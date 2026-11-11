/* Lapisan data: Supabase + cache + deteksi "Auto Pause". Dipakai toko dan admin. */
(function () {
  const cfg = window.APP_CONFIG || {};
  const live = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const sb = live ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const CACHE_KEY = 'store_cache_v1';
  const TIMEOUT = cfg.REQUEST_TIMEOUT || 9000;

  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(Object.assign(new Error('timeout'), { paused: true })), ms);
      Promise.resolve(promise).then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
    });
  }
  // Project ter-pause: request gagal jaringan/timeout/522/540/503, bukan error SQL biasa.
  function looksPaused(err) {
    if (!err) return false;
    if (err.paused) return true;
    const m = String(err.message || err).toLowerCase();
    return m.includes('failed to fetch') || m.includes('networkerror') || m.includes('timeout') ||
      m.includes('load failed') || m.includes('522') || m.includes('540') || m.includes('503');
  }
  function check(res) {
    if (res.error) {
      const e = new Error(res.error.message || 'Database error');
      e.paused = looksPaused(res.error) || res.status === 0 || res.status >= 520;
      throw e;
    }
    return res.data;
  }
  const q = (p) => withTimeout(p, TIMEOUT).then(check);

  function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) { return null; } }
  function writeCache(d) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: d })); } catch (e) { } }

  async function loadStore() {
    if (!live) {
      return { source: 'demo', data: { settings: DEMO.settings, categories: DEMO.categories, products: DEMO.products, banks: DEMO.banks } };
    }
    try {
      const [settings, categories, products, banks] = await Promise.all([
        q(sb.from('settings').select('*').eq('id', 1).maybeSingle()),
        q(sb.from('categories').select('*').order('sort').order('created_at')),
        q(sb.from('products').select('*').eq('active', true).order('sort').order('created_at')),
        q(sb.from('bank_accounts').select('*').order('sort').order('created_at'))
      ]);
      const data = { settings: settings || {}, categories, products, banks };
      writeCache(data);
      return { source: 'live', data };
    } catch (err) {
      const cached = readCache();
      if (looksPaused(err)) {
        if (cached) return { source: 'cache', data: cached.data, cachedAt: cached.at, error: err };
        return { source: 'paused', data: null, error: err };
      }
      if (cached) return { source: 'cache', data: cached.data, cachedAt: cached.at, error: err };
      throw err;
    }
  }

  async function createOrder(order) {
    if (!live) return { demo: true };
    const res = await withTimeout(sb.from('orders').insert(order), TIMEOUT);
    if (res.error) { const e = new Error(res.error.message); e.paused = looksPaused(res.error); throw e; }
    return { ok: true };
  }

  async function trackOrder(code, phone) {
    if (!live) return { demo: true };
    const res = await withTimeout(sb.rpc('track_order', { p_code: code, p_phone: phone }), TIMEOUT);
    if (res.error) { const e = new Error(res.error.message); e.paused = looksPaused(res.error); throw e; }
    return { ok: true, order: res.data };
  }

  async function ping() {
    if (!live) return { ok: false, reason: 'demo' };
    const t0 = performance.now();
    try {
      await q(sb.from('settings').select('id').eq('id', 1).maybeSingle());
      return { ok: true, ms: Math.round(performance.now() - t0) };
    } catch (e) { return { ok: false, paused: !!e.paused, reason: e.message }; }
  }

  window.API = { live, sb, cfg, loadStore, createOrder, trackOrder, ping, looksPaused, q, withTimeout, check };
})();
