'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CloudLightning, Wind } from 'lucide-react';
import { Lahan } from '../types';
import { checkWeatherAnomaly } from '../../supabase/functions/_shared/anomalyDetection';

export default function EarlyWarning({ lahans }: { lahans: Lahan[] }) {
  const [warning, setWarning] = useState<{ message: string; date: string } | null>(null);

  const targetLahan = lahans[0];
  const lat = targetLahan?.centroid?.[0];
  const lng = targetLahan?.centroid?.[1];

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;

    // Tambahkan timeout 3 detik
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=precipitation_sum,temperature_2m_max,windspeed_10m_max&timezone=Asia%2FJakarta&forecast_days=3`, {
      signal: controller.signal
    })
      .then(res => {
        clearTimeout(timeoutId);
        return res.json();
      })
      .then(data => {
        if (data.daily) {
          for (let i = 0; i < data.daily.time.length; i++) {
            const date = data.daily.time[i];
            const rain = data.daily.precipitation_sum[i];
            const temp = data.daily.temperature_2m_max[i];
            const wind = data.daily.windspeed_10m_max[i];

            const check = checkWeatherAnomaly(rain, temp, wind, targetLahan.nama);
            if (check.isAnomaly) {
              setWarning({
                message: check.message,
                date
              });
              return;
            }
          }
        }
      })
      .catch((error: any) => {
        if (error.name !== 'AbortError') {
          // Gunakan console.warn alih-alih console.error agar tidak memicu layar error merah di Next.js saat internet mati
          console.warn('Gagal memuat data cuaca untuk peringatan dini:', error.message);
        }
      });
  }, [lat, lng]);

  if (!warning) return null;

  return (
    <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-4 mb-6 flex items-start gap-4 animate-pulse">
      <div className="bg-red-500/20 p-3 rounded-full shrink-0 mt-1">
        <AlertTriangle className="w-6 h-6 text-red-500" />
      </div>
      <div>
        <h3 className="text-red-400 font-bold text-lg uppercase tracking-wider flex items-center gap-2">
          <CloudLightning className="w-5 h-5" /> 
          Peringatan Dini Cuaca Ekstrem
        </h3>
        <p className="text-white mt-1 font-medium leading-relaxed">
          {warning.message}
        </p>
        <span className="inline-block mt-2 text-xs font-bold px-3 py-1 bg-red-500/20 text-red-300 rounded-full">
          Prediksi Tanggal: {warning.date}
        </span>
      </div>
    </div>
  );
}
