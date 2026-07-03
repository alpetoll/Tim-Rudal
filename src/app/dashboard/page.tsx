'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Lahan, RiwayatPanen } from '@/types';
import { cekKelayakan, cariAlternatif, TANAMAN_DATABASE } from '@/utils/suitability';
import { supabase } from '@/utils/supabaseClient';
import { 
  getLahans, 
  insertLahan, 
  startTanamLahan, 
  updateLahanStatus, 
  getRiwayatPanens, 
  insertRiwayatPanen 
} from '@/utils/supabaseQueries';
import { 
  Sprout, 
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
  Mail
} from 'lucide-react';

// Dynamically import Map component (disable SSR for Leaflet window access)
const PetaLahan = dynamic(() => import('@/components/PetaLahan'), { ssr: false });
import KalenderTanam from '@/components/KalenderTanam';
import EarlyWarning from '@/components/EarlyWarning';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function DashboardPage() {
  // --- AUTH STATES ---
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');

  // --- PROFILE & BUSINESS STATES ---
  const [petaniName, setPetaniName] = useState<string>('');
  const [petaniKomoditas, setPetaniKomoditas] = useState<string>('');
  const [needProfileSetup, setNeedProfileSetup] = useState<boolean>(false);
  const [lahans, setLahans] = useState<Lahan[]>([]);
  const [panens, setPanens] = useState<RiwayatPanen[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  
  // Navigation / View state
  // 'dashboard' | 'add-lahan' | 'suitability' | 'monitoring' | 'panen'
  const [currentView, setCurrentView] = useState<'dashboard' | 'add-lahan' | 'suitability' | 'monitoring' | 'panen'>('dashboard');
  
  // Selected entities for drill-down
  const [selectedLahan, setSelectedLahan] = useState<Lahan | null>(null);
  const [selectedCropId, setSelectedCropId] = useState<string>('padi');
  const [activeTab, setActiveTab] = useState<'lahan' | 'panen' | 'kalender'>('lahan');
  const [liveWeather, setLiveWeather] = useState<{suhu: number, curahHujan: number} | null>(null);

  // Fetch live weather for suitability check
  useEffect(() => {
    if (currentView === 'suitability' && selectedLahan) {
      const [lat, lng] = selectedLahan.centroid;
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_mean,precipitation_sum&timezone=Asia%2FJakarta&forecast_days=14`)
        .then(res => res.json())
        .then(data => {
            if (data.daily) {
              const avgTemp = data.daily.temperature_2m_mean.reduce((a:number, b:number) => a+b, 0) / 14;
              const totalRain = data.daily.precipitation_sum.reduce((a:number, b:number) => a+b, 0); // 14 days rain
              setLiveWeather({ suhu: Math.round(avgTemp * 10) / 10, curahHujan: Math.round(totalRain * (30/14)) }); // Project to monthly
            }
        })
        .catch(console.error);
    } else {
      setLiveWeather(null);
    }
  }, [currentView, selectedLahan]);

  // ==========================================
  // AUTHENTICATION & INITIALIZATION FLOW
  // ==========================================
  
  // Monitor auth state changes
  useEffect(() => {
    // 1. Get current session
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error) {
        console.error('Auth getUser error:', error);
      }
      setUser(user);
      if (user) {
        checkPetaniProfile(user.id);
      } else {
        setAuthLoading(false);
      }
    }).catch((err) => {
      console.error('Network or unexpected error during getUser:', err);
      setAuthLoading(false);
      setAuthError('Gagal terhubung ke server autentikasi. Periksa koneksi internet Anda.');
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) {
        checkPetaniProfile(currentUser.id);
      } else {
        setAuthLoading(false);
        setLahans([]);
        setPanens([]);
        setPetaniName('');
        setPetaniKomoditas('');
        setNeedProfileSetup(false);
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
        setPetaniKomoditas(data.komoditas_utama || '');
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

  // --- AUTH HANDLERS ---
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (isRegisterMode) {
        // Sign Up
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
        });
        if (error) throw error;
        alert('Pendaftaran berhasil! Silakan periksa email Anda untuk verifikasi atau langsung login jika konfirmasi otomatis aktif.');
        setAuthLoading(false);
      } else {
        // Login
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        });
        if (error) throw error;
        
        if (!data.session) {
          setAuthError('Email belum dikonfirmasi. Silakan periksa inbox email Anda untuk memverifikasi akun.');
          setAuthLoading(false);
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Terjadi kesalahan autentikasi.');
      setAuthLoading(false);
    }
  };

  // Create profile for new user
  const handleProfileSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petaniName.trim() || !user) return;

    setAuthLoading(true);
    try {
      const { error } = await supabase
        .from('petani')
        .insert([
          {
            id: user.id,
            nama: petaniName,
            komoditas_utama: petaniKomoditas
          }
        ]);

      if (error) throw error;
      
      setNeedProfileSetup(false);
      await loadDashboardData(user.id);
    } catch (err: any) {
      alert('Gagal membuat profil: ' + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('Apakah Anda ingin keluar dari akun EkoTani?')) {
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
      alert('Lahan sawah berhasil disimpan ke cloud database Supabase!');
    } else {
      alert('Gagal menyimpan lahan. Silakan coba kembali.');
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
      alert(`Status penanaman ${tanaman.nama} berhasil diaktifkan.`);
    } else {
      alert('Gagal mengaktifkan penanaman.');
    }
    setDataLoading(false);
  };

  const handleSimpanPanen = async (berat: number, statusHasil: RiwayatPanen['statusHasil'], hargaJualActual: number) => {
    if (!selectedLahan || !selectedLahan.varietasDitanam || !user) return;

    const pendapatanEstimasi = berat * hargaJualActual;

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
      alert('Hasil panen berhasil tersimpan di Supabase! Lahan Anda telah di-reset ke status kosong.');
    } else {
      alert('Gagal mencatat hasil panen.');
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
      alert('Gagal mengubah status lahan.');
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
        <p className="text-xs text-gray-500 uppercase tracking-widest">Menghubungkan ke Supabase...</p>
      </div>
    );
  }

  // ==========================================================================
  // VIEW: AUTHENTICATION FORM (LOGIN / REGISTER)
  // ==========================================================================
  if (!user) {
    return (
      <div className="min-h-screen bg-bg-dark flex flex-col justify-center items-center px-4 relative overflow-hidden bg-[radial-gradient(circle_at_center,rgba(0,168,89,0.06),transparent_50%)]">
        <div className="w-full max-w-md bg-bg-card border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10">
          
          <div className="flex items-center gap-3 justify-center mb-6">
            <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
              <Sprout className="h-6 w-6 text-primary" />
            </div>
            <span className="text-2xl font-extrabold tracking-tight text-white">EcoTani</span>
          </div>

          <h2 className="text-xl font-bold text-center text-white mb-1">
            {isRegisterMode ? 'Buat Akun Petani' : 'Masuk ke Platform'}
          </h2>
          <p className="text-sm text-gray-400 text-center mb-6">
            {isRegisterMode ? 'Mulai mengelola mitigasi pertanian dengan cloud database.' : 'Akses pemetaan geospatial sawah Anda.'}
          </p>

          {authError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3.5 rounded-xl text-xs font-semibold mb-4 leading-relaxed">
              ⚠️ {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Alamat Email</label>
              <div className="relative">
                <Mail className="w-4.5 h-4.5 text-gray-500 absolute left-4 top-3.5" />
                <input 
                  type="email" 
                  required
                  placeholder="nama@email.com" 
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full bg-bg-dark border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:outline-none focus:border-primary transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Kata Sandi</label>
              <div className="relative">
                <Lock className="w-4.5 h-4.5 text-gray-500 absolute left-4 top-3.5" />
                <input 
                  type="password" 
                  required
                  placeholder="Min. 6 Karakter" 
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full bg-bg-dark border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:outline-none focus:border-primary transition-all text-sm"
                />
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-primary hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/20 mt-6 flex items-center justify-center gap-2"
            >
              <span>{isRegisterMode ? 'Daftar Sekarang' : 'Masuk Dashboard'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="border-t border-white/5 mt-6 pt-4 text-center">
            <button
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setAuthError('');
              }}
              className="text-xs text-primary-light hover:underline font-semibold"
            >
              {isRegisterMode ? 'Sudah punya akun? Masuk di sini' : 'Belum punya akun? Daftar gratis'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // VIEW: PROFILE SETUP (PRD Flowchart: Tanya Profil Petani Baru)
  // ==========================================================================
  if (needProfileSetup) {
    return (
      <div className="min-h-screen bg-bg-dark flex flex-col justify-center items-center px-4 relative overflow-hidden bg-[radial-gradient(circle_at_center,rgba(0,168,89,0.06),transparent_50%)]">
        <div className="w-full max-w-md bg-bg-card border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10">
          <h2 className="text-xl font-bold text-center text-white mb-2">Lengkapi Profil Petani</h2>
          <p className="text-sm text-gray-400 text-center mb-6">Silakan lengkapi profil pertanian Anda untuk menginisialisasi dashboard geospatial.</p>

          <form onSubmit={handleProfileSetupSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nama Lengkap Petani</label>
              <input 
                type="text" 
                required
                placeholder="Contoh: Pak Tani Sugeng" 
                value={petaniName}
                onChange={(e) => setPetaniName(e.target.value)}
                className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Komoditas Utama</label>
              <input 
                type="text" 
                placeholder="Contoh: Padi, Jagung, Bawang" 
                value={petaniKomoditas}
                onChange={(e) => setPetaniKomoditas(e.target.value)}
                className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all text-sm"
              />
            </div>

            <button 
              type="submit"
              className="w-full bg-primary hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/20 mt-4 flex items-center justify-center gap-2"
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
        <header className="border-b border-white/5 py-4 px-6 bg-bg-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setCurrentView('dashboard')}
              className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-white">Tandai Batas Wilayah Lahan Sawah</h1>
          </div>
          <span className="text-xs text-gray-400">Teknologi Geospatial EcoTani</span>
        </header>

        <main className="flex-grow p-4 md:p-6 overflow-hidden">
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
  // VIEW: CROP CHECK & SUITABILITY ASSESSMENT
  // ==========================================================================
  if (currentView === 'suitability' && selectedLahan) {
    const lahanToEvaluate = liveWeather ? { ...selectedLahan, suhu: liveWeather.suhu, curahHujan: liveWeather.curahHujan } : selectedLahan;
    const evalResult = cekKelayakan(lahanToEvaluate, selectedCropId);
    const alternatifList = cariAlternatif(lahanToEvaluate);

    return (
      <div className="min-h-screen bg-bg-dark py-8 px-4">
        <div className="max-w-3xl mx-auto bg-bg-card border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
          <button 
            onClick={() => {
              setCurrentView('dashboard');
              setSelectedLahan(null);
            }}
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Dashboard</span>
          </button>

          <h2 className="text-2xl font-bold text-white mb-1">Cek Kelayakan Lahan Tanam</h2>
          <p className="text-sm text-gray-400 mb-6">
            Menilai kesesuaian lahan <strong className="text-white">{selectedLahan.nama}</strong> berdasarkan parameter geospasial tanah dan iklim.
            {liveWeather && <span className="block mt-1 text-primary-light flex items-center gap-1"><CloudRain className="w-3.5 h-3.5" /> Terhubung dengan data cuaca live ({liveWeather.suhu}°C, {liveWeather.curahHujan} mm/bln)</span>}
          </p>

          {/* Pilihan Jenis Tanaman */}
          <div className="mb-8 bg-bg-dark border border-white/10 rounded-2xl p-5">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pilih Komoditas Tanaman</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {TANAMAN_DATABASE.map(crop => (
                <button
                  key={crop.id}
                  onClick={() => setSelectedCropId(crop.id)}
                  className={`py-3 px-2 rounded-xl border text-center transition-all ${
                    selectedCropId === crop.id
                      ? 'border-primary bg-primary/10 text-primary-light font-bold'
                      : 'border-white/10 hover:bg-white/5 text-gray-400'
                  }`}
                >
                  <span className="block text-sm">{crop.nama}</span>
                </button>
              ))}
            </div>
          </div>

          {/* HASIL ANALISIS KELAYAKAN */}
          <div className="space-y-6">
            <div className="flex items-start gap-4 p-5 rounded-2xl border bg-bg-dark border-white/5">
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
                  <h3 className="font-bold text-lg text-white">
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
                    <ul className="list-disc pl-5 text-sm text-gray-400 space-y-1">
                      {evalResult.kendala.map((k, i) => <li key={`k-${i}`}>{k}</li>)}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Selamat! Parameter lingkungan (suhu, curah hujan, ketinggian, dan tipe tanah) terdeteksi sangat cocok dengan kebutuhan varietas tanaman ini.</p>
                )}
              </div>
            </div>

            {/* Jika LAYAK: Tampilkan Kalender Kerja / Estimasi */}
            {evalResult.layak && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-bg-dark border border-white/5 space-y-4">
                  <h4 className="font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2">
                    <Calendar className="w-4.5 h-4.5 text-primary-light" />
                    <span>Rencana Perawatan</span>
                  </h4>
                  <ul className="text-xs text-gray-400 space-y-3">
                    {evalResult.siklusPemupukan.map((step, i) => (
                      <li key={`s-${i}`} className="flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5"></span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-5 rounded-2xl bg-bg-dark border border-white/5 space-y-3">
                  <h4 className="font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2">
                    <Droplet className="w-4.5 h-4.5 text-primary-light" />
                    <span>Kebutuhan Sumber Daya</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-gray-500 block mb-0.5">Estimasi Air</span>
                      <strong className="text-white text-sm">{(evalResult.kebutuhanAirDaily * selectedLahan.luas).toLocaleString('id-ID')} Liter/Hari</strong>
                      <span className="text-gray-600 block mt-0.5">({evalResult.kebutuhanAirDaily}L / m²)</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block mb-0.5">Siklus Panen</span>
                      <strong className="text-white text-sm">{TANAMAN_DATABASE.find(t => t.id === selectedCropId)?.siklusTanamDays} Hari</strong>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed border-t border-white/5 pt-2 mt-2">
                    {evalResult.saranMitigasi}
                  </p>
                </div>
              </div>
            )}

            {/* OPSI MITIGASI / KEPUTUSAN JIKA TIDAK LAYAK */}
            {!evalResult.layak && (
              <div className="space-y-4 border-t border-white/5 pt-6">
                <div className="p-4 rounded-xl bg-orange-600/10 border border-orange-500/20 text-xs text-orange-400 leading-relaxed">
                  <strong>Analisis Mitigasi:</strong> Meskipun lahan kurang layak, Anda tetap dapat memaksakan penanaman dengan menerapkan langkah mitigasi khusus. Atau, cari komoditas alternatif yang lebih menguntungkan untuk wilayah ini.
                </div>

                <div className="p-5 rounded-2xl bg-bg-dark border border-white/5">
                  <h4 className="font-bold text-white mb-3 text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span>Rekomendasi Tanaman Alternatif Terdekat</span>
                  </h4>
                  <div className="space-y-2">
                    {alternatifList.filter(a => a.tanaman.id !== selectedCropId).slice(0, 2).map((alt) => (
                      <div key={alt.tanaman.id} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl text-xs">
                        <div>
                          <strong className="text-white text-sm block">{alt.tanaman.nama}</strong>
                          <span className="text-gray-500">Estimasi panen: {alt.tanaman.siklusTanamDays} hari</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-emerald-400 font-bold">Kecocokan: {alt.evaluasi.skor}%</span>
                          <button
                            onClick={() => setSelectedCropId(alt.tanaman.id)}
                            className="bg-white/10 hover:bg-white/20 text-white font-semibold py-1.5 px-3 rounded-lg"
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
            <div className="flex gap-4 border-t border-white/5 pt-6 mt-8">
              <button 
                onClick={() => {
                  setCurrentView('dashboard');
                  setSelectedLahan(null);
                }}
                className="flex-1 py-3.5 px-4 rounded-xl border border-white/10 hover:bg-white/5 text-gray-300 font-bold text-sm transition-all text-center"
              >
                Batalkan
              </button>

              <button 
                onClick={() => handleConfirmTanam(selectedCropId, evalResult.saranMitigasi)}
                className={`flex-1 py-3.5 px-4 rounded-xl font-bold text-sm transition-all text-center ${
                  evalResult.layak 
                    ? 'bg-primary hover:bg-emerald-600 text-white shadow-lg shadow-primary/20' 
                    : 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/20'
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
        <div className="max-w-3xl mx-auto bg-bg-card border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
          
          <button 
            onClick={() => {
              setCurrentView('dashboard');
              setSelectedLahan(null);
            }}
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Dashboard</span>
          </button>

          <div className="flex justify-between items-start mb-4 border-b border-white/5 pb-4">
            <div>
              <span className="text-xs bg-primary-dark/30 text-primary-light font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Sedang Ditanam</span>
              <h2 className="text-2xl font-bold text-white mt-2">{selectedLahan.nama}</h2>
              <p className="text-sm text-gray-400 mt-1">Varietas: <strong className="text-white">{selectedLahan.varietasDitanam}</strong></p>
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
            <div className="bg-bg-dark p-4 rounded-xl border border-white/5">
              <span className="text-gray-500 text-xs block mb-1">Status Sensor Kelembapan</span>
              <div className="flex items-center gap-2">
                <Droplet className="w-4.5 h-4.5 text-primary-light" />
                <strong className="text-white text-base">78% (Kelembapan Optimal)</strong>
              </div>
            </div>
            <div className="bg-bg-dark p-4 rounded-xl border border-white/5">
              <span className="text-gray-500 text-xs block mb-1">Cuaca Hari Ini</span>
              <div className="flex items-center gap-2">
                <CloudRain className="w-4.5 h-4.5 text-blue-400" />
                <strong className="text-white text-base">Hujan Ringan (24°C)</strong>
              </div>
            </div>
            <div className="bg-bg-dark p-4 rounded-xl border border-white/5">
              <span className="text-gray-500 text-xs block mb-1">Estimasi Tanggal Panen</span>
              <div className="flex items-center gap-2">
                <Calendar className="w-4.5 h-4.5 text-orange-400" />
                <strong className="text-white text-base">{selectedLahan.estimasiPanenDate}</strong>
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
              <p className="text-xs text-gray-300 leading-relaxed">
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
              <p className="text-xs text-gray-400 leading-relaxed">
                Kondisi curah hujan ({selectedLahan.curahHujan} mm/bln) dan suhu ({selectedLahan.suhu}°C) berada di dalam batas normal. Rekomendasi penyiraman harian: {(selectedLahan.kebutuhanAirDaily || 5) * selectedLahan.luas} liter dialirkan pada pagi hari.
              </p>
            </div>
          )}

          {/* CATATAN MITIGASI SAAT CHECK SUITABILITY */}
          {selectedLahan.catatanMitigasi && (
            <div className="bg-bg-dark border border-white/5 rounded-2xl p-5 mb-6">
              <h4 className="font-bold text-white mb-2 text-xs uppercase tracking-wider text-gray-400">Instruksi Budidaya & Mitigasi Tanam</h4>
              <p className="text-xs text-gray-400 whitespace-pre-line leading-relaxed">{selectedLahan.catatanMitigasi}</p>
            </div>
          )}

          {/* SIMULASI LAPORAN WARGA SEKITAR (CROWDSOURCED) */}
          <div className="bg-bg-dark border border-white/5 rounded-2xl p-5 mb-8">
            <h4 className="font-bold text-white mb-3 text-xs uppercase tracking-wider text-gray-400">Laporan Lahan Tetangga Terdekat</h4>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex justify-between">
                <div>
                  <strong className="text-white block">Pak Joko - Sawah Timur (200m)</strong>
                  <span className="text-gray-500">Mendeteksi kemunculan belalang sangit kecil di daun bawah.</span>
                </div>
                <span className="text-orange-400 font-semibold self-center">Waspada</span>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex justify-between">
                <div>
                  <strong className="text-white block">Bu Yanti - Sawah Kidul (500m)</strong>
                  <span className="text-gray-500">Saluran irigasi primer tersumbat sampah pohon tumbang kemarin sore.</span>
                </div>
                <span className="text-red-400 font-semibold self-center">Tersumbat</span>
              </div>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="flex gap-4 border-t border-white/5 pt-6">
            <button 
              onClick={() => {
                setCurrentView('dashboard');
                setSelectedLahan(null);
              }}
              className="flex-1 py-3.5 px-4 rounded-xl border border-white/10 hover:bg-white/5 text-gray-300 font-bold text-sm transition-all text-center"
            >
              Kembali
            </button>

            {/* Simpan Panen (Bisa dipanen kapan saja untuk testing flow, idealnya setelah siklus selesai) */}
            <button 
              onClick={() => setCurrentView('panen')}
              className="flex-1 py-3.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm transition-all text-center shadow-lg shadow-orange-600/20"
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
    
    const [beratPanen, setBeratPanen] = useState<number>(Math.round(selectedLahan.luas * 0.75)); // Default 0.75kg per m2
    const [statusHasil, setStatusHasil] = useState<RiwayatPanen['statusHasil']>('sukses');
    const [hargaJual, setHargaJual] = useState<number>(hargaDefault);

    return (
      <div className="min-h-screen bg-bg-dark flex flex-col justify-center items-center px-4">
        <div className="w-full max-w-md bg-bg-card border border-white/10 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-2">Catat Hasil Panen</h2>
          <p className="text-sm text-gray-400 mb-6">
            Masukkan total kuantitas panen dari lahan <strong className="text-white">{selectedLahan.nama}</strong> untuk komoditas <strong className="text-white">{selectedLahan.varietasDitanam}</strong>.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Berat Bersih Hasil Panen (Kg)</label>
              <input 
                type="number" 
                value={beratPanen}
                onChange={(e) => setBeratPanen(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Kualitas Panen</label>
              <select 
                value={statusHasil}
                onChange={(e) => setStatusHasil(e.target.value as RiwayatPanen['statusHasil'])}
                className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all text-sm"
              >
                <option value="sukses">Sukses (Panen Melimpah & Bagus)</option>
                <option value="sebagian">Sebagian (Ada Kerusakan Hama/Cuaca)</option>
                <option value="gagal">Gagal Panen (Total Gagal)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Harga Jual Aktual per Kg (Rp)</label>
              <input 
                type="number" 
                value={hargaJual}
                onChange={(e) => setHargaJual(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all text-sm font-bold"
              />
              {cropData?.hargaPasar && (
                <p className="text-[10px] text-gray-500 mt-1.5">
                  Info rentang harga pasar: Rp {cropData.hargaPasar.min.toLocaleString('id-ID')} - Rp {cropData.hargaPasar.max.toLocaleString('id-ID')} / kg
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button 
                onClick={() => setCurrentView('monitoring')}
                className="flex-1 py-3 px-4 rounded-xl border border-white/10 hover:bg-white/5 text-gray-300 font-semibold text-sm transition-all"
              >
                Batal
              </button>
              <button 
                onClick={() => handleSimpanPanen(beratPanen, statusHasil, hargaJual)}
                className="flex-1 py-3 px-4 rounded-xl bg-primary hover:bg-emerald-600 text-white font-bold text-sm transition-all shadow-lg shadow-primary/20"
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
  // VIEW: MAIN DASHBOARD
  // ==========================================================================
  return (
    <div className="min-h-screen bg-bg-dark flex flex-col">
      
      {/* Navbar (Oval Floating) */}
      <div className="fixed top-4 left-4 right-4 z-50 flex justify-center">
        <header className="w-full max-w-6xl bg-white/95 backdrop-blur-md rounded-full shadow-xl border border-black/5 px-6 py-2 flex items-center justify-between h-16 transition-all duration-300">
          <div className="flex items-center gap-3 pl-2">
            <img src="/assets/logo.svg" alt="EcoTani" className="h-8 w-8" />
            <span className="font-extrabold text-lg text-gray-900 tracking-tight">EcoTani</span>
          </div>

          <div className="flex items-center gap-4 text-gray-600 text-sm font-semibold">
            <div className="hidden sm:flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-xs">
              <User className="w-3.5 h-3.5 text-primary" />
              <span>{petaniName} {petaniKomoditas && `| ${petaniKomoditas}`}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-1 text-red-600 hover:text-red-700 font-semibold text-xs border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-full transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>
      </div>

      {/* Main Dashboard Content */}
      <main className="flex-grow pt-28 pb-12 max-w-6xl w-full mx-auto px-4">
        
        {/* Summary Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-bg-card border border-white/5 p-5 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary-light rounded-xl border border-primary/20">
              <Map className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-gray-500 block mb-0.5">Jumlah Lahan</span>
              <strong className="text-xl text-white block">{lahans.length} Bidang</strong>
            </div>
          </div>

          <div className="bg-bg-card border border-white/5 p-5 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary-light rounded-xl border border-primary/20">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-gray-500 block mb-0.5">Total Luas Lahan</span>
              <strong className="text-xl text-white block">
                {lahans.reduce((sum, l) => sum + l.luas, 0).toLocaleString('id-ID')} m²
              </strong>
            </div>
          </div>

          <div className="bg-bg-card border border-white/5 p-5 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary-light rounded-xl border border-primary/20">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-gray-500 block mb-0.5">Panen Sukses</span>
              <strong className="text-xl text-white block">
                {panens.filter(p => p.statusHasil === 'sukses').length} Kali
              </strong>
            </div>
          </div>

          <div className="bg-bg-card border border-white/5 p-5 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-gray-500 block mb-0.5">Peringatan Aktif</span>
              <strong className="text-xl text-white block">{activeAlerts.length} Bahaya</strong>
            </div>
          </div>
        </div>

        {/* ALERTS SECTION (CUACA BURUK) */}
        {activeAlerts.length > 0 && (
          <div className="bg-red-600/15 border border-red-500/20 rounded-2xl p-5 mb-8 flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-white text-sm">Peringatan Dini Cuaca Ekstrem Terdeteksi</h3>
              <p className="text-xs text-gray-400 leading-relaxed mt-1">
                Kami mendeteksi <strong>{activeAlerts.length} Lahan Anda</strong> berada di dataran tinggi dengan curah hujan melebihi batas toleransi. Silakan klik tombol "Pantau Lahan" di lahan yang bersangkutan untuk mendapatkan rincian panduan mitigasi bencana pertanian.
              </p>
            </div>
          </div>
        )}

        {/* TABS (Lahan Sawah vs Riwayat Panen) */}
        <div className="border-b border-white/10 flex items-center justify-between mb-6">
          <div className="flex gap-6 overflow-x-auto no-scrollbar pb-1">
            <button 
              onClick={() => setActiveTab('lahan')}
              className={`py-3 text-sm font-bold relative transition-all whitespace-nowrap ${
                activeTab === 'lahan' ? 'text-primary-light' : 'text-gray-400 hover:text-white'
              }`}
            >
              <span>Daftar Lahan Sawah</span>
              {activeTab === 'lahan' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-light"></span>}
            </button>
            <button 
              onClick={() => setActiveTab('kalender')}
              className={`py-3 text-sm font-bold relative transition-all whitespace-nowrap ${
                activeTab === 'kalender' ? 'text-primary-light' : 'text-gray-400 hover:text-white'
              }`}
            >
              <span>Kalender & Cuaca</span>
              {activeTab === 'kalender' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-light"></span>}
            </button>
            <button 
              onClick={() => setActiveTab('panen')}
              className={`py-3 text-sm font-bold relative transition-all whitespace-nowrap ${
                activeTab === 'panen' ? 'text-primary-light' : 'text-gray-400 hover:text-white'
              }`}
            >
              <span>Riwayat Hasil Panen</span>
              {activeTab === 'panen' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-light"></span>}
            </button>
          </div>

          {activeTab === 'lahan' && (
            <button 
              onClick={() => setCurrentView('add-lahan')}
              className="bg-primary hover:bg-emerald-600 text-white font-bold py-2 px-4 rounded-full text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-primary/10"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Lahan</span>
            </button>
          )}
        </div>

        {/* TAB CONTENT: LAHAN ACTIVE */}
          {activeTab === 'lahan' && (
            <>
              <EarlyWarning lahans={lahans} />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lahans.map((lahan) => {
              const isExtreme = lahan.ketinggian > 800 && lahan.curahHujan > 250;
              return (
                <div 
                  key={lahan.id}
                  className="bg-bg-card border border-white/5 rounded-2xl p-6 hover:border-primary/25 hover:shadow-2xl transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-white font-bold text-base leading-tight">{lahan.nama}</h3>
                        <span className="text-xs text-gray-500 mt-1 block">Luas: {lahan.luas.toLocaleString('id-ID')} m²</span>
                      </div>
                      
                      {lahan.status === 'kosong' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold uppercase tracking-wider">Kosong</span>
                      ) : lahan.status === 'sedang-ditanam' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider">Ditanami</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase tracking-wider">Siap Panen</span>
                      )}
                    </div>

                    {/* Sensor parameters */}
                    <div className="grid grid-cols-2 gap-2 bg-bg-dark/50 border border-white/5 rounded-xl p-3 text-xs mb-4">
                      <div>
                        <span className="text-gray-500 block mb-0.5">Ketinggian Lahan</span>
                        <strong className="text-white">{lahan.ketinggian} mdpl</strong>
                      </div>
                      <div>
                        <span className="text-gray-500 block mb-0.5">Suhu Tanah/Udara</span>
                        <strong className="text-white">{lahan.suhu} °C</strong>
                      </div>
                      <div className="mt-1">
                        <span className="text-gray-500 block mb-0.5">Curah Hujan</span>
                        <strong className="text-white">{lahan.curahHujan} mm/bln</strong>
                      </div>
                      <div className="mt-1">
                        <span className="text-gray-500 block mb-0.5">Jenis Tanah</span>
                        <strong className="text-white">{lahan.jenisTanah}</strong>
                      </div>
                    </div>

                    {/* Plant Status detail */}
                    {lahan.status !== 'kosong' && (
                      <div className="border-t border-white/5 pt-3 mb-4 text-xs space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Tanaman:</span>
                          <strong className="text-white">{lahan.varietasDitanam}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Estimasi Panen:</span>
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
                  <div className="flex gap-2 border-t border-white/5 pt-4 mt-auto">
                    {lahan.status === 'kosong' ? (
                      <button 
                        onClick={() => {
                          setSelectedLahan(lahan);
                          setCurrentView('suitability');
                        }}
                        className="w-full bg-primary hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                      >
                        <Sprout className="w-3.5 h-3.5" />
                        <span>Mulai Tanam (Cek Kelayakan)</span>
                      </button>
                    ) : (
                      <>
                        <button 
                          onClick={() => {
                            setSelectedLahan(lahan);
                            setCurrentView('monitoring');
                          }}
                          className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1"
                        >
                          <Activity className="w-3.5 h-3.5" />
                          <span>Pantau Lahan</span>
                        </button>
                        
                        {lahan.status === 'sedang-ditanam' && (
                          <button 
                            onClick={() => handleUpdateStatusTanam(lahan.id, 'siap-panen')}
                            className="px-3 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center"
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
              <div className="col-span-full bg-bg-card border border-white/5 rounded-2xl p-12 text-center">
                <Map className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-white font-bold text-lg mb-1">Belum Ada Lahan</h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto mb-6">
                  Tandai wilayah persawahan Anda sekarang untuk mendeteksi data geospasial serta memantau kesehatan tanaman secara berkala.
                </p>
                <button 
                  onClick={() => setCurrentView('add-lahan')}
                  className="bg-primary hover:bg-emerald-600 text-white font-bold py-2.5 px-6 rounded-full text-xs transition-all inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Gambar Lahan Pertama</span>
                </button>
              </div>
            )}
            </div>
            </>
          )}

        {/* TAB CONTENT: HARVEST HISTORY */}
        {activeTab === 'panen' && (
          <div className="space-y-6">
            {/* Chart Area */}
            {panens.length > 0 && (
              <div className="bg-bg-card border border-white/5 rounded-2xl p-6 h-72">
                <h3 className="text-white font-bold mb-4 text-sm">Grafik Pendapatan Panen</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[...panens].reverse()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                      tickFormatter={(val) => `Rp${(val/1000000).toFixed(1)}Jt`}
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

            <div className="bg-bg-card border border-white/5 rounded-2xl p-6 overflow-x-auto">
              {panens.length > 0 ? (
                <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-gray-500">
                    <th className="pb-3 font-semibold uppercase tracking-wider">Lahan</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider">Komoditas</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider">Tanggal</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider">Kualitas</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider">Berat Bersih</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider text-right">Estimasi Nilai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {panens.map((p) => (
                    <tr key={p.id} className="text-white hover:bg-white/[0.01] transition-colors">
                      <td className="py-4.5 font-medium">{p.namaLahan}</td>
                      <td className="py-4.5">{p.varietas}</td>
                      <td className="py-4.5 text-gray-400">{p.tanggalPanen}</td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <FileSpreadsheet className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-white font-bold text-lg mb-1">Riwayat Panen Kosong</h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Belum ada catatan panen yang direkam. Setelah tanaman pada lahan memasuki masa panen, silakan rekam hasil panen Anda di dashboard.
                </p>
              </div>
            )}
          </div>
          </div>
        )}

        {/* TAB CONTENT: KALENDER & CUACA */}
        {activeTab === 'kalender' && (
          <KalenderTanam savedLahans={lahans} />
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 bg-bg-card/50 text-center text-xs text-gray-500">
        <p>&copy; 2026 EcoTani. Hak Cipta Dilindungi Undang-Undang.</p>
        <p className="mt-1">Developed by Tim EcoTani Indonesia - Universitas Dian Nuswantoro</p>
      </footer>

    </div>
  );
}
