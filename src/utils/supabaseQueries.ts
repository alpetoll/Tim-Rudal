import { supabase } from './supabaseClient';
import { Lahan, RiwayatPanen } from '../types';

// ==========================================
// 1. QUERY LAHAN SAWAH
// ==========================================

// Mengambil seluruh lahan milik petani tertentu
export async function getLahans(petaniId: string): Promise<Lahan[]> {
  const { data, error } = await supabase
    .from('lahan')
    .select('*')
    .eq('petani_id', petaniId);

  if (error) {
    console.error('Gagal mengambil data lahan:', error.message);
    return [];
  }

  // Map database snake_case fields to frontend camelCase model
  return (data || []).map(row => ({
    id: row.id,
    nama: row.nama,
    luas: Number(row.luas),
    koordinat: typeof row.koordinat === 'string' ? JSON.parse(row.koordinat) : row.koordinat,
    centroid: typeof row.centroid === 'string' ? JSON.parse(row.centroid) : row.centroid,
    ketinggian: row.ketinggian,
    curahHujan: Number(row.curah_hujan),
    suhu: Number(row.suhu),
    tipeDrainase: row.tipe_drainase,
    jenisTanah: row.jenis_tanah,
    riwayatHama: row.riwayat_hama,
    pH: row.ph || undefined,
    slope: row.slope || undefined,
    clay: row.clay ? Number(row.clay) : undefined,
    sand: row.sand ? Number(row.sand) : undefined,
    cec: row.cec ? Number(row.cec) : undefined,
    status: row.status,
    varietasDitanam: row.varietas_ditanam || undefined,
    tanggalTanam: row.tanggal_tanam || undefined,
    kebutuhanAirDaily: row.kebutuhan_air_daily ? Number(row.kebutuhan_air_daily) : undefined,
    estimasiPanenDate: row.estimasi_panen_date || undefined,
    catatanMitigasi: row.catatan_mitigasi || undefined
  }));
}

// Menyimpan lahan sawah baru ke Supabase
export async function insertLahan(lahan: Omit<Lahan, 'id' | 'status'>, petaniId: string): Promise<Lahan | null> {
  const { data, error } = await supabase
    .from('lahan')
    .insert([
      {
        petani_id: petaniId,
        nama: lahan.nama,
        luas: lahan.luas,
        koordinat: lahan.koordinat, // Supabase automatically handles JSONB conversion
        centroid: lahan.centroid,
        ketinggian: lahan.ketinggian,
        curah_hujan: lahan.curahHujan,
        suhu: lahan.suhu,
        tipe_drainase: lahan.tipeDrainase,
        jenis_tanah: lahan.jenisTanah,
        riwayat_hama: lahan.riwayatHama,
        ph: lahan.pH || null,
        slope: lahan.slope || null,
        clay: lahan.clay || null,
        sand: lahan.sand || null,
        cec: lahan.cec || null,
        status: 'kosong'
      }
    ])
    .select();

  if (error) {
    console.error('Gagal menyimpan lahan:', error.message);
    return null;
  }

  const row = data[0];
  return {
    id: row.id,
    nama: row.nama,
    luas: Number(row.luas),
    koordinat: row.koordinat,
    centroid: row.centroid,
    ketinggian: row.ketinggian,
    curahHujan: Number(row.curah_hujan),
    suhu: Number(row.suhu),
    tipeDrainase: row.tipe_drainase,
    jenisTanah: row.jenis_tanah,
    riwayatHama: row.riwayat_hama,
    pH: row.ph || undefined,
    slope: row.slope || undefined,
    clay: row.clay ? Number(row.clay) : undefined,
    sand: row.sand ? Number(row.sand) : undefined,
    cec: row.cec ? Number(row.cec) : undefined,
    status: row.status
  };
}

