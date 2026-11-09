/* Toko: rak hanger, viewer putar, keranjang, checkout (QRIS statis + bank manual). */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rp = (n) => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
  const safeUrl = (u) => /^(https?:|data:image\/|assets\/|\.\/|\/)/i.test(u || '') ? u : '';
  const toastEl = $('#toast'); let toastT;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2400); }

  const S = { settings: {}, categories: [], products: [], banks: [], cat: 'all', source: 'demo', cart: [], retryT: null };
  try { S.cart = JSON.parse(localStorage.getItem('cart_v1')) || []; } catch (e) { S.cart = []; }
  const saveCart = () => { try { localStorage.setItem('cart_v1', JSON.stringify(S.cart)); } catch (e) { } };
  const byId = (id) => S.products.find(p => String(p.id) === String(id));
  const imgsOf = (p) => (Array.isArray(p.images) ? p.images : []).filter(Boolean);
  const sizesOf = (p) => (Array.isArray(p.sizes) ? p.sizes : []);
  const totalStock = (p) => sizesOf(p).reduce((a, s) => a + (Number(s.stock) || 0), 0);
  // Foto hasil kompres admin: xxx_m.webp (utama) + xxx_t.webp (thumbnail kecil untuk rak/keranjang)
  const thumb = (u) => /_m\.(webp|png)(\?|$)/.test(u || '') ? u.replace(/_m\.(webp|png)/, '_t.$1') : u;
  const visible = () => S.products.filter(p => S.cat === 'all' || String(p.category_id) === String(S.cat));

  /* ---------- Banner status database / Auto Pause ---------- */
  function showBanner(html, warn, retry) {
    const b = $('#banner'); b.className = 'banner' + (warn ? ' warn' : '');
    b.innerHTML = `<span>${html}</span>` + (retry ? '<button id="retryBtn">Coba lagi</button>' : '');
    b.hidden = false;
    if (retry) $('#retryBtn').onclick = () => boot(true);
  }
  const hideBanner = () => { $('#banner').hidden = true; };

  /* ---------- Boot ---------- */
  async function boot(isRetry) {
    clearTimeout(S.retryT);
    if (isRetry) showBanner('Menghubungi database…', false, false);
    let res;
    try { res = await API.loadStore(); }
    catch (err) { res = { source: 'error', data: null, error: err }; }
    S.source = res.source;
    if (res.data) {
      S.settings = res.data.settings || {};
      S.categories = res.data.categories || [];
      S.products = res.data.products || [];
      S.banks = res.data.banks || [];
    }
    $('#skeleton').hidden = true;
    if (res.source === 'live') hideBanner();
    else if (res.source === 'demo') showBanner('MODE DEMO — data contoh. Isi <code>config.js</code> untuk menyambungkan Supabase.', false, false);
    else if (res.source === 'cache') {
      const d = res.cachedAt ? new Date(res.cachedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '';
      showBanner(`Database sedang tidur (Auto Pause Supabase). Menampilkan data tersimpan${d ? ' · ' + esc(d) : ''}. Pesanan tetap bisa dikirim lewat WhatsApp.`, true, true);
      S.retryT = setTimeout(() => boot(true), 45000);
    } else {
      showBanner('Database sedang tidur (Auto Pause Supabase). Admin perlu menekan “Restore project” di dashboard Supabase.', true, true);
      S.retryT = setTimeout(() => boot(true), 45000);
    }
    renderAll();
    if (res.source === 'paused' || res.source === 'error') renderPaused();
  }

  function renderPaused() {
    $('#track').innerHTML = `<div class="paused-card" style="margin:20px auto;width:min(520px,92vw)">
      <h3>Toko sedang bangun tidur</h3>
      <p>Server database gratis otomatis beristirahat bila lama tidak dikunjungi. Mohon coba lagi sebentar lagi, kami sedang membangunkannya.</p>
      <button class="btn primary" id="pauseRetry">Muat ulang</button></div>`;
    $('#pauseRetry').onclick = () => boot(true);
    $('#hint').hidden = true;
  }

  /* ---------- Render umum ---------- */
  function renderAll() {
    const s = S.settings || {};
    const name = s.store_name || 'Toko';
    $('#brandName').textContent = name; $('#footName').textContent = name;
    $('#year').textContent = new Date().getFullYear();
    if (s.tagline) { $('#heroTitle').innerHTML = esc(s.tagline).replace(/&lt;br\s*\/?&gt;/gi, '<br>'); }
    $('#aboutTitle').textContent = s.about_title || 'Tentang Kami';
    $('#aboutText').innerHTML = (s.about_text || '').split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('') || '<p class="muted">Belum ada deskripsi.</p>';
    // kontak
    const wa = String(s.whatsapp || '').replace(/\D/g, '');
    const mail = s.email || '';
    const waHref = wa ? `https://wa.me/${wa}` : '#';
    const mailHref = mail ? `mailto:${mail}` : '#';
    $('#navWa').href = waHref; $('#cWa').href = waHref; $('#cWaText').textContent = wa ? '+' + wa : 'Belum diisi';
    $('#navEmail').href = mailHref; $('#cEmail').href = mailHref; $('#cEmailText').textContent = mail || 'Belum diisi';
    const dc = $('#demoCard');
    if (s.demo_user && s.demo_pass) {
      dc.hidden = false; $('#demoUser').textContent = s.demo_user; $('#demoPass').textContent = s.demo_pass;
      $('#demoNote').textContent = s.demo_note || 'Gunakan akun berikut untuk mencoba panel admin. Akun demo memiliki akses terbatas.';
    } else dc.hidden = true;
    renderCats(); renderRack(); updateCart();
  }

  function renderCats() {
    const list = $('#variasiList');
    const items = [{ id: 'all', name: 'Semua Variasi' }, ...S.categories];
    list.innerHTML = items.map(c => `<button data-cat="${esc(c.id)}">${esc(c.name)}</button>`).join('') || '<div class="empty">Belum ada variasi</div>';
    $('#chips').innerHTML = items.map(c => `<button class="chip ${String(S.cat) === String(c.id) ? 'on' : ''}" data-cat="${esc(c.id)}" role="tab">${esc(c.id === 'all' ? 'Semua' : c.name)}</button>`).join('');
  }

  function renderRack() {
    const list = visible();
    const track = $('#track');
    $('#hint').hidden = false;
    if (!list.length) { track.innerHTML = '<div class="empty-rack">Belum ada produk di variasi ini.</div>'; updateArrows(); return; }
    track.innerHTML = list.map((p, i) => {
      const im = imgsOf(p)[0] || '';
      const sold = totalStock(p) <= 0;
      return `<button class="hg ${sold ? 'soldout' : ''}" style="--i:${i}" data-id="${esc(p.id)}" aria-label="${esc(p.name)}">
        <span class="hg-sway">
          <span class="hg-hook"><svg viewBox="0 0 120 62"><path d="M60 24v-6c0-6 9-6 9-13S58-2 53 4" stroke="#6a5a48" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M60 24L8 54h104z" stroke="#6a5a48" stroke-width="3.4" fill="none" stroke-linejoin="round"/></svg></span>
          <span class="hg-art"><img class="hg-img" src="${esc(safeUrl(thumb(im)))}" data-full="${esc(safeUrl(im))}" width="300" height="350" alt="" loading="lazy" decoding="async" draggable="false"><span class="hg-tag">${esc(p.name)}${sold ? ' · habis' : ''}</span></span>
          <span class="hg-name">${esc(p.name)}</span><span class="hg-price">${rp(p.price)}</span>
        </span></button>`;
    }).join('');
    track.scrollLeft = 0; $('#rackScroll').scrollLeft = 0;
    updateArrows();
  }

  function updateArrows() {
    const sc = $('#rackScroll');
    const overflow = sc.scrollWidth - sc.clientWidth > 8;
    $('#rackPrev').hidden = !overflow || sc.scrollLeft < 8;
    $('#rackNext').hidden = !overflow || sc.scrollLeft > sc.scrollWidth - sc.clientWidth - 8;
  }
  document.addEventListener('error', (e) => { const t = e.target; if (t && t.classList && t.classList.contains('hg-img') && t.dataset.full && t.src !== t.dataset.full) t.src = t.dataset.full; }, true);
  $('#rackScroll').addEventListener('scroll', updateArrows, { passive: true });
  window.addEventListener('resize', updateArrows);
  $('#rackPrev').onclick = () => $('#rackScroll').scrollBy({ left: -$('#rackScroll').clientWidth * .7, behavior: 'smooth' });
  $('#rackNext').onclick = () => $('#rackScroll').scrollBy({ left: $('#rackScroll').clientWidth * .7, behavior: 'smooth' });

  function setCat(id) {
    S.cat = id; renderCats(); renderRack();
    $('#menu').classList.remove('open'); $('#burger').setAttribute('aria-expanded', 'false');
    $$('.dd.open').forEach(d => d.classList.remove('open'));
    document.getElementById('beranda').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  document.addEventListener('click', (e) => {
    const cp = e.target.closest('[data-copytext]');
    if (cp) { const t = $(cp.dataset.copytext).textContent; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Disalin: ' + t)).catch(() => toast('Salin manual: ' + t)); return; }
    const c = e.target.closest('[data-cat]'); if (c) { setCat(c.dataset.cat); return; }
    const h = e.target.closest('.hg'); if (h) { openViewer(h.dataset.id); return; }
    const dd = e.target.closest('.dd-btn');
    if (dd && matchMedia('(max-width:760px)').matches) { dd.parentElement.classList.toggle('open'); return; }
    if (!e.target.closest('.dd')) $$('.dd.open').forEach(d => d.classList.remove('open'));
  });
  $('#burger').onclick = () => { const o = $('#menu').classList.toggle('open'); $('#burger').setAttribute('aria-expanded', o); };
  $$('.menu > a').forEach(a => a.addEventListener('click', () => { $('#menu').classList.remove('open'); $('#burger').setAttribute('aria-expanded', 'false'); }));

  /* ---------- Viewer ---------- */
  const V = { p: null, frame: 0, zoom: 1, size: null, qty: 1 };
  const LABELS4 = ['Depan', 'Samping Kanan', 'Belakang', 'Samping Kiri'];
  function viewLabel(i, n) { return n === 4 ? LABELS4[i] : `Tampak ${i + 1} / ${n}`; }

  function openViewer(id) {
    const p = byId(id); if (!p) return;
    V.p = p; V.frame = 0; V.zoom = 1; V.size = null; V.qty = 1;
    const imgs = imgsOf(p); imgs.forEach(u => { const i = new Image(); i.src = u; });
    const list = visible(); const pos = Math.max(0, list.findIndex(x => String(x.id) === String(id))) + 1;
    const sizes = sizesOf(p), sold = totalStock(p) <= 0;
    $('#vInfo').innerHTML = `
      <div class="idx">${String(pos).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}</div>
      <h2>${esc(p.name)}</h2>
      <div class="meta-row"><span class="swatch" style="background:${esc(p.color_hex || '#ccc')}"></span><span>${esc(p.color_name || '')}</span><span>·</span><b>${rp(p.price)}</b></div>
      ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}
      ${p.details ? `<p class="det">${esc(p.details)}</p>` : ''}
      <span class="lbl">Ukuran</span>
      <div class="sizes" id="vSizes">${sizes.map(s => `<button class="size" data-size="${esc(s.size)}" ${Number(s.stock) <= 0 ? 'disabled' : ''}>${esc(s.size)}</button>`).join('') || '<span class="muted">—</span>'}</div>
      <div class="stock-note" id="vStock"></div>
      ${sold ? '<div class="sold-out-pill">0 DARI ' + sizes.length + ' UKURAN TERSEDIA</div>' : `
      <div class="qty"><button id="qMinus" aria-label="Kurangi">−</button><span id="qVal">1</span><button id="qPlus" aria-label="Tambah">+</button></div>
      <div class="cta"><button class="btn primary block" id="vAdd">Tambah ke keranjang</button><button class="btn block" id="vBuy">Beli sekarang</button></div>`}`;
    $('#vDots').innerHTML = imgs.map((_, i) => `<i data-i="${i}"></i>`).join('');
    setFrame(0); applyZoom(1);
    $('#viewer').hidden = false; document.body.style.overflow = 'hidden';
    $('#viewer').scrollTop = 0;
  }
  function closeViewer() { $('#viewer').hidden = true; document.body.style.overflow = ''; V.p = null; }
  $('#viewerClose').onclick = closeViewer;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (!$('#viewer').hidden) closeViewer(); closeDrawer(); if (!$('#checkout').hidden) closeCheckout(); }
    if (!$('#viewer').hidden) { if (e.key === 'ArrowLeft') setFrame(V.frame - 1); if (e.key === 'ArrowRight') setFrame(V.frame + 1); }
  });

  function setFrame(i) {
    const imgs = imgsOf(V.p || { images: [] }); const n = imgs.length; if (!n) return;
    V.frame = ((i % n) + n) % n;
    const el = $('#vImg'); el.src = safeUrl(imgs[V.frame]); el.alt = V.p ? V.p.name : '';
    $('#vView').textContent = viewLabel(V.frame, n);
    $$('#vDots i').forEach((d, k) => d.classList.toggle('on', k === V.frame));
    $('#vPrev').hidden = $('#vNext').hidden = n < 2;
  }
  function applyZoom(z) { V.zoom = Math.max(1, Math.min(2.6, z)); $('#vWrap').style.transform = `scale(${V.zoom})`; }
  $('#vPrev').onclick = () => setFrame(V.frame - 1);
  $('#vNext').onclick = () => setFrame(V.frame + 1);
  $('#vZoomIn').onclick = () => applyZoom(V.zoom + .4);
  $('#vZoomOut').onclick = () => applyZoom(V.zoom - .4);
  $('#vDots').addEventListener('click', (e) => { const d = e.target.closest('i'); if (d) setFrame(+d.dataset.i); });
  const stage = $('#vStage'); let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    drag = { x: e.clientX, f: V.frame }; stage.classList.add('grabbing'); try { stage.setPointerCapture(e.pointerId); } catch (_) { }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag || !V.p) return;
    const n = imgsOf(V.p).length || 1; const step = Math.max(46, stage.clientWidth / (n * 1.6));
    setFrame(drag.f - Math.round((e.clientX - drag.x) / step));
  });
  const endDrag = () => { drag = null; stage.classList.remove('grabbing'); };
  stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('wheel', (e) => { e.preventDefault(); applyZoom(V.zoom + (e.deltaY < 0 ? .2 : -.2)); }, { passive: false });
  stage.addEventListener('dblclick', () => applyZoom(V.zoom > 1 ? 1 : 2));

  $('#vInfo').addEventListener('click', (e) => {
    const p = V.p; if (!p) return;
    const sz = e.target.closest('.size');
    if (sz && !sz.disabled) {
      V.size = sz.dataset.size; V.qty = 1; $('#qVal') && ($('#qVal').textContent = 1);
      $$('#vSizes .size').forEach(b => b.classList.toggle('on', b === sz));
      const st = Number((sizesOf(p).find(s => String(s.size) === V.size) || {}).stock) || 0;
      $('#vStock').textContent = st <= 3 ? `Sisa ${st} pcs` : '';
      return;
    }
    const maxQty = () => Number((sizesOf(p).find(s => String(s.size) === V.size) || {}).stock) || 99;
    if (e.target.id === 'qMinus') { V.qty = Math.max(1, V.qty - 1); $('#qVal').textContent = V.qty; }
    if (e.target.id === 'qPlus') { V.qty = Math.min(maxQty(), V.qty + 1); $('#qVal').textContent = V.qty; }
    if (e.target.id === 'vAdd' || e.target.id === 'vBuy') {
      if (!V.size) { $('#vStock').textContent = 'Pilih ukuran terlebih dahulu.'; return; }
      addToCart(p, V.size, V.qty);
      if (e.target.id === 'vBuy') { closeViewer(); openCheckout(); }
      else { closeViewer(); openDrawer(); }
    }
  });

  /* ---------- Keranjang ---------- */
  function stockFor(p, size) { return Number((sizesOf(p).find(s => String(s.size) === String(size)) || {}).stock) || 0; }
  function addToCart(p, size, qty) {
    const it = S.cart.find(c => String(c.id) === String(p.id) && c.size === size);
    const max = stockFor(p, size) || 99;
    if (it) it.qty = Math.min(max, it.qty + qty); else S.cart.push({ id: p.id, size, qty: Math.min(max, qty) });
    saveCart(); updateCart(true); toast('Ditambahkan ke keranjang');
  }
  function cartLines() { return S.cart.map(c => ({ ...c, p: byId(c.id) })).filter(l => l.p); }
  function cartTotal() { return cartLines().reduce((a, l) => a + l.p.price * l.qty, 0); }
  function updateCart(bump) {
    const n = cartLines().reduce((a, l) => a + l.qty, 0);
    const el = $('#cartCount'); el.textContent = n; el.style.display = n ? 'grid' : 'none';
    if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    const lines = cartLines();
    $('#cartItems').innerHTML = lines.length ? lines.map(l => `
      <div class="ci"><img src="${esc(safeUrl(thumb(imgsOf(l.p)[0] || '')))}" alt="" loading="lazy">
        <div><b>${esc(l.p.name)}</b><small>${esc(l.p.color_name || '')} · ${esc(l.size)} · ${rp(l.p.price)}</small>
          <div class="qty"><button data-q="-1" data-k="${esc(l.id)}|${esc(l.size)}">−</button><span>${l.qty}</span><button data-q="1" data-k="${esc(l.id)}|${esc(l.size)}">+</button></div></div>
        <button class="rm" data-rm="${esc(l.id)}|${esc(l.size)}">Hapus</button></div>`).join('') : '<div class="cart-empty">Keranjang masih kosong.</div>';
    $('#cartTotal').textContent = rp(cartTotal());
    $('#checkoutBtn').disabled = !lines.length;
  }
  $('#cartItems').addEventListener('click', (e) => {
    const q = e.target.closest('[data-q]'), r = e.target.closest('[data-rm]');
    const find = (k) => { const [id, size] = k.split('|'); return S.cart.find(c => String(c.id) === id && c.size === size); };
    if (q) { const it = find(q.dataset.k); if (it) { const p = byId(it.id); const max = stockFor(p, it.size) || 99; it.qty = Math.max(1, Math.min(max, it.qty + Number(q.dataset.q))); } }
    if (r) { const it = find(r.dataset.rm); S.cart = S.cart.filter(c => c !== it); }
    saveCart(); updateCart();
  });
  function openDrawer() { $('#drawer').classList.add('open'); $('#drawerBack').hidden = false; $('#drawer').setAttribute('aria-hidden', 'false'); }
  function closeDrawer() { $('#drawer').classList.remove('open'); $('#drawerBack').hidden = true; $('#drawer').setAttribute('aria-hidden', 'true'); }
  $('#cartBtn').onclick = openDrawer; $('#drawerClose').onclick = closeDrawer; $('#drawerBack').onclick = closeDrawer;
  $('#checkoutBtn').onclick = () => { closeDrawer(); openCheckout(); };

  /* ---------- Checkout ---------- */
  const C = { step: 1, form: { name: '', phone: '', address: '', note: '' }, tab: 'qris', code: '' };
  function openCheckout() {
    if (!cartLines().length) { toast('Keranjang masih kosong'); return; }
    C.step = 1; C.tab = (S.settings.qris_url ? 'qris' : 'bank');
    $('#checkout').hidden = false; document.body.style.overflow = 'hidden'; $('#checkout').scrollTop = 0; renderCheckout();
  }
  function closeCheckout() { $('#checkout').hidden = true; document.body.style.overflow = ''; }
  $('#coClose').onclick = closeCheckout;

  const steps = (n) => `<div class="steps"><span ${n === 1 ? 'class="x"' : ''}>${n === 1 ? '<b>1 · Data</b>' : '1 · Data'}</span><span>${n === 2 ? '<b>2 · Pembayaran</b>' : '2 · Pembayaran'}</span><span>${n === 3 ? '<b>3 · Selesai</b>' : '3 · Selesai'}</span></div>`;
  function summaryHtml() {
    return cartLines().map(l => `<div class="sum-line"><span>${esc(l.p.name)}<small>${esc(l.size)} × ${l.qty}</small></span><b>${rp(l.p.price * l.qty)}</b></div>`).join('') +
      `<div class="sum-total"><span>Total</span><span>${rp(cartTotal())}</span></div>`;
  }
  function renderCheckout() {
    const el = $('#coBody');
    if (C.step === 1) {
      el.innerHTML = `<h2>Checkout</h2>${steps(1)}
      <div class="co-grid"><div class="panel"><h4>Data penerima</h4>
        <div class="field"><label for="fName">Nama lengkap</label><input id="fName" autocomplete="name" value="${esc(C.form.name)}"></div>
        <div class="field"><label for="fPhone">Nomor WhatsApp</label><input id="fPhone" inputmode="tel" autocomplete="tel" placeholder="08xxxxxxxxxx" value="${esc(C.form.phone)}"></div>
        <div class="field"><label for="fAddr">Alamat pengiriman</label><textarea id="fAddr" rows="3" autocomplete="street-address">${esc(C.form.address)}</textarea></div>
        <div class="field"><label for="fNote">Catatan (opsional)</label><input id="fNote" value="${esc(C.form.note)}"></div>
        <div class="hp" aria-hidden="true"><label>Website<input id="fHp" tabindex="-1" autocomplete="off"></label></div>
        <div id="fErr" class="stock-note"></div>
        <button class="btn primary block" id="toPay">Lanjut ke pembayaran</button></div>
      <div class="panel"><h4>Ringkasan pesanan</h4>${summaryHtml()}</div></div>`;
      $('#toPay').onclick = () => {
        C.form = { name: $('#fName').value.trim(), phone: $('#fPhone').value.trim(), address: $('#fAddr').value.trim(), note: $('#fNote').value.trim() };
        const err = !C.form.name ? 'Nama wajib diisi.' : C.form.phone.replace(/\D/g, '').length < 8 ? 'Nomor WhatsApp tidak valid.' : C.form.address.length < 8 ? 'Alamat terlalu singkat.' : '';
        if (err) { $('#fErr').textContent = err; return; }
        C.hp = ($('#fHp') || {}).value || ''; C.t0 = Date.now();
        C.step = 2; renderCheckout(); $('#checkout').scrollTop = 0;
      };
    } else if (C.step === 2) {
      const qris = safeUrl(S.settings.qris_url);
      const banks = S.banks || [];
      const pane = C.tab === 'qris'
        ? `<div class="qris">${qris ? `<img src="${esc(qris)}" alt="QRIS toko">` : '<div class="qris-empty">QRIS belum diunggah oleh admin.<br>Gunakan transfer bank.</div>'}</div><p class="muted" style="font-size:13px;text-align:center">Scan dengan aplikasi e-wallet / mobile banking, bayar <b>${rp(cartTotal())}</b>.</p>`
        : (banks.length ? banks.map(b => `<div class="bank"><div><small>${esc(b.bank_name)}</small><span class="no">${esc(b.account_number)}</span><small style="display:block">a.n. ${esc(b.account_name)}</small></div><button class="copy" data-copy="${esc(b.account_number)}">Salin</button></div>`).join('') : '<div class="notice">Data rekening belum diisi admin.</div>');
      el.innerHTML = `<h2>Pembayaran</h2>${steps(2)}
      <div class="co-grid"><div class="panel"><h4>Metode pembayaran</h4>
        <div class="pay-tabs"><button data-tab="qris" class="${C.tab === 'qris' ? 'on' : ''}">QRIS</button><button data-tab="bank" class="${C.tab === 'bank' ? 'on' : ''}">Transfer Bank</button><button disabled>Payment Gateway<span class="soon">SEGERA</span></button></div>
        ${pane}<div class="notice" style="margin-top:14px">${esc(S.settings.payment_note || 'Setelah membayar, tekan tombol konfirmasi di bawah.')}</div>
        <div id="payErr" class="stock-note"></div>
        <button class="btn primary block" id="paid">Saya sudah membayar</button>
        <button class="btn block" id="back" style="margin-top:10px;border-color:var(--line)">Kembali</button></div>
      <div class="panel"><h4>Ringkasan pesanan</h4>${summaryHtml()}<div class="notice" style="margin-top:16px;margin-bottom:0">Kirim ke: <b>${esc(C.form.name)}</b><br>${esc(C.form.address)}</div></div></div>`;
      $$('[data-tab]', el).forEach(b => b.onclick = () => { C.tab = b.dataset.tab; renderCheckout(); });
      $$('[data-copy]', el).forEach(b => b.onclick = () => { (navigator.clipboard ? navigator.clipboard.writeText(b.dataset.copy) : Promise.reject()).then(() => toast('Nomor rekening disalin')).catch(() => toast('Salin manual: ' + b.dataset.copy)); });
      $('#back').onclick = () => { C.step = 1; renderCheckout(); };
      $('#paid').onclick = submitOrder;
    } else {
      const wa = String(S.settings.whatsapp || '').replace(/\D/g, '');
      const lines = cartLinesSnapshot.map(l => `• ${l.name} (${l.size}) x${l.qty} = ${rp(l.price * l.qty)}`).join('\n');
      const msg = `Halo, saya ingin konfirmasi pembayaran.\nKode pesanan: ${C.code}\nNama: ${C.form.name}\nWA: ${C.form.phone}\nAlamat: ${C.form.address}\n\n${lines}\n\nTotal: ${rp(totalSnapshot)}\nMetode: ${C.tab === 'qris' ? 'QRIS' : 'Transfer bank'}`;
      el.innerHTML = `${steps(3)}<div class="done"><div class="ok">✓</div><h2>Terima kasih, ${esc(C.form.name.split(' ')[0])}!</h2>
        <p class="muted">${C.saved ? 'Pesanan Anda sudah tercatat.' : 'Pesanan belum tersimpan di sistem (database sedang tidur), tetapi Anda bisa mengirim konfirmasi langsung ke admin.'} Kirim bukti pembayaran lewat WhatsApp agar segera diproses.</p>
        <div class="code">${esc(C.code)}</div><br>
        ${wa ? `<a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(msg)}">Konfirmasi via WhatsApp</a>` : '<p class="muted">Nomor WhatsApp admin belum diisi.</p>'}
        <p style="margin-top:20px"><button class="btn" id="doneClose">Tutup</button></p></div>`;
      $('#doneClose').onclick = closeCheckout;
    }
  }
  let cartLinesSnapshot = [], totalSnapshot = 0;
  async function submitOrder() {
    const btn = $('#paid'); const err = $('#payErr');
    // Penjaga sisi browser (penghalang bot sederhana; penjaga utama ada di database)
    const recent = (() => { try { return (JSON.parse(localStorage.getItem('ord_t')) || []).filter(t => Date.now() - t < 600000); } catch (e) { return []; } })();
    if (recent.length >= 3) { err.textContent = 'Terlalu banyak pesanan dalam waktu singkat. Coba lagi beberapa menit lagi.'; return; }
    if (C.hp) { S.cart = []; saveCart(); updateCart(); C.code = 'MG-' + Math.random().toString(36).slice(2, 8).toUpperCase(); C.saved = true; cartLinesSnapshot = []; totalSnapshot = 0; C.step = 3; renderCheckout(); return; }   // honeypot terisi = bot
    if (Date.now() - (C.t0 || 0) < 2500) { err.textContent = 'Mohon periksa kembali pesanan Anda, lalu tekan sekali lagi.'; return; }
    btn.disabled = true; btn.textContent = 'Memproses…'; err.textContent = '';
    const lines = cartLines();
    cartLinesSnapshot = lines.map(l => ({ id: l.id, name: l.p.name, size: l.size, qty: l.qty, price: l.p.price, color: l.p.color_name || '' }));
    totalSnapshot = cartTotal();
    C.code = 'MG-' + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).slice(2, 4).toUpperCase();
    C.saved = false;
    try {
      const r = await API.createOrder({
        order_code: C.code, customer_name: C.form.name, phone: C.form.phone, address: C.form.address, note: C.form.note || null,
        items: cartLinesSnapshot, total: totalSnapshot, payment_method: C.tab === 'qris' ? 'qris' : 'bank'
      });
      C.saved = !!r.ok || !!r.demo;
    } catch (e) {
      if (!e.paused) {   // ditolak server (mis. batas spam): tampilkan alasannya, jangan lanjut
        err.textContent = e.message || 'Pesanan ditolak.'; btn.disabled = false; btn.textContent = 'Saya sudah membayar'; return;
      }
      C.saved = false;   // database tidur: tetap bisa konfirmasi lewat WhatsApp
    }
    try { localStorage.setItem('ord_t', JSON.stringify([...recent, Date.now()])); } catch (e) { }
    S.cart = []; saveCart(); updateCart();
    C.step = 3; renderCheckout(); $('#checkout').scrollTop = 0;
  }

  /* ---------- Scroll spy sederhana ---------- */
  const spy = new IntersectionObserver((en) => en.forEach(e => { if (e.isIntersecting) $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
  ['beranda', 'tentang'].forEach(id => spy.observe(document.getElementById(id)));

  boot(false);
})();
