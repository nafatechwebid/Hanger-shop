/* ============================================================
   KONFIGURASI SUPABASE
   Isi 2 nilai di bawah dari: Supabase Dashboard > Project Settings > API
   - SUPABASE_URL      : "Project URL"
   - SUPABASE_ANON_KEY : "anon / publishable key"  (AMAN untuk publik, JANGAN pakai service_role)
   Biarkan kosong untuk menjalankan MODE DEMO (data contoh, tanpa database).
   ============================================================ */
window.APP_CONFIG = {
  SUPABASE_URL: "https://fpxdwbokmblnbautnwpz.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable__kJ6oPjGLoUQKxwOsy34sQ_iidnvgZZ",
  STORAGE_BUCKET: "store",
  // Batas waktu tunggu database (ms). Project yang ter-pause biasanya tidak merespons.
  REQUEST_TIMEOUT: 9000
};
