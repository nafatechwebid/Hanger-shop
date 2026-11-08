# Maison Gantung — Toko Pakaian dengan Rak Hanger

Website toko baju statis (HTML/CSS/JS) + database **Supabase**, siap diunggah ke **GitHub Pages**.

**Fitur:** rak hanger interaktif · hover memunculkan nama di kerah & baju maju ke depan · klik untuk zoom dan putar (depan/samping/belakang) · detail ukuran/warna/stok · keranjang · checkout (QRIS statis + maks 5 rekening bank) · navbar Beranda, Tentang Kami, Variasi (maks 10), Hubungi Kami (ikon email & WhatsApp) · Panel Admin · **Auto Pause Supabase (anti-pause + tahan pause)**.

```
index.html            toko              admin.html           panel admin
assets/js/config.js   <-- isi kunci Supabase di sini
supabase/schema.sql   skema database    .github/workflows/keepalive.yml  anti auto-pause
```

---

## 1. Coba dulu di komputer (Mode Demo)
Tanpa Supabase, website langsung berjalan dengan data contoh. Buka folder, jalankan `python3 -m http.server 8000`, lalu buka http://localhost:8000.
(Membuka `index.html` langsung dengan klik ganda juga bisa untuk toko.)

## 2. Buat project Supabase
1. Daftar di https://supabase.com → **New project** (pilih region **Singapore**), simpan password database.
2. Buka **SQL Editor → New query**, tempel seluruh isi `supabase/schema.sql`, klik **Run**. Ini membuat semua tabel, aturan keamanan (RLS), bucket gambar `store`, batas 10 variasi & 5 rekening.
3. **Authentication → Providers → Email**: pastikan aktif. Lalu **Authentication → Sign In / Providers → matikan “Allow new users to sign up”** (PENTING, agar orang lain tidak bisa mendaftar jadi admin).
4. **Authentication → Users → Add user → Create new user**: isi email & password Anda, centang *Auto Confirm User*. Ini akun admin Anda.
5. **Project Settings → API**: salin **Project URL** dan **anon / publishable key**.

## 3. Hubungkan website
Edit `assets/js/config.js`:
```js
SUPABASE_URL: "https://xxxx.supabase.co",
SUPABASE_ANON_KEY: "eyJ...",
```
Kunci *anon* memang boleh publik (data dilindungi RLS). **Jangan pernah** memakai `service_role`.

## 4. Isi data lewat Panel Admin (`/admin.html`)
Masuk dengan akun dari langkah 2.4.
- **Toko & Kontak**: nama toko, judul beranda, Tentang Kami, email, nomor WhatsApp (format `62812…`).
- **Variasi**: tambah/ubah (Hoodie, Jaket, Kemeja, T-Shirt, dst., maks 10).
- **Produk**: nama, variasi, harga, warna, deskripsi, ukuran + stok, unggah gambar. Satu produk = satu hanger.
- **Pembayaran**: unggah gambar QRIS statis toko, isi hingga 5 rekening bank.
- **Pesanan**: lihat pesanan masuk dan ubah statusnya. Stok dikurangi manual dari tab Produk.

**Tips gambar produk:** pakai PNG/WebP latar transparan, tanpa hanger (hanger digambar oleh website). Urutan unggah = urutan putaran: **Depan → Samping kanan → Belakang → Samping kiri**. Gambar pertama tampil di rak. Rasio ± 6:7, lebar 800–1200 px, < 5 MB.

## 5. Upload ke GitHub Pages
1. Buat repository baru di GitHub (mis. `toko-baju`), upload **semua isi folder ini** (termasuk folder `.github` dan file `.nojekyll`).
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save.**
3. Tunggu ± 1 menit. Toko ada di `https://USERNAME.github.io/toko-baju/` dan admin di `.../admin.html`.

## 6. Auto Pause Supabase
Paket gratis Supabase **mem-pause project yang tidak aktif 7 hari**. Ada dua perlindungan:

**A. Anti-pause (keep-alive otomatis)** — `.github/workflows/keepalive.yml` mengakses database tiap 3 hari.
1. Di repo GitHub: **Settings → Secrets and variables → Actions → New repository secret**.
2. Buat `SUPABASE_URL` (Project URL) dan `SUPABASE_ANON_KEY` (anon key).
3. Tab **Actions → Supabase Keep Alive → Run workflow** untuk tes. Harus berstatus hijau.
> Catatan: GitHub menonaktifkan workflow terjadwal pada repo publik yang tanpa aktivitas 60 hari. Bila itu terjadi, buka tab Actions dan klik **Enable**, atau lakukan satu commit kecil.

**B. Tahan pause (bila tetap ter-pause)** — toko tidak error: produk tampil dari cache browser pengunjung, muncul banner “database sedang tidur”, mencoba menyambung ulang tiap 45 detik, dan pesanan tetap bisa dikirim lewat WhatsApp.
Untuk memulihkan: Dashboard Supabase → project → **Restore project** (beberapa menit). Tab **Status DB** di admin berisi tombol tes koneksi.

## 7. Menuju produksi (Payment Gateway)
Tombol “Payment Gateway · SEGERA” sudah disiapkan di checkout. Saat produksi, buat **Supabase Edge Function** untuk membuat transaksi Midtrans/Xendit (kunci rahasia disimpan di Edge Function secrets, bukan di website) dan webhook untuk mengubah status pesanan menjadi `dibayar`. Kolom `orders.payment_method` sudah mendukung nilai `gateway`.

## Pemecahan masalah
| Gejala | Solusi |
|---|---|
| Banner “MODE DEMO” | `config.js` belum diisi / salah |
| Banner “Database sedang tidur” | Project ter-pause → Restore project |
| Admin: “Email atau kata sandi salah” | Pastikan user dibuat di Authentication → Users dan *Auto Confirm* dicentang |
| Gagal unggah gambar | Pastikan `schema.sql` sudah dijalankan penuh (bucket `store`) |
| “Maksimal 10 data” / “Maksimal 5 data” | Batas variasi / rekening; hapus yang lama |
| Perubahan tidak muncul | Muat ulang paksa (Ctrl+Shift+R) |
