/* Panel admin v2: produk (+kompres foto), variasi, toko, pembayaran, pesanan, penyimpanan (diagram), peran owner/demo. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rp = (n) => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
  const safeUrl = (u) => /^(https?:|data:image\/|blob:)/i.test(u || '') ? u : '';
  const toastEl = $('#toast'); let tt;
  const toast = (m) => { toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => toastEl.classList.remove('show'), 3000); };
  const bootEl = document.getElementById('boot'); if (bootEl) bootEl.remove();
  const sb = API.sb, q = API.q, BUCKET = (API.cfg && API.cfg.STORAGE_BUCKET) || 'store';
  const MAX_CATS = 10, MAX_BANKS = 5;
  // Batas paket GRATIS Supabase (ubah di sini bila upgrade paket)
  const LIMITS = { db: 500 * 1024 * 1024, storage: 1024 * 1024 * 1024 };
  let tab = 'products', ROLE = null;
  const isOwner = () => ROLE === 'owner';
  const D = { cats: [], products: [], banks: [], settings: {}, orders: [] };

  if (!API.live) { $('#noconf').hidden = false; return; }

  const fmtB = (b) => { b = Number(b) || 0; if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(0) + ' KB'; if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB'; return (b / 1073741824).toFixed(2) + ' GB'; };
  const pausedMsg = (e) => (e && e.paused) || API.looksPaused(e) ? 'Project Supabase kemungkinan sedang ter-pause. Buka dashboard Supabase lalu klik “Restore project”.' : ((e && e.message) || 'Terjadi kesalahan');

  /* ---------- Auth + peran ---------- */
  const LOCK = 'adm_fail';
  const readFail = () => { try { return JSON.parse(localStorage.getItem(LOCK)) || { n: 0, t: 0 }; } catch (e) { return { n: 0, t: 0 }; } };
  const lockLeft = () => { const o = readFail(); return o.n >= 5 && Date.now() - o.t < 300000 ? Math.ceil((300000 - (Date.now() - o.t)) / 1000) : 0; };
  const addFail = () => { const o = readFail(); const n = (Date.now() - o.t > 300000 ? 0 : o.n) + 1; try { localStorage.setItem(LOCK, JSON.stringify({ n, t: Date.now() })); } catch (e) { } };
  const clearFail = () => { try { localStorage.removeItem(LOCK); } catch (e) { } };

  async function loadDemoHint() {
    try {
      const s = await q(sb.from('settings').select('demo_user,demo_pass').eq('id', 1).maybeSingle());
      if (s && s.demo_user && s.demo_pass) {
        const h = $('#demoHint'); h.hidden = false;
        h.innerHTML = 'Ingin mencoba? <button type="button" class="linkbtn" id="fillDemo">Isi otomatis akun demo</button>';
        $('#fillDemo').onclick = () => { $('#lEmail').value = s.demo_user; $('#lPass').value = s.demo_pass; };
      }
    } catch (e) { }
  }
  function showLogin(msg) { $('#app').hidden = true; $('#login').hidden = false; $('#lErr').textContent = msg || ''; loadDemoHint(); }
  async function enter() {
    try { ROLE = await q(sb.rpc('my_role')); }
    catch (e) { showLogin(/my_role|function|schema/i.test(e.message || '') ? 'Database belum diperbarui. Jalankan schema.sql versi terbaru di Supabase → SQL Editor.' : pausedMsg(e)); return; }
    if (!ROLE) { await sb.auth.signOut(); showLogin('Akun ini tidak memiliki akses admin.'); return; }
    $('#login').hidden = true; $('#app').hidden = false;
    const rb = $('#roleBadge'); rb.textContent = isOwner() ? 'OWNER' : 'AKUN DEMO'; rb.className = 'pill ' + (isOwner() ? 'ok' : 'warn');
    render(); usageWarn();
  }
  async function start() {
    try { const { data } = await API.withTimeout(sb.auth.getSession(), 9000); if (data && data.session) await enter(); else showLogin(); }
    catch (e) { showLogin(pausedMsg(e)); }
  }
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const er = $('#lErr'); er.textContent = '';
    const left = lockLeft(); if (left) { er.textContent = `Terlalu banyak percobaan. Coba lagi dalam ${left} detik.`; return; }
    try {
      const r = await API.withTimeout(sb.auth.signInWithPassword({ email: $('#lEmail').value.trim(), password: $('#lPass').value }), 12000);
      if (r.error) { addFail(); er.textContent = /rate|too many/i.test(r.error.message) ? 'Terlalu banyak percobaan. Tunggu sebentar.' : 'Email atau kata sandi salah.'; return; }
      clearFail(); await enter();
    } catch (err) { er.textContent = pausedMsg(err); }
  });
  $('#logout').onclick = async () => { await sb.auth.signOut(); location.reload(); };
  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    tab = b.dataset.tab; $$('#tabs button').forEach(x => x.classList.toggle('on', x === b)); render();
  });
  async function render() {
    const v = $('#view'); v.onclick = null; v.onchange = null; v.innerHTML = '<p class="muted">Memuat…</p>';
    try {
      if (tab === 'products') await viewProducts(v);
      else if (tab === 'cats') await viewCats(v);
      else if (tab === 'store') await viewStore(v);
      else if (tab === 'pay') await viewPay(v);
      else if (tab === 'orders') await viewOrders(v);
      else await viewStorage(v);
    } catch (err) { v.innerHTML = `<div class="tip">${esc(pausedMsg(err))}</div>`; }
  }
  const demoNote = () => isOwner() ? '' : '<div class="tip">Anda masuk sebagai <b>akun demo</b>: bisa menambah &amp; mengubah data, tetapi <b>menghapus</b> dan mengubah <b>pengaturan toko</b> hanya untuk owner.</div>';

  /* ---------- Modal form ---------- */
  let formCleanup = null;
  const openForm = (html) => { $('#formBody').innerHTML = html; $('#formModal').hidden = false; $('#formModal').scrollTop = 0; document.body.style.overflow = 'hidden'; };
  const closeForm = () => { $('#formModal').hidden = true; document.body.style.overflow = ''; };
  $('#formClose').onclick = () => { if (formCleanup) { formCleanup(); formCleanup = null; } closeForm(); };
  const saveBtn = (b, on) => { b.disabled = on; b.textContent = on ? 'Menyimpan…' : 'Simpan'; };
  const dbErr = (e) => toast(e.message && /Maksimal|forbidden|policy|permission/i.test(e.message) ? (/policy|permission|forbidden/i.test(e.message) ? 'Tindakan ini hanya untuk owner.' : e.message) : pausedMsg(e));

  /* ---------- Kompres foto otomatis ---------- */
  const WEBP = (() => { try { return document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0; } catch (e) { return false; } })();
  const EXT = WEBP ? 'webp' : 'png', MIME = WEBP ? 'image/webp' : 'image/png';
  const toBlob = (c, type, qual) => new Promise(r => c.toBlob(r, type, qual));
  async function decode(file) {
    if (window.createImageBitmap) { try { return await createImageBitmap(file); } catch (e) { } }
    return await new Promise((res, rej) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = () => rej(new Error('Gambar tidak bisa dibaca')); i.src = u; });
  }
  // Perkecil dimensi + turunkan kualitas bertahap sampai <= targetKB. Transparansi tetap dipertahankan (WebP/PNG).
  async function shrink(file, { maxDim, targetKB, minQ = 0.5 }) {
    const bmp = await decode(file); const W = bmp.width || bmp.naturalWidth, H = bmp.height || bmp.naturalHeight;
    let scale = Math.min(1, maxDim / Math.max(W, H)), best = null;
    for (let round = 0; round < 8; round++) {
      const w = Math.max(1, Math.round(W * scale)), h = Math.max(1, Math.round(H * scale));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(bmp, 0, 0, w, h);
      for (let qual = 0.88; qual >= minQ - 0.001; qual -= 0.07) {
        const blob = await toBlob(c, MIME, WEBP ? qual : undefined);
        if (!blob) throw new Error('Gagal memampatkan gambar');
        if (!best || blob.size < best.blob.size) best = { blob, w, h };
        if (blob.size <= targetKB * 1024) return { blob, w, h };
        if (!WEBP) break;
      }
      scale *= 0.82;
    }
    return best;
  }
  async function putFile(blob, path) {
    if (blob.size > 400 * 1024) throw new Error('Foto terlalu rumit untuk dikompres di bawah 400 KB. Coba foto lain.');
    const r = await API.withTimeout(sb.storage.from(BUCKET).upload(path, blob, { contentType: MIME, cacheControl: '31536000', upsert: false }), 30000);
    if (r.error) throw new Error(r.error.message);
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }
  const baseName = (folder) => `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  function checkImg(file) {
    if (!/^image\//.test(file.type)) throw new Error('File harus berupa gambar');
    if (file.size > 25 * 1024 * 1024) throw new Error('Foto terlalu besar (maks 25 MB sebelum dikompres)');
  }
  // Foto produk: utama (maks 1000px, ≤140 KB) + thumbnail rak (360px, ≤28 KB)
  async function uploadPhoto(file, onInfo) {
    checkImg(file); const base = baseName('products');
    const main = await shrink(file, { maxDim: 1000, targetKB: 140, minQ: 0.55 });
    const th = await shrink(file, { maxDim: 360, targetKB: 28, minQ: 0.5 });
    const url = await putFile(main.blob, `${base}_m.${EXT}`);
    await putFile(th.blob, `${base}_t.${EXT}`);
    onInfo && onInfo(file.size, main.blob.size + th.blob.size);
    return url;
  }
  // QRIS: harus tetap tajam agar bisa discan (maks 900px, ≤180 KB, kualitas tinggi)
  async function uploadQris(file) {
    checkImg(file); const r = await shrink(file, { maxDim: 900, targetKB: 180, minQ: 0.8 });
    return putFile(r.blob, `${baseName('qris')}_q.${EXT}`);
  }
  async function removeUrls(urls) {
    if (!isOwner()) return;                       // hanya owner yang boleh menghapus file
    const key = '/object/public/' + BUCKET + '/', paths = [];
    (urls || []).forEach(u => { const i = (u || '').indexOf(key); if (i < 0) return; const p = decodeURIComponent(u.slice(i + key.length).split('?')[0]); paths.push(p); if (/_m\.(webp|png)$/.test(p)) paths.push(p.replace(/_m\.(webp|png)$/, '_t.$1')); });
    if (paths.length) { try { await sb.storage.from(BUCKET).remove(paths); } catch (e) { } }
  }

  /* ---------- PRODUK ---------- */
  async function viewProducts(v) {
    [D.cats, D.products] = await Promise.all([
      q(sb.from('categories').select('*').order('sort').order('created_at')),
      q(sb.from('products').select('*').order('sort').order('created_at'))
    ]);
    const cname = (id) => (D.cats.find(c => c.id === id) || {}).name || '—';
    const th = (u) => /_m\.(webp|png)/.test(u || '') ? u.replace(/_m\.(webp|png)/, '_t.$1') : u;
    v.innerHTML = `<div class="ad-head"><div><h2>Produk</h2><p>${D.products.length}/40 produk. Setiap produk menjadi satu hanger di rak.</p></div><button class="btn primary sm" id="addP">+ Produk baru</button></div>${demoNote()}
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Nama</th><th>Variasi</th><th>Harga</th><th>Stok</th><th>Status</th><th></th></tr></thead><tbody>
    ${D.products.map(p => { const st = (p.sizes || []).reduce((a, s) => a + (+s.stock || 0), 0); return `<tr><td><img src="${esc(safeUrl(th((p.images || [])[0] || '')))}" alt=""></td><td><b>${esc(p.name)}</b><br><small class="muted">${esc(p.color_name || '')}</small></td><td>${esc(cname(p.category_id))}</td><td>${rp(p.price)}</td><td>${st}</td><td><span class="pill ${p.active ? 'ok' : 'warn'}">${p.active ? 'tampil' : 'sembunyi'}</span></td><td><div class="acts"><button class="btn sm" data-edit="${p.id}">Ubah</button>${isOwner() ? `<button class="btn sm danger" data-del="${p.id}">Hapus</button>` : ''}</div></td></tr>`; }).join('') || '<tr><td colspan="7" class="muted">Belum ada produk.</td></tr>'}
    </tbody></table></div>`;
    $('#addP').onclick = () => productForm(null);
    v.onclick = async (e) => {
      const ed = e.target.closest('[data-edit]'), de = e.target.closest('[data-del]');
      if (ed) productForm(D.products.find(p => p.id === ed.dataset.edit));
      if (de && isOwner() && confirm('Hapus produk ini beserta fotonya?')) {
        const p = D.products.find(x => x.id === de.dataset.del);
        try { await q(sb.from('products').delete().eq('id', de.dataset.del)); await removeUrls(p && p.images); toast('Produk dihapus'); render(); } catch (err) { dbErr(err); }
      }
    };
  }

  function productForm(p) {
    const st = { images: [...((p && p.images) || [])], sizes: ((p && p.sizes) || [{ size: 'S', stock: 0 }, { size: 'M', stock: 0 }, { size: 'L', stock: 0 }]).map(s => ({ ...s })) };
    const fresh = [], removed = [];
    const thumbOf = (u) => /_m\.(webp|png)/.test(u) ? u.replace(/_m\.(webp|png)/, '_t.$1') : u;
    const paint = () => {
      $('#imgList').innerHTML = st.images.map((u, i) => `<div class="im"><img src="${esc(safeUrl(thumbOf(u)))}" alt=""><small>${['Depan', 'Kanan', 'Belakang', 'Kiri'][i] || 'Tampak ' + (i + 1)}</small><div class="mv"><button type="button" data-mv="${i}|-1">←</button><button type="button" data-mv="${i}|1">→</button><button type="button" data-rmi="${i}">✕</button></div></div>`).join('') || '<small class="muted">Belum ada gambar.</small>';
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
        <div class="tip"><b>Foto otomatis dikompres</b> sebelum diunggah (utama ≤140 KB + thumbnail ≤28 KB, tetap tajam, latar transparan tetap terjaga), jadi toko tetap cepat dan ruang gratis hemat. Maks 8 foto. Urutan disarankan: <b>Depan → Samping kanan → Belakang → Samping kiri</b>. Foto pertama tampil di rak. Gunakan foto latar transparan tanpa hanger.</div>
        <div class="imgs" id="imgList"></div>
        <input type="file" id="pFiles" accept="image/*" multiple>
        <div id="upStat" class="small muted"></div></div>
      <div class="card"><h4>Ukuran &amp; stok</h4><div class="sizes-ed" id="sizeList"></div><button type="button" class="btn sm" id="addSize">+ Ukuran</button></div>
      <div class="grid2"><div class="field"><label>Urutan di rak (kecil = kiri)</label><input id="pSort" type="number" value="${p ? p.sort : 0}"></div>
        <div class="field"><label>Status</label><select id="pActive"><option value="1" ${!p || p.active ? 'selected' : ''}>Tampil di toko</option><option value="0" ${p && !p.active ? 'selected' : ''}>Sembunyikan</option></select></div></div>
      <button class="btn primary block" type="submit" id="pSave">Simpan</button></form>`);
    paint();
    formCleanup = () => removeUrls(fresh.filter(u => !(p && (p.images || []).includes(u))));   // batal: buang foto baru yang belum dipakai
    const fm = $('#formBody');
    fm.onclick = (e) => {
      const mv = e.target.closest('[data-mv]'), rm = e.target.closest('[data-rmi]'), rs = e.target.closest('[data-rms]');
      if (mv) { const [i, d] = mv.dataset.mv.split('|').map(Number), j = i + d; if (j >= 0 && j < st.images.length) { [st.images[i], st.images[j]] = [st.images[j], st.images[i]]; paint(); } }
      if (rm) { removed.push(st.images.splice(+rm.dataset.rmi, 1)[0]); paint(); }
      if (rs) { st.sizes.splice(+rs.dataset.rms, 1); paint(); }
      if (e.target.id === 'addSize') { if (st.sizes.length < 12) { st.sizes.push({ size: '', stock: 0 }); paint(); } }
    };
    fm.oninput = (e) => {
      if (e.target.dataset.sz !== undefined) st.sizes[+e.target.dataset.sz].size = e.target.value.toUpperCase();
      if (e.target.dataset.st !== undefined) st.sizes[+e.target.dataset.st].stock = Math.max(0, parseInt(e.target.value) || 0);
    };
    $('#pFiles').onchange = async (e) => {
      const files = [...e.target.files]; if (!files.length) return; const logs = [];
      for (let i = 0; i < files.length; i++) {
        if (st.images.length >= 8) { toast('Maksimal 8 foto per produk'); break; }
        $('#upStat').innerHTML = logs.join('<br>') + `<br>Memampatkan &amp; mengunggah ${i + 1}/${files.length}…`;
        try {
          const url = await uploadPhoto(files[i], (a, b) => logs.push(`✓ Foto ${i + 1}: ${fmtB(a)} → ${fmtB(b)} (hemat ${Math.max(0, Math.round((1 - b / a) * 100))}%)`));
          st.images.push(url); fresh.push(url); paint();
        } catch (err) { logs.push('✗ Foto ' + (i + 1) + ': ' + esc(err.message)); }
      }
      $('#upStat').innerHTML = logs.join('<br>'); e.target.value = '';
    };
    $('#pf').onsubmit = async (e) => {
      e.preventDefault();
      const sizes = st.sizes.filter(s => s.size.trim()).map(s => ({ size: s.size.trim(), stock: +s.stock || 0 }));
      const row = { name: $('#pName').value.trim(), category_id: $('#pCat').value || null, price: +$('#pPrice').value || 0, color_name: $('#pColor').value.trim(), color_hex: $('#pHex').value, description: $('#pDesc').value.trim(), details: $('#pDet').value.trim(), sizes, images: st.images, sort: parseInt($('#pSort').value) || 0, active: $('#pActive').value === '1' };
      const b = $('#pSave'); saveBtn(b, true);
      try {
        await q(p ? sb.from('products').update(row).eq('id', p.id) : sb.from('products').insert(row));
        await removeUrls(removed.filter(u => !st.images.includes(u)));   // hemat ruang: hapus foto yang dibuang
        formCleanup = null; toast('Produk tersimpan'); closeForm(); render();
      } catch (err) { dbErr(err); saveBtn(b, false); }
    };
  }

  /* ---------- VARIASI ---------- */
  async function viewCats(v) {
    D.cats = await q(sb.from('categories').select('*').order('sort').order('created_at'));
    v.innerHTML = `<div class="ad-head"><div><h2>Variasi</h2><p>Menu “Variasi” di toko. Maksimal ${MAX_CATS} (${D.cats.length}/${MAX_CATS} terpakai).</p></div><button class="btn primary sm" id="addC" ${D.cats.length >= MAX_CATS ? 'disabled' : ''}>+ Variasi</button></div>${demoNote()}
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nama</th><th>Urutan</th><th></th></tr></thead><tbody>${D.cats.map(c => `<tr><td><b>${esc(c.name)}</b></td><td>${c.sort}</td><td><div class="acts"><button class="btn sm" data-edit="${c.id}">Ubah</button>${isOwner() ? `<button class="btn sm danger" data-del="${c.id}">Hapus</button>` : ''}</div></td></tr>`).join('') || '<tr><td colspan="3" class="muted">Belum ada variasi.</td></tr>'}</tbody></table></div>`;
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
      if (de && isOwner() && confirm('Hapus variasi ini? Produk di dalamnya tidak ikut terhapus.')) { try { await q(sb.from('categories').delete().eq('id', de.dataset.del)); render(); } catch (err) { dbErr(err); } }
    };
  }

  /* ---------- TOKO & KONTAK ---------- */
  async function viewStore(v) {
    D.settings = (await q(sb.from('settings').select('*').eq('id', 1).maybeSingle())) || {};
    const s = D.settings, dis = isOwner() ? '' : 'disabled';
    v.innerHTML = `<div class="ad-head"><div><h2>Toko &amp; Kontak</h2><p>Teks di beranda, tentang kami, kontak, dan akun demo.</p></div></div>${demoNote()}
    <form id="sf" class="card">
      <div class="field"><label>Nama toko</label><input id="sName" maxlength="60" value="${esc(s.store_name)}" ${dis}></div>
      <div class="field"><label>Judul beranda (boleh 2 baris, pisahkan dengan Enter)</label><textarea id="sTag" rows="2" ${dis}>${esc(String(s.tagline || '').replace(/<br\s*\/?>/gi, '\n'))}</textarea></div>
      <div class="field"><label>Judul “Tentang Kami”</label><input id="sAT" value="${esc(s.about_title)}" ${dis}></div>
      <div class="field"><label>Isi “Tentang Kami” (paragraf dipisah baris kosong)</label><textarea id="sAbout" rows="9" ${dis}>${esc(s.about_text)}</textarea></div>
      <div class="grid2"><div class="field"><label>Email admin</label><input id="sMail" type="email" value="${esc(s.email)}" ${dis}></div>
      <div class="field"><label>WhatsApp admin (628…, tanpa +)</label><input id="sWa" inputmode="numeric" value="${esc(s.whatsapp)}" placeholder="6281234567890" ${dis}></div></div>
      <h4 style="margin:18px 0 10px;font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--mute);font-weight:400">Akun demo (tampil publik di “Tentang Kami”)</h4>
      <div class="tip">Buat user demo di Supabase → Authentication → Users, lalu daftarkan sebagai demo (lihat README bagian 8). Kosongkan kedua kolom di bawah untuk menyembunyikan kartu akun demo.</div>
      <div class="grid2"><div class="field"><label>Username (email akun demo)</label><input id="sDU" value="${esc(s.demo_user)}" placeholder="demo@rakbaju.web.id" ${dis}></div>
      <div class="field"><label>Password demo</label><input id="sDP" value="${esc(s.demo_pass)}" ${dis}></div></div>
      <div class="field"><label>Catatan di kartu demo</label><input id="sDN" maxlength="200" value="${esc(s.demo_note)}" ${dis}></div>
      ${isOwner() ? '<button class="btn primary" id="sSave" type="submit">Simpan</button>' : ''}</form>`;
    $('#sf').onsubmit = async (e) => {
      e.preventDefault(); if (!isOwner()) return; const b = $('#sSave'); saveBtn(b, true);
      let wa = $('#sWa').value.replace(/\D/g, ''); if (wa.startsWith('0')) wa = '62' + wa.slice(1);
      try {
        await q(sb.from('settings').upsert({ id: 1, store_name: $('#sName').value.trim(), tagline: $('#sTag').value.trim().replace(/<[^>]*>/g, '').replace(/\n/g, '<br>'), about_title: $('#sAT').value.trim(), about_text: $('#sAbout').value, email: $('#sMail').value.trim(), whatsapp: wa, demo_user: $('#sDU').value.trim() || null, demo_pass: $('#sDP').value.trim() || null, demo_note: $('#sDN').value.trim() || null, updated_at: new Date().toISOString() }));
        toast('Tersimpan'); saveBtn(b, false);
      } catch (err) { dbErr(err); saveBtn(b, false); }
    };
  }

  /* ---------- PEMBAYARAN ---------- */
  async function viewPay(v) {
    [D.settings, D.banks] = await Promise.all([
      q(sb.from('settings').select('*').eq('id', 1).maybeSingle()).then(x => x || {}),
      q(sb.from('bank_accounts').select('*').order('sort').order('created_at'))
    ]);
    const s = D.settings;
    v.innerHTML = `<div class="ad-head"><div><h2>Pembayaran</h2><p>Tahap demo: QRIS statis + transfer bank. Payment gateway menyusul saat produksi.</p></div></div>${demoNote()}
    <div class="card"><h4>QRIS statis toko</h4>
      ${s.qris_url ? `<div class="qpreview"><img src="${esc(safeUrl(s.qris_url))}" alt="QRIS"></div>` : '<p class="muted small">Belum ada QRIS.</p>'}
      ${isOwner() ? `<input type="file" id="qFile" accept="image/*"> ${s.qris_url ? '<button class="btn sm danger" id="qDel">Hapus QRIS</button>' : ''}<div id="qStat" class="small muted"></div>
      <div class="field" style="margin-top:14px"><label>Catatan pembayaran (tampil di checkout)</label><input id="payNote" value="${esc(s.payment_note)}"><button class="btn sm" id="saveNote" style="margin-top:8px;align-self:start">Simpan catatan</button></div>` : ''}</div>
    <div class="ad-head"><div><h2 style="font-size:28px">Rekening bank</h2><p>Maksimal ${MAX_BANKS} (${D.banks.length}/${MAX_BANKS} terpakai).</p></div><button class="btn primary sm" id="addB" ${D.banks.length >= MAX_BANKS ? 'disabled' : ''}>+ Rekening</button></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Bank</th><th>No. rekening</th><th>Atas nama</th><th></th></tr></thead><tbody>${D.banks.map(b => `<tr><td><b>${esc(b.bank_name)}</b></td><td>${esc(b.account_number)}</td><td>${esc(b.account_name)}</td><td><div class="acts"><button class="btn sm" data-edit="${b.id}">Ubah</button>${isOwner() ? `<button class="btn sm danger" data-del="${b.id}">Hapus</button>` : ''}</div></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Belum ada rekening.</td></tr>'}</tbody></table></div>`;
    if (isOwner()) {
      $('#qFile').onchange = async (e) => {
        const f = e.target.files[0]; if (!f) return; $('#qStat').textContent = 'Memampatkan & mengunggah…';
        try { const url = await uploadQris(f); const old = s.qris_url; await q(sb.from('settings').upsert({ id: 1, qris_url: url })); await removeUrls([old]); toast('QRIS diperbarui'); render(); } catch (err) { $('#qStat').textContent = err.message; }
      };
      if ($('#qDel')) $('#qDel').onclick = async () => { try { await q(sb.from('settings').upsert({ id: 1, qris_url: null })); await removeUrls([s.qris_url]); render(); } catch (err) { dbErr(err); } };
      $('#saveNote').onclick = async () => { try { await q(sb.from('settings').upsert({ id: 1, payment_note: $('#payNote').value.trim() })); toast('Tersimpan'); } catch (err) { dbErr(err); } };
    }
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
      if (de && isOwner() && confirm('Hapus rekening ini?')) { try { await q(sb.from('bank_accounts').delete().eq('id', de.dataset.del)); render(); } catch (err) { dbErr(err); } }
    };
  }

  /* ---------- PESANAN ---------- */
  async function viewOrders(v) {
    D.orders = await q(sb.from(isOwner() ? 'orders' : 'orders_masked').select('*').order('created_at', { ascending: false }).limit(100));
    v.innerHTML = `<div class="ad-head"><div><h2>Pesanan</h2><p>${D.orders.length} pesanan terakhir. Kurangi stok produk manual setelah pembayaran dikonfirmasi.</p></div><button class="btn sm" id="rf">Muat ulang</button></div>` +
      (isOwner() ? '' : '<div class="tip">Akun demo melihat data pembeli dalam bentuk <b>tersamar</b> demi privasi, dan tidak dapat mengubah status.</div>') +
      (D.orders.map(o => `<div class="order"><div class="top"><div><span class="code pill">${esc(o.order_code)}</span> <small class="muted">${new Date(o.created_at).toLocaleString('id-ID')}</small></div>
      ${isOwner() ? `<select data-st="${o.id}">${['menunggu', 'dibayar', 'dikirim', 'selesai', 'batal'].map(s => `<option ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>` : `<span class="pill">${esc(o.status)}</span>`}</div>
      <dl class="kv"><dt>Pembeli</dt><dd>${esc(o.customer_name)} · ${isOwner() ? `<a href="https://wa.me/${esc(String(o.phone).replace(/\D/g, '').replace(/^0/, '62'))}" target="_blank" rel="noopener">${esc(o.phone)}</a>` : esc(o.phone)}</dd><dt>Alamat</dt><dd>${esc(o.address)}</dd>${o.note ? `<dt>Catatan</dt><dd>${esc(o.note)}</dd>` : ''}<dt>Metode</dt><dd>${esc(o.payment_method || '-')}</dd></dl>
      <ul>${(o.items || []).map(i => `<li>${esc(i.name)} (${esc(i.size)}) × ${+i.qty} — ${rp(i.price * i.qty)}</li>`).join('')}</ul><b>Total ${rp(o.total)}</b></div>`).join('') || '<p class="muted">Belum ada pesanan.</p>');
    $('#rf').onclick = render;
    v.onchange = async (e) => { const s = e.target.closest('[data-st]'); if (s && isOwner()) { try { await q(sb.from('orders').update({ status: s.value }).eq('id', s.dataset.st)); toast('Status diperbarui'); } catch (err) { dbErr(err); } } };
  }

  /* ---------- PENYIMPANAN (diagram terhubung Supabase) ---------- */
  const mix = (a, b, t) => { const p = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((x, i) => Math.round(x + (B[i] - x) * t).toString(16).padStart(2, '0')).join(''); };
  // hijau <50% · kuning 50–70% · oranye→merah 71–95% · merah tua >95%
  const levelColor = (p) => p < 50 ? '#2f7d5b' : p <= 70 ? '#d9a21b' : p <= 95 ? mix('#e8772e', '#c0392b', (p - 71) / 24) : '#8e1f1f';
  const levelName = (p) => p < 50 ? 'Masih sangat lega' : p <= 70 ? 'Mulai terisi' : p <= 95 ? 'Hampir penuh' : 'Kritis — segera bersihkan';
  const arc = (p0, p1, r = 80) => { const pt = (p) => { const a = Math.PI * (1 - p / 100); return [100 + r * Math.cos(a), 100 - r * Math.sin(a)]; }; const [x0, y0] = pt(p0), [x1, y1] = pt(p1); return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; };
  function gauge(pct, title, used, limit, note) {
    const p = Math.min(100, Math.max(0, pct)), col = levelColor(p);
    const zone = (a, b, c) => `<path d="${arc(a, b)}" fill="none" stroke="${c}" stroke-width="16" opacity=".2"/>`;
    return `<div class="gauge"><svg viewBox="0 0 200 118" role="img" aria-label="${esc(title)} terpakai ${p.toFixed(1)} persen">
      ${zone(0, 50, '#2f7d5b')}${zone(50, 70, '#d9a21b')}${zone(70, 100, '#c0392b')}
      ${p > 0.4 ? `<path d="${arc(0, p)}" fill="none" stroke="${col}" stroke-width="16" stroke-linecap="round"/>` : ''}
      <text x="100" y="94" text-anchor="middle" class="g-pct" fill="${col}">${p < 10 ? p.toFixed(1) : Math.round(p)}%</text>
      <text x="100" y="112" text-anchor="middle" class="g-sub">${fmtB(used)} / ${fmtB(limit)}</text></svg>
      <b>${esc(title)}</b><span class="lvl" style="color:${col}">● ${levelName(p)}</span><small>${esc(note)}</small></div>`;
  }
  async function getUsage() { return q(sb.rpc('admin_usage')); }
  async function usageWarn() {
    try {
      const u = await getUsage(), p = Math.max(u.db_bytes / LIMITS.db, u.storage_bytes / LIMITS.storage) * 100, bar = $('#warnBar');
      if (p > 70) { bar.hidden = false; bar.style.background = levelColor(p); bar.innerHTML = `Penyimpanan ${Math.round(p)}% terpakai. Buka tab <b>Penyimpanan</b> untuk membersihkan ruang.`; } else bar.hidden = true;
    } catch (e) { }
  }
  function download(name, text, type) { const b = new Blob([text], { type }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  const cell = (x) => '"' + String(x ?? '').replace(/"/g, '""') + '"';
  const ordersCsv = (rows) => '﻿' + ['kode', 'tanggal', 'nama', 'whatsapp', 'alamat', 'catatan', 'metode', 'status', 'item', 'total'].join(',') + '\n' +
    rows.map(o => [o.order_code, o.created_at, o.customer_name, o.phone, o.address, o.note, o.payment_method, o.status, (o.items || []).map(i => `${i.name} (${i.size}) x${i.qty}`).join(' | '), o.total].map(cell).join(',')).join('\n');
  const today = () => new Date().toISOString().slice(0, 10);

  async function viewStorage(v) {
    let u;
    try { u = await getUsage(); } catch (e) {
      v.innerHTML = `<div class="ad-head"><div><h2>Penyimpanan</h2></div></div><div class="tip">${/admin_usage|function|schema/i.test(e.message || '') ? 'Fungsi pemantau belum ada. Jalankan <b>schema.sql</b> terbaru di Supabase SQL Editor.' : esc(pausedMsg(e))}</div>${connCard()}`; bindConn(); return;
    }
    const dbP = u.db_bytes / LIMITS.db * 100, stP = u.storage_bytes / LIMITS.storage * 100, worst = Math.max(dbP, stP);
    const avgOrder = u.rows.orders > 0 ? u.tables.orders / u.rows.orders : 2500;
    const left = Math.max(0, Math.floor((LIMITS.db - u.db_bytes) / avgOrder));
    const steps = '<ol class="small" style="margin:8px 0 0 18px;line-height:1.7"><li><b>Unduh backup cadangan</b> (tombol di bawah) sebelum menghapus apa pun.</li><li><b>Hapus transaksi lama</b> yang sudah selesai/batal.</li><li>Untuk ruang gambar: hapus produk atau foto yang tidak dipakai.</li></ol>';
    const alert = worst < 50 ? `<div class="notice ok"><b>✅ Ruang masih sangat lega.</b> Tidak ada tindakan yang perlu dilakukan.</div>`
      : worst <= 70 ? `<div class="notice yellow"><b>⚠️ Ruang mulai terisi (${Math.round(worst)}%).</b> Disarankan mulai merapikan data lama. Kosongkan ruang penyimpanan dengan menghapus beberapa transaksi lama, <u>tetapi unduh backup dulu</u>.${steps}</div>`
        : worst <= 95 ? `<div class="notice red"><b>🔴 Ruang hampir penuh (${Math.round(worst)}%).</b> Segera kosongkan ruang penyimpanan: hapus beberapa transaksi lama setelah mengunduh backup. Bila penuh, database dapat menolak pesanan baru.${steps}</div>`
          : `<div class="notice crit"><b>🚨 KRITIS (${Math.round(worst)}%).</b> Database hampir tidak bisa menerima data baru. Lakukan sekarang:${steps}</div>`;
    const tb = Object.entries(u.tables).sort((a, b) => b[1] - a[1]), mx = Math.max(1, tb[0][1]);
    v.innerHTML = `<div class="ad-head"><div><h2>Penyimpanan</h2><p>Terhubung ke Supabase · diperiksa ${new Date(u.checked_at).toLocaleTimeString('id-ID')} · paket Gratis (database ${fmtB(LIMITS.db)}, file ${fmtB(LIMITS.storage)})</p></div><button class="btn sm" id="rfS">Segarkan</button></div>
    <div class="gauges">${gauge(dbP, 'Database', u.db_bytes, LIMITS.db, 'Termasuk data sistem Supabase (±beberapa puluh MB)')}${gauge(stP, 'File gambar', u.storage_bytes, LIMITS.storage, u.storage_files + ' file (foto produk & QRIS)')}</div>
    <div class="legend"><span><i style="background:#2f7d5b"></i>&lt; 50% lega</span><span><i style="background:#d9a21b"></i>50–70% terisi</span><span><i style="background:linear-gradient(90deg,#e8772e,#c0392b)"></i>71–95% menuju merah</span><span><i style="background:#8e1f1f"></i>&gt; 95% kritis</span></div>
    ${alert}
    <div class="card"><h4>Rincian</h4>
      ${tb.map(([k, b]) => `<div class="bar"><span>${esc(k)} <small class="muted">(${u.rows[k] ?? 0} baris)</small></span><div><i style="width:${Math.max(2, b / mx * 100)}%"></i></div><em>${fmtB(b)}</em></div>`).join('')}
      <p class="small muted" style="margin-top:10px">Perkiraan: ± <b>${left.toLocaleString('id-ID')}</b> pesanan lagi sebelum database penuh (rata-rata ${fmtB(avgOrder)}/pesanan).</p></div>
    ${isOwner() ? cleanCard() : '<div class="card"><h4>Backup &amp; pembersihan</h4><p class="muted small">Unduh backup dan hapus transaksi lama hanya tersedia untuk akun <b>owner</b>, karena berisi data pembeli.</p></div>'}
    <div class="card info"><h4>Catatan tahap produksi</h4><p class="small">Saat ini (tahap demo) angka diambil langsung dari Supabase setiap tab ini dibuka. Pada <b>tahap production</b>, fitur penyimpanan ini akan <b>dihubungkan ke database sistem</b> (pemantauan otomatis + peringatan lewat WhatsApp/email) agar pengecekan lebih mudah tanpa membuka panel ini.</p></div>
    <div class="card"><h4>Perlindungan keamanan aktif</h4><ul class="small checks">
      <li>Pengunjung hanya bisa <b>membaca</b> katalog dan <b>membuat</b> pesanan; tidak bisa membaca/ubah/hapus data lain (RLS).</li>
      <li>Batas spam pesanan: maks 5 per perangkat/10 menit, 5 per nomor HP/jam, 120 per jam seluruh toko, 1.000 antrian menunggu.</li>
      <li>Ukuran data dibatasi: maks 30 item &amp; 8 KB per pesanan, 40 produk, 10 variasi, 5 rekening, 8 foto per produk.</li>
      <li>Upload gambar khusus admin; server menolak file &gt; 400 KB atau bukan gambar. Foto dikompres otomatis.</li>
      <li>Login admin: batas 5 percobaan/5 menit di browser + pembatas bawaan Supabase. Pendaftaran umum dimatikan.</li>
      <li>Honeypot &amp; jeda minimum di checkout untuk menyaring bot; CSP membatasi sumber skrip.</li></ul></div>
    ${connCard()}`;
    $('#rfS').onclick = render; bindConn(); if (isOwner()) bindClean();
    usageWarn();
  }
  function connCard() { return `<div class="card"><h4>Koneksi &amp; Auto Pause</h4><p id="pingOut" class="muted small">Belum dicek.</p><button class="btn sm primary" id="pingBtn" style="margin:8px 0 12px">Tes koneksi</button>
    <p class="small muted">Paket gratis Supabase <b>otomatis ter-pause setelah 1 minggu tanpa aktivitas</b>. Anti-pause: GitHub Actions <code>keepalive.yml</code> mengakses database tiap 3 hari. Bila sudah ter-pause: dashboard Supabase → <b>Restore project</b>.</p></div>`; }
  function bindConn() { const b = $('#pingBtn'); if (!b) return; b.onclick = async () => { $('#pingOut').textContent = 'Menguji…'; const r = await API.ping(); $('#pingOut').innerHTML = r.ok ? `<span class="pill ok">Terhubung</span> respon ${r.ms} ms` : `<span class="pill warn">Gagal</span> ${esc(r.paused ? 'Kemungkinan project ter-pause. Klik “Restore project” di dashboard Supabase.' : r.reason)}`; }; }

  function cleanCard() {
    return `<div class="card"><h4>Backup &amp; kosongkan ruang</h4>
      <p class="small muted" style="margin-bottom:12px">Urutan aman: <b>(1) unduh backup</b> → <b>(2) hapus transaksi lama</b>. Tombol hapus baru aktif setelah backup untuk pilihan yang sama diunduh.</p>
      <button class="btn sm" id="bkFull">⬇ Backup lengkap (JSON: produk, toko, pesanan)</button>
      <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
      <div class="grid2"><div class="field"><label>Hapus pesanan lebih lama dari</label><select id="cDays"><option value="30">30 hari</option><option value="60">60 hari</option><option value="90" selected>90 hari</option><option value="180">180 hari</option><option value="365">1 tahun</option></select></div>
      <div class="field"><label>Status yang dihapus</label><select id="cSt"><option value="done">Selesai &amp; batal saja (aman)</option><option value="all">Termasuk yang masih “menunggu”</option></select></div></div>
      <p id="cCount" class="small muted">Menghitung…</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px"><button class="btn sm" id="bkOld" disabled>⬇ 1. Unduh backup pesanan ini (CSV)</button><button class="btn sm danger" id="delOld" disabled>🗑 2. Hapus pesanan lama</button></div></div>`;
  }
  function bindClean() {
    let backed = '', n = 0;
    const cond = () => { const days = +$('#cDays').value, st = $('#cSt').value === 'all' ? ['selesai', 'batal', 'menunggu'] : ['selesai', 'batal']; return { days, st, cut: new Date(Date.now() - days * 86400000).toISOString(), key: days + '|' + st.length }; };
    const countIt = async () => {
      const c = cond(); $('#cCount').textContent = 'Menghitung…';
      try {
        const r = await API.withTimeout(sb.from('orders').select('id', { count: 'exact', head: true }).lt('created_at', c.cut).in('status', c.st), 9000); if (r.error) throw r.error; n = r.count || 0;
        $('#cCount').innerHTML = `<b>${n}</b> pesanan lebih lama dari ${c.days} hari akan dihapus.`;
      } catch (e) { n = 0; $('#cCount').textContent = pausedMsg(e); }
      $('#bkOld').disabled = n === 0; $('#delOld').disabled = !(n > 0 && backed === c.key);
    };
    $('#cDays').onchange = $('#cSt').onchange = countIt; countIt();
    $('#bkFull').onclick = async () => {
      try {
        const [settings, categories, products, banks, orders] = await Promise.all([q(sb.from('settings').select('*')), q(sb.from('categories').select('*')), q(sb.from('products').select('*')), q(sb.from('bank_accounts').select('*')), q(sb.from('orders').select('*').order('created_at').range(0, 9999))]);
        download(`backup-lengkap-${today()}.json`, JSON.stringify({ dibuat: new Date().toISOString(), settings, categories, products, bank_accounts: banks, orders }, null, 2), 'application/json'); toast('Backup lengkap diunduh');
      } catch (e) { dbErr(e); }
    };
    $('#bkOld').onclick = async () => {
      const c = cond();
      try {
        const rows = await q(sb.from('orders').select('*').lt('created_at', c.cut).in('status', c.st).order('created_at').range(0, 9999));
        download(`backup-pesanan-lama-${today()}.csv`, ordersCsv(rows), 'text/csv;charset=utf-8'); backed = c.key; toast(`Backup ${rows.length} pesanan diunduh. Tombol hapus kini aktif.`); countIt();
      } catch (e) { dbErr(e); }
    };
    $('#delOld').onclick = async () => {
      const c = cond(); if (backed !== c.key) { toast('Unduh backup dulu'); return; }
      if (!confirm(`Hapus ${n} pesanan lebih lama dari ${c.days} hari? Tindakan ini tidak bisa dibatalkan (pastikan file backup sudah tersimpan).`)) return;
      try { await q(sb.from('orders').delete().lt('created_at', c.cut).in('status', c.st)); toast('Pesanan lama dihapus'); render(); } catch (e) { dbErr(e); }
    };
  }

  start();
})();
