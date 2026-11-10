/* SIMULASI ongkir (tahap demo). Data wilayah & tarif di sini hanya contoh, bukan tarif kurir asli.
   Saat produksi, ganti isi Ongkir.search() dan Ongkir.rates() dengan panggilan ke Supabase Edge Function
   yang meneruskan ke penyedia ongkir (mis. Biteship / RajaOngkir). Bentuk data yang dikembalikan sudah sama. */
(function () {
  const ORIGIN = { name: 'Kebayoran Baru, Jakarta Selatan', lat: -6.243, lng: 106.800 };
  const A = [
    ['Kebayoran Baru, Jakarta Selatan, DKI Jakarta', -6.243, 106.800], ['Menteng, Jakarta Pusat, DKI Jakarta', -6.195, 106.832],
    ['Cengkareng, Jakarta Barat, DKI Jakarta', -6.150, 106.735], ['Cilandak, Jakarta Selatan, DKI Jakarta', -6.290, 106.800],
    ['Tangerang Selatan, Banten', -6.288, 106.718], ['Bekasi Selatan, Kota Bekasi, Jawa Barat', -6.268, 106.985],
    ['Depok, Jawa Barat', -6.402, 106.795], ['Bogor Tengah, Kota Bogor, Jawa Barat', -6.595, 106.806],
    ['Coblong, Kota Bandung, Jawa Barat', -6.887, 107.613], ['Cirebon, Jawa Barat', -6.732, 108.552],
    ['Semarang Tengah, Kota Semarang, Jawa Tengah', -6.985, 110.420], ['Banyumanik, Kota Semarang, Jawa Tengah', -7.070, 110.430],
    ['Surakarta, Jawa Tengah', -7.567, 110.825], ['Gondokusuman, Kota Yogyakarta, DI Yogyakarta', -7.783, 110.378],
    ['Sukolilo, Kota Surabaya, Jawa Timur', -7.290, 112.800], ['Lowokwaru, Kota Malang, Jawa Timur', -7.950, 112.620],
    ['Denpasar Selatan, Kota Denpasar, Bali', -8.700, 115.215], ['Mataram, Nusa Tenggara Barat', -8.583, 116.117],
    ['Kupang, Nusa Tenggara Timur', -10.178, 123.598], ['Medan Kota, Kota Medan, Sumatera Utara', 3.595, 98.678],
    ['Banda Aceh, Aceh', 5.548, 95.323], ['Padang Barat, Kota Padang, Sumatera Barat', -0.947, 100.354],
    ['Pekanbaru Kota, Riau', 0.507, 101.447], ['Batam Kota, Kepulauan Riau', 1.130, 104.053],
    ['Jambi Selatan, Kota Jambi, Jambi', -1.610, 103.610], ['Ilir Timur, Kota Palembang, Sumatera Selatan', -2.976, 104.775],
    ['Tanjung Karang, Kota Bandar Lampung, Lampung', -5.430, 105.262], ['Pontianak Kota, Kalimantan Barat', -0.027, 109.343],
    ['Balikpapan Kota, Kalimantan Timur', -1.265, 116.831], ['Banjarmasin Tengah, Kalimantan Selatan', -3.320, 114.590],
    ['Palangka Raya, Kalimantan Tengah', -2.210, 113.920], ['Ujung Pandang, Kota Makassar, Sulawesi Selatan', -5.135, 119.412],
    ['Manado, Sulawesi Utara', 1.474, 124.842], ['Palu Barat, Kota Palu, Sulawesi Tengah', -0.895, 119.860],
    ['Kendari, Sulawesi Tenggara', -3.997, 122.513], ['Ambon, Maluku', -3.696, 128.181],
    ['Ternate, Maluku Utara', 0.790, 127.376], ['Jayapura, Papua', -2.533, 140.717], ['Sorong, Papua Barat Daya', -0.876, 131.261]
  ].map((a, i) => ({ id: 'SIM' + (i + 1), name: a[0], lat: a[1], lng: a[2] }));

  const km = (a, b) => { const R = 6371, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r;
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function search(q) {
    q = norm(q).trim(); if (q.length < 2) return [];
    return A.filter(a => norm(a.name).includes(q)).slice(0, 8).map(a => ({ id: a.id, name: a.name }));
  }
  const COURIERS = [
    { code: 'jne', name: 'JNE', service: 'REG', mult: 1.00, speed: 1.0 },
    { code: 'jnt', name: 'J&T', service: 'EZ', mult: 0.94, speed: 1.1 },
    { code: 'sicepat', name: 'SiCepat', service: 'BEST', mult: 1.06, speed: 0.85 },
    { code: 'pos', name: 'POS Indonesia', service: 'Reguler', mult: 0.82, speed: 1.4 }
  ];
  function rates(destId, grams) {
    const d = A.find(a => a.id === destId); if (!d) return [];
    const dist = km(ORIGIN, d), kg = Math.max(1, Math.ceil((grams || 1) / 1000));
    const perKg = dist < 30 ? 9000 : dist < 200 ? 11000 : dist < 800 ? 16000 : dist < 1500 ? 24000 : dist < 2500 ? 34000 : 46000;
    return COURIERS.map(c => {
      const cost = Math.round(perKg * kg * c.mult / 500) * 500;
      const lo = Math.max(1, Math.round((1 + dist / 900) * c.speed)), hi = lo + (dist < 200 ? 1 : 2);
      return { code: c.code, courier: c.name, service: c.service, cost, eta: lo + '-' + hi + ' hari' };
    }).sort((a, b) => a.cost - b.cost);
  }
  window.Ongkir = { simulated: true, origin: ORIGIN.name, search, rates };
})();
