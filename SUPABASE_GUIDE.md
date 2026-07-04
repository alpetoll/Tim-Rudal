# Panduan Integrasi Supabase - EkoTani 🌾

Dokumen ini memandu Anda langkah-demi-langkah untuk menyiapkan, membuat tabel, dan menghubungkan aplikasi web geospatial **EkoTani** dengan database **Supabase (PostgreSQL)**.

---

## Langkah 1: Buat Project Baru di Supabase

1. Masuk ke [Supabase Dashboard](https://supabase.com/dashboard) (buat akun gratis jika belum ada).
2. Klik **New Project** dan pilih organisasi Anda.
3. Isi detail project:
   - **Name**: `EkoTani`
   - **Database Password**: *Buat password yang kuat (simpan baik-baik)*
   - **Region**: Pilih region terdekat, misalnya **Singapore (ap-southeast-1)**.
   - **Pricing Plan**: Pilih **Free Tier**.
4. Klik **Create new project** dan tunggu 1-2 menit sampai database siap.

---

## Langkah 2: Buat Tabel Database (SQL Schema)

Setelah project siap:
1. Di menu sidebar kiri dashboard Supabase, pilih **SQL Editor** (ikon persegi dengan tulisan SQL).
2. Klik **New query**.
3. Salin dan tempel (copy-paste) skrip SQL di bawah ini ke editor tersebut:

```sql
-- 1. Membuat Tabel Petani (Profil Pengguna)
CREATE TABLE public.petani (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  nama TEXT NOT NULL,
  email TEXT,
  komoditas_utama TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Membuat Tabel Lahan Sawah
CREATE TABLE public.lahan (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  petani_id UUID REFERENCES public.petani(id) ON DELETE CASCADE NOT NULL,
  nama TEXT NOT NULL,
  luas NUMERIC NOT NULL, -- m2
  koordinat JSONB NOT NULL, -- Menyimpan array koordinat [[lat, lng], ...]
  centroid JSONB NOT NULL, -- [lat, lng]
  ketinggian INTEGER NOT NULL, -- mdpl
  curah_hujan NUMERIC NOT NULL, -- mm/bulan
  suhu NUMERIC NOT NULL, -- °C
  tipe_drainase TEXT CHECK (tipe_drainase IN ('Baik', 'Buruk')) DEFAULT 'Baik' NOT NULL,
  jenis_tanah TEXT CHECK (jenis_tanah IN ('Humus', 'Lempung', 'Pasir', 'Gambut')) DEFAULT 'Lempung' NOT NULL,
  riwayat_hama TEXT CHECK (riwayat_hama IN ('Ada', 'Tidak')) DEFAULT 'Tidak' NOT NULL,
  status TEXT CHECK (status IN ('kosong', 'sedang-ditanam', 'siap-panen')) DEFAULT 'kosong' NOT NULL,
  varietas_ditanam TEXT,
  tanggal_tanam DATE,
  kebutuhan_air_daily NUMERIC,
  estimasi_panen_date DATE,
  catatan_mitigasi TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Membuat Tabel Riwayat Panen
CREATE TABLE public.riwayat_panen (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lahan_id UUID REFERENCES public.lahan(id) ON DELETE SET NULL,
  petani_id UUID REFERENCES public.petani(id) ON DELETE CASCADE NOT NULL,
  nama_lahan TEXT NOT NULL,
  varietas TEXT NOT NULL,
  tanggal_panen DATE DEFAULT CURRENT_DATE NOT NULL,
  status_hasil TEXT CHECK (status_hasil IN ('sukses', 'gagal', 'sebagian')) NOT NULL,
  berat_panen NUMERIC NOT NULL, -- kg
  pendapatan_estimasi NUMERIC NOT NULL, -- Rupiah
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Membuat Tabel Log Aktivitas (Activity Logs)
CREATE TABLE public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  land_id UUID REFERENCES public.lahan(id) ON DELETE CASCADE NOT NULL,
  activity_name TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Aktifkan Row Level Security (RLS) agar data aman per petani
ALTER TABLE public.petani ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lahan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riwayat_panen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 6. Kebijakan Keamanan (RLS Policies)
-- Pengguna hanya bisa membaca dan mengubah data mereka sendiri

CREATE POLICY "Petani dapat mengelola data profilnya sendiri" 
ON public.petani FOR ALL USING (auth.uid() = id);

CREATE POLICY "Petani dapat mengelola lahannya sendiri" 
ON public.lahan FOR ALL USING (auth.uid() = petani_id);

CREATE POLICY "Petani dapat mengelola riwayat panennya sendiri" 
ON public.riwayat_panen FOR ALL USING (auth.uid() = petani_id);

CREATE POLICY "Petani dapat mengelola log aktivitas lahannya sendiri" 
ON public.activity_logs FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.lahan 
    WHERE public.lahan.id = public.activity_logs.land_id 
    AND public.lahan.petani_id = auth.uid()
  )
);
```

4. Klik tombol **Run** di kanan bawah. Anda akan melihat pesan **Success** jika tabel berhasil dibuat.

---

## Langkah 3: Konfigurasi Next.js

1. Cari kredensial API Supabase Anda di **Project Settings** > **API**.
2. Di dalam folder proyek Next.js Anda (`E:\PROJEK\LOMBA TIC`), buat file baru bernama `.env.local`.
3. Isi file tersebut dengan URL dan Anon Key Anda seperti ini:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx-your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxxxx
```

---

## Langkah 4: Cara Penggunaan di Code Next.js

Berikut adalah contoh bagaimana kita menghubungkan database ini menggunakan Supabase JavaScript Client.

### 1. Inisialisasi Supabase Client (`src/utils/supabaseClient.ts`)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### 2. Membaca Data Lahan dari Supabase (Query SELECT)

```typescript
async function fetchLahan(petaniId: string) {
  const { data, error } = await supabase
    .from('lahan')
    .select('*')
    .eq('petani_id', petaniId);

  if (error) {
    console.error('Gagal mengambil data:', error.message);
    return [];
  }
  return data; // Mengembalikan array lahan sawah
}
```

### 3. Menyimpan Lahan Baru (Query INSERT)

```typescript
async function simpanLahanBaru(lahanData: Omit<Lahan, 'id'>, petaniId: string) {
  const { data, error } = await supabase
    .from('lahan')
    .insert([
      {
        petani_id: petaniId,
        nama: lahanData.nama,
        luas: lahanData.luas,
        koordinat: lahanData.koordinat, // JSON Array otomatis
        centroid: lahanData.centroid,
        ketinggian: lahanData.ketinggian,
        curah_hujan: lahanData.curahHujan,
        suhu: lahanData.suhu,
        tipe_drainase: lahanData.tipeDrainase,
        jenis_tanah: lahanData.jenisTanah,
        riwayat_hama: lahanData.riwayatHama,
        status: 'kosong'
      }
    ])
    .select();

  if (error) {
    console.error('Gagal menyimpan lahan:', error.message);
    return null;
  }
  return data[0];
}
```

### 4. Memperbarui Status Lahan setelah Tanam (Query UPDATE)

```typescript
async function updateStatusTanam(lahanId: string, status: string, varietas: string) {
  const { error } = await supabase
    .from('lahan')
    .update({ 
      status: status, 
      varietas_ditanam: varietas,
      tanggal_tanam: new Date().toISOString().split('T')[0]
    })
    .eq('id', lahanId);

  if (error) {
    console.error('Gagal mengupdate status:', error.message);
  }
}
```

### 5. Menghapus Lahan (Query DELETE)

```typescript
async function hapusLahan(lahanId: string) {
  const { error } = await supabase
    .from('lahan')
    .delete()
    .eq('id', lahanId);

  if (error) {
    console.error('Gagal menghapus:', error.message);
  }
}
```

---

## Keuntungan Menggunakan Supabase untuk EkoTani 🚀

1. **Aman**: Setiap data diproteksi oleh *Row Level Security (RLS)* PostgreSQL. Petani A tidak akan pernah bisa mengintip koordinat sawah Petani B.
2. **Real-time**: Supabase memiliki fitur *Subscription* bawaan. Jika sensor cuaca atau warga melaporkan hama, data di HP petani langsung ter-update tanpa perlu refresh halaman.
3. **Autentikasi Instan**: Supabase Auth mendukung fitur login email/password serta OAuth (Login Google/WhatsApp) secara langsung tanpa perlu coding rumit.
