-- =========================================================================
-- SQL Migration: Membuat Tabel 'climate_scenarios' dan 'stress_test_results'
-- Dibuat untuk: Aplikasi EcoTani
-- Tanggal: 2026-07-04
-- =========================================================================

-- 1. Membuat Tabel Skenario Iklim (Master Data Skenario)
CREATE TABLE IF NOT EXISTS public.climate_scenarios (
  id SERIAL PRIMARY KEY,
  nama_skenario TEXT NOT NULL UNIQUE,
  delta_suhu NUMERIC NOT NULL,
  delta_curah_hujan_persen NUMERIC NOT NULL,
  deskripsi TEXT NOT NULL
);

-- Seed data skenario awal jika belum ada
INSERT INTO public.climate_scenarios (nama_skenario, delta_suhu, delta_curah_hujan_persen, deskripsi)
VALUES 
  ('Gelombang Panas (El Niño)', 1.5, -20.0, 'Simulasi kondisi suhu ekstrem dan kekeringan akibat pola El Niño'),
  ('Hujan Ekstrem (La Niña)', -0.5, 30.0, 'Simulasi curah hujan berlebih akibat pola La Niña')
ON CONFLICT (nama_skenario) DO NOTHING;

-- 2. Membuat Tabel Hasil Climate Stress-Test
CREATE TABLE IF NOT EXISTS public.stress_test_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lahan_id UUID NOT NULL REFERENCES public.lahan(id) ON DELETE CASCADE,
  scenario_id INTEGER NOT NULL REFERENCES public.climate_scenarios(id) ON DELETE CASCADE,
  skor_normal NUMERIC NOT NULL,
  skor_skenario NUMERIC NOT NULL,
  status_kelayakan_skenario TEXT NOT NULL,
  user_aware_of_climate_risk BOOLEAN DEFAULT FALSE NOT NULL,
  keputusan_user TEXT CHECK (keputusan_user IN ('tetap_tanam', 'pilih_alternatif')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Mengaktifkan Row Level Security (RLS) pada kedua tabel
ALTER TABLE public.climate_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stress_test_results ENABLE ROW LEVEL SECURITY;

-- 4. Membuat Kebijakan RLS untuk climate_scenarios (Dapat dibaca oleh semua user)
DROP POLICY IF EXISTS "Allow public read access on climate_scenarios" ON public.climate_scenarios;
CREATE POLICY "Allow public read access on climate_scenarios"
ON public.climate_scenarios
FOR SELECT
TO public
USING (true);

-- 5. Kebijakan RLS untuk stress_test_results (Hanya pemilik lahan yang bersangkutan)
DROP POLICY IF EXISTS "Stress test SELECT policy" ON public.stress_test_results;
DROP POLICY IF EXISTS "Stress test INSERT policy" ON public.stress_test_results;
DROP POLICY IF EXISTS "Stress test UPDATE policy" ON public.stress_test_results;

-- SELECT policy: Pemilik lahan dapat membaca data stress test
CREATE POLICY "Stress test SELECT policy"
ON public.stress_test_results
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lahan 
    WHERE lahan.id = stress_test_results.lahan_id 
      AND lahan.petani_id = auth.uid()
  )
);

-- INSERT policy: Pemilik lahan dapat menambah data stress test dengan WITH CHECK eksplisit
CREATE POLICY "Stress test INSERT policy"
ON public.stress_test_results
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lahan 
    WHERE lahan.id = lahan_id 
      AND lahan.petani_id = auth.uid()
  )
);

-- UPDATE policy: Pemilik lahan dapat memperbarui data stress test miliknya
CREATE POLICY "Stress test UPDATE policy"
ON public.stress_test_results
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lahan 
    WHERE lahan.id = stress_test_results.lahan_id 
      AND lahan.petani_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lahan 
    WHERE lahan.id = lahan_id 
      AND lahan.petani_id = auth.uid()
  )
);
