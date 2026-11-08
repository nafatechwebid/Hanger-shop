/* Panel admin: produk, variasi (maks 10), toko & kontak, QRIS + bank (maks 5), pesanan, status DB. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rp = (n) => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
  const safeUrl = (u) => /^(https?:|data:image\/|assets\/)/i.test(u || '') ? u : '';
  const toastEl = $('#toast'); let tt;
  const toast = (m) => { toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => toastEl.classList.remove('show'), 2600); };
  const sb = API.sb, q = API.q, BUCKET = (API.cfg && API.cfg.STORAGE_BUCKET) || 'store';
  const MAX_CATS = 10, MAX_BANKS = 5;
  let tab = 'products';
  const D = { cats: [], products: [], banks: [], settings: {}, orders: [] };

  const __b = document.getElementById('boot'); if (__b) __b.remove();
  if (!API.live) { $('#noconf').hidden = false; return; }

  /* ---------- Auth ---------- */
  async function start() {
    try {
      const { data } = await API.withTimeout(sb.auth.getSession(), 9000);
      if (data && data.session) showApp(); else $('#login').hidden = false;
    } catch (e) { $('#login').hidden = false; $('#lErr').textContent = pausedMsg(e); }
  }
  const pausedMsg = (e) => (e && e.paused) || API.looksPaused(e) ? 'Project Supabase kemungkinan sedang ter-pause. Buka dashboard Supabase lalu klik “Restore project”.' : (e.message || 'Terjadi kesalahan');
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); $('#lErr').textContent = '';
    try {
      const r = await API.withTimeout(sb.auth.signInWithPassword({ email: $('#lEmail').value.trim(), password: $('#lPass').value }), 12000);
      if (r.error) { $('#lErr').textContent = 'Email atau kata sandi salah.'; return; }
      $('#login').hidden = true; showApp();
    } catch (err) { $('#lErr').textContent = pausedMsg(err); }
  });
  $('#logout').onclick = async () => { await sb.auth.signOut(); location.reload(); };
  function showApp() { $('#app').hidden = false; render(); }

  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    tab = b.dataset.tab; $$('#tabs button').forEach(x => x.classList.toggle('on', x === b)); render();
  });

  async function render() {
    const v = $('#view'); v.innerHTML = '<p class="muted">Memuat…</p>';
    try {
      if (tab === 'products') await viewProducts(v);
      else if (tab === 'cats') await viewCats(v);
      else if (tab === 'store') await viewStore(v);
      else if (tab === 'pay') await viewPay(v);
      else if (tab === 'orders') await viewOrders(v);
      else viewHealth(v);
    } catch (err) { v.innerHTML = `<div class="tip">${esc(pausedMsg(err))}</div>`; }
  }

  /* ---------- Modal form ---------- */
  const openForm = (html) => { $('#formBody').innerHTML = html; $('#formModal').hidden = false; $('#formModal').scrollTop = 0; document.body.style.overflow = 'hidden'; };
  const closeForm = () => { $('#formModal').hidden = true; document.body.style.overflow = ''; };
  $('#formClose').onclick = closeForm;
  const saveBtn = (b, on) => { b.disabled = on; b.textContent = on ? 'Menyimpan…' : 'Simpan'; };
  const dbErr = (e) => toast(e.message && /Maksimal/i.test(e.message) ? e.message : pausedMsg(e));

  async function upload(file, folder) {
    if (!/^image\//.test(file.type)) throw new Error('File harus berupa gambar');
    if (file.size > 5 * 1024 * 1024) throw new Error('Maksimal 5 MB per gambar');
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const r = await API.withTimeout(sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000' }), 30000);
    if (r.error) throw new Error(r.error.message);
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  /* ---------- PRODUK ---------- */
  async function viewProducts(v) {
    [D.cats, D.products] = await Promise.all([
      q(sb.from('categories').select('*').order('sort').order('created_at')),
      q(sb.from('products').select('*').order('sort').order('created_at'))
    ]);
    const cname = (id) => (D.cats.find(c => c.id === id) || {}).name || '—';
    v.innerHTML = `<div class="ad-head"><div><h2>Produk</h2><p>${D.products.length} produk. Setiap produk menjadi satu hanger di rak.</p></div><button class="btn primary sm" id="addP">+ Produk baru</button></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Nama</th><th>Variasi</th><th>Harga</th><th>Stok</th><th>Status</th><th></th></tr></thead><tbody>
    ${D.products.map(p => { const st = (p.sizes || []).reduce((a, s) => a + (+s.stock || 0), 0); return `<tr><td><img src="${esc(safeUrl((p.images || [])[0] || ''))}" alt=""></td><td><b>${esc(p.name)}</b><br><small class="muted">${esc(p.color_name || '')}</small></td><td>${esc(cname(p.category_id))}</td><td>${rp(p.price)}</td><td>${st}</td><td><span class="pill ${p.active ? 'ok' : 'warn'}">${p.active ? 'tampil' : 'sembunyi'}</span></td><td><div class="acts"><button class="btn sm" data-edit="${p.id}">Ubah</button><button class="btn sm danger" data-del="${p.id}">Hapus</button></div></td></tr>`; }).join('') || '<tr><td colspan="7" class="muted">Belum ada produk.</td></tr>'}
    </tbody></table></div>`;
    $('#addP').onclick = () => productForm(null);
    v.onclick = async (e) => {
      const ed = e.target.closest('[data-edit]'), de = e.target.closest('[data-del]');
      if (ed) productForm(D.products.find(p => p.id === ed.dataset.edit));
      if (de && confirm('Hapus produk ini?')) { try { await q(sb.from('products').delete().eq('id', de.dataset.del)); toast('Produk dihapus'); render(); } catch (err) { dbErr(err); } }
    };
  }

  function productForm(p) {
    const st = { images: [...((p && p.images) || [])], sizes: ((p && p.sizes) || [{ size: 'S', stock: 0 }, { size: 'M', stock: 0 }, { size: 'L', stock: 0 }]).map(s => ({ ...s })) };
    const paint = () => {
      $('#imgList').innerHTML = st.images.map((u, i) => `<div class="im"><img src="${esc(safeUrl(u))}" alt=""><small>${['Depan', 'Kanan', 'Belakang', 'Kiri'][i] || 'Tampak ' + (i + 1)}</small><div class="mv"><button type="button" data-mv="${i}|-1">←</button><button type="button" data-mv="${i}|1">→</button><button type="button" data-rmi="${i}">✕</button></div></div>`).join('') || '<small class="muted">Belum ada gambar.</small>';
      $('#sizeList').innerHTML = st.sizes.map((s, i) => `<div class="sr"><input data-sz="${i}" value="${esc(s.size)}" placeholder="Ukuran"><input data-st="${i}" type="number" min="0" value="${+s.stock || 0}" placeholder="Stok"><button type="button" class="btn sm danger" data-rms="${i}">✕</button></div>`).join('');
    };
    openForm(`<h3>${p ? 'Ubah produk' : 'Produk baru'}</h3>
    <form id="pf">
      <div class="field"><label>Nama baju</label><input id="pName" required maxlength="80" value="${esc(p ? p.name : '')}"></div>
      <div class="grid2">
        <div class="field"><label>Variasi</label><select id="pCat"><option value="">— tanpa variasi —</option>${D.cats.map(c => `<option value="${c.id}" ${p && p.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Harga (Rp)</label><input id="pPrice" type="number" min="0" step="1000" required value="${p ? p.price : ''}"></div>
        <div class="field"><label>Nama warna</label><input id="pColor" value="${esc(p ? p.color_name : '')}" placeholder="Vintage Blue"></div>
        <div class="field"><label>Kode warna</label><input id="pHex" type="color" value="${esc(p && p.color_hex ? p.color_hex : '#cccccc')}"></div>
      </div>
      <div class="field"><label>Deskripsi</label><textarea id="pDesc" rows="3">${esc(p ? p.description : '')}</textarea></div>
      <div class="field"><label>Bahan / spesifikasi</label><input id="pDet" value="${esc(p ? p.details : '')}" placeholder="485GSM fleece · 75% cotton · oversized"></div>
      <div class="card"><h4>Gambar (urutan = urutan putar)</h4>
        <div class="tip">Unggah foto dengan latar transparan (PNG/WebP) tanpa hanger. Urutan disarankan: <b>Depan → Samping kanan → Belakang → Samping kiri</b>. Gambar pertama dipakai di rak.</div>
        <div class="imgs" id="imgList"></div>
        <input type="file" id="pFiles" accept="image/*" multiple>
        <div id="upStat" class="small muted"></div></div>
      <div class="card"><h4>Ukuran &amp; stok</h4><div class="sizes-ed" id="sizeList"></div><button type="button" class="btn sm" id="addSize">+ Ukuran</button></div>
      <div class="grid2"><div class="field"><label>Urutan di rak (kecil = kiri)</label><input id="pSort" type="number" value="${p ? p.sort : 0}"></div>
        <div class="field"><label>Status</label><select id="pActive"><option value="1" ${!p || p.active ? 'selected' : ''}>Tampil di toko</option><option value="0" ${p && !p.active ? 'selected' : ''}>Sembunyikan</option></select></div></div>
      <button class="btn primary block" type="submit" id="pSave">Simpan</button></form>`);
    paint();
    const fm = $('#formBody');
    fm.onclick = (e) => {
      const mv = e.target.closest('[data-mv]'), rm = e.target.closest('[data-rmi]'), rs = e.target.closest('[data-rms]');
      if (mv) { const [i, d] = mv.dataset.mv.split('|').map(Number), j = i + d; if (j >= 0 && j < st.images.length) { [st.images[i], st.images[j]] = [st.images[j], st.images[i]]; paint(); } }
      if (rm) { st.images.splice(+rm.dataset.rmi, 1); paint(); }
      if (rs) { st.sizes.splice(+rs.dataset.rms, 1); paint(); }
      if (e.target.id === 'addSize') { st.sizes.push({ size: '', stock: 0 }); paint(); }
    };
    fm.oninput = (e) => {
      if (e.target.dataset.sz !== undefined) st.sizes[+e.target.dataset.sz].size = e.target.value.toUpperCase();
      if (e.target.dataset.st !== undefined) st.sizes[+e.target.dataset.st].stock = Math.max(0, parseInt(e.target.value) || 0);
    };
    $('#pFiles').onchange = async (e) => {
      const files = [...e.target.files]; if (!files.length) return;
      for (let i = 0; i < files.length; i++) {
        $('#upStat').textContent = `Mengunggah ${i + 1}/${files.length}…`;
        try { st.images.push(await upload(files[i], 'products')); paint(); } catch (err) { toast(err.message); }
      }
      $('#upStat').textContent = ''; e.target.value = '';
    };
    $('#pf').onsubmit = async (e) => {
      e.preventDefault();
      const sizes = st.sizes.filter(s => s.size.trim()).map(s => ({ size: s.size.trim(), stock: +s.stock || 0 }));
      const row = { name: $('#pName').value.trim(), category_id: $('#pCat').value || null, price: +$('#pPrice').value || 0, color_name: $('#pColor').value.trim(), color_hex: $('#pHex').value, description: $('#pDesc').value.trim(), details: $('#pDet').value.trim(), sizes, images: st.images, sort: parseInt($('#pSort').value) || 0, active: $('#pActive').value === '1' };
      const b = $('#pSave'); saveBtn(b, true);
      try { await q(p ? sb.from('products').update(row).eq('id', p.id) : sb.from('products').insert(row)); toast('Produk tersimpan'); closeForm(); render(); }
      catch (err) { dbErr(err); saveBtn(b, false); }
    };
  }

  /* ---------- VARIASI ---------- */
  async function viewCats(v) {
    D.cats = await q(sb.from('categories').select('*').order('sort').order('created_at'));
    v.innerHTML = `<div class="ad-head"><div><h2>Variasi</h2><p>Menu “Variasi” di toko. Maksimal ${MAX_CATS} (${D.cats.length}/${MAX_CATS} terpakai).</p></div><button class="btn primary sm" id="addC" ${D.cats.length >= MAX_CATS ? 'disabled' : ''}>+ Variasi</button></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nama</th><th>Urutan</th><th></th></tr></thead><tbody>${D.cats.map(c => `<tr><td><b>${esc(c.name)}</b></td><td>${c.sort}</td><td><div class="acts"><button class="btn sm" data-edit="${c.id}">Ubah</button><button class="btn sm danger" data-del="${c.id}">Hapus</button></div></td></tr>`).join('') || '<tr><td colspan="3" class="muted">Belum ada variasi.</td></tr>'}</tbody></table></div>`;
    const form = (c) => {
      openForm(`<h3>${c ? 'Ubah' : 'Tambah'} variasi</h3><form id="cf"><div class="field"><label>Nama (mis. Hoodie, Kemeja, Jaket)</label><input id="cName" required maxlength="40" value="${esc(c ? c.name : '')}"></div><div class="field"><label>Urutan</label><input id="cSort" type="number" value="${c ? c.sort : D.cats.length + 1}"></div><button class="btn primary block" id="cSave" type="submit">Simpan</button></form>`);
      $('#cf').onsubmit = async (e) => {
        e.preventDefault(); const row = { name: $('#cName').value.trim(), slug: $('#cName').value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'), sort: parseInt($('#cSort').value) || 0 };
        const b = $('#cSave'); saveBtn(b, true);
        try { await q(c ? sb.from('categories').update(row).eq('id', c.id) : sb.from('categories').insert(row)); toast('Tersimpan'); closeForm(); render(); } catch (err) { dbErr(err); saveBtn(b, false); }
      };
    };
    $('#addC').onclick = () => form(null);
    v.onclick = async (e) => {
      const ed = e.target.closest('[data-edit]'), de = e.target.closest('[data-del]');
      if (ed) form(D.cats.find(c => c.id === ed.dataset.edit));
      if (de && confirm('Hapus variasi ini? Produk di dalamnya tidak ikut terhapus.')) { try { await q(sb.from('categories').delete().eq('id', de.dataset.del)); render(); } catch (err) { dbErr(err); } }
    };
  }

  /* ---------- TOKO & KONTAK ---------- */
  async function viewStore(v) {
    D.settings = (await q(sb.from('settings').select('*').eq('id', 1).maybeSingle())) || {};
    const s = D.settings;
    v.innerHTML = `<div class="ad-head"><div><h2>Toko &amp; Kontak</h2><p>Teks di beranda, tentang kami, dan kontak.</p></div></div>
    <form id="sf" class="card">
      <div class="field"><label>Nama toko</label><input id="sName" maxlength="60" value="${esc(s.store_name)}"></div>
      <div class="field"><label>Judul beranda (boleh 2 baris, pisahkan dengan Enter)</label><textarea id="sTag" rows="2">${esc(s.tagline)}</textarea></div>
      <div class="field"><label>Judul “Tentang Kami”</label><input id="sAT" value="${esc(s.about_title)}"></div>
      <div class="field"><label>Isi “Tentang Kami” (paragraf dipisah baris kosong)</label><textarea id="sAbout" rows="6">${esc(s.about_text)}</textarea></div>
      <div class="grid2"><div class="field"><label>Email admin</label><input id="sMail" type="email" value="${esc(s.email)}"></div>
      <div class="field"><label>WhatsApp admin (628…, tanpa +)</label><input id="sWa" inputmode="numeric" value="${esc(s.whatsapp)}" placeholder="6281234567890"></div></div>
      <button class="btn primary" id="sSave" type="submit">Simpan</button></form>`;
    $('#sf').onsubmit = async (e) => {
      e.preventDefault(); const b = $('#sSave'); saveBtn(b, true);
      let wa = $('#sWa').value.replace(/\D/g, ''); if (wa.startsWith('0')) wa = '62' + wa.slice(1);
      try {
        await q(sb.from('settings').upsert({ id: 1, store_name: $('#sName').value.trim(), tagline: $('#sTag').value.trim().replace(/\n/g, '<br>').replace(/<(?!br>)[^>]*>/g, ''), about_title: $('#sAT').value.trim(), about_text: $('#sAbout').value, email: $('#sMail').value.trim(), whatsapp: wa, updated_at: new Date().toISOString() }));
        toast('Tersimpan'); saveBtn(b, false);
      } catch (err) { dbErr(err); saveBtn(b, false); }
    };
  }

  /* ---------- PEMBAYARAN: QRIS + BANK ---------- */
  async function viewPay(v) {
    [D.settings, D.banks] = await Promise.all([
      q(sb.from('settings').select('*').eq('id', 1).maybeSingle()).then(x => x || {}),
      q(sb.from('bank_accounts').select('*').order('sort').order('created_at'))
    ]);
    const s = D.settings;
    v.innerHTML = `<div class="ad-head"><div><h2>Pembayaran</h2><p>Tahap demo: QRIS statis + transfer bank. Payment gateway menyusul saat produksi.</p></div></div>
    <div class="card"><h4>QRIS statis toko</h4>
      ${s.qris_url ? `<div class="qpreview"><img src="${esc(safeUrl(s.qris_url))}" alt="QRIS"></div>` : '<p class="muted small">Belum ada QRIS.</p>'}
      <input type="file" id="qFile" accept="image/*"> ${s.qris_url ? '<button class="btn sm danger" id="qDel">Hapus QRIS</button>' : ''}
      <div class="field" style="margin-top:14px"><label>Catatan pembayaran (tampil di checkout)</label><input id="payNote" value="${esc(s.payment_note)}"><button class="btn sm" id="saveNote" style="margin-top:8px;align-self:start">Simpan catatan</button></div></div>
    <div class="ad-head"><div><h2 style="font-size:28px">Rekening bank</h2><p>Maksimal ${MAX_BANKS} (${D.banks.length}/${MAX_BANKS} terpakai).</p></div><button class="btn primary sm" id="addB" ${D.banks.length >= MAX_BANKS ? 'disabled' : ''}>+ Rekening</button></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Bank</th><th>No. rekening</th><th>Atas nama</th><th></th></tr></thead><tbody>${D.banks.map(b => `<tr><td><b>${esc(b.bank_name)}</b></td><td>${esc(b.account_number)}</td><td>${esc(b.account_name)}</td><td><div class="acts"><button class="btn sm" data-edit="${b.id}">Ubah</button><button class="btn sm danger" data-del="${b.id}">Hapus</button></div></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Belum ada rekening.</td></tr>'}</tbody></table></div>`;
    $('#qFile').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const url = await upload(f, 'qris'); await q(sb.from('settings').upsert({ id: 1, qris_url: url })); toast('QRIS diperbarui'); render(); } catch (err) { toast(err.message); }
    };
    if ($('#qDel')) $('#qDel').onclick = async () => { try { await q(sb.from('settings').upsert({ id: 1, qris_url: null })); render(); } catch (err) { dbErr(err); } };
    $('#saveNote').onclick = async () => { try { await q(sb.from('settings').upsert({ id: 1, payment_note: $('#payNote').value.trim() })); toast('Tersimpan'); } catch (err) { dbErr(err); } };
    const form = (b) => {
      openForm(`<h3>${b ? 'Ubah' : 'Tambah'} rekening</h3><form id="bf"><div class="field"><label>Nama bank</label><input id="bBank" required maxlength="40" value="${esc(b ? b.bank_name : '')}"></div><div class="field"><label>Nomor rekening</label><input id="bNo" required inputmode="numeric" maxlength="40" value="${esc(b ? b.account_number : '')}"></div><div class="field"><label>Atas nama</label><input id="bName" required maxlength="80" value="${esc(b ? b.account_name : '')}"></div><button class="btn primary block" id="bSave" type="submit">Simpan</button></form>`);
      $('#bf').onsubmit = async (e) => {
        e.preventDefault(); const row = { bank_name: $('#bBank').value.trim(), account_number: $('#bNo').value.trim(), account_name: $('#bName').value.trim(), sort: b ? b.sort : D.banks.length + 1 };
        const bt = $('#bSave'); saveBtn(bt, true);
        try { await q(b ? sb.from('bank_accounts').update(row).eq('id', b.id) : sb.from('bank_accounts').insert(row)); toast('Tersimpan'); closeForm(); render(); } catch (err) { dbErr(err); saveBtn(bt, false); }
      };
    };
    $('#addB').onclick = () => form(null);
    v.onclick = async (e) => {
      const ed = e.target.closest('[data-edit]'), de = e.target.closest('[data-del]');
      if (ed) form(D.banks.find(x => x.id === ed.dataset.edit));
      if (de && confirm('Hapus rekening ini?')) { try { await q(sb.from('bank_accounts').delete().eq('id', de.dataset.del)); render(); } catch (err) { dbErr(err); } }
    };
  }

  /* ---------- PESANAN ---------- */
  async function viewOrders(v) {
    D.orders = await q(sb.from('orders').select('*').order('created_at', { ascending: false }).limit(100));
    v.innerHTML = `<div class="ad-head"><div><h2>Pesanan</h2><p>${D.orders.length} pesanan terakhir. Kurangi stok produk secara manual setelah pembayaran dikonfirmasi.</p></div><button class="btn sm" id="rf">Muat ulang</button></div>` +
      (D.orders.map(o => `<div class="order"><div class="top"><div><span class="code pill">${esc(o.order_code)}</span> <small class="muted">${new Date(o.created_at).toLocaleString('id-ID')}</small></div>
      <select data-st="${o.id}">${['menunggu', 'dibayar', 'dikirim', 'selesai', 'batal'].map(s => `<option ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <dl class="kv"><dt>Pembeli</dt><dd>${esc(o.customer_name)} · <a href="https://wa.me/${esc(String(o.phone).replace(/\D/g, '').replace(/^0/, '62'))}" target="_blank" rel="noopener">${esc(o.phone)}</a></dd><dt>Alamat</dt><dd>${esc(o.address)}</dd>${o.note ? `<dt>Catatan</dt><dd>${esc(o.note)}</dd>` : ''}<dt>Metode</dt><dd>${esc(o.payment_method || '-')}</dd></dl>
      <ul>${(o.items || []).map(i => `<li>${esc(i.name)} (${esc(i.size)}) × ${+i.qty} — ${rp(i.price * i.qty)}</li>`).join('')}</ul><b>Total ${rp(o.total)}</b></div>`).join('') || '<p class="muted">Belum ada pesanan.</p>');
    $('#rf').onclick = render;
    v.onchange = async (e) => { const s = e.target.closest('[data-st]'); if (s) { try { await q(sb.from('orders').update({ status: s.value }).eq('id', s.dataset.st)); toast('Status diperbarui'); } catch (err) { dbErr(err); } } };
  }

  /* ---------- STATUS DB / AUTO PAUSE ---------- */
  function viewHealth(v) {
    v.innerHTML = `<div class="ad-head"><div><h2>Status Database</h2><p>Auto Pause Supabase (paket gratis).</p></div></div>
    <div class="card"><h4>Cek koneksi</h4><p id="pingOut" class="muted">Belum dicek.</p><button class="btn sm primary" id="pingBtn" style="margin-top:10px">Tes sekarang</button></div>
    <div class="card"><h4>Cara kerja anti-pause</h4>
      <p class="muted small" style="margin-bottom:10px">Project Supabase gratis otomatis <b>ter-pause setelah 7 hari tanpa aktivitas</b>. Dua perlindungan sudah disiapkan:</p>
      <ol class="small" style="margin-left:18px;line-height:1.8">
        <li><b>Keep-alive otomatis</b> — GitHub Actions (<code>.github/workflows/keepalive.yml</code>) mengakses database tiap 3 hari. Aktifkan dengan menambah secret <code>SUPABASE_URL</code> dan <code>SUPABASE_ANON_KEY</code> di repo GitHub.</li>
        <li><b>Tahan pause</b> — bila tetap ter-pause, toko menampilkan produk dari cache browser pengunjung + banner, dan pesanan bisa dikirim lewat WhatsApp.</li>
      </ol>
      <p class="small muted" style="margin-top:10px">Bila sudah ter-pause: Dashboard Supabase → pilih project → <b>Restore project</b>. Pemulihan butuh beberapa menit.</p></div>`;
    $('#pingBtn').onclick = async () => {
      $('#pingOut').textContent = 'Menguji…'; const r = await API.ping();
      $('#pingOut').innerHTML = r.ok ? `<span class="pill ok">Terhubung</span> respon ${r.ms} ms` : `<span class="pill warn">Gagal</span> ${esc(r.paused ? 'Kemungkinan project ter-pause. Klik “Restore project” di dashboard Supabase.' : r.reason)}`;
    };
  }

  start();
})();