// Memulai penanaman (mengubah status lahan menjadi 'sedang-ditanam')
export async function startTanamLahan(
  lahanId: string, 
  tanamanName: string, 
  kebutuhanAir: number, 
  estimasiPanen: string, 
  mitigasi: string
): Promise<boolean> {
  const { error } = await supabase
    .from('lahan')
    .update({
      status: 'sedang-ditanam',
      varietas_ditanam: tanamanName,
      tanggal_tanam: new Date().toISOString().split('T')[0],
      kebutuhan_air_daily: kebutuhanAir,
      estimasi_panen_date: estimasiPanen,
      catatan_mitigasi: mitigasi
    })
    .eq('id', lahanId);

  if (error) {
    console.error('Gagal mengupdate tanam lahan:', error.message);
    return false;
  }
  return true;
}

// Mengubah status lahan (misal: dari 'sedang-ditanam' ke 'siap-panen')
export async function updateLahanStatus(lahanId: string, newStatus: 'siap-panen' | 'kosong'): Promise<boolean> {
  const { error } = await supabase
    .from('lahan')
    .update({ status: newStatus })
    .eq('id', lahanId);

  if (error) {
    console.error('Gagal memperbarui status lahan:', error.message);
    return false;
  }
  return true;
}


// ==========================================
// 2. QUERY RIWAYAT PANEN
// ==========================================

// Mengambil log riwayat panen milik petani
export async function getRiwayatPanens(petaniId: string): Promise<RiwayatPanen[]> {
  const { data, error } = await supabase
    .from('riwayat_panen')
    .select('*')
    .eq('petani_id', petaniId);

  if (error) {
    console.error('Gagal mengambil riwayat panen:', error.message);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    lahanId: row.lahan_id,
    namaLahan: row.nama_lahan,
    varietas: row.varietas,
    tanggalPanen: row.tanggal_panen,
    statusHasil: row.status_hasil,
    beratPanen: Number(row.berat_panen),
    pendapatanEstimasi: Number(row.pendapatan_estimasi)
  }));
}

// Menghapus riwayat panen berdasarkan ID
export async function deleteRiwayatPanen(riwayatId: string): Promise<boolean> {
  const { error } = await supabase
    .from('riwayat_panen')
    .delete()
    .eq('id', riwayatId);

  if (error) {
    console.error('Gagal menghapus riwayat panen:', error.message);
    return false;
  }
  return true;
}

// Menyimpan catatan hasil panen baru dan mengosongkan lahan
export async function insertRiwayatPanen(
  panenData: Omit<RiwayatPanen, 'id'>, 
  petaniId: string
): Promise<boolean> {
  // 1. Simpan data riwayat panen
  const { error: insertError } = await supabase
    .from('riwayat_panen')
    .insert([
      {
        petani_id: petaniId,
        lahan_id: panenData.lahanId,
        nama_lahan: panenData.namaLahan,
        varietas: panenData.varietas,
        tanggal_panen: panenData.tanggalPanen,
        status_hasil: panenData.statusHasil,
        berat_panen: panenData.beratPanen,
        pendapatan_estimasi: panenData.pendapatanEstimasi
      }
    ]);

  if (insertError) {
    console.error('Gagal menyimpan riwayat panen:', insertError.message);
    return false;
  }

  // 2. Reset lahan menjadi kosong kembali
  const { error: updateError } = await supabase
    .from('lahan')
    .update({
      status: 'kosong',
      varietas_ditanam: null,
      tanggal_tanam: null,
      kebutuhan_air_daily: null,
      estimasi_panen_date: null,
      catatan_mitigasi: null
    })
    .eq('id', panenData.lahanId);

  if (updateError) {
    console.error('Gagal mengosongkan kembali lahan pasca-panen:', updateError.message);
    return false;
  }

  return true;
}

// Menghapus lahan dari database
export async function deleteLahan(lahanId: string): Promise<boolean> {
  const { error } = await supabase
    .from('lahan')
    .delete()
    .eq('id', lahanId);

  if (error) {
    console.error('Gagal menghapus lahan:', error.message);
    return false;
  }
  return true;
}

