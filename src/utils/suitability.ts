import { Lahan, Tanaman } from '../types';

export const TANAMAN_DATABASE: any[] = [
  {
    id: 'padi',
    nama: 'Padi Sawah',
    kebutuhanSuhu: { min: 20, max: 32 },
    kebutuhanCurahHujan: { min: 150, max: 300 },
    kebutuhanKetinggian: { min: 0, max: 1200 },
    tanahCocok: ['Lempung', 'Humus'],
    drainaseCocok: 'Baik',
    siklusTanamDays: 115,
    hargaPasar: { min: 6000, max: 8500 },
    potensiHasil: { min: 0.5, max: 0.8 }, // 5-8 ton/ha
  },
  {
    id: 'jagung',
    nama: 'Jagung',
    kebutuhanSuhu: { min: 21, max: 30 },
    kebutuhanCurahHujan: { min: 80, max: 180 },
    kebutuhanKetinggian: { min: 0, max: 1800 },
    tanahCocok: ['Humus', 'Lempung', 'Pasir'],
    drainaseCocok: 'Baik',
    siklusTanamDays: 100,
    hargaPasar: { min: 4500, max: 6500 },
    potensiHasil: { min: 0.5, max: 0.7 }, // 5-7 ton/ha
  },
  {
    id: 'cabai',
    nama: 'Cabai Merah',
    kebutuhanSuhu: { min: 18, max: 28 },
    kebutuhanCurahHujan: { min: 60, max: 150 },
    kebutuhanKetinggian: { min: 0, max: 1400 },
    tanahCocok: ['Humus', 'Lempung'],
    drainaseCocok: 'Baik',
    siklusTanamDays: 120,
    hargaPasar: { min: 25000, max: 55000 },
    potensiHasil: { min: 1.0, max: 1.5 }, // 10-15 ton/ha
  },
  {
    id: 'kedelai',
    nama: 'Kedelai',
    kebutuhanSuhu: { min: 21, max: 30 },
    kebutuhanCurahHujan: { min: 100, max: 200 },
    kebutuhanKetinggian: { min: 0, max: 900 },
    tanahCocok: ['Lempung', 'Humus'],
    drainaseCocok: 'Baik',
    siklusTanamDays: 85,
    hargaPasar: { min: 9000, max: 12000 },
    potensiHasil: { min: 0.15, max: 0.25 }, // 1.5-2.5 ton/ha
  },
  {
    id: 'bawang',
    nama: 'Bawang Merah',
    kebutuhanSuhu: { min: 25, max: 32 },
    kebutuhanCurahHujan: { min: 50, max: 120 },
    kebutuhanKetinggian: { min: 0, max: 1000 },
    tanahCocok: ['Humus', 'Lempung'],
    drainaseCocok: 'Baik',
    siklusTanamDays: 70,
    hargaPasar: { min: 20000, max: 40000 },
    potensiHasil: { min: 1.0, max: 1.2 }, // 10-12 ton/ha
  }
];

export interface HasilEvaluasi {
  layak: boolean;
  skor: number; // 0 - 100
  skorPotensial?: number; // 0 - 100 after mitigation
  kendala: string[];
  siklusPemupukan: string[];
  kebutuhanAirDaily: number; // liter / m2 / hari
  saranMitigasi: string;
  details?: {
    parameter: string;
    label: string;
    actual: string;
    ideal: string;
    rating: 'S1' | 'S2' | 'S3' | 'N';
  }[];
}

