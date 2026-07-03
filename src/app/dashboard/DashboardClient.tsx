'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Lahan, RiwayatPanen } from '@/types';
import { cekKelayakan, cariAlternatif, TANAMAN_DATABASE } from '@/utils/suitability';
import { supabase } from '@/utils/supabaseClient';
import { showAlertModal, showConfirmModal } from '@/utils/swal';
import { 
  getLahans, 
  insertLahan, 
  startTanamLahan, 
  updateLahanStatus, 
  getRiwayatPanens, 
  insertRiwayatPanen,
  deleteLahan,
  updateLahanDetails,
  deleteRiwayatPanen,
  updatePetaniProfile
} from '@/utils/supabaseQueries';
import { 
  Sprout, 
  Map as MapIcon, 
  Map,
  TrendingUp, 
  AlertTriangle, 
  User, 
  LogOut, 
  Plus, 
  Activity, 
  Droplet, 
  Calendar, 
  ArrowLeft, 
  ArrowRight,
  CheckCircle2, 
  XCircle,
  FileSpreadsheet,
  CloudRain,
  Lock,
  Mail,
  Edit2,
  Trash2,
  Settings,
  ThermometerSun,
  ChevronRight,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Dynamically import Map component (disable SSR for Leaflet window access)
const PetaLahan = dynamic(() => import('@/components/PetaLahan'), { ssr: false });
import KalenderTanam from '@/components/KalenderTanam';
import EarlyWarning from '@/components/EarlyWarning';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface DashboardClientProps {
  initialUser: any;
}

export default function DashboardClient({ initialUser }: DashboardClientProps) {
  // --- AUTH STATES ---
  const [user, setUser] = useState<any>(initialUser);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // --- PROFILE & BUSINESS STATES ---
  const [petaniName, setPetaniName] = useState<string>('');
  const [needProfileSetup, setNeedProfileSetup] = useState<boolean>(false);
  const [lahans, setLahans] = useState<Lahan[]>([]);
  const [panens, setPanens] = useState<RiwayatPanen[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  
  // Navigation / View state
  // 'dashboard' | 'add-lahan' | 'edit-lahan' | 'suitability' | 'monitoring' | 'panen' | 'profile'
  const [currentView, setCurrentView] = useState<'dashboard' | 'add-lahan' | 'edit-lahan' | 'suitability' | 'monitoring' | 'panen' | 'profile'>('dashboard');
  
  // Theme state removed - app is strictly dark mode
  
  useEffect(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('ecotani_theme', 'dark');
  }, []);
  
  // Selected entities for drill-down
  const [selectedLahan, setSelectedLahan] = useState<Lahan | null>(null);
  const [selectedCropId, setSelectedCropId] = useState<string>('padi');
  const [activeTab, setActiveTab] = useState<'lahan' | 'panen' | 'kalender'>('lahan');
  const [liveWeather, setLiveWeather] = useState<{suhu: number, curahHujan: number, currentTemp?: number, weatherDesc?: string} | null>(null);

  // --- HARVEST (PANEN) STATES ---
  const [beratPanen, setBeratPanen] = useState<number | ''>('');
  const [statusHasil, setStatusHasil] = useState<RiwayatPanen['statusHasil']>('sukses');
  const [hargaJual, setHargaJual] = useState<number | ''>('');

  // Fetch live weather for suitability check and monitoring
  useEffect(() => {
    if ((currentView === 'suitability' || currentView === 'monitoring') && selectedLahan) {
      const [lat, lng] = selectedLahan.centroid;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds timeout

      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_mean,precipitation_sum&current=temperature_2m,weather_code&timezone=Asia%2FJakarta&forecast_days=14`, { signal: controller.signal })
        .then(res => res.json())
        .then(data => {
            clearTimeout(timeoutId);
            if (data.daily) {
              const avgTemp = data.daily.temperature_2m_mean.reduce((a:number, b:number) => a+b, 0) / 14;
              const totalRain = data.daily.precipitation_sum.reduce((a:number, b:number) => a+b, 0); // 14 days rain
              
              let wDesc = 'Berawan';
              if (data.current) {
                const code = data.current.weather_code;
                if (code === 0) wDesc = 'Cerah';
                else if (code <= 3) wDesc = 'Berawan';
                else if (code >= 51 && code <= 67) wDesc = 'Hujan';
                else if (code >= 71) wDesc = 'Badai';
              }

              setLiveWeather({ 
                suhu: Math.round(avgTemp * 10) / 10, 
                curahHujan: Math.round(totalRain * (30/14)),
                currentTemp: data.current?.temperature_2m || Math.round(avgTemp),
                weatherDesc: wDesc
              });
            }
        })
        .catch(err => {
            clearTimeout(timeoutId);
            if (err.name !== 'AbortError') {
              console.warn('Weather API Warning:', err.message);
            }
            // Fallback to simulated offline data
            setLiveWeather({
              suhu: selectedLahan.suhu,
              curahHujan: selectedLahan.curahHujan,
              currentTemp: selectedLahan.suhu,
              weatherDesc: 'Cerah (Offline)'
            });
        });

      return () => {
        controller.abort();
        clearTimeout(timeoutId);
      };
    } else {
      setLiveWeather(null);
    }
  }, [currentView, selectedLahan]);

  // ==========================================
  // AUTHENTICATION & INITIALIZATION FLOW
  // ==========================================
  
  // Monitor auth state changes
  useEffect(() => {
    if (user) {
      checkPetaniProfile(user.id);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) {
        checkPetaniProfile(currentUser.id);
      } else {
        setLahans([]);
        setPanens([]);
        setPetaniName('');
        setNeedProfileSetup(false);
        // Direct browser redirect when session is cleared
        window.location.href = '/auth';
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch or setup Petani Profile
  const checkPetaniProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('petani')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // Real database error
        console.error('Error fetching profile:', error.message);
      }

      if (data) {
        // Profile exists, load dashboard data
        setPetaniName(data.nama);
        setNeedProfileSetup(false);
        await loadDashboardData(userId);
      } else {
        // Profile does not exist, trigger profile setup flow (PRD Flowchart: Akun Baru?)
        setNeedProfileSetup(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAuthLoading(false);
    }
  };

  // Fetch Lands and Harvest logs from Supabase
  const loadDashboardData = async (userId: string) => {
    setDataLoading(true);
    try {
      const [fetchedLahans, fetchedPanens] = await Promise.all([
        getLahans(userId),
        getRiwayatPanens(userId)
      ]);
      setLahans(fetchedLahans);
      setPanens(fetchedPanens);
    } catch (e) {
      console.error('Gagal memuat data:', e);
    } finally {
      setDataLoading(false);
    }
  };

  // Auth submission is handled by /auth page using Server-Side cookies.

  // Create profile for new user
  const handleProfileSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petaniName.trim() || !user) return;

    setAuthLoading(true);
    try {
      const { error } = await supabase
        .from('petani')
        .upsert([
          {
            id: user.id,
            nama: petaniName,
            komoditas_utama: ''
          }
        ]);

      if (error) throw error;
      
      setNeedProfileSetup(false);
      await loadDashboardData(user.id);
    } catch (err: any) {
      await showAlertModal('Gagal Membuat Profil', err.message || 'Terjadi kesalahan.', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    const confirmed = await showConfirmModal('Logout', 'Apakah Anda ingin keluar dari akun EkoTani?');
    if (confirmed) {
      await supabase.auth.signOut();
      setCurrentView('dashboard');
    }
  };

  // --- CRUD BUSINESS HANDLERS ---
  const handleAddLahan = async (lahanData: Omit<Lahan, 'id' | 'status'>) => {
    if (!user) return;
    
    setDataLoading(true);
    const result = await insertLahan(lahanData, user.id);
    setDataLoading(false);

    if (result) {
      setLahans(prev => [...prev, result]);
      setCurrentView('dashboard');
      await showAlertModal('Berhasil', 'Lahan sawah berhasil disimpan ke cloud database Supabase!', 'success');
    } else {
      await showAlertModal('Gagal', 'Gagal menyimpan lahan. Silakan coba kembali.', 'error');
    }
  };

  const handleUpdateLahan = async (lahanData: Omit<Lahan, 'id' | 'status'>) => {
    if (!user || !selectedLahan) return;
    
    setDataLoading(true);
    const success = await updateLahanDetails(selectedLahan.id, lahanData);
    setDataLoading(false);

    if (success) {
      await loadDashboardData(user.id);
      setCurrentView('dashboard');
      setSelectedLahan(null);
      await showAlertModal('Berhasil', 'Perubahan lahan berhasil disimpan!', 'success');
    } else {
      await showAlertModal('Gagal', 'Gagal memperbarui lahan. Silakan coba kembali.', 'error');
    }
  };

  const handleDeleteLahan = async (lahanId: string) => {
    const confirmed = await showConfirmModal('Hapus Lahan', 'Apakah Anda yakin ingin menghapus lahan ini secara permanen?');
    if (!confirmed) return;
    
    const success = await deleteLahan(lahanId);
    if (success) {
      setLahans(lahans.filter(l => l.id !== lahanId));
      if (selectedLahan?.id === lahanId) {
        setSelectedLahan(null);
        setCurrentView('dashboard');
      }
    } else {
      await showAlertModal('Gagal', 'Gagal menghapus lahan. Silakan coba lagi.', 'error');
    }
  };

  const handleDeleteRiwayat = async (riwayatId: string) => {
    const confirmed = await showConfirmModal('Hapus Riwayat', 'Apakah Anda yakin ingin menghapus riwayat panen ini?');
    if (!confirmed) return;
    
    const success = await deleteRiwayatPanen(riwayatId);
    if (success) {
      setPanens(panens.filter(p => p.id !== riwayatId));
    } else {
      await showAlertModal('Gagal', 'Gagal menghapus riwayat panen.', 'error');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setDataLoading(true);
    const success = await updatePetaniProfile(user.id, petaniName, '');
    setDataLoading(false);
    if (success) {
      await showAlertModal('Berhasil', 'Profil berhasil diperbarui!', 'success');
      setCurrentView('dashboard');
    } else {
      await showAlertModal('Gagal', 'Gagal memperbarui profil.', 'error');
    }
  };

  const handleConfirmTanam = async (cropId: string, customMitigasi?: string) => {
    if (!selectedLahan || !user) return;

    const tanaman = TANAMAN_DATABASE.find(t => t.id === cropId);
    if (!tanaman) return;

    const evalResult = cekKelayakan(selectedLahan, cropId);
    const estimasiPanen = new Date(Date.now() + (tanaman.siklusTanamDays * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    const mitigasi = customMitigasi || evalResult.saranMitigasi;

    setDataLoading(true);
    const success = await startTanamLahan(
      selectedLahan.id, 
      tanaman.nama, 
      evalResult.kebutuhanAirDaily, 
      estimasiPanen, 
      mitigasi
    );

    if (success) {
      // Reload land data from Supabase
      await loadDashboardData(user.id);
      setCurrentView('dashboard');
      setSelectedLahan(null);
      await showAlertModal('Tanam Diaktifkan', `Status penanaman ${tanaman.nama} berhasil diaktifkan.`, 'success');
    } else {
      await showAlertModal('Gagal', 'Gagal mengaktifkan penanaman.', 'error');
    }
    setDataLoading(false);
  };

  const handleSimpanPanen = async (berat: number | '', statusHasil: RiwayatPanen['statusHasil'], hargaJualActual: number | '') => {
    if (!selectedLahan || !selectedLahan.varietasDitanam || !user) return;
    
    const numBerat = typeof berat === 'number' ? berat : 0;
    const numHarga = typeof hargaJualActual === 'number' ? hargaJualActual : 0;

    const pendapatanEstimasi = numBerat * numHarga;

    const panenData: Omit<RiwayatPanen, 'id'> = {
      lahanId: selectedLahan.id,
      namaLahan: selectedLahan.nama,
      varietas: selectedLahan.varietasDitanam,
      tanggalPanen: new Date().toISOString().split('T')[0],
      statusHasil,
      beratPanen: berat,
      pendapatanEstimasi
    };

    setDataLoading(true);
    const success = await insertRiwayatPanen(panenData, user.id);

    if (success) {
      await loadDashboardData(user.id);
      setCurrentView('dashboard');
      setSelectedLahan(null);
      await showAlertModal('Panen Dicatat', 'Hasil panen berhasil tersimpan di Supabase! Lahan Anda telah di-reset ke status kosong.', 'success');
    } else {
      await showAlertModal('Gagal', 'Gagal mencatat hasil panen.', 'error');
    }
    setDataLoading(false);
  };

  const handleUpdateStatusTanam = async (lahanId: string, nextStatus: 'siap-panen' | 'kosong') => {
    if (!user) return;
    setDataLoading(true);
    const success = await updateLahanStatus(lahanId, nextStatus);
    if (success) {
      await loadDashboardData(user.id);
    } else {
      await showAlertModal('Gagal', 'Gagal mengubah status lahan.', 'error');
    }
    setDataLoading(false);
  };

  // --- DERIVED STATS ---
  const activeAlerts = lahans.filter(l => l.status === 'sedang-ditanam' && l.ketinggian > 800 && l.curahHujan > 250);

  // ==========================================================================
  // VIEW: LOADING SCREEN
  // ==========================================================================
  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg-dark flex flex-col justify-center items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mb-4"></div>
        <p className="text-xs text-text-muted uppercase tracking-widest">Menghubungkan ke Supabase...</p>
      </div>
    );
  }


  // ==========================================================================
  // VIEW: PROFILE SETUP (PRD Flowchart: Tanya Profil Petani Baru)
  // ==========================================================================
  if (needProfileSetup) {
    return (
      <div className="min-h-screen bg-bg-dark flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden bg-[radial-gradient(circle_at_center,rgba(0,168,89,0.06),transparent_50%)]">
        <div className="w-full max-w-md bg-bg-card border border-border-medium rounded-3xl p-6 md:p-8 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto no-scrollbar">
          <h2 className="text-xl font-bold text-center text-text-main mb-2">Lengkapi Profil Petani</h2>
          <p className="text-sm text-text-muted text-center mb-6">Silakan lengkapi profil pertanian Anda untuk menginisialisasi dashboard geospatial.</p>

          <form onSubmit={handleProfileSetupSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Nama Lengkap Petani</label>
              <input 
                type="text" 
                required
                placeholder="Contoh: Pak Tani Sugeng" 
                value={petaniName}
                onChange={(e) => setPetaniName(e.target.value)}
                className="w-full bg-bg-dark border border-border-medium rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary transition-all text-sm"
              />
            </div>

            <button 
              type="submit"
              className="w-full bg-primary hover:bg-emerald-600 text-text-main font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/20 mt-4 flex items-center justify-center gap-2"
            >
              <span>Simpan & Buka Dashboard</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // VIEW: ADD LAHAN (GEOSPATIAL DRAWING)
  // ==========================================================================
  if (currentView === 'add-lahan') {
    return (
      <div className="min-h-screen bg-bg-dark flex flex-col">
        <header className="border-b border-border-light py-4 px-6 bg-bg-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setCurrentView('dashboard')}
              className="p-2 hover:bg-border-light rounded-full text-text-muted hover:text-text-main transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-text-main">Tandai Batas Wilayah Lahan Sawah</h1>
          </div>
          <span className="text-xs text-text-muted">Teknologi Geospatial EcoTani</span>
        </header>

        <main className="flex-grow p-4 md:p-6 md:overflow-hidden overflow-y-auto">
          <PetaLahan 
            onSaveLahan={handleAddLahan}
            savedLahans={lahans}
            onClose={() => setCurrentView('dashboard')}
          />
        </main>
      </div>
    );
  }

  // ==========================================================================
  // VIEW: EDIT LAHAN (GEOSPATIAL DRAWING)
  // ==========================================================================
  if (currentView === 'edit-lahan' && selectedLahan) {
    return (
      <div className="min-h-screen bg-bg-dark flex flex-col">
        <header className="border-b border-border-light py-4 px-6 bg-bg-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setCurrentView('dashboard');
                setSelectedLahan(null);
              }}
              className="p-2 hover:bg-border-light rounded-full text-text-muted hover:text-text-main transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-text-main">Edit Lahan Sawah</h1>
          </div>
          <span className="text-xs text-text-muted">Teknologi Geospatial EcoTani</span>
        </header>

        <main className="flex-grow p-4 md:p-6 md:overflow-hidden overflow-y-auto">
          <PetaLahan 
            onSaveLahan={handleUpdateLahan}
            savedLahans={lahans.filter(l => l.id !== selectedLahan.id)} // Exclude self from saved lahans rendering to avoid overlap confusion
            onClose={() => {
              setCurrentView('dashboard');
              setSelectedLahan(null);
            }}
            initialLahan={selectedLahan}
          />
        </main>
      </div>
    );
  }

  // ==========================================================================
  // VIEW: CROP CHECK & SUITABILITY ASSESSMENT
  // ==========================================================================
  if (currentView === 'suitability' && selectedLahan) {
    const lahanToEvaluate = liveWeather ? { ...selectedLahan, suhu: liveWeather.suhu, curahHujan: liveWeather.curahHujan } : selectedLahan;
    const evalResult = cekKelayakan(lahanToEvaluate, selectedCropId);
    const alternatifList = cariAlternatif(lahanToEvaluate);

    return (
      <div className="min-h-screen bg-bg-dark py-8 px-4">
        <div className="max-w-3xl mx-auto bg-bg-card border border-border-medium rounded-3xl p-6 md:p-8 shadow-2xl">
          <button 
            onClick={() => {
              setCurrentView('dashboard');
              setSelectedLahan(null);
            }}
            className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-main mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Dashboard</span>
          </button>

          <h2 className="text-2xl font-bold text-text-main mb-1">Cek Kelayakan Lahan Tanam</h2>
          <p className="text-sm text-text-muted mb-6">
            Menilai kesesuaian lahan <strong className="text-text-main">{selectedLahan.nama}</strong> berdasarkan parameter geospasial tanah dan iklim.
            {liveWeather && <span className="block mt-1 text-primary-light flex items-center gap-1"><CloudRain className="w-3.5 h-3.5" /> Terhubung dengan data cuaca live ({liveWeather.suhu}°C, {liveWeather.curahHujan} mm/bln)</span>}
          </p>

          {/* Pilihan Jenis Tanaman */}
          <div className="mb-8 bg-bg-dark border border-border-medium rounded-2xl p-5">
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Pilih Komoditas Tanaman</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {TANAMAN_DATABASE.map(crop => (
                <button
                  key={crop.id}
                  onClick={() => setSelectedCropId(crop.id)}
                  className={`py-3 px-2 rounded-xl border text-center transition-all ${
                    selectedCropId === crop.id
                      ? 'border-primary bg-primary/10 text-primary-light font-bold'
                      : 'border-border-medium hover:bg-border-light text-text-muted'
                  }`}
                >
                  <span className="block text-sm">{crop.nama}</span>
                </button>
              ))}
            </div>
          </div>

          {/* HASIL ANALISIS KELAYAKAN */}
          <div className="space-y-6">
            <div className="flex items-start gap-4 p-5 rounded-2xl border bg-bg-dark border-border-light">
              <div className="mt-1">
                {evalResult.layak ? (
                  <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/30">
                    <XCircle className="h-6 w-6 text-red-500" />
                  </div>
                )}
              </div>
              <div className="flex-grow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-text-main">
                    {evalResult.layak ? 'Lahan Layak Ditanami' : 'Lahan Kurang Layak'}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    evalResult.layak ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    Kecocokan: {evalResult.skor}%
                  </span>
                </div>
                
                {evalResult.kendala.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <span className="text-xs font-semibold text-red-400 block uppercase tracking-wider">Deteksi Kendala:</span>
                    <ul className="list-disc pl-5 text-sm text-text-muted space-y-1">
                      {evalResult.kendala.map((k, i) => <li key={`k-${i}`}>{k}</li>)}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">Selamat! Parameter lingkungan (suhu, curah hujan, ketinggian, dan tipe tanah) terdeteksi sangat cocok dengan kebutuhan varietas tanaman ini.</p>
                )}
              </div>
            </div>

            {/* Jika LAYAK: Tampilkan Kalender Kerja / Estimasi */}
            {evalResult.layak && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-bg-dark border border-border-light space-y-4">
                  <h4 className="font-bold text-text-main flex items-center gap-2 border-b border-border-light pb-2">
                    <Calendar className="w-4.5 h-4.5 text-primary-light" />
                    <span>Rencana Perawatan</span>
                  </h4>
                  <ul className="text-xs text-text-muted space-y-3">
                    {evalResult.siklusPemupukan.map((step, i) => (
                      <li key={`s-${i}`} className="flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5"></span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-5 rounded-2xl bg-bg-dark border border-border-light space-y-3">
                  <h4 className="font-bold text-text-main flex items-center gap-2 border-b border-border-light pb-2">
                    <Droplet className="w-4.5 h-4.5 text-primary-light" />
                    <span>Kebutuhan Sumber Daya</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-text-muted block mb-0.5">Estimasi Air</span>
                      <strong className="text-text-main text-sm">{(evalResult.kebutuhanAirDaily * selectedLahan.luas).toLocaleString('id-ID')} Liter/Hari</strong>
                      <span className="text-gray-600 block mt-0.5">({evalResult.kebutuhanAirDaily}L / m²)</span>
                    </div>
                    <div>
                      <span className="text-text-muted block mb-0.5">Siklus Panen</span>
                      <strong className="text-text-main text-sm">{TANAMAN_DATABASE.find(t => t.id === selectedCropId)?.siklusTanamDays} Hari</strong>
                    </div>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed border-t border-border-light pt-2 mt-2">
                    {evalResult.saranMitigasi}
                  </p>
                </div>
              </div>
            )}

            {/* OPSI MITIGASI / KEPUTUSAN JIKA TIDAK LAYAK */}
            {!evalResult.layak && (
              <div className="space-y-4 border-t border-border-light pt-6">
                <div className="p-4 rounded-xl bg-orange-600/10 border border-orange-500/20 text-xs text-orange-400 leading-relaxed">
                  <strong>Analisis Mitigasi:</strong> Meskipun lahan kurang layak, Anda tetap dapat memaksakan penanaman dengan menerapkan langkah mitigasi khusus. Atau, cari komoditas alternatif yang lebih menguntungkan untuk wilayah ini.
                </div>

                <div className="p-5 rounded-2xl bg-bg-dark border border-border-light">
                  <h4 className="font-bold text-text-main mb-3 text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span>Rekomendasi Tanaman Alternatif Terdekat</span>
                  </h4>
                  <div className="space-y-2">
                    {alternatifList.filter(a => a.tanaman.id !== selectedCropId).slice(0, 2).map((alt) => (
                      <div key={alt.tanaman.id} className="flex items-center justify-between p-3 bg-border-light border border-border-light rounded-xl text-xs">
                        <div>
                          <strong className="text-text-main text-sm block">{alt.tanaman.nama}</strong>
                          <span className="text-text-muted">Estimasi panen: {alt.tanaman.siklusTanamDays} hari</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-emerald-400 font-bold">Kecocokan: {alt.evaluasi.skor}%</span>
                          <button
                            onClick={() => setSelectedCropId(alt.tanaman.id)}
                            className="bg-border-medium hover:bg-white/20 text-text-main font-semibold py-1.5 px-3 rounded-lg"
                          >
                            Pilih
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ACTIONS */}
            <div className="flex gap-4 border-t border-border-light pt-6 mt-8">
              <button 
                onClick={() => {
                  setCurrentView('dashboard');
                  setSelectedLahan(null);
                }}
                className="flex-1 py-3.5 px-4 rounded-xl border border-border-medium hover:bg-border-light text-text-muted font-bold text-sm transition-all text-center"
              >
                Batalkan
              </button>

              <button 
                onClick={() => handleConfirmTanam(selectedCropId, evalResult.saranMitigasi)}
                className={`flex-1 py-3.5 px-4 rounded-xl font-bold text-sm transition-all text-center ${
                  evalResult.layak 
                    ? 'bg-primary hover:bg-emerald-600 text-text-main shadow-lg shadow-primary/20' 
                    : 'bg-orange-600 hover:bg-orange-700 text-text-main shadow-lg shadow-orange-600/20'
                }`}
              >
                {evalResult.layak ? 'Konfirmasi Tanam' : 'Paksa Tanam (Gunakan Mitigasi)'}
              </button>
            </div>

          </div>

        </div>
      </div>
    );
  }

  // ==========================================================================
  // VIEW: MONITORING & EARLY WARNING SYSTEM
  // ==========================================================================
  if (currentView === 'monitoring' && selectedLahan) {
    const isExtremeWeather = selectedLahan.ketinggian > 800 && selectedLahan.curahHujan > 250;

    return (
      <div className="min-h-screen bg-bg-dark py-8 px-4">
        <div className="max-w-3xl mx-auto bg-bg-card border border-border-medium rounded-3xl p-6 md:p-8 shadow-2xl">
          
          <button 
            onClick={() => {
              setCurrentView('dashboard');
              setSelectedLahan(null);
            }}
            className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-main mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Dashboard</span>
          </button>

          <div className="flex justify-between items-start mb-4 border-b border-border-light pb-4">
            <div>
              <span className="text-xs bg-primary-dark/30 text-primary-light font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Sedang Ditanam</span>
              <h2 className="text-2xl font-bold text-text-main mt-2">{selectedLahan.nama}</h2>
              <p className="text-sm text-text-muted mt-1">Varietas: <strong className="text-text-main">{selectedLahan.varietasDitanam}</strong></p>
            </div>
            {isExtremeWeather && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-full px-3 py-1 flex items-center gap-1.5 text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Peringatan Cuaca</span>
              </div>
            )}
          </div>

          {/* DETEKSI GEOSPATIAL & CUACA REAL-TIME */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-bg-dark p-4 rounded-xl border border-border-light">
              <span className="text-text-muted text-xs block mb-1">Status Sensor Kelembapan</span>
              <div className="flex items-center gap-2">
                <Droplet className="w-4.5 h-4.5 text-primary-light" />
                <strong className="text-text-main text-base">78% (Kelembapan Optimal)</strong>
              </div>
            </div>
            <div className="bg-bg-dark p-4 rounded-xl border border-border-light">
              <span className="text-text-muted text-xs block mb-1">Cuaca Hari Ini</span>
              <div className="flex items-center gap-2">
                <CloudRain className="w-4.5 h-4.5 text-blue-400" />
                <strong className="text-text-main text-base">
                  {liveWeather ? `${liveWeather.weatherDesc} (${liveWeather.currentTemp}°C)` : 'Memuat...'}
                </strong>
              </div>
            </div>
            <div className="bg-bg-dark p-4 rounded-xl border border-border-light">
              <span className="text-text-muted text-xs block mb-1">Estimasi Tanggal Panen</span>
              <div className="flex items-center gap-2">
                <Calendar className="w-4.5 h-4.5 text-orange-400" />
                <strong className="text-text-main text-base">{selectedLahan.estimasiPanenDate}</strong>
              </div>
            </div>
          </div>

          {/* CUACA EKSTREM & EARLY WARNING BANNER */}
          {isExtremeWeather ? (
            <div className="bg-red-600/15 border border-red-500/30 rounded-2xl p-5 mb-6 space-y-3">
              <h4 className="text-red-400 font-bold text-sm flex items-center gap-2">
                <AlertTriangle className="w-4.5 h-4.5" />
                <span>Sistem Peringatan Dini (Early Warning)</span>
              </h4>
              <p className="text-xs text-text-muted leading-relaxed">
                Peta satelit mendeteksi adanya curah hujan ekstrim ({selectedLahan.curahHujan} mm/bln) di ketinggian lereng pegunungan ({selectedLahan.ketinggian} mdpl). Hal ini meningkatkan kelembapan tanah drastis dan memicu potensi busuk akar serta serangan wereng.
              </p>
              <div className="text-xs text-red-300 font-semibold">
                Rekomendasi Tindakan Cepat:
                <ul className="list-disc pl-5 font-normal mt-1 space-y-1">
                  <li>Buka seluruh katup drainase di hilir sawah untuk mengeluarkan limpahan air berlebih.</li>
                  <li>Lakukan pemangkasan daun terbawah pada varietas {selectedLahan.varietasDitanam} untuk mengurangi kelembapan rumpun.</li>
                  <li>Semprotkan fungisida alami pencegah jamur sebelum badai esok hari.</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 mb-6 space-y-2">
              <h4 className="text-primary-light font-bold text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4.5 h-4.5" />
                <span>Kondisi Lahan Terpantau Sehat</span>
              </h4>
              <p className="text-xs text-text-muted leading-relaxed">
                Kondisi curah hujan ({selectedLahan.curahHujan} mm/bln) dan suhu ({selectedLahan.suhu}°C) berada di dalam batas normal. Rekomendasi penyiraman harian: {(selectedLahan.kebutuhanAirDaily || 5) * selectedLahan.luas} liter dialirkan pada pagi hari.
              </p>
            </div>
          )}

          {/* CATATAN MITIGASI SAAT CHECK SUITABILITY */}
          {selectedLahan.catatanMitigasi && (
            <div className="bg-bg-dark border border-border-light rounded-2xl p-5 mb-6">
              <h4 className="font-bold text-text-main mb-2 text-xs uppercase tracking-wider text-text-muted">Instruksi Budidaya & Mitigasi Tanam</h4>
              <p className="text-xs text-text-muted whitespace-pre-line leading-relaxed">{selectedLahan.catatanMitigasi}</p>
            </div>
          )}



          {/* ACTIONS */}
          <div className="flex gap-4 border-t border-border-light pt-6">
            <button 
              onClick={() => {
                setCurrentView('dashboard');
                setSelectedLahan(null);
              }}
              className="flex-1 py-3.5 px-4 rounded-xl border border-border-medium hover:bg-border-light text-text-muted font-bold text-sm transition-all text-center"
            >
              Kembali
            </button>

            <button 
              onClick={() => {
                // Initialize default values for the harvest form
                const cropData = TANAMAN_DATABASE.find(t => t.nama === selectedLahan?.varietasDitanam);
                const hargaDef = cropData?.hargaPasar ? (cropData.hargaPasar.min + cropData.hargaPasar.max) / 2 : 7000;
                
                if (selectedLahan) {
                  const potensiAvg = cropData?.potensiHasil ? (cropData.potensiHasil.min + cropData.potensiHasil.max) / 2 : 0.75;
                  setBeratPanen(Math.round(selectedLahan.luas * potensiAvg)); // Default sukses (100%)
                }
                
                setHargaJual(hargaDef);
                setStatusHasil('sukses');
                setCurrentView('panen');
              }}
              className="flex-1 py-3.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-text-main font-bold text-sm transition-all text-center shadow-lg shadow-orange-600/20"
            >
              Panen Lahan Sekarang
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ==========================================================================
  // VIEW: HARVEST RECORDING
  // ==========================================================================
  if (currentView === 'panen' && selectedLahan) {
    const cropData = TANAMAN_DATABASE.find(t => t.nama === selectedLahan.varietasDitanam);
    const hargaDefault = cropData?.hargaPasar ? (cropData.hargaPasar.min + cropData.hargaPasar.max) / 2 : 7000;
    
    // Default values are now set in the onClick handler when entering this view.

    return (
      <div className="min-h-screen bg-bg-dark flex flex-col justify-center items-center px-4 py-8">
        <div className="w-full max-w-md bg-bg-card border border-border-medium rounded-3xl p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar">
          <h2 className="text-xl font-bold text-text-main mb-2">Catat Hasil Panen</h2>
          <p className="text-sm text-text-muted mb-6">
            Masukkan total kuantitas panen dari lahan <strong className="text-text-main">{selectedLahan.nama}</strong> untuk komoditas <strong className="text-text-main">{selectedLahan.varietasDitanam}</strong>.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Berat Bersih Hasil Panen (Kg)</label>
              <input 
                type="number" 
                value={beratPanen}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') setBeratPanen('');
                  else setBeratPanen(Math.max(0, parseInt(val) || 0));
                }}
                className="w-full bg-bg-dark border border-border-medium rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary transition-all text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Kualitas Panen</label>
              <select 
                value={statusHasil}
                onChange={(e) => {
                  const newStatus = e.target.value as RiwayatPanen['statusHasil'];
                  setStatusHasil(newStatus);
                  
                  // Auto recalculate berat panen based on status (Smart feature)
                  const cropData = TANAMAN_DATABASE.find(t => t.nama === selectedLahan.varietasDitanam);
                  const potensiAvg = cropData?.potensiHasil ? (cropData.potensiHasil.min + cropData.potensiHasil.max) / 2 : 0.75;
                  
                  let multiplier = 1;
                  if (newStatus === 'sebagian') multiplier = 0.5; // 50% yield
                  if (newStatus === 'gagal') multiplier = 0.1; // 10% yield
                  
                  setBeratPanen(Math.round(selectedLahan.luas * potensiAvg * multiplier));
                }}
                className="w-full bg-bg-dark border border-border-medium rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary transition-all text-sm"
              >
                <option value="sukses">Sukses (Panen Melimpah & Bagus)</option>
                <option value="sebagian">Sebagian (Ada Kerusakan Hama/Cuaca)</option>
                <option value="gagal">Gagal Panen (Total Gagal)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Harga Jual Aktual per Kg (Rp)</label>
              <input 
                type="number" 
                value={hargaJual}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') setHargaJual('');
                  else setHargaJual(Math.max(0, parseInt(val) || 0));
                }}
                className="w-full bg-bg-dark border border-border-medium rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary transition-all text-sm font-bold"
              />
              {cropData?.hargaPasar && (
                <p className="text-[10px] text-text-muted mt-1.5">
                  Info rentang harga pasar: Rp {cropData.hargaPasar.min.toLocaleString('id-ID')} - Rp {cropData.hargaPasar.max.toLocaleString('id-ID')} / kg
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button 
                onClick={() => setCurrentView('monitoring')}
                className="flex-1 py-3 px-4 rounded-xl border border-border-medium hover:bg-border-light text-text-muted font-semibold text-sm transition-all"
              >
                Batal
              </button>
              <button 
                onClick={() => handleSimpanPanen(beratPanen, statusHasil, hargaJual)}
                className="flex-1 py-3 px-4 rounded-xl bg-primary hover:bg-emerald-600 text-text-main font-bold text-sm transition-all shadow-lg shadow-primary/20"
              >
                Simpan Riwayat
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // VIEW: PROFILE & SETTINGS
  // ==========================================================================
  if (currentView === 'profile') {
    return (
      <div className="min-h-screen bg-bg-dark flex flex-col justify-center items-center px-4 py-8">
        <div className="w-full max-w-md bg-bg-card border border-border-light rounded-3xl p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="w-6 h-6 text-primary-light" />
            <h2 className="text-xl font-bold text-text-main">Pengaturan Profil</h2>
          </div>
          
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Nama Lengkap</label>
              <input 
                type="text" 
                value={petaniName}
                onChange={(e) => setPetaniName(e.target.value)}
                required
                className="w-full bg-bg-dark border border-border-medium rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary transition-all text-sm font-bold"
              />
            </div>
            
            <div className="flex gap-3 pt-6">
              <button 
                type="button"
                onClick={() => setCurrentView('dashboard')}
                className="flex-1 py-3 px-4 rounded-xl border border-border-medium hover:bg-border-light text-text-muted font-semibold text-sm transition-all"
              >
                Batal
              </button>
              <button 
                type="submit"
                disabled={dataLoading}
                className="flex-1 py-3 px-4 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-sm transition-all shadow-lg shadow-primary/20"
              >
                {dataLoading ? 'Menyimpan...' : 'Simpan Profil'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // VIEW: MAIN DASHBOARD
  // ==========================================================================
  return (
    <div className="min-h-screen bg-[#050505] flex flex-col relative overflow-hidden">
      {/* GeoSpatial Background Grid */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00a85908_1px,transparent_1px),linear-gradient(to_bottom,#00a85908_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_0%,#000_40%,transparent_100%)]"></div>
      </div>
      
      {/* Navbar (Oval Floating - Premium Dark Glass) */}
      <div className="fixed top-4 left-4 right-4 z-50 flex justify-center">
        <header className="w-full max-w-6xl bg-white/5 backdrop-blur-xl rounded-full shadow-2xl border border-white/10 px-4 md:px-6 py-2 flex items-center justify-between h-16 transition-all duration-300">
          <div className="flex items-center gap-2 md:gap-3 pl-1 md:pl-2">
            <img src="/assets/logo.webp" alt="EcoTani" className="h-8 w-8 drop-shadow-[0_0_8px_rgba(0,168,89,0.5)]" />
            <span className="font-extrabold text-lg text-white tracking-tight">EcoTani</span>
          </div>

          <div className="flex items-center gap-4 text-gray-300 text-sm font-semibold">
            <div className="hidden sm:flex items-center gap-1 bg-white/10 rounded-full px-3 py-1 text-xs border border-white/5">
              <User className="w-3.5 h-3.5 text-primary-light" />
              <span>{petaniName}</span>
            </div>
            
            <button 
              onClick={() => setCurrentView('profile')}
              className="p-1.5 text-gray-400 hover:text-primary-light transition-colors bg-white/5 hover:bg-white/10 border border-white/5 rounded-full"
              title="Pengaturan Profil"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button 
              onClick={handleLogout}
              className="flex items-center gap-1 text-red-400 hover:text-red-300 font-semibold text-xs border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-full transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>
      </div>

      {/* Main Dashboard Content */}
      <main className="flex-grow pt-24 pb-12 max-w-6xl w-full mx-auto px-4 relative z-10">
        
        {/* Summary Stats grid (Premium Glassmorphism) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-3 md:p-5 rounded-xl md:rounded-2xl flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 hover:bg-white/10 transition-colors shadow-lg shadow-black/20">
            <div className="p-2 md:p-3 bg-emerald-500/10 text-emerald-400 rounded-lg md:rounded-xl border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              <Map className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <span className="text-[10px] md:text-xs text-gray-400 block mb-0.5 leading-tight">Jumlah Lahan</span>
              <strong className="text-sm md:text-xl text-white block truncate">{lahans.length} Bidang</strong>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-3 md:p-5 rounded-xl md:rounded-2xl flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 hover:bg-white/10 transition-colors shadow-lg shadow-black/20">
            <div className="p-2 md:p-3 bg-blue-500/10 text-blue-400 rounded-lg md:rounded-xl border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
              <Activity className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <span className="text-[10px] md:text-xs text-gray-400 block mb-0.5 leading-tight">Total Luas</span>
              <strong className="text-sm md:text-xl text-white block truncate">
                {lahans.reduce((sum, l) => sum + l.luas, 0).toLocaleString('id-ID')} m²
              </strong>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-3 md:p-5 rounded-xl md:rounded-2xl flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 hover:bg-white/10 transition-colors shadow-lg shadow-black/20">
            <div className="p-2 md:p-3 bg-amber-500/10 text-amber-400 rounded-lg md:rounded-xl border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
              <TrendingUp className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <span className="text-[10px] md:text-xs text-gray-400 block mb-0.5 leading-tight">Panen Sukses</span>
              <strong className="text-sm md:text-xl text-white block truncate">
                {panens.filter(p => p.statusHasil === 'sukses').length} Kali
              </strong>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-3 md:p-5 rounded-xl md:rounded-2xl flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 hover:bg-white/10 transition-colors shadow-lg shadow-black/20">
            <div className="p-2 md:p-3 bg-red-500/10 text-red-400 rounded-lg md:rounded-xl border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.15)] animate-pulse">
              <AlertTriangle className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <span className="text-[10px] md:text-xs text-gray-400 block mb-0.5 leading-tight">Peringatan</span>
              <strong className="text-sm md:text-xl text-white block truncate">{activeAlerts.length} Bahaya</strong>
            </div>
          </div>
        </div>

        {/* ALERTS SECTION (CUACA BURUK) */}
        {activeAlerts.length > 0 && (
          <div className="bg-red-600/15 border border-red-500/20 rounded-2xl p-5 mb-8 flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-text-main text-sm">Peringatan Dini Cuaca Ekstrem Terdeteksi</h3>
              <p className="text-xs text-text-muted leading-relaxed mt-1">
                Kami mendeteksi <strong>{activeAlerts.length} Lahan Anda</strong> berada di dataran tinggi dengan curah hujan melebihi batas toleransi. Silakan klik tombol "Pantau Lahan" di lahan yang bersangkutan untuk mendapatkan rincian panduan mitigasi bencana pertanian.
              </p>
            </div>
          </div>
        )}

        {/* TABS (Lahan Sawah vs Riwayat Panen) */}
        <div className="border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between mb-6 pb-2 gap-4">
          <div className="flex gap-6 overflow-x-auto no-scrollbar w-full md:w-auto pb-2 md:pb-0">
            <button 
              onClick={() => setActiveTab('lahan')}
              className={`py-2 px-1 text-sm font-bold relative transition-all whitespace-nowrap ${
                activeTab === 'lahan' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="flex items-center gap-2"><Map className="w-4 h-4"/> Daftar Lahan Sawah</span>
              {activeTab === 'lahan' && <span className="absolute -bottom-2.5 left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>}
            </button>
            <button 
              onClick={() => setActiveTab('kalender')}
              className={`py-2 px-1 text-sm font-bold relative transition-all whitespace-nowrap ${
                activeTab === 'kalender' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="flex items-center gap-2"><Calendar className="w-4 h-4"/> Kalender & Cuaca</span>
              {activeTab === 'kalender' && <span className="absolute -bottom-2.5 left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>}
            </button>
            <button 
              onClick={() => setActiveTab('panen')}
              className={`py-2 px-1 text-sm font-bold relative transition-all whitespace-nowrap ${
                activeTab === 'panen' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="flex items-center gap-2"><FileSpreadsheet className="w-4 h-4"/> Riwayat Panen</span>
              {activeTab === 'panen' && <span className="absolute -bottom-2.5 left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>}
            </button>
          </div>

          {activeTab === 'lahan' && (
            <button 
              onClick={() => setCurrentView('add-lahan')}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold py-3 md:py-2 px-5 rounded-xl md:rounded-full text-xs transition-all flex justify-center items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.1)] w-full md:w-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Lahan</span>
            </button>
          )}
        </div>

        {/* TAB CONTENT */}
        <AnimatePresence mode="wait">
          {activeTab === 'lahan' && (
            <motion.div 
              key="lahan"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <EarlyWarning lahans={lahans} />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lahans.map((lahan) => {
              const isExtreme = lahan.ketinggian > 800 && lahan.curahHujan > 250;
              return (
                <div 
                  key={lahan.id}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-emerald-500/30 hover:bg-white/10 hover:shadow-[0_0_25px_rgba(16,185,129,0.1)] transition-all duration-300 flex flex-col justify-between group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-emerald-500/10 transition-colors"></div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-white font-bold text-base leading-tight group-hover:text-emerald-300 transition-colors">{lahan.nama}</h3>
                        <span className="text-xs text-gray-400 mt-1 block">Luas: {lahan.luas.toLocaleString('id-ID')} m²</span>
                      </div>
                      
                      {lahan.status === 'kosong' ? (
                        <div className="flex gap-2 items-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold uppercase tracking-wider">Kosong</span>
                          <button 
                            onClick={() => {
                              setSelectedLahan(lahan);
                              setCurrentView('edit-lahan');
                            }}
                            className="p-1.5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
                            title="Edit Lahan"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteLahan(lahan.id)}
                            className="p-1.5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                            title="Hapus Lahan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : lahan.status === 'sedang-ditanam' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider">Ditanami</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase tracking-wider">Siap Panen</span>
                      )}
                    </div>

                    {/* Sensor parameters */}
                    <div className="grid grid-cols-2 gap-2 bg-bg-dark/50 border border-border-light rounded-xl p-3 text-xs mb-4">
                      <div>
                        <span className="text-text-muted block mb-0.5">Ketinggian Lahan</span>
                        <strong className="text-text-main">{lahan.ketinggian} mdpl</strong>
                      </div>
                      <div>
                        <span className="text-text-muted block mb-0.5">Suhu Tanah/Udara</span>
                        <strong className="text-text-main">{lahan.suhu} °C</strong>
                      </div>
                      <div className="mt-1">
                        <span className="text-text-muted block mb-0.5">Curah Hujan</span>
                        <strong className="text-text-main">{lahan.curahHujan} mm/bln</strong>
                      </div>
                      <div className="mt-1">
                        <span className="text-text-muted block mb-0.5">Jenis Tanah</span>
                        <strong className="text-text-main">{lahan.jenisTanah}</strong>
                      </div>
                      <div className="mt-1">
                        <span className="text-text-muted block mb-0.5">pH Tanah</span>
                        <strong className="text-text-main">{lahan.pH || 'Tidak disetel'}</strong>
                      </div>
                      <div className="mt-1">
                        <span className="text-text-muted block mb-0.5">Kemiringan Lereng</span>
                        <strong className="text-text-main">{lahan.slope || 'Tidak disetel'}</strong>
                      </div>
                    </div>

                    {/* Plant Status detail */}
                    {lahan.status !== 'kosong' && (
                      <div className="border-t border-border-light pt-3 mb-4 text-xs space-y-2">
                        <div className="flex justify-between">
                          <span className="text-text-muted">Tanaman:</span>
                          <strong className="text-text-main">{lahan.varietasDitanam}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Estimasi Panen:</span>
                          <strong className="text-orange-400">{lahan.estimasiPanenDate}</strong>
                        </div>
                        {isExtreme && (
                          <div className="bg-red-500/15 border border-red-500/30 text-red-400 p-2 rounded-lg flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            <span>Terdeteksi Anomali Cuaca Dingin & Lembab</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions by Status */}
                  <div className="mt-5 pt-4 border-t border-white/10 flex gap-2 relative z-10">
                    {lahan.status === 'kosong' ? (
                      <button 
                        onClick={() => {
                          setSelectedLahan(lahan);
                          setCurrentView('suitability');
                        }}
                        className="flex-1 text-xs font-bold py-2.5 rounded-xl border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors text-center"
                      >
                        Cek Kelayakan
                      </button>
                    ) : (
                      <>
                        <button 
                          onClick={() => {
                            setSelectedLahan(lahan);
                            setCurrentView('monitoring');
                          }}
                          className="flex-1 text-xs font-bold py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors text-center flex items-center justify-center gap-1"
                        >
                          <Activity className="w-3.5 h-3.5" />
                          <span>Pantau Lahan</span>
                        </button>
                        
                        {lahan.status === 'sedang-ditanam' && (
                          <button 
                            onClick={() => handleUpdateStatusTanam(lahan.id, 'siap-panen')}
                            className="px-3 bg-amber-500 hover:bg-amber-600 text-text-main font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center"
                            title="Tandai Siap Panen"
                          >
                            Siap Panen
                          </button>
                        )}
                      </>
                    )}
                  </div>

                </div>
              );
            })}

            {lahans.length === 0 && (
              <div className="col-span-full bg-bg-card border border-border-light rounded-2xl p-12 text-center">
                <Map className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-text-main font-bold text-lg mb-1">Belum Ada Lahan</h3>
                <p className="text-xs text-text-muted max-w-sm mx-auto mb-6">
                  Tandai wilayah persawahan Anda sekarang untuk mendeteksi data geospasial serta memantau kesehatan tanaman secara berkala.
                </p>
                <button 
                  onClick={() => setCurrentView('add-lahan')}
                  className="bg-primary hover:bg-emerald-600 text-text-main font-bold py-2.5 px-6 rounded-full text-xs transition-all inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Gambar Lahan Pertama</span>
                </button>
              </div>
            )}
            </div>
            </motion.div>
          )}

        {/* TAB CONTENT: HARVEST HISTORY */}
        {activeTab === 'panen' && (
          <motion.div 
            key="panen"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Chart Area */}
            {panens.length > 0 && (
              <div className="bg-bg-card border border-border-light rounded-2xl p-6 h-72">
                <h3 className="text-text-main font-bold mb-4 text-sm">Grafik Pendapatan Panen</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[...panens].reverse()} margin={{ top: 10, right: 10, left: 15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPendapatan" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis 
                      dataKey="tanggalPanen" 
                      stroke="#666" 
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => {
                        const d = new Date(val);
                        return `${d.getDate()}/${d.getMonth()+1}`;
                      }}
                    />
                    <YAxis 
                      stroke="#666" 
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => {
                        if (val >= 1000000) return `Rp ${(val/1000000).toFixed(1)} Jt`;
                        if (val >= 1000) return `Rp ${(val/1000).toFixed(0)} Rb`;
                        return `Rp ${val}`;
                      }}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#141414', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                      itemStyle={{ color: '#22c55e', fontWeight: 'bold' }}
                      formatter={(value: any) => [`Rp ${Number(value || 0).toLocaleString('id-ID')}`, 'Pendapatan']}
                      labelFormatter={(label) => `Tanggal: ${label}`}
                    />
                    <Area type="monotone" dataKey="pendapatanEstimasi" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorPendapatan)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="bg-bg-card border border-border-light rounded-2xl p-4 md:p-6 overflow-x-auto no-scrollbar">
              {panens.length > 0 ? (
                <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-border-medium text-text-muted">
                    <th className="pb-3 font-semibold uppercase tracking-wider">Lahan</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider">Komoditas</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider">Tanggal</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider">Kualitas</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider">Berat Bersih</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider text-right">Estimasi Nilai</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {panens.map((p) => (
                    <tr key={p.id} className="text-text-main hover:bg-white/[0.01] transition-colors">
                      <td className="py-4.5 font-medium">{p.namaLahan}</td>
                      <td className="py-4.5">{p.varietas}</td>
                      <td className="py-4.5 text-text-muted">{p.tanggalPanen}</td>
                      <td className="py-4.5">
                        {p.statusHasil === 'sukses' ? (
                          <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold uppercase text-[9px]">Melimpah</span>
                        ) : p.statusHasil === 'sebagian' ? (
                          <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded font-bold uppercase text-[9px]">Sebagian</span>
                        ) : (
                          <span className="bg-red-500/10 text-red-400 px-2 py-0.5 rounded font-bold uppercase text-[9px]">Gagal</span>
                        )}
                      </td>
                      <td className="py-4.5 font-semibold">{p.beratPanen.toLocaleString('id-ID')} Kg</td>
                      <td className="py-4.5 text-right font-extrabold text-primary-light">
                        Rp {p.pendapatanEstimasi.toLocaleString('id-ID')}
                      </td>
                      <td className="py-4.5 text-right">
                        <button
                          onClick={() => handleDeleteRiwayat(p.id)}
                          className="p-1.5 hover:bg-red-500/20 text-text-muted hover:text-red-400 rounded-lg transition-colors"
                          title="Hapus Riwayat Panen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <FileSpreadsheet className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-text-main font-bold text-lg mb-1">Riwayat Panen Kosong</h3>
                <p className="text-xs text-text-muted max-w-sm mx-auto">
                  Belum ada catatan panen yang direkam. Setelah tanaman pada lahan memasuki masa panen, silakan rekam hasil panen Anda di dashboard.
                </p>
              </div>
            )}
          </div>
          </motion.div>
        )}

        {/* TAB CONTENT: KALENDER & CUACA */}
        {activeTab === 'kalender' && (
          <motion.div 
            key="kalender"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <KalenderTanam savedLahans={lahans} />
          </motion.div>
        )}
        </AnimatePresence>

      </main>

      <footer className="border-t border-white/10 py-6 bg-black/40 text-center text-xs text-text-muted">
        <p>&copy; 2026 EcoTani. Hak Cipta Dilindungi Undang-Undang.</p>
        <p className="mt-1">
          Developed by Tim EcoTani Indonesia <br className="md:hidden" />
          <span className="hidden md:inline"> - </span>Telkom University Purwokerto <span className="text-emerald-500 font-bold mx-1">X</span> Universitas Jendral Soedirman
        </p>
      </footer>

    </div>
  );
}



