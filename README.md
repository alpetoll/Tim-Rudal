<div align="center">
  <img src="public/assets/logo.webp" alt="Logo" width="120" />
  
  # Smart AgriMap & Crop Suitability Analyzer
  **Platform Pemetaan Lahan & Analisis Cerdas Kelayakan Tanam Nusantara**

  [![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
  [![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
  [![Leaflet](https://img.shields.io/badge/Leaflet-Maps-199900?style=for-the-badge&logo=leaflet)](https://leafletjs.com/)

  *Proyek ini dikembangkan untuk ajang kompetisi **Lomba TIC (Tech Innovation Challenge)***.
</div>

---

## 📖 Deskripsi Proyek
**Smart AgriMap** adalah aplikasi berbasis web revolusioner yang dirancang khusus untuk membantu petani, penyuluh pertanian, dan pengambil kebijakan dalam menentukan **komoditas tanaman paling presisi dan menguntungkan** untuk suatu petak lahan.

Dengan menggabungkan teknologi Sistem Informasi Geografis (GIS) dan algoritma kesesuaian lahan (merujuk pada standar agroklimatologi / FAO), aplikasi ini mampu melakukan evaluasi mendalam terhadap suhu, curah hujan, pH, elevasi (kemiringan), dan tekstur tanah. Hasilnya bukan hanya skor kecocokan, melainkan juga **langkah mitigasi taktis** (kebutuhan pupuk, kapur pertanian, dan irigasi) serta perhitungan proyeksi hasil panen.

---

## ✨ Fitur Unggulan

- 🗺️ **Pemetaan Lahan Interaktif (Interactive GIS)** 
  Petani dapat menggambar (*polygon mapping*) batas lahan mereka langsung di atas peta satelit. Sistem secara otomatis akan menghitung luas lahan (m²) dan titik pusat koordinat (*centroid*).
  
- 🔬 **Analisis Kelayakan Lahan Multi-Parameter**
  Mengevaluasi kecocokan tanaman yang dipilih berdasarkan parameter krusial: Suhu Udara, Curah Hujan, pH Tanah, Kemiringan (Slope), Tekstur Tanah, dan KTK Tanah. Output dievaluasi dalam kelas kesesuaian: `S1` (Sangat Sesuai), `S2` (Sesuai), `S3` (Sesuai Marginal), hingga `N` (Tidak Sesuai).

- 💡 **Rekomendasi & Mitigasi Taktis Otomatis**
  Jika lahan terdeteksi terlalu asam (pH rendah), sistem akan otomatis menghitung estimasi **kebutuhan Dolomit/Kapur Pertanian** per hektar. Jika tekstur tanah kurang ideal, sistem memberikan rekomendasi jumlah pemupukan organik yang presisi.

- 🔄 **Sistem Rekomendasi Tanaman Alternatif (*Smart Recommender*)**
  Jika tanaman yang dipilih dirasa kurang cocok (Skor < 90), AI aplikasi akan mencari silang seluruh database komoditas dan merekomendasikan daftar tanaman pengganti yang 100% cocok dengan kondisi lahan tersebut.

- 💰 **Kalkulator Panen & Proyeksi Ekonomi**
  Terintegrasi dengan sistem pencatatan Riwayat Panen. Menghitung otomatis estimasi tonase hasil panen berdasarkan luas lahan dan harga pasar (*real-time* base) untuk memproyeksikan potensi pendapatan kotor petani.

---

## 🛠️ Tech Stack & Teknologi

Aplikasi ini dibangun menggunakan arsitektur modern untuk memastikan performa yang cepat, aman, dan *scalable*:

- **Frontend:** [Next.js](https://nextjs.org/) (App Router), React, TypeScript
- **Styling UI:** [Tailwind CSS](https://tailwindcss.com/), Framer Motion (Micro-animations)
- **Database & Auth:** [Supabase](https://supabase.com/) (PostgreSQL), Supabase Auth
- **Mapping/GIS:** React-Leaflet, Leaflet.js
- **Icons & Assets:** Lucide React

---

## ⚙️ Instalasi & Menjalankan Aplikasi Lokal

Ikuti langkah-langkah berikut untuk menjalankan proyek ini di komputer Anda (Localhost).

### Prasyarat
- Node.js (Versi 18 atau lebih baru)
- Akun [Supabase](https://supabase.com/) (untuk *environment variables*)

### Langkah-langkah

1. **Clone repository ini**
   ```bash
   git clone https://github.com/username-anda/smart-agrimap-tic.git
   cd smart-agrimap-tic
   ```

2. **Install Dependencies**
   ```bash
   npm install
   # atau menggunakan yarn
   yarn install
   ```

3. **Konfigurasi Environment Variables**
   Buat file `.env.local` di root folder aplikasi Anda dan masukkan kredensial Supabase Anda:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-ID].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[KUNCI-ANON-ANDA]
   ```

4. **Jalankan Development Server**
   ```bash
   npm run dev
   # atau menggunakan yarn
   yarn dev
   ```

5. **Buka Aplikasi**
   Buka browser Anda dan kunjungi [http://localhost:3000](http://localhost:3000).

---

## 📂 Struktur Database Utama (Supabase)
Sistem ini menggunakan *relational database* dengan tabel utama sebagai berikut:
- `lahan`: Menyimpan data geometri lahan, luas, lokasi, dan properti fisik tanah.
- `tanaman`: Menyimpan profil, usia panen, potensi hasil, dan harga pasar komoditas.
- `kriteria_tanaman`: Menyimpan ambang batas toleransi (S1, S2, S3, N) untuk suhu, hujan, pH, dan kemiringan tiap tanaman.
- `riwayat_panen`: Sistem pencatatan historis hasil tani dan pendapatan.

---

## 🏆 Dikembangkan Untuk
**Lomba TIC (Tech Innovation Challenge)**
*Inovasi Teknologi Digital untuk Mendukung Ketahanan Pangan dan Pertanian Cerdas Masa Depan.*

> *"Membawa Presisi Agroklimatologi ke Genggaman Petani."*

---

## ⚠️ PENTING: Pengaturan Konfirmasi Email (Authentication)
> [!WARNING]
> **Email confirmation dinonaktifkan sementara** pada dashboard Supabase untuk mempercepat proses development dan testing. Hal ini memungkinkan alur pendaftaran (*signup*) langsung mengarah ke dashboard tanpa perlu memverifikasi email terlebih dahulu.
> 
> **Sebelum merilis ke pengguna nyata (production):**
> 1. Aktifkan kembali opsi **"Confirm email"** di Dashboard Supabase (**Authentication -> Providers -> Email**).
> 2. Pastikan konfigurasi Vercel Deployment Protection dan redirect URL sudah disiapkan dengan benar agar tautan konfirmasi email tidak menghasilkan halaman kesalahan ketika diklik oleh pengguna.