export function cekKelayakan(lahan: Lahan, tanamanId: string): HasilEvaluasi {
  const tanaman = TANAMAN_DATABASE.find(t => t.id === tanamanId);
  if (!tanaman) {
    throw new Error('Tanaman tidak terdaftar');
  }

  const kendala: string[] = [];
  
  // Weights (climate core: 60%, structural/topographical secondary: 30%, Ketinggian: 10%)
  // Sum = 90
  const weights = {
    suhu: 20,
    curahHujan: 20,
    ph: 20,
    ketinggian: 10,
    jenisTanah: 10,
    drainase: 10
  };

  const remediableParams = ['ph', 'jenisTanah', 'drainase'];

  let totalWeight = 90;
  let weightedScore = 0;
  let weightedPotentialScore = 0;

  // 1. Suhu (20)
  let suhuScore = weights.suhu;
  if (lahan.suhu < tanaman.kebutuhanSuhu.min) {
    kendala.push(`Suhu terlalu rendah (${lahan.suhu}°C < Min: ${tanaman.kebutuhanSuhu.min}°C)`);
    suhuScore = weights.suhu * 0.5; // S3/N reduction
  } else if (lahan.suhu > tanaman.kebutuhanSuhu.max) {
    kendala.push(`Suhu terlalu tinggi (${lahan.suhu}°C > Max: ${tanaman.kebutuhanSuhu.max}°C)`);
    suhuScore = weights.suhu * 0.8; // S2 reduction
  }
  weightedScore += suhuScore;
  weightedPotentialScore += suhuScore; // Not remediable

  // 2. Curah Hujan (20)
  let curahHujanScore = weights.curahHujan;
  if (lahan.curahHujan < tanaman.kebutuhanCurahHujan.min) {
    kendala.push(`Curah hujan terlalu rendah (${lahan.curahHujan} mm/bln < Min: ${tanaman.kebutuhanCurahHujan.min} mm/bln)`);
    curahHujanScore = weights.curahHujan * 0.5; // S3
  } else if (lahan.curahHujan > tanaman.kebutuhanCurahHujan.max) {
    kendala.push(`Curah hujan terlalu tinggi (${lahan.curahHujan} mm/bln > Max: ${tanaman.kebutuhanCurahHujan.max} mm/bln)`);
    curahHujanScore = weights.curahHujan * 0.8; // S2
  }
  weightedScore += curahHujanScore;
  weightedPotentialScore += curahHujanScore; // Not remediable

  // 3. pH (20)
  const pHVal = parsePH(lahan.pH);
  let phScore = weights.ph;
  let phRating = 'S1';
  if (pHVal < 5.5) {
    kendala.push(`pH tanah terlalu asam (${pHVal} < 5.5)`);
    phScore = weights.ph * 0.5; // S3
    phRating = 'S3';
  } else if (pHVal > 7.5) {
    kendala.push(`pH tanah terlalu basa (${pHVal} > 7.5)`);
    phScore = weights.ph * 0.5; // S3
    phRating = 'S3';
  }
  weightedScore += phScore;
  
  let phPotential = phScore;
  if (phRating === 'S3') {
    phPotential += (weights.ph - phScore) * 0.25;
  }
  weightedPotentialScore += phPotential;

  // 4. Ketinggian (10)
  let ketinggianScore = weights.ketinggian;
  if (lahan.ketinggian < tanaman.kebutuhanKetinggian.min || lahan.ketinggian > tanaman.kebutuhanKetinggian.max) {
    kendala.push(`Ketinggian lahan tidak ideal (${lahan.ketinggian} mdpl tidak dalam rentang ${tanaman.kebutuhanKetinggian.min}-${tanaman.kebutuhanKetinggian.max} mdpl)`);
    ketinggianScore = weights.ketinggian * 0.5; // S3
  }
  weightedScore += ketinggianScore;
  weightedPotentialScore += ketinggianScore;

  // 5. Jenis Tanah (10)
  let tanahScore = weights.jenisTanah;
  let tanahRating = 'S1';
  if (!tanaman.tanahCocok.includes(lahan.jenisTanah)) {
    kendala.push(`Jenis tanah tidak ideal (Tanaman butuh: ${tanaman.tanahCocok.join('/')}, Lahan Anda: ${lahan.jenisTanah})`);
    tanahScore = 0; // N
    tanahRating = 'N';
  }
  weightedScore += tanahScore;

  let tanahPotential = tanahScore;
  if (tanahRating === 'N') {
    tanahPotential += (weights.jenisTanah - tanahScore) * 0.25;
  }
  weightedPotentialScore += tanahPotential;

  // 6. Drainase (10)
  const drainageIdealForBaik = ['Agak Baik', 'Baik', 'Agak Cepat', 'Cepat'];
  const isDrainageIdeal = tanaman.drainaseCocok === 'Baik'
    ? drainageIdealForBaik.includes(lahan.tipeDrainase)
    : lahan.tipeDrainase === tanaman.drainaseCocok;

  let drainaseScore = weights.drainase;
  let drainaseRating = 'S1';
  if (!isDrainageIdeal) {
    kendala.push(`Kondisi drainase kurang ideal (Sistem drainase lahan terdeteksi ${lahan.tipeDrainase.toLowerCase()})`);
    drainaseScore = weights.drainase * 0.5; // S3
    drainaseRating = 'S3';
  }
  weightedScore += drainaseScore;

  let drainasePotential = drainaseScore;
  if (drainaseRating === 'S3') {
    drainasePotential += (weights.drainase - drainaseScore) * 0.25;
  }
  weightedPotentialScore += drainasePotential;

  // Normalize scores
  const skor = Math.max(0, Math.min(100, Math.round((weightedScore / totalWeight) * 100)));
  const skorPotensial = Math.max(0, Math.min(100, Math.round((weightedPotentialScore / totalWeight) * 100)));

  // Final Decision (encouraging)
  const layak = skorPotensial >= 50;

  // Menentukan kebutuhan air harian per m²
  let kebutuhanAirDaily = 5;
  if (tanamanId === 'padi') kebutuhanAirDaily = 8;
  else if (tanamanId === 'cabai') kebutuhanAirDaily = 4;
  else if (tanamanId === 'bawang') kebutuhanAirDaily = 3;

  // Siklus Pemupukan
  const siklusPemupukan = [
    'Minggu ke-1: Pemupukan dasar dengan Pupuk Organik Kompos.',
    'Minggu ke-4: Pemupukan susulan pertama (urea/NPK untuk fase vegetatif).',
    'Minggu ke-8: Pemupukan susulan kedua (fase generatif/pembuahan).'
  ];

  // Saran Mitigasi jika tidak layak namun dipaksa tanam
  let saranMitigasi = '';
  if (kendala.length > 0) {
    saranMitigasi = 'Rekomendasi Mitigasi Khusus:\n';
    if (lahan.curahHujan < tanaman.kebutuhanCurahHujan.min) {
      saranMitigasi += '- Pasang instalasi irigasi tetes ekstra dan tampung air hujan menggunakan embung.\n';
    }
    if (lahan.curahHujan > tanaman.kebutuhanCurahHujan.max) {
      saranMitigasi += '- Perdalam saluran drainase primer di sekitar bedengan untuk menghindari pembusukan akar.\n';
    }
    if (!tanaman.tanahCocok.includes(lahan.jenisTanah)) {
      saranMitigasi += `- Tambahkan amelioran tanah (kompos/pupuk kandang sebanyak 2-3 kg/m²) untuk meningkatkan struktur tanah ${lahan.jenisTanah}.\n`;
    }
    if (['Sangat Terhambat', 'Terhambat', 'Agak Terhambat'].includes(lahan.tipeDrainase)) {
      saranMitigasi += '- Buat parit bedengan yang lebih tinggi (minimal 30cm) untuk mempercepat aliran air berlebih.\n';
    }
    if (lahan.riwayatHama === 'Ada') {
      saranMitigasi += '- Lakukan rotasi tanaman dengan leguminosa sebelum menanam dan gunakan pestisida nabati secara berkala.\n';
    }
  } else {
    saranMitigasi = 'Lahan Anda sangat ideal! Ikuti petunjuk perawatan dasar dan jaga kelembapan tanah agar panen optimal.';
  }

  return {
    layak,
    skor,
    skorPotensial,
    kendala,
    siklusPemupukan,
    kebutuhanAirDaily,
    saranMitigasi
  };
}