// Memperbarui data Lahan (Edit Lahan)
export async function updateLahanDetails(lahanId: string, lahan: Omit<Lahan, 'id' | 'status'>): Promise<boolean> {
  const { error } = await supabase
    .from('lahan')
    .update({
      nama: lahan.nama,
      luas: lahan.luas,
      koordinat: lahan.koordinat,
      centroid: lahan.centroid,
      ketinggian: lahan.ketinggian,
      curah_hujan: lahan.curahHujan,
      suhu: lahan.suhu,
      tipe_drainase: lahan.tipeDrainase,
      jenis_tanah: lahan.jenisTanah,
      riwayat_hama: lahan.riwayatHama,
      ph: lahan.pH || null,
      slope: lahan.slope || null,
      clay: lahan.clay || null,
      sand: lahan.sand || null,
      cec: lahan.cec || null,
    })
    .eq('id', lahanId);

  if (error) {
    console.error('Gagal memperbarui lahan:', error.message);
    return false;
  }
  return true;
}

// ==========================================
// 4. QUERY PROFIL PETANI
// ==========================================
export async function updatePetaniProfile(petaniId: string, nama: string, komoditas: string): Promise<boolean> {
  const { error } = await supabase
    .from('petani')
    .update({ nama: nama, komoditas_utama: komoditas })
    .eq('id', petaniId);

  if (error) {
    console.error('Gagal memperbarui profil petani:', error.message);
    return false;
  }
  return true;
}

export async function getTanamanList(): Promise<any[]> {
  const { data, error } = await supabase
    .from('tanaman')
    .select('*, kriteria_tanaman(*)');

  if (error) {
    console.error('Gagal mengambil daftar tanaman:', error.message);
    return [];
  }
  return data || [];
}

// ==========================================
// 5. QUERY LOG AKTIVITAS (ACTIVITY LOGS)
// ==========================================
export async function getTodayActivityLogs(landId: string): Promise<any[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('land_id', landId)
    .gte('created_at', `${today}T00:00:00.000Z`)
    .lte('created_at', `${today}T23:59:59.999Z`);

  if (error) {
    console.error('Gagal mengambil log aktivitas hari ini:', error.message);
    return [];
  }
  return data || [];
}

export async function upsertActivityLog(landId: string, activityName: string, isCompleted: boolean): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  
  // Check if entry exists for today
  const { data: existing, error: fetchError } = await supabase
    .from('activity_logs')
    .select('id')
    .eq('land_id', landId)
    .eq('activity_name', activityName)
    .gte('created_at', `${today}T00:00:00.000Z`)
    .lte('created_at', `${today}T23:59:59.999Z`)
    .limit(1);

  if (fetchError) {
    console.error('Gagal mengecek log aktivitas:', fetchError.message);
  }

  if (existing && existing.length > 0) {
    // Update
    const { error } = await supabase
      .from('activity_logs')
      .update({ is_completed: isCompleted })
      .eq('id', existing[0].id);

    if (error) {
      console.error('Gagal memperbarui log aktivitas:', error.message);
      return false;
    }
  } else {
    // Insert
    const { error } = await supabase
      .from('activity_logs')
      .insert([
        {
          land_id: landId,
          activity_name: activityName,
          is_completed: isCompleted,
          created_at: new Date().toISOString()
        }
      ]);

    if (error) {
      console.error('Gagal membuat log aktivitas baru:', error.message);
      return false;
    }
  }
  return true;
}

// ==========================================
// 6. QUERY CLIMATE SCENARIOS
// ==========================================
export async function getClimateScenarios(): Promise<any[]> {
  const { data, error } = await supabase
    .from('climate_scenarios')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('Gagal mengambil skenario iklim:', error.message);
    return [];
  }
  return data || [];
}

