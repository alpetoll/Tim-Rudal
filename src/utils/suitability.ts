import { Lahan, Tanaman } from '../types';

export const TANAMAN_DATABASE: Tanaman[] = [
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
  }
];

export interface HasilEvaluasi {
  layak: boolean;
  skor: number; // 0 - 100
  kendala: string[];
  siklusPemupukan: string[];
  kebutuhanAirDaily: number; // liter / m2 / hari
  saranMitigasi: string;
}

export function cekKelayakan(lahan: Lahan, tanamanId: string): HasilEvaluasi {
  const tanaman = TANAMAN_DATABASE.find(t => t.id === tanamanId);
  if (!tanaman) {
    throw new Error('Tanaman tidak terdaftar');
  }

  const kendala: string[] = [];
  let skor = 100;

  // 1. Cek Suhu
  if (lahan.suhu < tanaman.kebutuhanSuhu.min) {
    kendala.push(`Suhu terlalu rendah (${lahan.suhu}°C < Min: ${tanaman.kebutuhanSuhu.min}°C)`);
    skor -= 20;
  } else if (lahan.suhu > tanaman.kebutuhanSuhu.max) {
    kendala.push(`Suhu terlalu tinggi (${lahan.suhu}°C > Max: ${tanaman.kebutuhanSuhu.max}°C)`);
    skor -= 15;
  }

  // 2. Cek Curah Hujan
  if (lahan.curahHujan < tanaman.kebutuhanCurahHujan.min) {
    kendala.push(`Curah hujan terlalu rendah (${lahan.curahHujan} mm/bln < Min: ${tanaman.kebutuhanCurahHujan.min} mm/bln)`);
    skor -= 25;
  } else if (lahan.curahHujan > tanaman.kebutuhanCurahHujan.max) {
    kendala.push(`Curah hujan terlalu tinggi (${lahan.curahHujan} mm/bln > Max: ${tanaman.kebutuhanCurahHujan.max} mm/bln)`);
    skor -= 15;
  }

  // 3. Cek Ketinggian
  if (lahan.ketinggian < tanaman.kebutuhanKetinggian.min || lahan.ketinggian > tanaman.kebutuhanKetinggian.max) {
    kendala.push(`Ketinggian lahan tidak ideal (${lahan.ketinggian} mdpl tidak dalam rentang ${tanaman.kebutuhanKetinggian.min}-${tanaman.kebutuhanKetinggian.max} mdpl)`);
    skor -= 15;
  }

  // 4. Cek Jenis Tanah
  if (!tanaman.tanahCocok.includes(lahan.jenisTanah)) {
    kendala.push(`Jenis tanah tidak ideal (Tanaman butuh: ${tanaman.tanahCocok.join('/')}, Lahan Anda: ${lahan.jenisTanah})`);
    skor -= 20;
  }

  // 5. Cek Drainase
  if (lahan.tipeDrainase !== tanaman.drainaseCocok) {
    kendala.push(`Kondisi drainase kurang ideal (Sistem drainase lahan terdeteksi ${lahan.tipeDrainase.toLowerCase()})`);
    skor -= 20;
  }

  // Final Decision
  const layak = kendala.length === 0 || skor >= 70;

  // Menentukan kebutuhan air harian per m²
  // Padi butuh air tinggi, kaktus butuh air rendah
  let kebutuhanAirDaily = 5; // default 5 liter / m² / hari
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
    if (lahan.tipeDrainase === 'Buruk') {
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
    skor: Math.max(0, skor),
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
export function evaluasiTanggalTanam(tanamanId: string, forecast14Hari: { date: string, suhu: number, curahHujan: number }[]) {
  const tanaman = TANAMAN_DATABASE.find(t => t.id === tanamanId) || TANAMAN_DATABASE[0];

  return forecast14Hari.map(day => {
    let score = 100;
    
    // Penalize if temperature is out of bounds
    if (day.temperature_2m_mean < tanaman.kebutuhanSuhu.min) {
      score -= 30; // Terlalu dingin untuk berkecambah
    } else if (day.temperature_2m_mean > tanaman.kebutuhanSuhu.max) {
      score -= 20; // Terlalu panas, risiko kering
    }

    // Penalize if rain is extremely high (flood risk for seeds) or zero (drought risk)
    // Curah hujan harian (mm/hari). Kebutuhan curah hujan di DB adalah mm/bulan. 
    // Rata-rata curah hujan harian optimal = mm_bulan / 30
    const dailyOptimalMin = tanaman.kebutuhanCurahHujan.min / 30;
    const dailyOptimalMax = tanaman.kebutuhanCurahHujan.max / 30;

    if (day.precipitation_sum === 0 && dailyOptimalMin > 2) {
      score -= 25; // Tidak ada hujan padahal butuh air
    } else if (day.precipitation_sum > dailyOptimalMax * 3) {
      score -= 40; // Hujan sangat ekstrem, benih bisa hanyut/busuk
    } else if (day.precipitation_sum > dailyOptimalMax * 1.5) {
      score -= 15; // Hujan lumayan deras
    }

    let status = 'optimal';
    if (score < 60) status = 'hindari';
    else if (score < 85) status = 'kurang-optimal';

    return {
      date: day.date,
      score,
      status, // 'optimal' | 'kurang-optimal' | 'hindari'
      temp: day.temperature_2m_mean,
      rain: day.precipitation_sum
    };
  });
}