export function cariAlternatif(lahan: Lahan): { tanaman: Tanaman; evaluasi: HasilEvaluasi }[] {
  return TANAMAN_DATABASE.map(tanaman => {
    return {
      tanaman,
      evaluasi: cekKelayakan(lahan, tanaman.id)
    };
  })
  .sort((a, b) => b.evaluasi.skor - a.evaluasi.skor);
}

// Fitur Kalender Tanam: Evaluasi skor tanam harian berdasarkan curah hujan dan suhu
export function evaluasiTanggalTanam(tanamanId: string, forecast14Hari: { date: string, temperature_2m_mean: number, precipitation_sum: number }[]) {
  const tanaman = TANAMAN_DATABASE.find(t => t.id === tanamanId) || TANAMAN_DATABASE[0];
  return evaluasiTanggalTanamDinamis(null, tanaman, forecast14Hari);
}

// Evaluasi Tanggal Tanam Dinamis: Menggabungkan kesesuaian lahan (static) dan kelayakan cuaca harian (dynamic)
export function evaluasiTanggalTanamDinamis(
  lahan: Lahan | null | undefined,
  cropDb: any,
  forecast14Hari: { date: string, temperature_2m_mean: number, precipitation_sum: number }[]
) {
  if (!cropDb) {
    return forecast14Hari.map(day => ({
      date: day.date,
      score: 100,
      weatherScore: 100,
      landScore: 100,
      status: 'optimal',
      temp: day.temperature_2m_mean,
      rain: day.precipitation_sum
    }));
  }

  // Hitung skor kesesuaian lahan (static)
  let landScore = 100;
  if (lahan) {
    if (cropDb.kriteria_tanaman) {
      const landEvalResult = evaluasiLahanDinamis(lahan, cropDb);
      landScore = landEvalResult.skor;
    } else {
      const landEvalResult = cekKelayakan(lahan, cropDb.id);
      landScore = landEvalResult.skor;
    }
  }

  // Ekstrak kriteria suhu & curah hujan secara dinamis
  const tempCriterion = cropDb.kriteria_tanaman?.find((c: any) => c.parameter === 'temperatur');
  const rainCriterion = cropDb.kriteria_tanaman?.find((c: any) => c.parameter === 'curah_hujan');

  // Fallbacks untuk suhu
  const tempMin = tempCriterion ? (tempCriterion.s3_min ?? tempCriterion.s2_min ?? tempCriterion.s1_min ?? 20) : (cropDb.kebutuhanSuhu?.min ?? 20);
  const tempMax = tempCriterion ? (tempCriterion.s3_max ?? tempCriterion.s2_max ?? tempCriterion.s1_max ?? 32) : (cropDb.kebutuhanSuhu?.max ?? 32);
  const tempIdealMin = tempCriterion ? (tempCriterion.s1_min ?? 24) : (cropDb.kebutuhanSuhu?.min ?? 24);
  const tempIdealMax = tempCriterion ? (tempCriterion.s1_max ?? 29) : (cropDb.kebutuhanSuhu?.max ?? 29);

  // Fallbacks untuk curah hujan
  const rainMin = rainCriterion ? (rainCriterion.s3_min ?? rainCriterion.s2_min ?? rainCriterion.s1_min ?? 100) : (cropDb.kebutuhanCurahHujan?.min ?? 100);
  const rainMax = rainCriterion ? (rainCriterion.s3_max ?? rainCriterion.s2_max ?? rainCriterion.s1_max ?? 300) : (cropDb.kebutuhanCurahHujan?.max ?? 300);
  
  const dailyOptimalMin = rainMin / 30;
  const dailyOptimalMax = rainMax / 30;

  return forecast14Hari.map(day => {
    let weatherScore = 100;
    
    // Penalti jika suhu di luar batas toleransi
    if (day.temperature_2m_mean < tempMin) {
      weatherScore -= 30; // Terlalu dingin untuk berkecambah
    } else if (day.temperature_2m_mean > tempMax) {
      weatherScore -= 20; // Terlalu panas, risiko kering
    } else if (day.temperature_2m_mean < tempIdealMin || day.temperature_2m_mean > tempIdealMax) {
      weatherScore -= 10; // Suhu sub-optimal (S2/S3)
    }

    // Penalti jika curah hujan ekstrem atau nol (risiko kekeringan)
    if (day.precipitation_sum === 0 && dailyOptimalMin > 2) {
      weatherScore -= 25; // Tidak ada hujan padahal butuh air
    } else if (day.precipitation_sum > dailyOptimalMax * 3) {
      weatherScore -= 40; // Hujan sangat ekstrem, benih bisa hanyut/busuk
    } else if (day.precipitation_sum > dailyOptimalMax * 1.5) {
      weatherScore -= 15; // Hujan lumayan deras
    }

    weatherScore = Math.max(0, weatherScore);

    // Gabungkan skor: 40% kelayakan cuaca, 60% kesesuaian lahan
    const combinedScore = Math.round(weatherScore * 0.4 + landScore * 0.6);

    let status = 'optimal';
    if (combinedScore < 60) status = 'hindari';
    else if (combinedScore < 85) status = 'kurang-optimal';

    return {
      date: day.date,
      score: combinedScore,
      weatherScore,
      landScore,
      status, // 'optimal' | 'kurang-optimal' | 'hindari'
      temp: day.temperature_2m_mean,
      rain: day.precipitation_sum
    };
  });
}


