'use client';

import { useState, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { Lahan } from '../types';
import { evaluasiTanggalTanam, TANAMAN_DATABASE, evaluasiTanggalTanamDinamis } from '../utils/suitability';
import { Calendar as CalendarIcon, MapPin, CloudRain, ThermometerSun, AlertTriangle, CheckCircle2, Sprout, Cloud, Sun, CloudLightning, CloudDrizzle } from 'lucide-react';

interface KalenderTanamProps {
  savedLahans: Lahan[];
  cropsDbList?: any[];
}

export default function KalenderTanam({ savedLahans, cropsDbList }: KalenderTanamProps) {
  const [selectedLahanId, setSelectedLahanId] = useState<string>('');
  const [selectedTanaman, setSelectedTanaman] = useState<string>('padi');
  const [forecast, setForecast] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [lahanWeathers, setLahanWeathers] = useState<Record<string, { temp: number, desc: string }>>({});
  
  const selectedLahan = savedLahans.find(l => l.id === selectedLahanId);
  const isNested = savedLahans.length === 1;

  const activeCrop = cropsDbList && cropsDbList.length > 0
    ? cropsDbList.find(c => c.id === selectedTanaman)
    : TANAMAN_DATABASE.find(t => t.id === selectedTanaman);

  // Set default selected crop from cropsDbList if loaded
  useEffect(() => {
    if (cropsDbList && cropsDbList.length > 0 && !cropsDbList.find(c => c.id === selectedTanaman)) {
      setSelectedTanaman(cropsDbList[0].id);
    }
  }, [cropsDbList, selectedTanaman]);

  // Set matching crop for single nested land layout
  useEffect(() => {
    if (savedLahans.length === 1 && savedLahans[0].varietasDitanam && cropsDbList && cropsDbList.length > 0) {
      const match = cropsDbList.find(c => c.nama.toLowerCase() === savedLahans[0].varietasDitanam?.toLowerCase());
      if (match) {
        setSelectedTanaman(match.id);
      }
    }
  }, [savedLahans, cropsDbList]);

  useEffect(() => {
    if (savedLahans.length > 0 && !selectedLahanId) {
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
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.warn('Failed to fetch weather for lahan:', lahan.nama);
          }
          weathers[lahan.id] = { temp: lahan.suhu || 28, desc: 'Offline' };
        }
      }));
      setLahanWeathers(weathers);
    };

    if (savedLahans.length > 0) {
      fetchAllWeather();
    }
  }, [savedLahans, selectedLahanId]);

  const lat = selectedLahan?.centroid?.[0];
  const lng = selectedLahan?.centroid?.[1];

  useEffect(() => {
    async function fetchWeather() {
      if (lat === undefined || lng === undefined) return;
      
      setLoading(true);
      try {
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
          const evals = evaluasiTanggalTanamDinamis(selectedLahan, activeCrop, days);
          setEvaluations(evals);
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.warn("Failed to fetch weather, using fallback data", error);
        }
        
        const mockDays = Array.from({length: 14}).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() + i);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          
          return {
            date: `${yyyy}-${mm}-${dd}`,
            temperature_2m_mean: 25 + Math.random() * 6,
            precipitation_sum: Math.random() * 15
          };
        });
        
        setForecast(mockDays);
        const evals = evaluasiTanggalTanamDinamis(selectedLahan, activeCrop, mockDays as any);
        setEvaluations(evals);

      } finally {
        setLoading(false);
      }
    }

    fetchWeather();
  }, [lat, lng, selectedTanaman, selectedLahan, activeCrop]);

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

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const selectedEval = evaluations.find(e => e.date === selectedDateStr);

  if (isNested) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Calendar Card */}
        <div className="md:col-span-7 bg-bg-card border border-border-medium rounded-2xl p-5 flex flex-col justify-between relative min-h-[350px]">
          {loading && (
             <div className="absolute inset-0 z-10 bg-bg-card/50 backdrop-blur-sm flex justify-center items-center rounded-2xl">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
             </div>
          )}
          <div className="w-full">
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-text-main border-b border-border-light pb-3 w-full">
              <CalendarIcon className="w-4 h-4 text-primary-light" />
              <span>Prediksi Kesesuaian Tanam (14 Hari Kedepan)</span>
            </h3>
            <div className="calendar-wrapper custom-calendar bg-bg-dark p-3.5 rounded-xl border border-border-light w-full flex justify-center">
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
        </div>

        {/* Date Details Card & Legend */}
        <div className="md:col-span-5 flex flex-col gap-6">
          <div className="bg-bg-card border border-border-medium rounded-2xl p-5 flex-1 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold mb-4 text-text-main border-b border-border-light pb-3">
                Detail Tanggal
              </h3>
              
              {!selectedDate ? (
                <div className="text-text-muted text-xs italic">Pilih tanggal di kalender untuk melihat prediksi.</div>
              ) : !selectedEval ? (
                <div className="text-text-muted text-xs">
                  Tidak ada data prediksi cuaca untuk tanggal {format(selectedDate, 'dd MMMM yyyy', { locale: id })}. Silakan pilih tanggal 14 hari ke depan.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-text-main font-semibold">
                    <span>{format(selectedDate, 'EEEE, dd MMMM yyyy', { locale: id })}</span>
                  </div>
                  
                  <div className={`p-4 rounded-xl border ${
                    selectedEval.status === 'optimal' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                    selectedEval.status === 'kurang-optimal' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                    'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>
                    <div className="flex items-start gap-2.5">
                      {selectedEval.status === 'optimal' ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />}
                      <div>
                        <h4 className="font-bold text-xs mb-1">
                          {selectedEval.status === 'optimal' ? 'Sangat Optimal untuk Tanam' :
                           selectedEval.status === 'kurang-optimal' ? 'Kurang Optimal (Butuh Mitigasi)' :
                           'Sangat Berisiko (Sebaiknya Hindari)'}
                        </h4>
                        {/* Dominant Skor Kelayakan Akhir */}
                        <div className="mb-2 mt-1.5 flex items-baseline gap-2">
                          <span className="text-[10px] uppercase tracking-wider opacity-85 font-bold text-gray-300">Skor Kelayakan Akhir:</span>
                          <strong className="text-2xl font-black tracking-tight">{selectedEval.score}/100</strong>
                        </div>
                        
                        {selectedEval.landScore !== undefined && (
                          <div className="text-[11px] opacity-90 space-y-1.5 border-t border-white/10 pt-2 mt-2 font-medium">
                            {/* Sub-skor 1: Kesesuaian Lahan */}
                            <div className="flex items-center gap-1.5 relative group cursor-help text-white/80 hover:text-white transition-colors">
                              <span>├─ Kesesuaian Lahan (fisik/tanah):</span>
                              <strong className="text-white">{selectedEval.landScore}/100</strong>
                              <span className="text-[9px] opacity-60">ⓘ</span>
                              
                              {/* Tooltip */}
                              <div className="absolute left-0 bottom-full mb-1.5 w-64 p-2.5 bg-zinc-900 border border-zinc-700/50 text-[10px] text-zinc-300 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 leading-relaxed normal-case font-normal">
                                Skor ini menghitung kombinasi parameter fisik lahan (tanah, curah hujan bulanan rata-rata, suhu tahunan, drainase, kemiringan) yang bersifat tetap.
                              </div>
                            </div>

                            {/* Sub-skor 2: Kelayakan Cuaca */}
                            <div className="flex items-center gap-1.5 relative group cursor-help text-white/80 hover:text-white transition-colors">
                              <span>└─ Kelayakan Cuaca (kondisi harian):</span>
                              <strong className="text-white">{selectedEval.weatherScore}/100</strong>
                              <span className="text-[9px] opacity-60">ⓘ</span>

                              {/* Tooltip */}
                              <div className="absolute left-0 bottom-full mb-1.5 w-64 p-2.5 bg-zinc-900 border border-zinc-700/50 text-[10px] text-zinc-300 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 leading-relaxed normal-case font-normal">
                                Skor ini menghitung kelayakan kondisi cuaca harian (suhu harian & curah hujan harian) pada tanggal tanam yang dipilih.
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {selectedEval.landScore !== undefined && selectedEval.landScore < 80 && (
                          <div className="text-[10px] text-amber-300/90 font-semibold mt-2 leading-normal">
                            💡 Lahan memiliki batasan fisik (skor {selectedEval.landScore}/100). Periksa tab Overview & Checklist untuk saran mitigasi.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="bg-bg-dark border border-border-medium rounded-xl p-3 overflow-hidden">
                      <div className="flex items-center gap-1.5 text-text-muted mb-1">
                        <ThermometerSun className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[10px] uppercase font-semibold truncate">Suhu Rata-rata</span>
                      </div>
                      <div className="text-lg font-bold text-text-main truncate">{Number(selectedEval.temp).toFixed(1)}°C</div>
                    </div>
                    
                    <div className="bg-bg-dark border border-border-medium rounded-xl p-3 overflow-hidden">
                      <div className="flex items-center gap-1.5 text-text-muted mb-1">
                        <CloudRain className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[10px] uppercase font-semibold truncate">Curah Hujan</span>
                      </div>
                      <div className="text-lg font-bold text-text-main truncate">{Number(selectedEval.rain).toFixed(1)} mm</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border-medium pt-3 mt-4">
              <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block mb-2">Keterangan Indikator Kalender</span>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/50"></div>
                  <span className="text-[11px] text-text-muted">Optimal</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/50"></div>
                  <span className="text-[11px] text-text-muted">Kurang Optimal</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/50"></div>
                  <span className="text-[11px] text-text-muted">Hindari</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback layout when not nested (more than one land)
  return (
    <div className="space-y-6">
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
                    {cropsDbList && cropsDbList.length > 0 ? (
                      cropsDbList.map(c => (
                        <option key={c.id} value={c.id}>{c.nama}</option>
                      ))
                    ) : (
                      TANAMAN_DATABASE.map(t => (
                        <option key={t.id} value={t.id}>{t.nama}</option>
                      ))
                    )}
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
                        {/* Dominant Skor Kelayakan Akhir */}
                        <div className="mb-3 mt-1.5 flex items-baseline gap-2">
                          <span className="text-[10px] uppercase tracking-wider opacity-85 font-bold text-gray-300">Skor Kelayakan Akhir:</span>
                          <strong className="text-3xl font-black tracking-tight">{selectedEval.score}/100</strong>
                        </div>
                        
                        {selectedEval.landScore !== undefined && (
                          <div className="text-xs opacity-90 space-y-1.5 border-t border-white/10 pt-2.5 mt-2.5 font-medium">
                            {/* Sub-skor 1: Kesesuaian Lahan */}
                            <div className="flex items-center gap-1.5 relative group cursor-help text-white/80 hover:text-white transition-colors">
                              <span>├─ Kesesuaian Lahan (fisik/tanah):</span>
                              <strong className="text-white">{selectedEval.landScore}/100</strong>
                              <span className="text-[10px] opacity-60">ⓘ</span>
                              
                              {/* Tooltip */}
                              <div className="absolute left-0 bottom-full mb-1.5 w-64 p-2.5 bg-zinc-900 border border-zinc-700/50 text-[10px] text-zinc-300 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 leading-relaxed normal-case font-normal">
                                Skor ini menghitung kombinasi parameter fisik lahan (tanah, curah hujan bulanan rata-rata, suhu tahunan, drainase, kemiringan) yang bersifat tetap.
                              </div>
                            </div>

                            {/* Sub-skor 2: Kelayakan Cuaca */}
                            <div className="flex items-center gap-1.5 relative group cursor-help text-white/80 hover:text-white transition-colors">
                              <span>└─ Kelayakan Cuaca (kondisi harian):</span>
                              <strong className="text-white">{selectedEval.weatherScore}/100</strong>
                              <span className="text-[10px] opacity-60">ⓘ</span>

                              {/* Tooltip */}
                              <div className="absolute left-0 bottom-full mb-1.5 w-64 p-2.5 bg-zinc-900 border border-zinc-700/50 text-[10px] text-zinc-300 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 leading-relaxed normal-case font-normal">
                                Skor ini menghitung kelayakan kondisi cuaca harian (suhu harian & curah hujan harian) pada tanggal tanam yang dipilih.
                              </div>
                            </div>
                          </div>
                        )}
                        {selectedEval.landScore !== undefined && selectedEval.landScore < 80 && (
                          <div className="text-xs text-amber-300/90 font-semibold mt-2">
                            💡 Peringatan: Lahan memiliki keterbatasan fisik (skor {selectedEval.landScore}/100). Harap periksa detail kendala dan saran mitigasi di menu Evaluasi Lahan.
                          </div>
                        )}
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
