import { Lahan } from '@/types';
import { evaluasiLahanDinamis, cekKelayakan, HasilEvaluasi } from './suitability';
import { supabase } from './supabaseClient';

/**
 * Mengembalikan objek data lahan baru dengan modifikasi suhu dan curah hujan sesuai skenario.
 */
export function applyScenarioDelta(
  dataLahanAsli: Lahan,
  scenario: { delta_suhu: number; delta_curah_hujan_persen: number }
): Lahan {
  const deltaSuhu = Number(scenario.delta_suhu || 0);
  const deltaCurahHujanPersen = Number(scenario.delta_curah_hujan_persen || 0);

  return {
    ...dataLahanAsli,
    suhu: Math.round((dataLahanAsli.suhu + deltaSuhu) * 10) / 10,
    curahHujan: Math.round(dataLahanAsli.curahHujan * (1 + deltaCurahHujanPersen / 100))
  };
}

/**
 * Memanggil ulang fungsi evaluasi kelayakan dengan data lahan hasil simulasi.
 */
export function runStressTest(
  dataLahan: Lahan,
  activeCrop: any,
  scenario: { delta_suhu: number; delta_curah_hujan_persen: number }
): HasilEvaluasi {
  const modifiedLahan = applyScenarioDelta(dataLahan, scenario);

  if (activeCrop.kriteria_tanaman) {
    // Tanaman dinamis dari database Supabase
    return evaluasiLahanDinamis(modifiedLahan, activeCrop);
  } else {
    // Tanaman statis dari database lokal (TANAMAN_DATABASE)
    return cekKelayakan(modifiedLahan, activeCrop.id);
  }
}

/**
 * Menyimpan hasil stress test ke tabel stress_test_results.
 */
export async function saveStressTestResult(
  lahanId: string,
  scenarioId: number,
  skorNormal: number,
  hasilSimulasi: HasilEvaluasi
): Promise<string | null> {
  const status = hasilSimulasi.skor >= 75 ? 'S1' :
                 hasilSimulasi.skor >= 50 ? 'S2' :
                 'N';

  const { data, error } = await supabase
    .from('stress_test_results')
    .insert([
      {
        lahan_id: lahanId,
        scenario_id: scenarioId,
        skor_normal: skorNormal,
        skor_skenario: hasilSimulasi.skor,
        status_kelayakan_skenario: status,
        user_aware_of_climate_risk: false,
        keputusan_user: null
      }
    ])
    .select('id')
    .single();

  if (error) {
    console.error('Gagal menyimpan hasil stress test:', error.message);
    return null;
  }

  return data?.id || null;
}

/**
 * Memperbarui kolom keputusan user di tabel stress_test_results.
 */
export async function updateUserDecision(
  stressTestId: string,
  keputusan: 'tetap_tanam' | 'pilih_alternatif'
): Promise<boolean> {
  const { error } = await supabase
    .from('stress_test_results')
    .update({
      user_aware_of_climate_risk: true,
      keputusan_user: keputusan
    })
    .eq('id', stressTestId);

  if (error) {
    console.error('Gagal mengupdate keputusan user:', error.message);
    return false;
  }

  return true;
}
