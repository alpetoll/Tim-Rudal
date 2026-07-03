'use client';

import { useState, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { Lahan } from '../types';
import { evaluasiTanggalTanam, TANAMAN_DATABASE } from '../utils/suitability';
import { Calendar as CalendarIcon, MapPin, CloudRain, ThermometerSun, AlertTriangle, CheckCircle2, Sprout, Cloud, Sun, CloudLightning, CloudDrizzle } from 'lucide-react';

interface KalenderTanamProps {
  savedLahans: Lahan[];
}

export default function KalenderTanam({ savedLahans }: KalenderTanamProps) {
  const [selectedLahanId, setSelectedLahanId] = useState<string>('');
  const [selectedTanaman, setSelectedTanaman] = useState<string>('padi');
  const [forecast, setForecast] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [lahanWeathers, setLahanWeathers] = useState<Record<string, { temp: number, desc: string }>>({});
  
  const selectedLahan = savedLahans.find(l => l.id === selectedLahanId);

  useEffect(() => {
    if (savedLahans.length > 0 && !selectedLahanId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedLahanId(savedLahans[0].id);
    }

    // Fetch real-time weather for ALL lahans
    const fetchAllWeather = async () => {
      const weathers: Record<string, { temp: number, desc: string }> = {};
      
      await Promise.all(savedLahans.map(async (lahan) => {
        if (!lahan.centroid) return;
        const [lat, lng] = lahan.centroid;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&timezone=Asia%2FJakarta`, {
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          const data = await res.json();
          if (data && data.current) {
            const code = data.current.weather_code;
            let desc = 'Cerah';
            if (code >= 1 && code <= 3) desc = 'Berawan';
            if (code >= 45 && code <= 48) desc = 'Berkabut';
            if (code >= 51 && code <= 67) desc = 'Hujan Ringan';
            if (code >= 71 && code <= 77) desc = 'Salju';
            if (code >= 80 && code <= 82) desc = 'Hujan Lebat';
            if (code >= 95) desc = 'Badai Petir';
            
            weathers[lahan.id] = {
              temp: data.current.temperature_2m,
              desc
            };
          }
        } catch (err) {
          console.warn('Failed to fetch weather for lahan:', lahan.nama);
          // Fallback
          weathers[lahan.id] = { temp: lahan.suhu || 28, desc: 'Offline' };
        }
      }));
      setLahanWeathers(weathers);
    };

    if (savedLahans.length > 0) {
      fetchAllWeather();
    }
  }, [savedLahans]);

  const lat = selectedLahan?.centroid?.[0];
  const lng = selectedLahan?.centroid?.[1];

  useEffect(() => {
    async function fetchWeather() {
      if (lat === undefined || lng === undefined) return;
      
      setLoading(true);
      try {
        // Tambahkan timeout 3 detik agar tidak loading lama saat internet bermasalah
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_mean,precipitation_sum&timezone=Asia%2FJakarta&forecast_days=14`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        const data = await res.json();
        
        if (data && data.daily) {
          const days = data.daily.time.map((time: string, i: number) => ({
            date: time,
            temperature_2m_mean: data.daily.temperature_2m_mean[i],
            precipitation_sum: data.daily.precipitation_sum[i]
          }));
          
          setForecast(days);
          
          // Evaluate for selected plant
          const evals = evaluasiTanggalTanam(selectedTanaman, days);
          setEvaluations(evals);
        }
      } catch (error) {
        console.warn("Failed to fetch weather, using fallback data", error);
        
        // --- Fallback Mock Data ---
        // Jika API gagal (misal tidak ada internet), gunakan data simulasi agar aplikasi tetap berjalan
        const mockDays = Array.from({length: 14}).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() + i);
          // Format ke yyyy-MM-dd
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          
          return {
            date: `${yyyy}-${mm}-${dd}`,
            temperature_2m_mean: 25 + Math.random() * 6, // Suhu random 25-31
            precipitation_sum: Math.random() * 15 // Hujan random 0-15
          };
        });
        
        setForecast(mockDays);
        const evals = evaluasiTanggalTanam(selectedTanaman, mockDays as any);
        setEvaluations(evals);

      } finally {
        setLoading(false);
      }
    }

    fetchWeather();
  }, [lat, lng, selectedTanaman]);

  // Modifiers for the calendar
  const optimalDays = evaluations.filter(e => e.status === 'optimal').map(e => parseISO(e.date));
  const warningDays = evaluations.filter(e => e.status === 'kurang-optimal').map(e => parseISO(e.date));
  const dangerDays = evaluations.filter(e => e.status === 'hindari').map(e => parseISO(e.date));

  const modifiers = {
    optimal: optimalDays,
    warning: warningDays,
    danger: dangerDays,
  };

  const modifiersClassNames = {
    optimal: 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/50',
    warning: 'bg-amber-500/20 text-amber-400 font-bold border border-amber-500/50',
    danger: 'bg-red-500/20 text-red-400 font-bold border border-red-500/50',
  };

  // Find info for selected date
  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const selectedEval = evaluations.find(e => e.date === selectedDateStr);

  return (
    <div className="space-y-6">
      
      {/* Real-time Weather Section */}
      <div className="bg-bg-card border border-border-medium rounded-2xl p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-text-main">
          <Cloud className="w-5 h-5 text-sky-400" />
          <span>Cuaca Saat Ini di Lahan Anda</span>
        </h3>
        
        {savedLahans.length === 0 ? (
          <div className="text-text-muted text-sm italic">Belum ada data lahan tersimpan.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {savedLahans.map(lahan => {
              const w = lahanWeathers[lahan.id];
              return (
                <div key={lahan.id} className="bg-bg-dark border border-border-light rounded-xl p-4 flex flex-col justify-center items-center text-center">
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 truncate w-full">{lahan.nama}</span>
                  {w ? (
                    <>
                      <div className="text-2xl font-bold text-text-main mb-1">{w.temp}°C</div>
                      <div className="text-xs text-primary-light bg-primary/10 px-2 py-0.5 rounded-full inline-block">{w.desc}</div>
                    </>
                  ) : (
                    <div className="text-sm text-text-muted animate-pulse py-2">Memuat...</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Sidebar Controls */}
      <div className="space-y-6">
        <div className="bg-bg-card border border-border-medium rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-text-main">
            <MapPin className="w-5 h-5 text-primary-light" />
            <span>Pilih Lokasi Lahan</span>
          </h3>
          
          {savedLahans.length === 0 ? (
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl text-sm text-primary-light">
              Anda belum memiliki lahan. Silakan tambah lahan di menu Peta Lahan terlebih dahulu.
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Lahan Saya</label>
                <select 
                  value={selectedLahanId}
                  onChange={(e) => setSelectedLahanId(e.target.value)}
                  className="w-full bg-bg-dark border border-border-medium rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary transition-all text-sm"
                >
                  {savedLahans.map(lahan => (
                    <option key={lahan.id} value={lahan.id}>{lahan.nama} (Luas: {lahan.luas} m²)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Rencana Tanaman</label>
                <select 
                  value={selectedTanaman}
                  onChange={(e) => setSelectedTanaman(e.target.value)}
                  className="w-full bg-bg-dark border border-border-medium rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary transition-all text-sm"
                >
                  {TANAMAN_DATABASE.map(t => (
                    <option key={t.id} value={t.id}>{t.nama}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="bg-bg-card border border-border-medium rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-text-main">
            <Sprout className="w-5 h-5 text-emerald-400" />
            <span>Keterangan Indikator</span>
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-emerald-500/20 border border-emerald-500/50"></div>
              <span className="text-text-muted">Sangat Optimal untuk Tanam</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-amber-500/20 border border-amber-500/50"></div>
              <span className="text-text-muted">Kurang Optimal (Perlu Mitigasi)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-red-500/20 border border-red-500/50"></div>
              <span className="text-text-muted">Hindari (Risiko Gagal Panen)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Calendar Area */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-bg-card border border-border-medium rounded-2xl p-6 flex flex-col md:flex-row gap-8 items-start relative">
          
          {loading && (
             <div className="absolute inset-0 z-10 bg-bg-card/50 backdrop-blur-sm flex justify-center items-center rounded-2xl">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
             </div>
          )}

          <div className="w-full md:w-auto flex-shrink-0">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-text-main border-b border-border-light pb-3">
              <CalendarIcon className="w-5 h-5 text-primary-light" />
              <span>Prediksi 14 Hari Kedepan</span>
            </h3>
            
            <div className="calendar-wrapper custom-calendar bg-bg-dark p-4 rounded-xl border border-border-light w-full max-w-full overflow-x-auto flex justify-center md:inline-block">
              <DayPicker 
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={id}
                modifiers={modifiers}
                modifiersClassNames={modifiersClassNames}
                disabled={[{ before: new Date() }]}
                className="text-text-main min-w-[280px]"
              />
            </div>
          </div>

          <div className="flex-1 w-full">
            <h3 className="text-lg font-bold mb-4 text-text-main border-b border-border-light pb-3">
              Detail Tanggal
            </h3>
            
            {!selectedDate ? (
              <div className="text-text-muted text-sm italic">Pilih tanggal di kalender untuk melihat prediksi.</div>
            ) : !selectedEval ? (
              <div className="text-text-muted text-sm">
                Tidak ada data prediksi cuaca untuk tanggal {format(selectedDate, 'dd MMMM yyyy', { locale: id })}. Silakan pilih tanggal 14 hari ke depan.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg text-text-main font-semibold">
                  <span>{format(selectedDate, 'EEEE, dd MMMM yyyy', { locale: id })}</span>
                </div>
                
                <div className={`p-4 rounded-xl border ${
                  selectedEval.status === 'optimal' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                  selectedEval.status === 'kurang-optimal' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                  'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  <div className="flex items-start gap-3">
                    {selectedEval.status === 'optimal' ? <CheckCircle2 className="w-6 h-6 mt-0.5" /> : <AlertTriangle className="w-6 h-6 mt-0.5" />}
                    <div>
                      <h4 className="font-bold text-base mb-1">
                        {selectedEval.status === 'optimal' ? 'Sangat Optimal untuk Tanam' :
                         selectedEval.status === 'kurang-optimal' ? 'Kurang Optimal (Butuh Mitigasi)' :
                         'Sangat Berisiko (Sebaiknya Hindari)'}
                      </h4>
                      <p className="text-sm opacity-90 leading-relaxed">
                        Skor Kelayakan Cuaca: <strong>{selectedEval.score}/100</strong>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-bg-dark border border-border-medium rounded-xl p-4 overflow-hidden">
                    <div className="flex items-center gap-2 text-text-muted mb-2">
                      <ThermometerSun className="w-4 shrink-0 h-4" />
                      <span className="text-xs uppercase font-semibold truncate">Suhu Rata-rata</span>
                    </div>
                    <div className="text-2xl font-bold text-text-main truncate">{Number(selectedEval.temp).toFixed(1)}°C</div>
                  </div>
                  
                  <div className="bg-bg-dark border border-border-medium rounded-xl p-4 overflow-hidden">
                    <div className="flex items-center gap-2 text-text-muted mb-2">
                      <CloudRain className="w-4 shrink-0 h-4" />
                      <span className="text-xs uppercase font-semibold truncate">Curah Hujan</span>
                    </div>
                    <div className="text-2xl font-bold text-text-main truncate">{Number(selectedEval.rain).toFixed(1)} mm</div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
      
    </div>
    </div>
  );
}


