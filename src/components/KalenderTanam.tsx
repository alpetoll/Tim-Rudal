'use client';

import { useState, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { Lahan } from '../types';
import { evaluasiTanggalTanam, TANAMAN_DATABASE } from '../utils/suitability';
import { Calendar as CalendarIcon, MapPin, CloudRain, ThermometerSun, AlertTriangle, CheckCircle2, Sprout } from 'lucide-react';

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
  
  const selectedLahan = savedLahans.find(l => l.id === selectedLahanId);

  useEffect(() => {
    if (savedLahans.length > 0 && !selectedLahanId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedLahanId(savedLahans[0].id);
    }
  }, [savedLahans, selectedLahanId]);

  const lat = selectedLahan?.centroid?.[0];
  const lng = selectedLahan?.centroid?.[1];

  useEffect(() => {
    async function fetchWeather() {
      if (lat === undefined || lng === undefined) return;
      
      setLoading(true);
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_mean,precipitation_sum&timezone=Asia%2FJakarta&forecast_days=14`);
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
        console.error("Failed to fetch weather", error);
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Sidebar Controls */}
      <div className="space-y-6">
        <div className="bg-bg-card border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
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
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Lahan Saya</label>
                <select 
                  value={selectedLahanId}
                  onChange={(e) => setSelectedLahanId(e.target.value)}
                  className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all text-sm"
                >
                  {savedLahans.map(lahan => (
                    <option key={lahan.id} value={lahan.id}>{lahan.nama} (Luas: {lahan.luas} m²)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Rencana Tanaman</label>
                <select 
                  value={selectedTanaman}
                  onChange={(e) => setSelectedTanaman(e.target.value)}
                  className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all text-sm"
                >
                  {TANAMAN_DATABASE.map(t => (
                    <option key={t.id} value={t.id}>{t.nama}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="bg-bg-card border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
            <Sprout className="w-5 h-5 text-emerald-400" />
            <span>Keterangan Indikator</span>
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-emerald-500/20 border border-emerald-500/50"></div>
              <span className="text-gray-300">Sangat Optimal untuk Tanam</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-amber-500/20 border border-amber-500/50"></div>
              <span className="text-gray-300">Kurang Optimal (Perlu Mitigasi)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-red-500/20 border border-red-500/50"></div>
              <span className="text-gray-300">Hindari (Risiko Gagal Panen)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Calendar Area */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-bg-card border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row gap-8 items-start relative">
          
          {loading && (
             <div className="absolute inset-0 z-10 bg-bg-card/50 backdrop-blur-sm flex justify-center items-center rounded-2xl">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
             </div>
          )}

          <div className="w-full md:w-auto flex-shrink-0">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white border-b border-white/5 pb-3">
              <CalendarIcon className="w-5 h-5 text-primary-light" />
              <span>Prediksi 14 Hari Kedepan</span>
            </h3>
            
            <div className="calendar-wrapper custom-calendar bg-bg-dark p-4 rounded-xl border border-white/5 inline-block">
              <DayPicker 
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={id}
                modifiers={modifiers}
                modifiersClassNames={modifiersClassNames}
                disabled={[{ before: new Date() }]}
                className="text-white"
              />
            </div>
          </div>

          <div className="flex-1 w-full">
            <h3 className="text-lg font-bold mb-4 text-white border-b border-white/5 pb-3">
              Detail Tanggal
            </h3>
            
            {!selectedDate ? (
              <div className="text-gray-400 text-sm italic">Pilih tanggal di kalender untuk melihat prediksi.</div>
            ) : !selectedEval ? (
              <div className="text-gray-400 text-sm">
                Tidak ada data prediksi cuaca untuk tanggal {format(selectedDate, 'dd MMMM yyyy', { locale: id })}. Silakan pilih tanggal 14 hari ke depan.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg text-white font-semibold">
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
                  <div className="bg-bg-dark border border-white/10 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                      <ThermometerSun className="w-4 h-4" />
                      <span className="text-xs uppercase font-semibold">Suhu Rata-rata</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{selectedEval.temp}°C</div>
                  </div>
                  
                  <div className="bg-bg-dark border border-white/10 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                      <CloudRain className="w-4 h-4" />
                      <span className="text-xs uppercase font-semibold">Curah Hujan</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{selectedEval.rain} mm</div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
      
    </div>
  );
}
