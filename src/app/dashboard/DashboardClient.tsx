'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Lahan, RiwayatPanen } from '@/types';
import { cekKelayakan, cariAlternatif, TANAMAN_DATABASE, evaluasiLahanDinamis, cariAlternatifDinamis } from '@/utils/suitability';
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
  updatePetaniProfile,
  getTanamanList,
  getTodayActivityLogs,
  upsertActivityLog
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
  ChevronDown,
  Search,
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
  const [cropsList, setCropsList] = useState<any[]>([]);
  const [selectedCropId, setSelectedCropId] = useState<string>('');
  const [isCropDropdownOpen, setIsCropDropdownOpen] = useState(false);
  const [cropSearchQuery, setCropSearchQuery] = useState('');

  const [activeTab, setActiveTab] = useState<'lahan' | 'panen' | 'kalender'>('lahan');
  const [liveWeather, setLiveWeather] = useState<{suhu: number, curahHujan: number, currentTemp?: number, weatherDesc?: string} | null>(null);

  // --- HARVEST (PANEN) STATES ---
  const [beratPanen, setBeratPanen] = useState<number | ''>('');
  const [statusHasil, setStatusHasil] = useState<RiwayatPanen['statusHasil']>('sukses');
  const [hargaJual, setHargaJual] = useState<number | ''>('');

  // --- CHECKLIST & MONITORING STATES ---
  const [checkedActivities, setCheckedActivities] = useState<Record<string, boolean>>({});

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

  // Fetch activity logs for the selected land
  useEffect(() => {
    if (selectedLahan && currentView === 'monitoring') {
      const fetchLogs = async () => {
        try {
          const logs = await getTodayActivityLogs(selectedLahan.id);
          const map: Record<string, boolean> = {};
          logs.forEach(log => {
            map[log.activity_name] = log.is_completed;
          });
          setCheckedActivities(map);
        } catch (err) {
          console.error('Error fetching today logs:', err);
        }
      };
      fetchLogs();
    } else {
      setCheckedActivities({});
    }
  }, [selectedLahan, currentView]);

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
      const [fetchedLahans, fetchedPanens, fetchedCrops] = await Promise.all([
        getLahans(userId),
        getRiwayatPanens(userId),
        getTanamanList()
      ]);
      setLahans(fetchedLahans);
      setPanens(fetchedPanens);
      setCropsList(fetchedCrops);
      if (fetchedCrops.length > 0) {
        setSelectedCropId(fetchedCrops[0].id);
      }
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
      await showAlertModal('Berhasil', 'Lahan sawah berhasil disimpan!', 'success');
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

    const tanaman = cropsList.find(t => t.id === cropId);
    if (!tanaman) return;

    const evalResult = evaluasiLahanDinamis(selectedLahan, tanaman);
    const cycleDays = tanaman.siklus_tanam_days || 120;
    const estimasiPanen = new Date(Date.now() + (cycleDays * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
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
      beratPanen: numBerat,
      pendapatanEstimasi
    };

    setDataLoading(true);
    const success = await insertRiwayatPanen(panenData, user.id);

    if (success) {
      await loadDashboardData(user.id);
      setCurrentView('dashboard');
      setSelectedLahan(null);
      await showAlertModal('Panen Dicatat', 'Hasil panen berhasil disimpan! Status lahan Anda telah dikembalikan menjadi kosong.', 'success');
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

  const handleToggleActivity = async (activityName: string, isChecked: boolean) => {
    if (!selectedLahan) return;
    
    // 1. Update local state immediately for visual responsiveness
    const nextMap = { ...checkedActivities, [activityName]: isChecked };
    setCheckedActivities(nextMap);

    // 2. Persist to DB via upsert
    try {
      await upsertActivityLog(selectedLahan.id, activityName, isChecked);
    } catch (err) {
      console.warn('DB Log Activity Error (table might not exist yet):', err);
    }

    // 3. Define total items based on weather conditions
    const isExtremeWeather = selectedLahan.ketinggian > 800 && selectedLahan.curahHujan > 250;
    const requiredItems = isExtremeWeather 
      ? ['Buka katup drainase sawah', 'Pemangkasan daun terbawah', 'Semprotkan fungisida organik', 'Monitor tanggul bedengan']
      : ['Irigasi Harian Terjadwal', 'Pembersihan Parit', 'Pengecekan Mulsa Lahan'];

    // 4. Calculate progress percentage
    const completedCount = requiredItems.filter(item => nextMap[item]).length;
    const totalCount = requiredItems.length;

    // 5. Trigger Swal award if reaching 100% completion
    if (completedCount === totalCount && isChecked) {
      await showAlertModal('Luar biasa!', 'Pemeliharaan harian telah selesai 100% dan tercatat di sistem.', 'success');
    }
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
        <p className="text-xs text-text-muted uppercase tracking-widest">Menghubungkan...</p>
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
              className="w-full bg-primary hover:bg-primary-dark text-text-main font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/20 mt-4 flex items-center justify-center gap-2"
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
          <span className="hidden md:inline text-xs text-text-muted">Teknologi Geospatial EcoTani</span>
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
          <span className="hidden md:inline text-xs text-text-muted">Teknologi Geospatial EcoTani</span>
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
    const activeCrop = cropsList.find(c => c.id === selectedCropId) || (cropsList.length > 0 ? cropsList[0] : null);
    const evalResult = activeCrop 
      ? evaluasiLahanDinamis(lahanToEvaluate, activeCrop) 
      : { layak: false, skor: 0, kendala: [], siklusPemupukan: [], kebutuhanAirDaily: 5, saranMitigasi: '' };
    const alternatifList = cropsList.length > 0 ? cariAlternatifDinamis(lahanToEvaluate, cropsList) : [];
    const filteredCrops = cropsList.filter(crop =>
      crop.nama.toLowerCase().includes(cropSearchQuery.toLowerCase()) ||
      (crop.nama_latin && crop.nama_latin.toLowerCase().includes(cropSearchQuery.toLowerCase()))
    );

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
            {liveWeather && <span className="block mt-1 text-primary flex items-center gap-1"><CloudRain className="w-3.5 h-3.5" /> Terhubung dengan data cuaca live ({liveWeather.suhu}°C, {liveWeather.curahHujan} mm/bln)</span>}
          </p>

          {/* Pilihan Jenis Tanaman */}
          <div className="mb-8 bg-bg-dark border border-border-medium rounded-2xl p-5">
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Pilih Komoditas Tanaman</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCropDropdownOpen(!isCropDropdownOpen)}
                className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-3 text-left text-white focus:outline-none focus:border-primary transition-all text-sm font-bold flex justify-between items-center"
              >
                <span>
                  {activeCrop ? `${activeCrop.nama} ${activeCrop.nama_latin ? `(${activeCrop.nama_latin})` : ''}` : 'Pilih Komoditas Tanaman'}
                </span>
                <ChevronDown className={`w-4 h-4 transform transition-transform duration-200 ${isCropDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isCropDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => { setIsCropDropdownOpen(false); setCropSearchQuery(''); }} />
                  <div className="absolute z-50 mt-2 w-full bg-bg-card border border-border-medium rounded-xl shadow-2xl p-3 space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Cari komoditas..."
                        value={cropSearchQuery}
                        onChange={(e) => setCropSearchQuery(e.target.value)}
                        className="w-full bg-bg-dark border border-white/10 rounded-lg pl-9 pr-4 py-2 text-white focus:outline-none focus:border-primary transition-all text-xs"
                        autoFocus
                      />
                      <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-text-muted" />
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
                      {filteredCrops.length > 0 ? (
                        filteredCrops.map(crop => (
                          <button
                            key={crop.id}
                            type="button"
                            onClick={() => {
                              setSelectedCropId(crop.id);
                              setIsCropDropdownOpen(false);
                              setCropSearchQuery('');
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex flex-col ${
                              crop.id === selectedCropId
                                ? 'bg-primary/20 border border-primary text-white font-bold'
                                : 'hover:bg-white/5 text-text-muted hover:text-text-main'
                            }`}
                          >
                            <span className="font-bold">{crop.nama}</span>
                            {crop.nama_latin && <span className="text-[10px] italic opacity-60">{crop.nama_latin}</span>}
                          </button>
                        ))
                      ) : (
                        <div className="text-center py-4 text-xs text-text-muted">Komoditas tidak ditemukan</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* HASIL ANALISIS KELAYAKAN */}
          <div className="space-y-6">
            <div className="flex items-start gap-4 p-5 rounded-2xl border bg-bg-dark border-border-light">
              <div className="mt-1 flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                  <Activity className="h-5 w-5 text-text-muted" />
                </div>
              </div>
              <div className="flex-grow w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <h3 className="font-bold text-lg text-text-main">
                    {evalResult.details?.some((d: any) => d.rating === 'N' || d.rating === 'S3') 
                      ? 'Evaluasi Kelayakan Tanam' 
                      : 'Lahan Sangat Layak Ditanami'}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">Skor Kecocokan:</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      (evalResult.skorPotensial || evalResult.skor) >= 75 ? 'bg-primary-dark/20 text-primary border-primary/10' :
                      (evalResult.skorPotensial || evalResult.skor) >= 50 ? 'bg-amber-950/20 text-amber-400 border-amber-500/10' :
                      'bg-red-950/20 text-red-400 border-red-500/10'
                    }`}>
                      {evalResult.skor}%
                      {evalResult.skorPotensial && evalResult.skorPotensial > evalResult.skor && (
                        <span className="text-text-muted font-normal"> → <strong className="text-primary/90 font-bold">{evalResult.skorPotensial}% setelah Mitigasi</strong></span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Visual Progress Bar */}
                <div className="w-full bg-bg-card h-2.5 rounded-full overflow-hidden mb-4 border border-white/5 p-[1px] relative">
                  {/* Potential score bar extension (semi-transparent) */}
                  {evalResult.skorPotensial && evalResult.skorPotensial > evalResult.skor && (
                    <div 
                      className={`absolute top-0 bottom-0 left-0 rounded-full opacity-35 transition-all duration-500 ${
                        evalResult.skorPotensial >= 75 ? 'bg-primary' :
                        evalResult.skorPotensial >= 50 ? 'bg-amber-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${evalResult.skorPotensial}%` }}
                    />
                  )}
                  {/* Current score bar */}
                  <div 
                    className={`h-full rounded-full transition-all duration-500 relative z-10 ${
                      evalResult.skor >= 75 ? 'bg-gradient-to-r from-primary-dark to-primary' :
                      evalResult.skor >= 50 ? 'bg-gradient-to-r from-amber-600 to-amber-500' :
                      'bg-gradient-to-r from-red-600 to-red-500'
                    }`}
                    style={{ width: `${evalResult.skor}%` }}
                  />
                </div>
                
                {evalResult.kendala.length > 0 ? (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-amber-500/90 block uppercase tracking-wider">Deteksi Kendala:</span>
                    <ul className="list-disc pl-4 text-xs text-text-muted space-y-1">
                      {evalResult.kendala.map((k, i) => <li key={`k-${i}`}>{k}</li>)}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">Selamat! Parameter lingkungan (suhu, curah hujan, ketinggian, dan tipe tanah) terdeteksi sangat cocok dengan kebutuhan varietas tanaman ini.</p>
                )}
              </div>
            </div>

            {/* TABEL KOMPARASI PARAMETER */}
            {evalResult.details && evalResult.details.length > 0 && (
              <div className="bg-bg-dark border border-border-light rounded-2xl p-5 shadow-inner">
                <h4 className="font-bold text-text-main text-sm mb-4 flex items-center gap-2">
                  <Activity className="w-4.5 h-4.5 text-primary" />
                  <span>Detail Perbandingan Parameter</span>
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-text-muted">
                        <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Parameter</th>
                        <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Lahan Anda</th>
                        <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Ideal (S1)</th>
                        <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-center">Kelas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {evalResult.details.map((detail, index) => {
                        const isN = detail.rating === 'N';
                        const isS3 = detail.rating === 'S3';
                        const isS2 = detail.rating === 'S2';
                        
                        const rowBg = 'hover:bg-white/5 transition-colors';

                        let ratingBadgeColor = '';
                        if (isN) ratingBadgeColor = 'text-red-400 font-bold';
                        else if (isS3) ratingBadgeColor = 'text-amber-500 font-bold';
                        else if (isS2) ratingBadgeColor = 'text-blue-400/90 font-medium';
                        else ratingBadgeColor = 'text-zinc-500 font-medium';

                        return (
                          <tr key={`param-${index}`} className={rowBg}>
                            <td className="py-3 px-3 font-medium text-text-main">{detail.label}</td>
                            <td className="py-3 px-3 text-text-muted">{detail.actual}</td>
                            <td className="py-3 px-3 text-text-muted">{detail.ideal}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`inline-block text-[10px] tracking-wider ${ratingBadgeColor}`}>
                                {detail.rating}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Jika LAYAK: Tampilkan Kalender Kerja / Estimasi */}
            {evalResult.layak && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-bg-dark border border-border-light space-y-4">
                  <h4 className="font-bold text-text-main flex items-center gap-2 border-b border-border-light pb-2">
                    <Calendar className="w-4.5 h-4.5 text-primary" />
                    <span>Rencana Perawatan</span>
                  </h4>
                  <ul className="text-xs text-text-muted space-y-3">
                    {evalResult.siklusPemupukan.map((step, i) => (
                      <li key={`s-${i}`} className="flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0"></span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-5 rounded-2xl bg-bg-dark border border-border-light space-y-3">
                  <h4 className="font-bold text-text-main flex items-center gap-2 border-b border-border-light pb-2">
                    <Droplet className="w-4.5 h-4.5 text-primary" />
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
                      <strong className="text-text-main text-sm">{cropsList.find(t => t.id === selectedCropId)?.siklus_tanam_days || 120} Hari</strong>
                    </div>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed border-t border-border-light pt-2 mt-2">
                    {evalResult.saranMitigasi}
                  </p>
                </div>
              </div>
            )}

            {/* ANALISIS MITIGASI TAKTIS & DINAMIS (Tampil jika ada parameter sub-optimal: S2/S3/N) */}
            {(() => {
              const mitigasiTaktis: any[] = [];
              if (evalResult.details) {
                evalResult.details.forEach((detail: any) => {
                  if (detail.rating === 'S1') return;

                  let text = '';
                  if (detail.parameter === 'tekstur_tanah') {
                    text = 'Penambahan bahan organik secara masif (kompos/pupuk kandang matang sebanyak 2-3 kg/m²) untuk meningkatkan struktur agregat tanah, menunjang retensi air, dan memulihkan sirkulasi udara pada daerah perakaran.';
                  } else if (detail.parameter === 'drainase') {
                    if (detail.rating === 'S2') {
                      text = 'Kondisi drainase sedikit terhambat/cepat. Disarankan untuk memantau intensitas pemberian air harian dan membuat parit drainase sekunder dengan kedalaman sedang (15-20 cm) agar tanah tidak jenuh air.';
                    } else { // S3 atau N
                      text = 'Sistem drainase sangat buruk/ekstrem. Buat parit bedengan yang tinggi (minimal 30 cm) dan saluran pembuangan air utama di keliling lahan untuk mencegah genangan air lama yang memicu busuk perakaran.';
                    }
                  } else if (detail.parameter === 'ph_tanah') {
                    const phVal = parseFloat(detail.actual) || 6.5;
                    if (phVal < 5.5) {
                      text = 'Tanah terlalu asam (pH rendah). Aplikasikan kapur pertanian (dolomit) sebanyak 150-200 gram/m² sekitar 2-3 minggu sebelum tanam untuk menetralkan pH dan menambah kalsium (Ca) serta magnesium (Mg).';
                    } else if (phVal > 7.5) {
                      text = 'Tanah terlalu basa (pH tinggi). Berikan belerang hiasan (sulfur) atau aplikasikan pupuk amonium sulfat (ZA) serta pupuk organik untuk membantu menurunkan pH ke arah netral secara bertahap.';
                    } else {
                      text = 'Derajat keasaman tanah (pH) berada di luar batas ideal. Lakukan pemupukan bahan organik matang atau berikan dolomit/sulfur sesuai dengan uji indikator laboratorium.';
                    }
                  } else if (detail.parameter === 'lereng') {
                    text = 'Kemiringan lereng tidak ideal. Terapkan metode terasering (sengkedan) serta buat sabuk gunung / penanaman rumput vetiver di bibir lereng untuk memitigasi risiko erosi lapisan tanah atas (topsoil) yang subur.';
                  } else if (detail.parameter === 'temperatur') {
                    text = 'Suhu udara ekstrem. Gunakan jaring naungan (paranet dengan kerapatan 50-70%) atau aplikasikan mulsa plastik/organik (jerami) pada permukaan tanah untuk menstabilkan suhu mikro tanah dan mereduksi evaporasi.';
                  } else if (detail.parameter === 'curah_hujan') {
                    text = 'Volume curah hujan tidak sesuai. Jika terlalu rendah, buat penampung air (embung) dan pasang instalasi irigasi tetes (drip irrigation). Jika terlalu tinggi, optimalkan kapasitas saluran pembuangan utama.';
                  } else if (detail.parameter === 'ketinggian') {
                    text = 'Ketinggian wilayah kurang ideal untuk komoditas ini. Pertahankan suhu tanah tetap sejuk dengan mengoptimalkan ketebalan mulsa penutup tanah dan memilih varietas benih yang tahan suhu panas/dingin.';
                  }

                  if (text) {
                    mitigasiTaktis.push({ label: detail.label, rating: detail.rating, text });
                  }
                });
              }

              if (mitigasiTaktis.length === 0) return null;

              return (
                <div className="p-5 rounded-r-2xl rounded-l-none border-l-4 border-l-amber-500/80 border-y border-r border-border-light bg-bg-dark text-xs text-text-muted space-y-4 shadow-md">
                  <h4 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2 text-text-main">
                    <AlertTriangle className="w-4.5 h-4.5 text-amber-500/85" />
                    <span>Rencana & Rekomendasi Mitigasi Taktis</span>
                  </h4>
                  <div className="space-y-4 divide-y divide-white/5">
                    {mitigasiTaktis.map((m, idx) => (
                      <div key={`mitigasi-${idx}`} className="pt-3 first:pt-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="font-semibold text-text-main text-xs">{m.label}</span>
                        </div>
                        <p className="text-text-muted leading-relaxed text-xs">
                          {m.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* OPSI REKOMENDASI ALTERNATIF JIKA ADA KENDALA */}
            {evalResult.skor < 90 && alternatifList.filter(a => a.tanaman.id !== selectedCropId).length > 0 && (
              <div className="p-5 rounded-2xl bg-bg-dark border border-border-light space-y-4 shadow-md">
                <h4 className="font-bold text-text-main text-sm flex items-center gap-2 border-b border-border-light/40 pb-2">
                  <TrendingUp className="w-4.5 h-4.5 text-primary" />
                  <span>Rekomendasi Tanaman Alternatif Terdekat</span>
                </h4>
                <div className="space-y-3">
                  {alternatifList.filter(a => a.tanaman.id !== selectedCropId).slice(0, 2).map((alt) => (
                    <div key={alt.tanaman.id} className="flex items-center justify-between p-3.5 bg-bg-card border border-border-medium rounded-xl text-xs hover:border-primary/20 transition-all">
                      <div className="space-y-1">
                        <strong className="text-text-main text-sm block">{alt.tanaman.nama}</strong>
                        <span className="text-text-muted block text-[10px]">Estimasi panen: {alt.tanaman.siklus_tanam_days || 120} hari</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-primary/90 font-semibold bg-primary-dark/20 px-2 py-0.5 rounded border border-primary/10">Kecocokan: {alt.evaluasi.skor}%</span>
                        <button
                          onClick={() => setSelectedCropId(alt.tanaman.id)}
                          className="bg-border-medium hover:bg-white/10 text-text-main font-bold py-2 px-4 rounded-xl transition-all text-[11px] cursor-pointer"
                        >
                          Pilih
                        </button>
                      </div>
                    </div>
                  ))}
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
                    ? 'bg-primary hover:bg-primary-dark text-text-main shadow-lg shadow-primary/20' 
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

    const mockTrendData = [
      { name: 'Sen', kelembapan: 75, suhu: 24.2 },
      { name: 'Sel', kelembapan: 78, suhu: 24.8 },
      { name: 'Rab', kelembapan: 76, suhu: 25.1 },
      { name: 'Kam', kelembapan: 82, suhu: 23.5 },
      { name: 'Jum', kelembapan: 79, suhu: 24.0 },
      { name: 'Sab', kelembapan: 77, suhu: 24.5 },
      { name: 'Min', kelembapan: 78, suhu: 25.0 }
    ];

    return (
      <div className="min-h-screen bg-bg-dark py-8 px-4">
        <div className="max-w-4xl mx-auto bg-bg-card border border-border-medium rounded-3xl p-6 md:p-8 shadow-2xl">
          
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

          <div className="flex justify-between items-start mb-6 border-b border-border-light pb-4">
            <div>
              <span className="text-xs bg-primary-dark/30 text-primary font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Sedang Ditanam</span>
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

          {/* METRICS SUMMARY GRID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-bg-dark p-5 rounded-2xl border border-border-light">
              <span className="text-text-muted text-[11px] block mb-1 uppercase tracking-wider font-semibold">Sensor Kelembapan</span>
              <div className="flex items-baseline gap-1 mt-1">
                <strong className="text-2xl font-bold text-text-main">78%</strong>
                <span className="text-[10px] text-primary font-semibold bg-emerald-955/20 px-1.5 py-0.5 rounded border border-primary/10">Optimal</span>
              </div>
              <p className="text-[10px] text-text-muted mt-2">Kondisi media tanam optimal untuk perakaran.</p>
            </div>

            <div className="bg-bg-dark p-5 rounded-2xl border border-border-light">
              <span className="text-text-muted text-[11px] block mb-1 uppercase tracking-wider font-semibold">Suhu & Cuaca</span>
              <div className="flex items-center gap-2 mt-1">
                <CloudRain className="w-5 h-5 text-blue-400" />
                <strong className="text-lg font-bold text-text-main">
                  {liveWeather ? `${liveWeather.currentTemp}°C` : '24°C'}
                </strong>
                <span className="text-[10px] text-text-muted font-normal">
                  ({liveWeather ? liveWeather.weatherDesc : 'Hujan Ringan'})
                </span>
              </div>
              <p className="text-[10px] text-text-muted mt-2">Suhu rata-rata harian terpantau stabil.</p>
            </div>

            <div className="bg-bg-dark p-5 rounded-2xl border border-border-light">
              <span className="text-text-muted text-[11px] block mb-1 uppercase tracking-wider font-semibold">Proyeksi Panen</span>
              <div className="flex items-baseline gap-1 mt-1">
                <strong className="text-base font-bold text-text-main">{selectedLahan.estimasiPanenDate}</strong>
              </div>
              <p className="text-[10px] text-text-muted mt-2">Perkiraan umur tanaman siap dipanen.</p>
            </div>
          </div>

          {/* HISTORICAL TREND CHARTS */}
          <div className="bg-bg-dark border border-border-light rounded-3xl p-5 mb-6">
            <h3 className="font-bold text-text-main text-sm mb-4 flex items-center gap-2 border-b border-border-light/40 pb-2">
              <Activity className="w-4.5 h-4.5 text-primary" />
              <span>Tren Sensor Lahan (7 Hari Terakhir)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Chart 1: Kelembapan */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-text-muted block">Status Kelembapan Lahan (%)</span>
                <div className="bg-bg-card/50 border border-border-medium rounded-2xl p-3">
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={mockTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMoisture" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff/5" vertical={false} />
                      <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} />
                      <YAxis stroke="#6b7280" fontSize={10} tickLine={false} domain={[60, 100]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                        labelStyle={{ color: '#a1a1aa', fontWeight: 'bold', fontSize: '11px' }}
                        itemStyle={{ color: '#10b981', fontSize: '12px' }}
                      />
                      <Area type="monotone" dataKey="kelembapan" name="Kelembapan" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#colorMoisture)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Suhu */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-text-muted block">Suhu Udara (°C)</span>
                <div className="bg-bg-card/50 border border-border-medium rounded-2xl p-3">
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={mockTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f5a623" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#f5a623" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff/5" vertical={false} />
                      <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} />
                      <YAxis stroke="#6b7280" fontSize={10} tickLine={false} domain={[15, 35]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                        labelStyle={{ color: '#a1a1aa', fontWeight: 'bold', fontSize: '11px' }}
                        itemStyle={{ color: '#f5a623', fontSize: '12px' }}
                      />
                      <Area type="monotone" dataKey="suhu" name="Suhu" stroke="#f5a623" strokeWidth={1.5} fillOpacity={1} fill="url(#colorTemp)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* PANDUAN AKTIF & CHECKLIST MITIGASI */}
          {(() => {
            const requiredItems = isExtremeWeather 
              ? ['Buka katup drainase sawah', 'Pemangkasan daun terbawah', 'Semprotkan fungisida organik', 'Monitor tanggul bedengan']
              : ['Irigasi Harian Terjadwal', 'Pembersihan Parit', 'Pengecekan Mulsa Lahan'];
            const completedCount = requiredItems.filter(item => checkedActivities[item]).length;
            const progressPercent = requiredItems.length > 0 ? Math.round((completedCount / requiredItems.length) * 100) : 0;

            return (
              <div className="bg-bg-dark border border-border-light rounded-3xl p-5 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-border-light/40">
                  <h3 className="font-bold text-text-main text-sm flex items-center gap-2">
                    <CheckCircle2 className={`w-4.5 h-4.5 ${isExtremeWeather ? 'text-amber-500' : 'text-primary'}`} />
                    <span>{isExtremeWeather ? 'Checklist Tindakan Penyelamatan Lahan' : 'Checklist Tindakan Pemeliharaan Rutin'}</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-muted">Progres:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      progressPercent === 100 ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-white/5 text-text-muted border border-white/10'
                    }`}>
                      {progressPercent}%
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-bg-card h-2 rounded-full overflow-hidden mb-4 border border-white/5 p-[1px] relative">
                  <div 
                    className="h-full rounded-full transition-all duration-500 bg-primary"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                
                <p className="text-xs text-text-muted mb-4 leading-relaxed">
                  {isExtremeWeather 
                    ? `Kami mendeteksi anomali cuaca berupa curah hujan ekstrim (${selectedLahan.curahHujan} mm/bln) di ketinggian lahan ${selectedLahan.ketinggian} mdpl. Jalankan rekomendasi taktis berikut segera:`
                    : `Kondisi curah hujan (${selectedLahan.curahHujan} mm/bln) dan suhu udara (${selectedLahan.suhu}°C) stabil di batas optimal. Jalankan perawatan harian berikut untuk memaksimalkan pertumbuhan varietas ${selectedLahan.varietasDitanam}:`}
                </p>

                <div className="space-y-2.5">
                  {isExtremeWeather ? (
                    <>
                      <div className="flex items-start gap-3 p-3 bg-bg-card border border-border-medium rounded-xl text-xs hover:border-amber-500/20 transition-all">
                        <input 
                          type="checkbox" 
                          checked={checkedActivities['Buka katup drainase sawah'] || false}
                          onChange={(e) => handleToggleActivity('Buka katup drainase sawah', e.target.checked)}
                          className="mt-0.5 rounded border-white/10 text-amber-500 focus:ring-0 focus:ring-offset-0 bg-transparent cursor-pointer" 
                        />
                        <div className="text-text-main">
                          <strong className={checkedActivities['Buka katup drainase sawah'] ? 'line-through text-text-muted' : ''}>Buka katup drainase sawah</strong>
                          <p className="text-[10px] text-text-muted mt-0.5">Keluarkan limpahan air berlebih untuk mencegah busuk akar.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-bg-card border border-border-medium rounded-xl text-xs hover:border-amber-500/20 transition-all">
                        <input 
                          type="checkbox" 
                          checked={checkedActivities['Pemangkasan daun terbawah'] || false}
                          onChange={(e) => handleToggleActivity('Pemangkasan daun terbawah', e.target.checked)}
                          className="mt-0.5 rounded border-white/10 text-amber-500 focus:ring-0 focus:ring-offset-0 bg-transparent cursor-pointer" 
                        />
                        <div className="text-text-main">
                          <strong className={checkedActivities['Pemangkasan daun terbawah'] ? 'line-through text-text-muted' : ''}>Pemangkasan daun terbawah</strong>
                          <p className="text-[10px] text-text-muted mt-0.5">Kurangi kelembapan rumpun tanaman varietas {selectedLahan.varietasDitanam}.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-bg-card border border-border-medium rounded-xl text-xs hover:border-amber-500/20 transition-all">
                        <input 
                          type="checkbox" 
                          checked={checkedActivities['Semprotkan fungisida organik'] || false}
                          onChange={(e) => handleToggleActivity('Semprotkan fungisida organik', e.target.checked)}
                          className="mt-0.5 rounded border-white/10 text-amber-500 focus:ring-0 focus:ring-offset-0 bg-transparent cursor-pointer" 
                        />
                        <div className="text-text-main">
                          <strong className={checkedActivities['Semprotkan fungisida organik'] ? 'line-through text-text-muted' : ''}>Semprotkan fungisida organik</strong>
                          <p className="text-[10px] text-text-muted mt-0.5">Lakukan pencegahan awal terhadap serangan jamur patogen.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-bg-card border border-border-medium rounded-xl text-xs hover:border-amber-500/20 transition-all">
                        <input 
                          type="checkbox" 
                          checked={checkedActivities['Monitor tanggul bedengan'] || false}
                          onChange={(e) => handleToggleActivity('Monitor tanggul bedengan', e.target.checked)}
                          className="mt-0.5 rounded border-white/10 text-amber-500 focus:ring-0 focus:ring-offset-0 bg-transparent cursor-pointer" 
                        />
                        <div className="text-text-main">
                          <strong className={checkedActivities['Monitor tanggul bedengan'] ? 'line-through text-text-muted' : ''}>Monitor tanggul bedengan</strong>
                          <p className="text-[10px] text-text-muted mt-0.5">Pastikan tidak terjadi sumbatan aliran air di saluran irigasi utama.</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start gap-3 p-3 bg-bg-card border border-border-medium rounded-xl text-xs hover:border-primary/20 transition-all">
                        <input 
                          type="checkbox" 
                          checked={checkedActivities['Irigasi Harian Terjadwal'] || false}
                          onChange={(e) => handleToggleActivity('Irigasi Harian Terjadwal', e.target.checked)}
                          className="mt-0.5 rounded border-white/10 text-primary focus:ring-0 focus:ring-offset-0 bg-transparent cursor-pointer" 
                        />
                        <div className="text-text-main">
                          <strong className={checkedActivities['Irigasi Harian Terjadwal'] ? 'line-through text-text-muted' : ''}>Irigasi Harian Terjadwal</strong>
                          <p className="text-[10px] text-text-muted mt-0.5">Salurkan air irigasi sebanyak {(selectedLahan.kebutuhanAirDaily || 5) * selectedLahan.luas} Liter di pagi hari.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-bg-card border border-border-medium rounded-xl text-xs hover:border-primary/20 transition-all">
                        <input 
                          type="checkbox" 
                          checked={checkedActivities['Pembersihan Parit'] || false}
                          onChange={(e) => handleToggleActivity('Pembersihan Parit', e.target.checked)}
                          className="mt-0.5 rounded border-white/10 text-primary focus:ring-0 focus:ring-offset-0 bg-transparent cursor-pointer" 
                        />
                        <div className="text-text-main">
                          <strong className={checkedActivities['Pembersihan Parit'] ? 'line-through text-text-muted' : ''}>Pembersihan Parit</strong>
                          <p className="text-[10px] text-text-muted mt-0.5">Bersihkan parit irigasi dari sisa gulma atau lumpur penyumbat.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-bg-card border border-border-medium rounded-xl text-xs hover:border-primary/20 transition-all">
                        <input 
                          type="checkbox" 
                          checked={checkedActivities['Pengecekan Mulsa Lahan'] || false}
                          onChange={(e) => handleToggleActivity('Pengecekan Mulsa Lahan', e.target.checked)}
                          className="mt-0.5 rounded border-white/10 text-primary focus:ring-0 focus:ring-offset-0 bg-transparent cursor-pointer" 
                        />
                        <div className="text-text-main">
                          <strong className={checkedActivities['Pengecekan Mulsa Lahan'] ? 'line-through text-text-muted' : ''}>Pengecekan Mulsa Lahan</strong>
                          <p className="text-[10px] text-text-muted mt-0.5">Pastikan mulsa organik/jerami penutup tanah tidak tergeser.</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* CATATAN MITIGASI SAAT CHECK SUITABILITY */}
          {selectedLahan.catatanMitigasi && (
            <div className="bg-bg-dark border border-border-light rounded-3xl p-5 mb-6">
              <h4 className="font-bold text-text-main mb-3 text-xs uppercase tracking-wider text-text-muted border-b border-border-light/40 pb-2">Instruksi Tanam Awal</h4>
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
              className="flex-1 py-3.5 px-4 rounded-xl border border-border-medium hover:bg-border-light text-text-muted font-bold text-sm transition-all text-center cursor-pointer"
            >
              Kembali
            </button>

            <button 
              onClick={() => {
                // Initialize default values for the harvest form
                const cropData = cropsList.find(t => t.nama === selectedLahan?.varietasDitanam);
                const hargaDef = 7000; // standard average default
                
                setBeratPanen(0);
                
                setHargaJual(hargaDef);
                setStatusHasil('sukses');
                setCurrentView('panen');
              }}
              className="flex-1 py-3.5 px-4 rounded-xl bg-primary-dark hover:bg-primary text-white font-bold text-sm transition-all text-center shadow-lg shadow-primary/10 cursor-pointer"
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
    const cropData = cropsList.find(t => t.nama === selectedLahan.varietasDitanam);
    const hargaDefault = 7000;
    
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
                  const cropData = cropsList.find(t => t.nama === selectedLahan.varietasDitanam);
                  const potensiAvg = 0.75;
                  
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
                className="flex-1 py-3 px-4 rounded-xl bg-primary hover:bg-primary-dark text-text-main font-bold text-sm transition-all shadow-lg shadow-primary/20"
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
            <Settings className="w-6 h-6 text-primary" />
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
              <User className="w-3.5 h-3.5 text-primary" />
              <span>{petaniName}</span>
            </div>
            
            <button 
              onClick={() => setCurrentView('profile')}
              className="p-1.5 text-gray-400 hover:text-primary transition-colors bg-white/5 hover:bg-white/10 border border-white/5 rounded-full"
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
            <div className="p-2 md:p-3 bg-primary/10 text-primary rounded-lg md:rounded-xl border border-primary/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
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
                activeTab === 'lahan' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="flex items-center gap-2"><Map className="w-4 h-4"/> Daftar Lahan Sawah</span>
              {activeTab === 'lahan' && <span className="absolute -bottom-2.5 left-0 right-0 h-0.5 bg-primary-light shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>}
            </button>
            <button 
              onClick={() => setActiveTab('kalender')}
              className={`py-2 px-1 text-sm font-bold relative transition-all whitespace-nowrap ${
                activeTab === 'kalender' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="flex items-center gap-2"><Calendar className="w-4 h-4"/> Kalender & Cuaca</span>
              {activeTab === 'kalender' && <span className="absolute -bottom-2.5 left-0 right-0 h-0.5 bg-primary-light shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>}
            </button>
            <button 
              onClick={() => setActiveTab('panen')}
              className={`py-2 px-1 text-sm font-bold relative transition-all whitespace-nowrap ${
                activeTab === 'panen' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="flex items-center gap-2"><FileSpreadsheet className="w-4 h-4"/> Riwayat Panen</span>
              {activeTab === 'panen' && <span className="absolute -bottom-2.5 left-0 right-0 h-0.5 bg-primary-light shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>}
            </button>
          </div>

          {activeTab === 'lahan' && (
            <button 
              onClick={() => setCurrentView('add-lahan')}
              className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-bold py-3 md:py-2 px-5 rounded-xl md:rounded-full text-xs transition-all flex justify-center items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.1)] w-full md:w-auto"
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
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-primary/30 hover:bg-white/10 hover:shadow-[0_0_25px_rgba(16,185,129,0.1)] transition-all duration-300 flex flex-col justify-between group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-primary/10 transition-colors"></div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-white font-bold text-base leading-tight group-hover:text-primary transition-colors">{lahan.nama}</h3>
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
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary border border-primary/20 font-bold uppercase tracking-wider">Ditanami</span>
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
                        className="flex-1 text-xs font-bold py-2.5 rounded-xl border border-primary/30 text-primary hover:bg-primary/10 transition-colors text-center"
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
                          className="flex-1 text-xs font-bold py-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-colors text-center flex items-center justify-center gap-1"
                        >
                          <Activity className="w-3.5 h-3.5" />
                          <span>Pantau Lahan</span>
                        </button>
                        
                        {lahan.status === 'sedang-ditanam' && (
                          <button 
                            onClick={async () => {
                              const confirmed = await showConfirmModal(
                                'Tandai Siap Panen',
                                'Apakah Anda yakin ingin memanen lahan ini? Tindakan ini akan menandai status lahan siap panen.',
                                'Ya, Panen Sekarang',
                                'Batalkan'
                              );
                              if (confirmed) {
                                await handleUpdateStatusTanam(lahan.id, 'siap-panen');
                                await showAlertModal('Berhasil', 'Status lahan berhasil diubah menjadi Siap Panen!', 'success');
                              }
                            }}
                            className="px-3 bg-amber-500 hover:bg-amber-600 text-text-main font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center cursor-pointer"
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
                  className="bg-primary hover:bg-primary-dark text-text-main font-bold py-2.5 px-6 rounded-full text-xs transition-all inline-flex items-center gap-1.5"
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
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-bold uppercase text-[9px]">Melimpah</span>
                        ) : p.statusHasil === 'sebagian' ? (
                          <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded font-bold uppercase text-[9px]">Sebagian</span>
                        ) : (
                          <span className="bg-red-500/10 text-red-400 px-2 py-0.5 rounded font-bold uppercase text-[9px]">Gagal</span>
                        )}
                      </td>
                      <td className="py-4.5 font-semibold">{p.beratPanen.toLocaleString('id-ID')} Kg</td>
                      <td className="py-4.5 text-right font-extrabold text-primary">
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
          <span className="hidden md:inline"> - </span>Telkom University Purwokerto <span className="text-primary font-bold mx-1">X</span> Universitas Jendral Soedirman
        </p>
      </footer>

    </div>
  );
}



