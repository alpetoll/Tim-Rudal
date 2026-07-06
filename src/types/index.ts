export interface KriteriaTanaman {
  id: string;
  tanaman_id: string;
  parameter: string; // e.g. 'Suhu', 'Curah Hujan', 'pH', 'Slope'
  s1_min: number | null;
  s1_max: number | null;
  s2_min: number | null;
  s2_max: number | null;
  s3_min: number | null;
  s3_max: number | null;
  s1_text: string | null;
  s2_text: string | null;
  s3_text: string | null;
  created_at?: string;
}

export interface Tanaman {
  id: string;
  nama: string;
  nama_latin: string | null;
  kategori: string | null;
  siklus_tanam_days: number | null;
  created_at?: string;
}

export interface Lahan {
  id: string;
  nama: string;
  luas: number; // m²
  koordinat: [number, number][]; // Polygon coordinates [[lat, lng], ...]
  centroid: [number, number]; // [lat, lng]
  ketinggian: number; // mdpl
  curahHujan: number; // mm/bulan
  suhu: number; // °C
  tipeDrainase: 'Sangat Terhambat' | 'Terhambat' | 'Agak Terhambat' | 'Agak Baik' | 'Baik' | 'Agak Cepat' | 'Cepat';
  jenisTanah: 'Humus' | 'Lempung' | 'Pasir' | 'Gambut';
  riwayatHama: 'Ada' | 'Tidak';
  pH?: number;
  slope?: number;
  clay?: number;
  sand?: number;
  cec?: number;
  status: 'kosong' | 'sedang-ditanam' | 'siap-panen';
  tanaman_id?: string;
  varietasDitanam?: string;
  tanggalTanam?: string;
  kebutuhanAirDaily?: number; // liter
  estimasiPanenDate?: string;
  catatanMitigasi?: string;
  created_at?: string;
}

export interface RiwayatPanen {
  id: string;
  lahanId: string;
  namaLahan: string;
  varietas: string;
  tanggalPanen: string;
  statusHasil: 'sukses' | 'gagal' | 'sebagian';
  beratPanen: number; // kg
  pendapatanEstimasi: number; // Rupiah
  created_at?: string;
}
