const dotenv = require('dotenv');
const path = require('path');

// Target coordinates for testing
const LOCATIONS = [
  {
    name: 'Indramayu (Dataran Rendah, Sentra Padi)',
    lat: -6.32,
    lng: 108.32,
    expectedElevation: '10m'
  },
  {
    name: 'Lembang, Bandung (Dataran Tinggi)',
    lat: -6.82,
    lng: 107.62,
    expectedElevation: '1200m'
  }
];

async function runTest(loc) {
  console.log(`\n======================================================`);
  console.log(`PENGUJIAN LOKASI: ${loc.name}`);
  console.log(`Koordinat: Latitude ${loc.lat}, Longitude ${loc.lng}`);
  console.log(`======================================================`);

  const start_date = '1996-01-01';
  const end_date = '2025-12-31';
  const climateUrl = `https://climate-api.open-meteo.com/v1/climate?latitude=${loc.lat}&longitude=${loc.lng}&start_date=${start_date}&end_date=${end_date}&models=MRI_AGCM3_2_S&daily=temperature_2m_mean,temperature_2m_max,precipitation_sum&timezone=Asia%2FJakarta`;
  
  console.log(`URL API: ${climateUrl}`);

  try {
    const response = await fetch(climateUrl);
    if (!response.ok) {
      throw new Error(`Gagal mengambil data dari API: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.daily || !data.daily.time) {
      throw new Error('Format data API tidak valid.');
    }

    const { time, temperature_2m_max, precipitation_sum } = data.daily;

    console.log(`\n[DEBUG] Ketinggian (elevation) dari API: ${data.elevation} m`);
    console.log(`[DEBUG] Rentang Data: ${time[0]} s.d. ${time[time.length - 1]}`);

    // Print first 10 days raw response sample
    console.log('\n[DEBUG] Raw response sample (10 hari pertama):');
    const sample = time.slice(0, 10).map((t, idx) => ({
      date: t,
      temp_max: temperature_2m_max[idx] !== null ? `${temperature_2m_max[idx]}°C` : 'N/A',
      precipitation: precipitation_sum[idx] !== null ? `${precipitation_sum[idx]} mm` : 'N/A'
    }));
    console.table(sample);

    // Calculate min and max temperature
    let minTemp = Infinity;
    let maxTemp = -Infinity;
    let minTempDate = '';
    let maxTempDate = '';
    let validCount = 0;

    for (let i = 0; i < temperature_2m_max.length; i++) {
      const val = temperature_2m_max[i];
      if (val !== undefined && val !== null && !isNaN(val)) {
        validCount++;
        if (val < minTemp) {
          minTemp = val;
          minTempDate = time[i];
        }
        if (val > maxTemp) {
          maxTemp = val;
          maxTempDate = time[i];
        }
      }
    }

    console.log(`\n[DEBUG] Total data hari valid: ${validCount} hari`);
    console.log(`[DEBUG] Suhu Maksimum Terendah (Min): ${minTemp}°C pada ${minTempDate}`);
    console.log(`[DEBUG] Suhu Maksimum Tertinggi (Max): ${maxTemp}°C pada ${maxTempDate}`);

    // Count heat days exceeding threshold of 33C
    const threshold = 33;
    let totalExceedingDays = 0;
    const yearlyCounts = {};

    for (let i = 0; i < time.length; i++) {
      const dateStr = time[i];
      const year = parseInt(dateStr.split('-')[0], 10);
      const maxT = temperature_2m_max[i];

      if (year >= 1996 && year <= 2025) {
        if (!yearlyCounts[year]) {
          yearlyCounts[year] = 0;
        }
        if (maxT !== null && maxT > threshold) {
          yearlyCounts[year] += 1;
          totalExceedingDays += 1;
        }
      }
    }

    console.log(`\n[DEBUG] Statistik Pemrosesan (Threshold: ${threshold}°C):`);
    console.log(`- Total Hari Melebihi ${threshold}°C: ${totalExceedingDays} hari`);
    console.log('- Distribusi Hari Panas Ekstrem per Tahun (10 tahun terakhir):');
    
    // Log only last 10 years for readability
    const lastYears = Object.keys(yearlyCounts).slice(-10);
    const lastYearsData = {};
    lastYears.forEach(y => {
      lastYearsData[y] = yearlyCounts[y];
    });
    console.log(lastYearsData);

  } catch (err) {
    console.error(`Error pada pengujian lokasi ${loc.name}:`, err.message);
  }
}

async function run() {
  for (const loc of LOCATIONS) {
    await runTest(loc);
  }
}

run();
