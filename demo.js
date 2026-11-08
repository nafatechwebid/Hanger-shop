/* Data contoh (MODE DEMO) + generator gambar baju SVG. Dipakai bila Supabase belum diisi. */
window.DEMO = (function () {
  function clamp(n) { return Math.max(0, Math.min(255, n)); }
  function shade(hex, amt) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
    const r = clamp((n >> 16) + amt), g = clamp(((n >> 8) & 255) + amt), b = clamp((n & 255) + amt);
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  const BODY = {
    tee: 'M112 66 Q150 92 188 66 L240 90 L262 150 L228 168 L214 140 L214 320 L86 320 L86 140 L72 168 L38 150 L60 90 Z',
    long: 'M112 66 Q150 92 188 66 L238 88 L270 262 L240 272 L216 176 L214 320 L86 320 L84 176 L60 272 L30 262 L62 88 Z',
    hoodie: 'M108 70 Q150 98 192 70 L244 92 L278 268 L244 282 L220 190 L222 324 L78 324 L80 190 L56 282 L22 268 L56 92 Z',
    shirt: 'M112 66 Q150 84 188 66 L240 88 L272 266 L242 276 L216 172 L214 320 L86 320 L84 172 L58 276 L28 266 L60 88 Z',
    jacket: 'M110 68 Q150 90 190 68 L246 92 L280 270 L246 284 L222 192 L224 326 L76 326 L78 192 L54 284 L20 270 L54 92 Z'
  };
  function art(type, color, view, print) {
    const d = shade(color, -26), l = shade(color, 18), dd = shade(color, -45);
    const front = view === 'front';
    const back = view === 'back';
    let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 350">';
    s += '<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".16"/><stop offset=".45" stop-color="#fff" stop-opacity=".10"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs>';
    let g = '';
    if (type === 'hoodie') {
      g += back
        ? `<path d="M104 72 Q150 30 196 72 Q150 140 104 72Z" fill="${d}"/>`
        : `<path d="M102 76 Q150 0 198 76 Q150 112 102 76Z" fill="${dd}"/>`;
    }
    g += `<path d="${BODY[type]}" fill="${color}"/>`;
    g += `<path d="${BODY[type]}" fill="url(#g)"/>`;
    if (front) {
      if (type === 'tee' || type === 'long') g += `<path d="M112 66 Q150 92 188 66" fill="none" stroke="${d}" stroke-width="6" stroke-linecap="round"/>`;
      if (type === 'hoodie') {
        g += `<path d="M112 72 Q150 104 188 72 Q150 92 112 72Z" fill="${dd}"/>`;
        g += `<path d="M126 100 L124 150 M174 100 L176 150" stroke="${l}" stroke-width="3" stroke-linecap="round"/>`;
        g += `<path d="M104 242 L196 242 L212 300 L88 300 Z" fill="${d}" opacity=".55"/>`;
        g += `<path d="M82 306 H218" stroke="${d}" stroke-width="10" opacity=".7"/>`;
      }
      if (type === 'shirt') {
        g += `<path d="M112 66 L150 108 L132 70Z" fill="${l}"/><path d="M188 66 L150 108 L168 70Z" fill="${l}"/>`;
        g += `<path d="M150 108 V320" stroke="${d}" stroke-width="2"/>`;
        for (let i = 0; i < 6; i++) g += `<circle cx="150" cy="${128 + i * 32}" r="3" fill="${dd}"/>`;
        g += `<rect x="108" y="150" width="34" height="34" fill="none" stroke="${d}" stroke-width="1.5"/>`;
      }
      if (type === 'jacket') {
        g += `<path d="M110 68 L150 120 L190 68 L172 62 L150 92 L128 62Z" fill="${d}"/>`;
        g += `<path d="M150 120 V326" stroke="${dd}" stroke-width="3"/>`;
        g += `<path d="M98 250 L128 250 L128 296 L98 296Z M172 250 L202 250 L202 296 L172 296Z" fill="none" stroke="${dd}" stroke-width="2"/>`;
        g += `<path d="M78 316 H222" stroke="${d}" stroke-width="8" opacity=".7"/>`;
      }
      if (print && (type === 'tee' || type === 'long' || type === 'hoodie')) {
        g += `<text x="150" y="${type === 'hoodie' ? 220 : 170}" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="17" fill="${l}" opacity=".95">${print}</text>`;
      }
    } else if (back) {
      g += `<path d="M112 68 Q150 84 188 68" fill="none" stroke="${d}" stroke-width="5" stroke-linecap="round"/>`;
      if (type === 'jacket' || type === 'shirt') g += `<path d="M150 80 V326" stroke="${d}" stroke-width="1.5" opacity=".5"/>`;
    }
    if (front || back) {
      g += `<path d="M86 150 L84 322 M214 150 L216 322" stroke="${dd}" stroke-width="1" opacity=".25"/>`;
    }
    if (view === 'right' || view === 'left') {
      const sx = view === 'left' ? -0.52 : 0.52;
      g = `<g transform="translate(150 0) scale(${sx} 1) translate(-150 0)">${g}</g>`;
      g += `<path d="M150 90 V326" stroke="${dd}" stroke-width="1.5" opacity=".3"/>`;
    }
    s += g + '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }
  function imgs(type, color, print) { return ['front', 'right', 'back', 'left'].map(v => art(type, color, v, print)); }
  const std = (a) => ['XS', 'S', 'M', 'L', 'XL'].map((s, i) => ({ size: s, stock: a[i] }));

  const categories = [
    { id: 'c1', name: 'Hoodie', slug: 'hoodie', sort: 1 },
    { id: 'c2', name: 'T-Shirt', slug: 't-shirt', sort: 2 },
    { id: 'c3', name: 'Kemeja', slug: 'kemeja', sort: 3 },
    { id: 'c4', name: 'Jaket', slug: 'jaket', sort: 4 }
  ];
  const P = (id, cat, name, price, cname, chex, type, print, desc, det, stocks) => ({
    id, category_id: cat, name, price, color_name: cname, color_hex: chex, description: desc, details: det,
    sizes: std(stocks), images: imgs(type, chex, print), active: true, sort: 0
  });
  const products = [
    P('d1', 'c1', 'Heavyweight Hoodie', 389000, 'Midnight', '#1f2a44', 'hoodie', 'atelier', 'Hoodie oversized dengan siluet boxy dan fleece tebal yang lembut di dalam.', '485GSM brushed fleece · 75% cotton, 25% polyester · ribbed hem & cuffs', [2, 5, 8, 4, 1]),
    P('d2', 'c1', 'Typewriter Hoodie', 369000, 'Vintage Blue', '#4a6a9c', 'hoodie', 'typewriter', 'Bordir minimalis di saku kanguru. Nyaman dipakai seharian.', '450GSM fleece · 80% cotton · balloon sleeves', [0, 0, 0, 0, 0]),
    P('d3', 'c1', 'Sage Hoodie', 379000, 'Sage', '#7d8f6a', 'hoodie', 'sage', 'Warna sage yang tenang, cocok untuk padu padan netral.', '450GSM fleece · 80% cotton · ribbed cuffs', [3, 6, 6, 3, 2]),
    P('d4', 'c1', 'Oat Hoodie', 379000, 'Oat', '#d8ccb4', 'hoodie', 'oat', 'Hoodie krem hangat dengan tekstur halus.', '450GSM fleece · 80% cotton', [1, 4, 5, 5, 0]),
    P('d5', 'c2', 'Boxy Tee', 189000, 'Butter', '#efe3b5', 'tee', 'boxy', 'Kaos boxy dengan jatuh bahu lebar.', '240GSM combed cotton · 100% cotton', [4, 9, 12, 8, 3]),
    P('d6', 'c2', 'Essential Tee', 169000, 'Charcoal', '#3a3a40', 'tee', 'essential', 'Kaos harian yang kokoh dan tidak mudah melar.', '220GSM cotton jersey', [5, 8, 10, 7, 4]),
    P('d7', 'c2', 'Rose Tee', 169000, 'Dusty Rose', '#d9a5a5', 'tee', 'rose', 'Rose dusty yang lembut di kulit.', '220GSM cotton jersey', [2, 3, 6, 4, 0]),
    P('d8', 'c2', 'Lounge Flare Long Sleeve', 249000, 'Butter', '#f1e6c0', 'long', 'sunday', 'Lengan flare dengan potongan crop yang manis.', '180GSM single knit jersey · 100% cotton · cropped, flowy fit', [0, 3, 4, 2, 0]),
    P('d9', 'c3', 'Oxford Shirt', 329000, 'Sky', '#a9c3dc', 'shirt', '', 'Kemeja oxford klasik dengan kerah button-down.', 'Oxford cotton · 100% cotton · regular fit', [3, 7, 9, 6, 2]),
    P('d10', 'c3', 'Linen Shirt', 349000, 'Ivory', '#ece6d6', 'shirt', '', 'Linen ringan untuk cuaca tropis.', 'Washed linen · 100% linen · relaxed fit', [2, 5, 7, 5, 1]),
    P('d11', 'c3', 'Stripe Shirt', 339000, 'Olive', '#8a8b64', 'shirt', '', 'Kemeja santai dengan sentuhan lembut.', 'Cotton poplin · regular fit', [0, 4, 6, 3, 2]),
    P('d12', 'c4', 'Coach Jacket', 459000, 'Navy', '#27324f', 'jacket', '', 'Jaket coach ringan, tahan angin.', 'Nylon twill · lined · snap closure', [2, 4, 5, 3, 1]),
    P('d13', 'c4', 'Harrington Jacket', 489000, 'Stone', '#b9b3a3', 'jacket', '', 'Jaket klasik dengan kerah berdiri.', 'Cotton blend · zip front', [1, 3, 4, 3, 0]),
    P('d14', 'c4', 'Work Jacket', 529000, 'Brown', '#6b4f3a', 'jacket', '', 'Jaket kerja tebal dengan dua saku depan.', 'Canvas 12oz · 100% cotton', [2, 3, 3, 2, 1]),
    P('d15', 'c1', 'Forest Hoodie', 389000, 'Forest', '#2f5a45', 'hoodie', 'forest', 'Hijau hutan yang dalam dan elegan.', '485GSM fleece · 75% cotton', [2, 4, 6, 3, 1])
  ];
  const banks = [
    { id: 'b1', bank_name: 'BCA', account_number: '1234567890', account_name: 'Maison Gantung', sort: 1 },
    { id: 'b2', bank_name: 'Mandiri', account_number: '9876543210123', account_name: 'Maison Gantung', sort: 2 }
  ];
  const settings = {
    id: 1,
    store_name: 'Maison Gantung',
    tagline: 'Koleksi pilihan, tergantung rapi untuk Anda.',
    about_title: 'Tentang Kami',
    about_text: 'Maison Gantung adalah toko pakaian yang dikurasi dengan teliti. Setiap potong dipilih dari bahan yang nyaman, potongan yang bersih, dan warna yang awet dipakai.\n\nIni adalah teks contoh. Ubah lewat Panel Admin > Toko.',
    email: 'halo@maisongantung.id',
    whatsapp: '6281234567890',
    qris_url: '',
    payment_note: 'Transfer sesuai total, lalu konfirmasi lewat WhatsApp.'
  };
  return { categories, products, banks, settings, art };
})();