// -------------------------------------------------------------
// DYNAMIC DATABASE EVALUATORS FOR 25 CROPS
// -------------------------------------------------------------

function parsePH(phStr?: string | number): number {
  if (phStr === undefined || phStr === null) return 6.5;
  if (typeof phStr === 'number') return phStr;
  const str = String(phStr);
  if (str.includes('< 5.5')) return 5.0;
  if (str.includes('5.5 - 6.5')) return 6.0;
  if (str.includes('6.5 - 7.5')) return 7.0;
  if (str.includes('> 7.5')) return 8.0;
  const num = parseFloat(str);
  return isNaN(num) ? 6.5 : num;
}

function parseSlope(slopeStr?: string | number): number {
  if (slopeStr === undefined || slopeStr === null) return 2.0;
  if (typeof slopeStr === 'number') return slopeStr;
  const str = String(slopeStr);
  if (str.includes('<3%')) return 1.5;
  if (str.includes('3-8%')) return 5.5;
  if (str.includes('8-16%')) return 12.0;
  if (str.includes('>16%')) return 20.0;
  const num = parseFloat(str);
  return isNaN(num) ? 2.0 : num;
}

export function evaluasiLahanDinamis(lahan: Lahan, cropDb: any): HasilEvaluasi {
  const kendala: string[] = [];
  const details: any[] = [];
  
  const cropName = cropDb.nama;
  const kriteriaList = cropDb.kriteria_tanaman || [];
  
  // Weights (climate core: 60%, structural/topographical/alt secondary: 40%)
  const weights: Record<string, number> = {
    temperatur: 20,
    curah_hujan: 20,
    ph_tanah: 20,
    ketinggian: 10,
    lereng: 10,
    drainase: 10,
    tekstur_tanah: 10
  };

  const remediableParams = ['ph_tanah', 'lereng', 'drainase', 'tekstur_tanah'];

  let totalWeight = 0;
  let weightedScore = 0;
  let weightedPotentialScore = 0;
  
  for (const criterion of kriteriaList) {
    const { parameter, s1_min, s1_max, s2_min, s2_max, s3_min, s3_max, s1_text, s2_text, s3_text } = criterion;
    
    let val: any = null;
    let label = '';
    
    // Map parameter from land
    if (parameter === 'temperatur') {
      val = lahan.suhu;
      label = 'Suhu udara';
    } else if (parameter === 'curah_hujan') {
      val = lahan.curahHujan;
      label = 'Curah hujan';
    } else if (parameter === 'ketinggian') {
      val = lahan.ketinggian;
      label = 'Ketinggian lahan';
    } else if (parameter === 'ph_tanah') {
      val = parsePH(lahan.pH);
      label = 'Derajat keasaman pH';
    } else if (parameter === 'lereng') {
      val = parseSlope(lahan.slope);
      label = 'Kemiringan lereng';
    } else if (parameter === 'drainase') {
      val = lahan.tipeDrainase;
      label = 'Tipe drainase';
    } else if (parameter === 'tekstur_tanah') {
      val = lahan.jenisTanah;
      label = 'Tekstur jenis tanah';
    }
    
    if (val === null || val === undefined) continue;
    
    // Evaluate suitability class
    let rating = 'N';
    const isTextParam = ['drainase', 'tekstur_tanah'].includes(parameter);
    
    if (isTextParam) {
      const valStr = String(val).toLowerCase().trim();
      const normalizeArray = (arr: any) => (Array.isArray(arr) ? arr : []).map((x: any) => String(x).toLowerCase().trim());
      
      const s1Arr = normalizeArray(s1_text);
      const s2Arr = normalizeArray(s2_text);
      const s3Arr = normalizeArray(s3_text);
      
      if (s1Arr.includes(valStr)) rating = 'S1';
      else if (s2Arr.includes(valStr)) rating = 'S2';
      else if (s3Arr.includes(valStr)) rating = 'S3';
    } else {
      const numVal = Number(val);
      
      const matchesRange = (min: any, max: any) => {
        if (min === null || max === null) return false;
        return numVal >= Number(min) && numVal <= Number(max);
      };
      
      if (matchesRange(s1_min, s1_max)) rating = 'S1';
      else if (matchesRange(s2_min, s2_max)) rating = 'S2';
      else if (matchesRange(s3_min, s3_max)) rating = 'S3';
      else if (s1_min === null && s1_max === null && s2_min === null && s2_max === null && s3_min === null && s3_max === null) {
        rating = 'S1'; // skip unconfigured parameter
      }
    }
    
    // Process parameter weight
    const weight = weights[parameter] || 10;
    totalWeight += weight;

    // Calculate score contribution based on rating
    let paramScore = 0;
    if (rating === 'S1') {
      paramScore = weight;
    } else if (rating === 'S2') {
      paramScore = weight * 0.8;
      kendala.push(`${label} cukup sesuai (S2). Aktifkan pemantauan.`);
    } else if (rating === 'S3') {
      paramScore = weight * 0.5;
      kendala.push(`${label} kurang optimal (S3/Marginal). Butuh mitigasi.`);
    } else if (rating === 'N') {
      paramScore = 0;
      kendala.push(`${label} tidak sesuai (N/Ekstrem). Berisiko tinggi.`);
    }

    weightedScore += paramScore;

    // Mitigation potential boost (regain 25% of lost value)
    let paramPotentialScore = paramScore;
    if ((rating === 'S3' || rating === 'N') && remediableParams.includes(parameter)) {
      const lostValue = weight - paramScore;
      const regainedValue = lostValue * 0.25;
      paramPotentialScore = paramScore + regainedValue;
    }
    weightedPotentialScore += paramPotentialScore;

    // Format human-readable values
    let actualStr = '';
    let idealStr = '';
    
    if (parameter === 'temperatur') {
      actualStr = `${lahan.suhu} °C`;
      idealStr = `${s1_min} - ${s1_max} °C`;
    } else if (parameter === 'curah_hujan') {
      actualStr = `${lahan.curahHujan} mm/bln`;
      idealStr = `${s1_min} - ${s1_max} mm/bln`;
    } else if (parameter === 'ketinggian') {
      actualStr = `${lahan.ketinggian} mdpl`;
      idealStr = `${s1_min} - ${s1_max} mdpl`;
    } else if (parameter === 'ph_tanah') {
      actualStr = lahan.pH || '6.5 (Netral)';
      idealStr = `${s1_min} - ${s1_max}`;
    } else if (parameter === 'lereng') {
      actualStr = lahan.slope || 'Datar (<3%)';
      idealStr = s1_max && Number(s1_max) <= 3 ? '< 3%' : `${s1_min} - ${s1_max}%`;
    } else if (parameter === 'drainase') {
      actualStr = lahan.tipeDrainase;
      idealStr = Array.isArray(s1_text) ? s1_text.join(', ') : String(s1_text || '-');
    } else if (parameter === 'tekstur_tanah') {
      actualStr = lahan.jenisTanah;
      idealStr = Array.isArray(s1_text) ? s1_text.join(', ') : String(s1_text || '-');
    }

    details.push({
      parameter,
      label,
      actual: actualStr,
      ideal: idealStr,
      rating
    });
  }
  
  // Normalize scores to 0-100 range
  const skor = totalWeight > 0 ? Math.max(0, Math.min(100, Math.round((weightedScore / totalWeight) * 100))) : 100;
  const skorPotensial = totalWeight > 0 ? Math.max(0, Math.min(100, Math.round((weightedPotentialScore / totalWeight) * 100))) : 100;

  // Final Decision (encouraging, based on mitigation potential)
  const layak = skorPotensial >= 50;
  
  // Dynamic water demand based on crop types
  let kebutuhanAirDaily = 5;
  const nameLower = cropName.toLowerCase();
  if (nameLower.includes('padi')) kebutuhanAirDaily = 8;
  else if (nameLower.includes('cabai') || nameLower.includes('bawang') || nameLower.includes('selada')) kebutuhanAirDaily = 4;
  else if (nameLower.includes('kaktus') || nameLower.includes('lidah buaya')) kebutuhanAirDaily = 2;
  
  const siklusPemupukan = [
    'Minggu ke-1: Pemupukan dasar dengan Pupuk Organik Kompos.',
    'Minggu ke-4: Pemupukan susulan pertama (urea/NPK untuk fase vegetatif).',
    'Minggu ke-8: Pemupukan susulan kedua (fase generatif/pembuahan).'
  ];
  
  // Specific mitigations based on detected issues
  let saranMitigasi = '';
  if (kendala.length > 0) {
    saranMitigasi = 'Rekomendasi Langkah Mitigasi:\n';
    
    const hasIssue = (param: string) => kendala.some(k => k.toLowerCase().includes(param));
    
    if (hasIssue('suhu')) {
      saranMitigasi += '- Suhu ekstrem: Gunakan naungan net/mulsa organik untuk mereduksi penguapan berlebih.\n';
    }
    if (hasIssue('curah hujan')) {
      saranMitigasi += '- Curah hujan bermasalah: Buat tampungan air (embung) untuk kemarau, atau perluas drainase untuk musim basah.\n';
    }
    if (hasIssue('keasaman') || hasIssue('ph')) {
      saranMitigasi += '- pH kurang netral: Taburkan kapur dolomit jika asam (pH rendah), atau belerang/pupuk organik jika basa.\n';
    }
    if (hasIssue('lereng')) {
      saranMitigasi += '- Lereng curam: Terapkan metode terasering / sabuk gunung pada bedengan sawah.\n';
    }
    if (hasIssue('drainase')) {
      saranMitigasi += '- Drainase terhambat: Tinggikan parit bedengan sawah (min. 30 cm) untuk melancarkan sirkulasi air.\n';
    }
    if (hasIssue('tanah')) {
      saranMitigasi += '- Struktur tanah kurang ideal: Tambahkan kompos/amelioran organik guna gemburkan media tanam.\n';
    }
  } else {
    saranMitigasi = 'Kondisi lahan sangat prima! Lanjutkan perawatan dasar sesuai dengan panduan siklus pemupukan.';
  }
  
  return {
    layak,
    skor,
    skorPotensial,
    kendala,
    siklusPemupukan,
    kebutuhanAirDaily,
    saranMitigasi,
    details
  };
}

export function cariAlternatifDinamis(lahan: Lahan, cropsDbList: any[]): { tanaman: any; evaluasi: HasilEvaluasi }[] {
  return cropsDbList.map(crop => {
    return {
      tanaman: crop,
      evaluasi: evaluasiLahanDinamis(lahan, crop)
    };
  })
  .sort((a, b) => b.evaluasi.skor - a.evaluasi.skor);
}

