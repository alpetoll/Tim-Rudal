# Panduan Setup EWS Web Push Notifications (EcoTani)

Sistem Peringatan Dini (EWS) via Web Push Notifications menggunakan Supabase Vault dan `pg_cron` untuk mengotomatisasi pemeriksaan dan pengiriman peringatan cuaca buruk secara real-time.

Langkah-langkah berikut diperlukan untuk mengonfigurasi dan mengaktifkan sistem notifikasi baik di lingkungan lokal maupun produksi.

---

## 1. Konfigurasi Environment Variables

### Frontend (`.env.local`)
Tambahkan kunci VAPID publik berikut ke file `.env.local` proyek Anda:
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BOmcE1qM3DFyUK-LnJfiIqB8gLVcUunGFdXDk5gdPYgcaNe1nqFEDisgsR8zjtPsSLjxu_O6k1D7rIKYOWgiXuI
```

### Supabase Edge Functions Secrets
Simpan rahasia VAPID di lingkungan Supabase Edge Functions Anda dengan menjalankan perintah berikut melalui CLI Anda:
```bash
npx supabase secrets set VAPID_PUBLIC_KEY=BOmcE1qM3DFyUK-LnJfiIqB8gLVcUunGFdXDk5gdPYgcaNe1nqFEDisgsR8zjtPsSLjxu_O6k1D7rIKYOWgiXuI
npx supabase secrets set VAPID_PRIVATE_KEY=okwh-l2QFx518tIXYC0Ep3Ogc8LOMPGe12LKzL-vX_4
npx supabase secrets set VAPID_EMAIL=mailto:contact@ecotani.id
```

---

## 2. Pendaftaran Kredensial di Database Vault (pg_cron Helper)

Agar `pg_cron` dapat memicu Edge Function secara aman tanpa melakukan hardcoding token di file migrasi SQL git, kunci otentikasi disimpan di dalam **Supabase Vault**.

Jalankan perintah SQL berikut di **Supabase SQL Editor** Anda (baik lokal `localhost:54323` atau cloud dashboard):

```sql
-- 1. Bersihkan rahasia jika ada
DELETE FROM vault.decrypted_secrets WHERE name IN ('SUPABASE_PROJECT_URL', 'SUPABASE_SERVICE_ROLE_KEY');

-- 2. Daftarkan URL Proyek Supabase
-- Gunakan http://kong:8000 untuk local docker, atau url production (https://xxxx.supabase.co)
SELECT vault.create_secret(
  'http://kong:8000', -- Ganti dengan URL produksi Anda di server production
  'SUPABASE_PROJECT_URL'
);

-- 3. Daftarkan Service Role Key Supabase Anda
SELECT vault.create_secret(
  'YOUR_SUPABASE_SERVICE_ROLE_KEY', -- Masukkan SERVICE_ROLE_KEY rahasia Anda
  'SUPABASE_SERVICE_ROLE_KEY'
);
```

> [!NOTE]
> Pada lingkungan lokal Docker, database container terhubung dengan Edge Functions container melalui internal proxy `http://kong:8000`. Oleh karena itu, kita menggunakan `'http://kong:8000'` sebagai `SUPABASE_PROJECT_URL` di Vault lokal.

---

## 3. Menjalankan Edge Functions Secara Lokal

Untuk menguji dan menjalankan Edge Functions di lingkungan pengembangan Anda:

```bash
# 1. Jalankan supabase lokal (jika belum berjalan)
npx supabase start

# 2. Jalankan server edge functions lokal
npx supabase functions serve
```

---

## 4. Verifikasi dan Pengujian

* **Verifikasi database & migration**: Pastikan tabel `push_subscriptions` dan `weather_anomaly_logs` sudah terbentuk.
* **Uji Kirim Manual**: Picu fungsi secara manual dengan melakukan `POST` request ke Edge Function `check-weather-anomaly`:
  ```bash
  curl -i --location --request POST 'http://localhost:54321/functions/v1/check-weather-anomaly' \
    --header 'Authorization: Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY'
  ```
