'use client';

import { useState, useEffect, Fragment } from 'react';
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
  upsertActivityLog,
  getClimateScenarios,
  getActivityLogsForLands,
  getStressTestResultsForLands
} from '@/utils/supabaseQueries';
import { runStressTest, saveStressTestResult, updateUserDecision, applyScenarioDelta } from '@/utils/climateStressTest';
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  Eye,
  EyeOff,
  Sparkles,
  Lightbulb,
  Check,
  ClipboardCheck,
  Clock,
  X
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
  const [selectedKategori, setSelectedKategori] = useState<string>('');
  const [isKategoriDropdownOpen, setIsKategoriDropdownOpen] = useState(false);
  const [isCropDropdownOpen, setIsCropDropdownOpen] = useState(false);
  const [cropSearchQuery, setCropSearchQuery] = useState('');
  const [activeStep, setActiveStep] = useState<number>(1);
  const [openAltGroup, setOpenAltGroup] = useState<string>('90-100');
  const [animateProgress, setAnimateProgress] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('Suhu');
  const [innerTab, setInnerTab] = useState<'overview' | 'weather' | 'checklist'>('overview');
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [onboardingStep, setOnboardingStep] = useState<number>(1);

  const [activeTab, setActiveTab] = useState<'lahan' | 'panen'>('lahan');
  const [liveWeather, setLiveWeather] = useState<{suhu: number, curahHujan: number, currentTemp?: number, weatherDesc?: string} | null>(null);

  // --- HARVEST (PANEN) STATES ---
  const [beratPanen, setBeratPanen] = useState<number | ''>('');
  const [statusHasil, setStatusHasil] = useState<RiwayatPanen['statusHasil']>('sukses');
  const [hargaJual, setHargaJual] = useState<number | ''>('');

  // --- CHECKLIST & MONITORING STATES ---
  const [checkedActivities, setCheckedActivities] = useState<Record<string, boolean>>({});

  // --- CLIMATE STRESS TEST STATES ---
  const [climateScenarios, setClimateScenarios] = useState<any[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<any | null>(null);
  const [isStressTestModalOpen, setIsStressTestModalOpen] = useState<boolean>(false);
  const [stressTestResult, setStressTestResult] = useState<any | null>(null);
  const [stressTestId, setStressTestId] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // --- RECENT ACTIVITIES STATES ---
  const [allActivityLogs, setAllActivityLogs] = useState<any[]>([]);
  const [allStressTests, setAllStressTests] = useState<any[]>([]);
  const [isActivitiesModalOpen, setIsActivitiesModalOpen] = useState<boolean>(false);
  const [activitiesPage, setActivitiesPage] = useState<number>(1);

  // --- HELPER: FORMAT RELATIVE TIME ---
  const formatRelativeTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Baru saja';
      if (diffMins < 60) return `${diffMins} menit lalu`;
      if (diffHours < 24) return `${diffHours} jam lalu`;
      if (diffDays === 1) return 'Kemarin';
      if (diffDays < 7) return `${diffDays} hari lalu`;
      
      return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return '';
    }
  };

  // --- HELPER: GENERATE TIMELINE FROM VARIOUS DATA SOURCES ---
  const generateTimeline = (): any[] => {
    const items: any[] = [];

    // 1. Lahan Baru Ditambahkan
    lahans.forEach(l => {
      const timestamp = l.created_at || (l.tanggalTanam ? new Date(l.tanggalTanam).toISOString() : new Date().toISOString());
      items.push({
        id: `lahan_baru_${l.id}`,
        type: 'lahan_baru',
        lahan_id: l.id,
        lahan_name: l.nama,
        message: l.varietasDitanam 
          ? `${l.nama} ditambahkan — ${l.varietasDitanam} mulai ditanam` 
          : `${l.nama} ditambahkan — siap untuk ditanami`,
        timestamp: timestamp,
        severity: 'info'
      });

      // 2. Anomali cuaca terdeteksi
      const isExtreme = l.status === 'sedang-ditanam' && l.ketinggian > 800 && l.curahHujan > 250;
      if (isExtreme) {
        items.push({
          id: `anomali_${l.id}`,
          type: 'anomali',
          lahan_id: l.id,
          lahan_name: l.nama,
          message: `Anomali cuaca terdeteksi di ${l.nama}`,
          timestamp: l.tanggalTanam ? new Date(l.tanggalTanam).toISOString() : timestamp,
          severity: 'warning'
        });
      }
    });

    // 3. Riwayat Panen
    panens.forEach(p => {
      const timestamp = p.created_at || (p.tanggalPanen ? new Date(p.tanggalPanen).toISOString() : new Date().toISOString());
      let statusStr = 'sukses';
      if (p.statusHasil === 'gagal') statusStr = 'Gagal';
      else if (p.statusHasil === 'sebagian') statusStr = 'Sebagian';
      else statusStr = 'Selesai';
      
      items.push({
        id: `panen_${p.id}`,
        type: 'panen',
        lahan_id: p.lahanId,
        lahan_name: p.namaLahan,
        message: `Panen ${p.varietas} di ${p.namaLahan} selesai — ${p.beratPanen} kg, kualitas ${statusStr}`,
        timestamp: timestamp,
        severity: 'success'
      });
    });

    // 4. Checklist mitigasi selesai
    const completedLogsByLandAndDate: Record<string, Record<string, { logs: any[], maxTime: string }>> = {};

    allActivityLogs.forEach(log => {
      if (!log.is_completed) return;
      const landId = log.land_id;
      const dateStr = new Date(log.created_at).toISOString().split('T')[0];
      
      if (!completedLogsByLandAndDate[landId]) {
        completedLogsByLandAndDate[landId] = {};
      }
      if (!completedLogsByLandAndDate[landId][dateStr]) {
        completedLogsByLandAndDate[landId][dateStr] = { logs: [], maxTime: log.created_at };
      }
      
      completedLogsByLandAndDate[landId][dateStr].logs.push(log);
      if (new Date(log.created_at) > new Date(completedLogsByLandAndDate[landId][dateStr].maxTime)) {
        completedLogsByLandAndDate[landId][dateStr].maxTime = log.created_at;
      }
    });

    Object.entries(completedLogsByLandAndDate).forEach(([landId, dates]) => {
      const land = lahans.find(l => l.id === landId);
      if (!land) return;

      const isExtremeWeather = land.ketinggian > 800 && land.curahHujan > 250;
      const requiredItems = isExtremeWeather 
        ? ['Buka katup drainase sawah', 'Pemangkasan daun terbawah', 'Semprotkan fungisida organik', 'Monitor tanggul bedengan']
        : ['Irigasi Harian Terjadwal', 'Pembersihan Parit', 'Pengecekan Mulsa Lahan'];

      Object.entries(dates).forEach(([dateStr, data]) => {
        const completedRequired = requiredItems.filter(item => 
          data.logs.some(log => log.activity_name === item)
        ).length;

        if (completedRequired === requiredItems.length) {
          items.push({
            id: `checklist_${landId}_${dateStr}`,
            type: 'checklist',
            lahan_id: landId,
            lahan_name: land.nama,
            message: `Checklist mitigasi ${land.nama} diselesaikan`,
            timestamp: data.maxTime,
            severity: 'success'
          });
        }
      });
    });

    // 5. Analisis kelayakan selesai
    allStressTests.forEach(test => {
      const landName = lahans.find(l => l.id === test.lahan_id)?.nama || 'Lahan';
      items.push({
        id: `analisis_${test.id}`,
        type: 'analisis',
        lahan_id: test.lahan_id,
        lahan_name: landName,
        message: `Analisis kelayakan ${landName} selesai — Skor: ${Math.round(test.skor_skenario)}%`,
        timestamp: test.created_at,
        severity: test.skor_skenario >= 75 ? 'success' : test.skor_skenario >= 50 ? 'info' : 'warning'
      });
    });

    return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };


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

  // Trigger animation for the suitability circular progress bar when mounting Step 2
  useEffect(() => {
    if (activeStep === 2) {
      setAnimateProgress(false);
      const timer = setTimeout(() => {
        setAnimateProgress(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeStep]);

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

  // Check if user has just confirmed their email address
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('confirmed') === 'true') {
        showAlertModal(
          'Email Berhasil Diverifikasi',
          'Alamat email Anda telah berhasil dikonfirmasi! Selamat menggunakan EcoTani.',
          'success'
        );
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    }
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
      const [fetchedLahans, fetchedPanens, fetchedCrops, fetchedScenarios] = await Promise.all([
        getLahans(userId),
        getRiwayatPanens(userId),
        getTanamanList(),
        getClimateScenarios()
      ]);

      const landIds = fetchedLahans.map(l => l.id);
      let fetchedLogs: any[] = [];
      let fetchedStressTests: any[] = [];
      
      if (landIds.length > 0) {
        const [logs, stressTests] = await Promise.all([
          getActivityLogsForLands(landIds),
          getStressTestResultsForLands(landIds)
        ]);
        fetchedLogs = logs;
        fetchedStressTests = stressTests;
      }

      setLahans(fetchedLahans);
      setPanens(fetchedPanens);
      setCropsList(fetchedCrops);
      setClimateScenarios(fetchedScenarios);
      setAllActivityLogs(fetchedLogs);
      setAllStressTests(fetchedStressTests);
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
      setShowOnboarding(true);
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

  const handleExecuteStressTest = async (activeCrop: any, normalScore: number) => {
    if (!selectedScenario || !selectedLahan || !activeCrop) return;
    setIsSimulating(true);
    try {
      const normalLahan = liveWeather ? { ...selectedLahan, suhu: liveWeather.suhu, curahHujan: liveWeather.curahHujan } : selectedLahan;
      const hasilSimulasi = runStressTest(normalLahan, activeCrop, selectedScenario);

      const savedId = await saveStressTestResult(
        selectedLahan.id,
        selectedScenario.id,
        normalScore,
        hasilSimulasi
      );

      setStressTestResult(hasilSimulasi);
      setStressTestId(savedId);
      setIsStressTestModalOpen(false);
    } catch (e) {
      console.error('Error running stress test:', e);
      await showAlertModal('Error', 'Gagal menjalankan simulasi iklim.', 'error');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleStressTestDecision = async (keputusan: 'tetap_tanam' | 'pilih_alternatif') => {
    if (!stressTestId || !selectedLahan) return;

    setDataLoading(true);
    const success = await updateUserDecision(stressTestId, keputusan);
    setDataLoading(false);

    if (success) {
      if (keputusan === 'tetap_tanam') {
        const activeCrop = cropsList.find(c => c.id === selectedCropId) || null;
        handleConfirmTanam(selectedCropId, stressTestResult?.saranMitigasi || (activeCrop ? evaluasiLahanDinamis(selectedLahan, activeCrop).saranMitigasi : ''));
      } else {
        // Go to alternatives
        setActiveStep(5);
      }
    } else {
      await showAlertModal('Gagal', 'Gagal memperbarui keputusan simulasi.', 'error');
    }
  };

  const handleResetStressTest = () => {
    setStressTestResult(null);
    setStressTestId(null);
    setSelectedScenario(null);
    setIsStressTestModalOpen(false);
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
  // VIEW: ONBOARDING WIZARD
  // ==========================================================================
  if (showOnboarding) {
    return (
      <div className="min-h-screen bg-bg-dark flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden bg-[radial-gradient(circle_at_center,rgba(0,168,89,0.06),transparent_50%)]">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#00a85908_1px,transparent_1px),linear-gradient(to_bottom,#00a85908_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_0%,#000_40%,transparent_100%)]"></div>
        </div>
        
        <div className="w-full max-w-lg bg-bg-card border border-border-medium rounded-3xl p-6 md:p-8 shadow-2xl relative z-10 text-center flex flex-col justify-between min-h-[460px] animate-fade-in">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] uppercase font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full tracking-wider">Panduan Mulai Cepat</span>
            <span className="text-xs text-text-muted font-semibold">{onboardingStep} dari 3</span>
          </div>

          {/* Slide 1 */}
          {onboardingStep === 1 && (
            <div className="space-y-4 my-auto">
              <div className="flex justify-center">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-primary shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                  <Map className="w-12 h-12" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-text-main flex items-center justify-center gap-1.5"><span>1. Tambah & Petakan Lahan Sawah</span> <Map className="w-4.5 h-4.5 text-primary-light" /></h3>
              <p className="text-xs text-text-muted leading-relaxed max-w-sm mx-auto">
                Gambarkan batas wilayah sawah Anda secara interaktif di peta. Sistem geospatial kami akan mendeteksi koordinat lintang/bujur dan mengimpor data **ketinggian (mdpl)**, **suhu**, serta **curah hujan** secara otomatis tanpa pengisian manual.
              </p>
            </div>
          )}

          {/* Slide 2 */}
          {onboardingStep === 2 && (
            <div className="space-y-4 my-auto">
              <div className="flex justify-center">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-primary shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                  <Sprout className="w-12 h-12" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-text-main flex items-center justify-center gap-1.5"><span>2. Analisis Kelayakan & Mitigasi</span> <Sprout className="w-4.5 h-4.5 text-primary-light" /></h3>
              <p className="text-xs text-text-muted leading-relaxed max-w-sm mx-auto">
                Gunakan fitur **Cek Kelayakan** dengan alur 5-Step Stepper interaktif. Sistem mencocokkan kondisi fisik tanah (pH, lereng, tipe drainase) dan kondisi iklim mikro dengan syarat tumbuh tanaman untuk meminimalkan risiko gagal tanam.
              </p>
            </div>
          )}

          {/* Slide 3 */}
          {onboardingStep === 3 && (
            <div className="space-y-4 my-auto">
              <div className="flex justify-center">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-primary shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                  <Activity className="w-12 h-12" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-text-main flex items-center justify-center gap-1.5"><span>3. Pantau Lahan & Catat Hasil Panen</span> <TrendingUp className="w-4.5 h-4.5 text-primary-light" /></h3>
              <p className="text-xs text-text-muted leading-relaxed max-w-sm mx-auto">
                Setelah ditanam, Anda dapat memantau iklim lokal secara real-time, mengikuti checklist tindakan pemeliharaan harian, serta merekam performa keuntungan hasil ke dalam database **Riwayat Panen** Anda.
              </p>
            </div>
          )}

          {/* Slide Indicator Dots */}
          <div className="flex justify-center gap-1.5 mt-6 mb-4">
            {[1, 2, 3].map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => setOnboardingStep(step)}
                className={`w-2 h-2 rounded-full transition-all ${
                  onboardingStep === step ? 'bg-primary w-4' : 'bg-border-medium'
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 border-t border-border-light pt-4 mt-auto">
            {onboardingStep > 1 && (
              <button
                type="button"
                onClick={() => setOnboardingStep(prev => prev - 1)}
                className="py-3 px-4 rounded-xl border border-border-medium hover:bg-border-light text-text-muted font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Kembali</span>
              </button>
            )}
            {onboardingStep < 3 ? (
              <button
                type="button"
                onClick={() => setOnboardingStep(prev => prev + 1)}
                className="flex-1 py-3 px-4 rounded-xl bg-primary hover:bg-primary-dark text-text-inverse font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Lanjutkan</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowOnboarding(false)}
                className="flex-1 py-3 px-4 rounded-xl bg-primary hover:bg-primary-dark text-text-inverse font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer font-extrabold shadow-lg shadow-primary/20"
              >
                <span>Mulai Gunakan EcoTani</span>
                <Sprout className="w-4 h-4" />
              </button>
            )}
          </div>
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
    const activeCrop = cropsList.find(c => c.id === selectedCropId) || null;
    const evalResult = activeCrop 
      ? evaluasiLahanDinamis(lahanToEvaluate, activeCrop) 
      : { layak: false, skor: 0, skorPotensial: 0, kendala: [], siklusPemupukan: [], kebutuhanAirDaily: 5, saranMitigasi: '', details: [] };
    const alternatifList = cropsList.length > 0 ? cariAlternatifDinamis(lahanToEvaluate, cropsList) : [];
    const filteredCrops = cropsList.filter(crop => {
      const matchSearch = crop.nama.toLowerCase().includes(cropSearchQuery.toLowerCase()) ||
                          (crop.nama_latin && crop.nama_latin.toLowerCase().includes(cropSearchQuery.toLowerCase()));
      const matchKategori = selectedKategori ? (crop.kategori || 'Lainnya') === selectedKategori : true;
      return matchSearch && matchKategori;
    });
    
    const uniqueKategori = Array.from(new Set(cropsList.map(c => c.kategori || 'Lainnya'))).sort((a, b) => {
      if (a === 'Lainnya') return 1;
      if (b === 'Lainnya') return -1;
      return a.localeCompare(b);
    });

    // Compute tactical mitigations
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
          mitigasiTaktis.push({ label: detail.label, parameter: detail.parameter, rating: detail.rating, text });
        }
      });
    }

    // Categorized mitigations for Step 4
    const suhuIklimItems = mitigasiTaktis.filter(m => m.parameter === 'temperatur' || m.parameter === 'curah_hujan' || m.parameter === 'ketinggian');
    const drainaseItems = mitigasiTaktis.filter(m => m.parameter === 'drainase');
    const tanahItems = mitigasiTaktis.filter(m => m.parameter === 'ph_tanah' || m.parameter === 'tekstur_tanah');
    const lerengItems = mitigasiTaktis.filter(m => m.parameter === 'lereng');

    // Constraint summary for Step 2
    const mainConstraint = evalResult.kendala[0] || '';
    const isClimateAnomaly = mainConstraint.toLowerCase().includes('suhu') || 
                             mainConstraint.toLowerCase().includes('temperatur') || 
                             mainConstraint.toLowerCase().includes('curah') || 
                             mainConstraint.toLowerCase().includes('hujan');

    // Circular gauge calculations for Step 2
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const score = evalResult.skor;
    const potentialScore = evalResult.skorPotensial || score;
    const currentScore = animateProgress ? score : 0;
    const currentPotentialScore = animateProgress ? potentialScore : 0;
    const strokeDashoffset = circumference - (currentScore / 100) * circumference;
    const potentialDashoffset = circumference - (currentPotentialScore / 100) * circumference;
    const strokeColor = score >= 75 ? '#2e7d32' : score >= 50 ? '#d97706' : '#dc2626';

    const parameterExplanations: Record<string, string> = {
      temperatur: 'Suhu mempengaruhi respirasi, laju transpirasi, dan fotosintesis tanaman. Suhu di luar batas ideal menghambat pengisian bulir/buah.',
      curah_hujan: 'Curah hujan menentukan ketersediaan air alami. Curah hujan terlalu tinggi memicu banjir dan kelembapan tinggi (penyakit), sedangkan kekeringan menghentikan pertumbuhan.',
      ph_tanah: 'pH tanah mempengaruhi ketersediaan unsur hara makro dan mikro bagi perakaran. Pada pH ekstrem, unsur hara penting terikat kuat dan tidak dapat diserap tanaman.',
      ketinggian: 'Ketinggian menentukan tekanan udara dan suhu lingkungan secara makro. Menanam di ketinggian tidak cocok memicu kegagalan adaptasi vegetatif.',
      lereng: 'Lereng mempengaruhi limpasan air hujan dan risiko erosi topsoil. Lereng curam memerlukan terasering/sengkedan.',
      drainase: 'Drainase mengatur sirkulasi oksigen di zona perakaran. Drainase yang buruk memicu genangan air berkepanjangan (anoksia akar) dan busuk akar.',
      tekstur_tanah: 'Tekstur tanah menentukan daya ikat air dan sirkulasi udara (aerasi). Tanah berpasir terlalu kering (nutrisi hanyut), sedangkan tanah liat berat cenderung padat.'
    };

    const steps = [
      { number: 1, label: 'Komoditas' },
      { number: 2, label: 'Kelayakan' },
      { number: 3, label: 'Parameter' },
      { number: 4, label: 'Mitigasi' },
      { number: 5, label: 'Konfirmasi' }
    ];

    return (
      <div className="min-h-screen bg-bg-dark py-8 px-4">
        <div className="max-w-3xl mx-auto bg-bg-card border border-border-medium rounded-3xl p-6 md:p-8 shadow-2xl">
          <button 
            onClick={() => {
              setCurrentView('dashboard');
              setSelectedLahan(null);
              setActiveStep(1);
              handleResetStressTest();
            }}
            className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-main mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Dashboard</span>
          </button>

          <h2 className="text-2xl font-bold text-text-main mb-1">Cek Kelayakan Lahan Tanam</h2>
          <p className="text-sm text-text-muted mb-6">
            Menilai kesesuaian lahan <strong className="text-text-main">{selectedLahan.nama}</strong> berdasarkan parameter geospasial tanah dan iklim.
            {liveWeather && (
              <span className="block mt-1 text-primary flex items-center gap-1">
                <CloudRain className="w-3.5 h-3.5" /> Terhubung dengan data cuaca live ({liveWeather.suhu}°C, {liveWeather.curahHujan} mm/bln)
              </span>
            )}
          </p>

          {/* SLEEK STEPPER INDICATOR */}
          <div className="mb-8">
            <div className="flex items-center justify-between relative">
              {/* Background Line */}
              <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-white/10 -translate-y-1/2 z-0" />
              {/* Active Progress Line */}
              <div 
                className="absolute top-1/2 left-0 h-[2px] bg-gradient-to-r from-primary to-primary-light -translate-y-1/2 z-0 transition-all duration-300"
                style={{ width: `${((activeStep - 1) / (steps.length - 1)) * 100}%` }}
              />
              
              {steps.map((s) => {
                const isCompleted = activeStep > s.number;
                const isActive = activeStep === s.number;
                return (
                  <div key={s.number} className="relative z-10 flex flex-col items-center">
                    <button
                      type="button"
                      disabled={s.number > activeStep && !selectedCropId}
                      onClick={() => {
                        if (s.number <= activeStep || selectedCropId) {
                          setActiveStep(s.number);
                        }
                      }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 border ${
                        isCompleted ? 'bg-primary border-primary text-text-inverse shadow-md shadow-primary/20' :
                        isActive ? 'bg-bg-card border-primary text-primary ring-4 ring-primary/20 scale-110' :
                        'bg-bg-dark border-white/10 text-text-muted'
                      }`}
                    >
                      {isCompleted ? '✓' : s.number}
                    </button>
                    <span className={`text-[10px] font-semibold mt-2 hidden sm:inline ${
                      isActive ? 'text-primary' : isCompleted ? 'text-text-main' : 'text-text-muted'
                    }`}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* STEP CONTENT CONTAINER */}
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {/* STEP 1: PILIH KOMODITAS */}
              {activeStep === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="bg-bg-dark border border-border-medium rounded-2xl p-5">
                    
                    {/* DROPDOWN KATEGORI */}
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Pilih Kategori</label>
                    <div className="relative mb-6">
                      <button
                        type="button"
                        onClick={() => setIsKategoriDropdownOpen(!isKategoriDropdownOpen)}
                        className={`w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-3 text-left focus:outline-none focus:border-primary transition-all text-sm flex justify-between items-center ${selectedKategori ? 'text-white font-bold' : 'text-text-muted font-normal'}`}
                      >
                        <span>{selectedKategori || 'Pilih Kategori...'}</span>
                        <ChevronDown className={`w-4 h-4 transform transition-transform duration-200 ${isKategoriDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isKategoriDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsKategoriDropdownOpen(false)} />
                          <div className="absolute z-50 mt-2 w-full bg-bg-card border border-border-medium rounded-xl shadow-2xl p-2 space-y-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedKategori('');
                                setIsKategoriDropdownOpen(false);
                                setSelectedCropId('');
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                                selectedKategori === '' ? 'bg-primary/20 border border-primary text-white font-bold' : 'hover:bg-white/5 text-text-muted hover:text-text-main'
                              }`}
                            >
                              Semua Kategori
                            </button>
                            {uniqueKategori.map(kat => (
                              <button
                                key={kat}
                                type="button"
                                onClick={() => {
                                  setSelectedKategori(kat);
                                  setIsKategoriDropdownOpen(false);
                                  setSelectedCropId('');
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                                  kat === selectedKategori ? 'bg-primary/20 border border-primary text-white font-bold' : 'hover:bg-white/5 text-text-muted hover:text-text-main'
                                }`}
                              >
                                {kat}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {/* DROPDOWN KOMODITAS */}
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Pilih Komoditas Tanaman</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsCropDropdownOpen(!isCropDropdownOpen)}
                        className={`w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-3 text-left focus:outline-none focus:border-primary transition-all text-sm flex justify-between items-center ${activeCrop ? 'text-white font-bold' : 'text-text-muted font-normal'}`}
                      >
                        <span>
                          {activeCrop ? `${activeCrop.nama} ${activeCrop.nama_latin ? `(${activeCrop.nama_latin})` : ''}` : 'Pilih Komoditas Tanaman...'}
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
                                      handleResetStressTest();
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
                  
                  <div className="flex justify-end pt-4">
                    <button
                      type="button"
                      disabled={!selectedCropId && !activeCrop}
                      onClick={() => {
                        if (selectedCropId || activeCrop) {
                          if (!selectedCropId && activeCrop) {
                            setSelectedCropId(activeCrop.id);
                          }
                          setActiveStep(2);
                        }
                      }}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-primary-dark text-text-inverse font-bold text-sm transition-all text-center flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary disabled:shadow-none"
                    >
                      <span>Analisis Kelayakan Lahan</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: HASIL KELAYAKAN */}
              {activeStep === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="flex flex-col items-center justify-center p-6 bg-bg-dark border border-border-light rounded-2xl">
                    <span className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Skor Kecocokan</span>
                    
                    {/* Gauge */}
                    <div className="relative w-40 h-40">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                        <circle
                          cx="60"
                          cy="60"
                          r="50"
                          className="stroke-white/5"
                          strokeWidth="8"
                          fill="transparent"
                        />
                        {potentialScore > score && (
                          <circle
                            cx="60"
                            cy="60"
                            r="50"
                            className="transition-all duration-1000 ease-out"
                            stroke={strokeColor}
                            strokeWidth="8"
                            strokeDasharray={circumference}
                            strokeDashoffset={potentialDashoffset}
                            strokeLinecap="round"
                            opacity="0.3"
                            fill="transparent"
                          />
                        )}
                        <circle
                          cx="60"
                          cy="60"
                          r="50"
                          className="transition-all duration-1000 ease-out"
                          stroke={strokeColor}
                          strokeWidth="8"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                          fill="transparent"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-3xl font-extrabold text-white">{score}%</span>
                        {potentialScore > score && (
                          <span className="text-[9px] text-primary-light font-bold mt-0.5">Potensi: {potentialScore}%</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                        score >= 75 ? 'bg-primary-dark/20 text-primary border-primary/20' :
                        score >= 50 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                        'bg-red-500/10 text-red-500 border-red-500/20'
                      }`}>
                        {score >= 75 ? 'Lahan Sangat Layak' : score >= 50 ? 'Cukup Layak (Butuh Mitigasi)' : 'Tidak Layak / Berisiko'}
                      </span>
                    </div>
                  </div>

                  {/* Constraint summary & Climate change positioning */}
                  <div className="bg-bg-dark border border-border-light rounded-2xl p-5 space-y-4">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-text-muted">Ringkasan Kendala Utama</h4>
                    {mainConstraint ? (
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-text-main leading-relaxed">
                          {mainConstraint}
                        </p>
                        {isClimateAnomaly && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            <span>Dipengaruhi Anomali Iklim</span>
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-text-muted">Selamat! Parameter lingkungan terdeteksi sangat cocok dengan kebutuhan varietas tanaman ini.</p>
                    )}
                  </div>

                  {/* Simulasi Musim Sulit Section */}
                  <div className="bg-bg-dark border border-border-light rounded-2xl p-5 space-y-4 mt-6">
                    <div className="flex flex-col">
                      <h4 className="font-bold text-sm text-text-main">Simulasi Musim Sulit</h4>
                      <span className="text-xs text-text-muted">Bagaimana jika iklim berubah ekstrem?</span>
                    </div>

                    {/* Skenario Pilihan */}
                    {climateScenarios.length > 0 && !stressTestResult && (
                      <div className="flex flex-col sm:flex-row gap-3">
                        {climateScenarios.map((scenario) => {
                          const isHot = scenario.nama_skenario.toLowerCase().includes('panas') || scenario.nama_skenario.toLowerCase().includes('nino');
                          const isSelected = selectedScenario?.id === scenario.id;
                          return (
                            <button
                              key={scenario.id}
                              type="button"
                              onClick={() => {
                                setSelectedScenario(scenario);
                                setIsStressTestModalOpen(true);
                              }}
                              className={`flex-1 py-3 px-4 rounded-xl border font-bold text-xs transition-all text-center flex items-center justify-center gap-2 cursor-pointer ${
                                isSelected 
                                  ? 'bg-primary/20 border-primary text-white' 
                                  : 'bg-bg-card border-white/10 hover:border-primary/50 text-text-main hover:bg-primary/5'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 justify-center">
                                {isHot ? (
                                  <ThermometerSun className="w-4 h-4 text-orange-400 shrink-0" />
                                ) : (
                                  <CloudRain className="w-4 h-4 text-blue-400 shrink-0" />
                                )}
                                <span>{scenario.nama_skenario.split('(')[0].trim()}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Modal/Expandable Card Konfirmasi */}
                    <AnimatePresence>
                      {isStressTestModalOpen && selectedScenario && !stressTestResult && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-bg-card border border-border-medium rounded-xl p-4 space-y-3 overflow-hidden"
                        >
                          <div className="space-y-1">
                            <h5 className="font-bold text-xs uppercase tracking-wider text-text-muted">Konfirmasi Simulasi</h5>
                            <p className="text-xs text-text-main leading-relaxed">{selectedScenario.deskripsi}</p>
                          </div>
                          <div className="bg-bg-dark border border-border-light rounded-xl p-3 flex justify-between items-center text-xs">
                            <div>
                              <span className="text-[10px] text-text-muted block uppercase tracking-wider font-semibold">Modifikasi Suhu</span>
                              <strong className="text-orange-400 font-bold">{selectedScenario.delta_suhu > 0 ? `+${selectedScenario.delta_suhu}` : selectedScenario.delta_suhu} °C</strong>
                            </div>
                            <div className="w-[1px] h-8 bg-white/10" />
                            <div>
                              <span className="text-[10px] text-text-muted block uppercase tracking-wider font-semibold">Modifikasi Curah Hujan</span>
                              <strong className="text-blue-400 font-bold">{selectedScenario.delta_curah_hujan_persen > 0 ? `+${selectedScenario.delta_curah_hujan_persen}` : selectedScenario.delta_curah_hujan_persen} %</strong>
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setIsStressTestModalOpen(false);
                                setSelectedScenario(null);
                              }}
                              className="px-3 py-1.5 rounded-lg border border-border-medium hover:bg-white/5 text-text-muted text-xs font-bold transition-all cursor-pointer"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExecuteStressTest(activeCrop, score)}
                              disabled={isSimulating}
                              className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-orange-600/20"
                            >
                              {isSimulating ? 'Menjalankan...' : 'Jalankan Simulasi'}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Perbandingan Side-by-Side */}
                    <AnimatePresence>
                      {stressTestResult && selectedScenario && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="space-y-4"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Kondisi Normal */}
                            <div className="bg-[#2e7d32]/10 border border-[#2e7d32]/30 rounded-2xl p-4 space-y-2">
                              <span className="text-[10px] text-[#2e7d32] font-extrabold uppercase tracking-wider block">Kondisi Normal</span>
                              <div className="flex justify-between items-baseline">
                                <strong className="text-2xl font-extrabold text-[#2e7d32]">{score}%</strong>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  score >= 75 ? 'bg-primary-dark/20 text-primary border border-primary/20' :
                                  score >= 50 ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                  'bg-red-500/10 text-red-500 border border-red-500/20'
                                }`}>
                                  {score >= 75 ? 'S1' : score >= 50 ? 'S2' : 'N'}
                                </span>
                              </div>
                              <div className="text-xs text-text-muted space-y-1 pt-2 border-t border-white/5">
                                <div className="flex justify-between">
                                  <span>Suhu:</span>
                                  <span className="text-text-main">{liveWeather ? liveWeather.suhu : selectedLahan.suhu} °C</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Curah Hujan:</span>
                                  <span className="text-text-main">{liveWeather ? liveWeather.curahHujan : selectedLahan.curahHujan} mm/bln</span>
                                </div>
                              </div>
                            </div>

                            {/* Kondisi Skenario */}
                            <div className="bg-orange-600/10 border border-orange-500/30 rounded-2xl p-4 space-y-2">
                              <span className="text-[10px] text-orange-400 font-extrabold uppercase tracking-wider block">Skenario {selectedScenario.nama_skenario.split('(')[0].trim()}</span>
                              <div className="flex justify-between items-baseline">
                                <strong className="text-2xl font-extrabold text-orange-400">{stressTestResult.skor}%</strong>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  stressTestResult.skor >= 75 ? 'bg-primary-dark/20 text-primary border border-primary/20' :
                                  stressTestResult.skor >= 50 ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                  'bg-red-500/10 text-red-500 border border-red-500/20'
                                }`}>
                                  {stressTestResult.skor >= 75 ? 'S1' : stressTestResult.skor >= 50 ? 'S2' : 'N'}
                                </span>
                              </div>
                              <div className="text-xs text-text-muted space-y-1 pt-2 border-t border-white/5">
                                {(() => {
                                  const modified = applyScenarioDelta(
                                    liveWeather ? { ...selectedLahan, suhu: liveWeather.suhu, curahHujan: liveWeather.curahHujan } : selectedLahan,
                                    selectedScenario
                                  );
                                  return (
                                    <>
                                      <div className="flex justify-between">
                                        <span>Suhu:</span>
                                        <span className="text-text-main">{modified.suhu} °C</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Curah Hujan:</span>
                                        <span className="text-text-main">{modified.curahHujan} mm/bln</span>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>

                          {/* Delta Message */}
                          {(() => {
                            const diff = score - stressTestResult.skor;
                            if (diff > 0) {
                              return (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-xl p-3 flex items-center gap-1.5">
                                  <AlertTriangle className="w-4 h-4 shrink-0" />
                                  <span>Penurunan skor {diff} poin — lahan ini rentan terhadap {selectedScenario.nama_skenario.split('(')[0].trim()}</span>
                                </div>
                              );
                            } else if (diff < 0) {
                              return (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-xl p-3 flex items-center gap-1.5">
                                  <Sparkles className="w-4 h-4 shrink-0" />
                                  <span>Peningkatan skor {Math.abs(diff)} poin — kondisi ini justru menguntungkan komoditas ini!</span>
                                </div>
                              );
                            } else {
                              return (
                                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-semibold rounded-xl p-3 flex items-center gap-1.5">
                                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                                  <span>Skor kelayakan stabil pada {score}%, namun kondisi ekstrem {selectedScenario.nama_skenario.split('(')[0].trim()} tetap berisiko menimbulkan tekanan iklim (climate stress) pada tanaman dalam jangka panjang. Sangat disarankan menerapkan adaptasi di bawah.</span>
                                </div>
                              );
                            }
                          })()}

                          {/* Rekomendasi Adaptasi */}
                          <div className="bg-bg-card border border-border-medium rounded-xl p-4 space-y-2">
                            <span className="text-xs font-extrabold text-text-main block">Rekomendasi Adaptasi</span>
                            <div className="text-xs text-text-muted space-y-1.5 leading-relaxed">
                              {(() => {
                                const temp = selectedScenario.delta_suhu;
                                const rainPercent = selectedScenario.delta_curah_hujan_persen;
                                const recomms = [];
                                
                                if (temp > 0) {
                                  recomms.push('Naungan & Mulsa: Gunakan jaring naungan (paranet 50-70%) atau mulsa tebal untuk menekan laju penguapan (evapotranspirasi) akibat peningkatan suhu ekstrem.');
                                }
                                if (rainPercent < 0) {
                                  recomms.push('Manajemen Air: Terapkan sistem irigasi tetes (drip irrigation) yang efisien, lakukan penyiraman hanya pada pagi/sore hari, dan kumpulkan cadangan air di embung.');
                                }
                                if (rainPercent > 0) {
                                  recomms.push('Sistem Drainase: Tinggikan bedengan hingga minimal 30 cm, bersihkan saluran air utama dari sedimentasi untuk melancarkan pembuangan air berlebih guna mencegah pembusukan akar.');
                                }

                                if (stressTestResult.kendala && stressTestResult.kendala.length > 0) {
                                  const hasIssue = (param: string) => stressTestResult.kendala.some((k: string) => k.toLowerCase().includes(param));
                                  if (hasIssue('suhu') && temp <= 0) {
                                    recomms.push('Mitigasi Suhu Dingin: Gunakan mulsa penutup tanah untuk menjaga temperatur perakaran tetap hangat.');
                                  }
                                  if (hasIssue('curah hujan') && rainPercent === 0) {
                                    recomms.push('Mitigasi Hujan Rendah: Gunakan irigasi air permukaan cadangan untuk menjaga kelembapan perakaran.');
                                  }
                                }

                                return (
                                  <div className="space-y-1.5">
                                    {recomms.map((rec, i) => (
                                      <div key={i} className="flex gap-2">
                                        <span className="text-primary font-bold">•</span>
                                        <span>{rec}</span>
                                      </div>
                                    ))}
                                    {recomms.length === 0 && (
                                      <p className="text-emerald-400 flex items-center gap-1.5">
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Tidak diperlukan penyesuaian khusus untuk skenario iklim ini.</span>
                                      </p>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Tombol Keputusan */}
                          <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <button
                              type="button"
                              onClick={() => handleStressTestDecision('tetap_tanam')}
                              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all text-center cursor-pointer shadow-lg shadow-emerald-600/20"
                            >
                              Tetap Tanam Komoditas Ini
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStressTestDecision('pilih_alternatif')}
                              className="flex-1 py-3 px-4 rounded-xl bg-teal-950/40 hover:bg-teal-900/60 border border-teal-500/30 text-teal-300 text-xs font-bold transition-all text-center cursor-pointer shadow-lg shadow-teal-950/20"
                            >
                              Pilih Alternatif
                            </button>
                            <button
                              type="button"
                              onClick={handleResetStressTest}
                              className="py-3 px-5 rounded-xl border border-border-medium hover:bg-white/5 text-text-muted text-xs font-bold transition-all text-center cursor-pointer"
                            >
                              Uji Skenario Lain
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: DETAIL PARAMETER */}
              {activeStep === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {evalResult.details && evalResult.details.length > 0 ? (
                    <div className="bg-bg-dark border border-border-light rounded-2xl p-5 shadow-inner">
                      <h4 className="font-bold text-text-main text-sm mb-4 flex items-center gap-2">
                        <Activity className="w-4.5 h-4.5 text-primary" />
                        <span>Detail Perbandingan Parameter</span>
                      </h4>
                      <p className="text-[10px] text-text-muted mb-4 flex items-center gap-1">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Klik pada baris parameter untuk melihat penjelasan detail.</span>
                      </p>
                      
                      <div className="overflow-x-auto rounded-xl border border-white/5">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-white/5 border-b border-white/10 text-[10px] uppercase font-bold text-text-muted">
                              <th className="p-3">Parameter</th>
                              <th className="p-3">Aktual</th>
                              <th className="p-3">Batas Ideal</th>
                              <th className="p-3 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {evalResult.details.map((detail: any, index: number) => {
                              const isExpanded = expandedRow === detail.parameter;
                              const isN = detail.rating === 'N';
                              const isS3 = detail.rating === 'S3';
                              const isS2 = detail.rating === 'S2';
                              
                              let ratingBadgeColor = '';
                              if (isN) ratingBadgeColor = 'bg-red-500/10 text-red-400 border border-red-500/20';
                              else if (isS3) ratingBadgeColor = 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
                              else if (isS2) ratingBadgeColor = 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
                              else ratingBadgeColor = 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';

                              return (
                                <Fragment key={`param-fragment-${index}`}>
                                  <tr 
                                    onClick={() => setExpandedRow(isExpanded ? null : detail.parameter)}
                                    className="hover:bg-white/5 transition-colors cursor-pointer"
                                  >
                                    <td className="p-3 font-bold text-text-main flex items-center gap-1.5">
                                      <span>{detail.label}</span>
                                      <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                    </td>
                                    <td className="p-3 text-text-muted font-medium">{detail.actual}</td>
                                    <td className="p-3 text-text-muted font-medium">{detail.ideal}</td>
                                    <td className="p-3 text-right">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ratingBadgeColor}`}>
                                        {detail.rating}
                                      </span>
                                    </td>
                                  </tr>
                                  
                                  {isExpanded && (
                                    <tr className="bg-white/[0.02]">
                                      <td colSpan={4} className="p-3 border-t border-white/[0.02]">
                                        <p className="text-[11px] text-text-muted leading-relaxed font-medium">
                                          {parameterExplanations[detail.parameter] || 'Parameter penting untuk menentukan pertumbuhan tanaman.'}
                                        </p>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-xs text-text-muted">Detail parameter tidak tersedia.</div>
                  )}
                </motion.div>
              )}

              {/* STEP 4: RENCANA MITIGASI */}
              {activeStep === 4 && (
                <motion.div
                  key="step-4"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <h4 className="font-bold text-text-main text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />
                      <span>Rencana Perawatan & Mitigasi Taktis</span>
                    </h4>

                    <div className="space-y-2">
                      {/* Category Suhu */}
                      <div className="bg-bg-dark border border-border-light rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setActiveCategory(activeCategory === 'Suhu' ? '' : 'Suhu')}
                          className="w-full flex items-center justify-between p-4 font-bold text-xs text-text-main hover:bg-white/5 transition-colors text-left"
                        >
                          <span className="flex items-center gap-2">
                            <ThermometerSun className="w-4 h-4 text-orange-400" />
                            <span>1. Suhu, Iklim & Kebutuhan Air</span>
                          </span>
                          <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-200 ${activeCategory === 'Suhu' ? 'rotate-180' : ''}`} />
                        </button>
                        {activeCategory === 'Suhu' && (
                          <div className="p-4 border-t border-white/5 bg-white/[0.01] space-y-4 text-xs text-text-muted">
                            <div className="bg-bg-card p-3 rounded-lg border border-border-medium flex justify-between items-center">
                              <div>
                                <span className="text-[10px] text-text-muted block mb-0.5 uppercase tracking-wider font-semibold">Estimasi Air Harian</span>
                                <strong className="text-text-main text-xs">{(evalResult.kebutuhanAirDaily * selectedLahan.luas).toLocaleString('id-ID')} Liter/Hari</strong>
                              </div>
                              <span className="text-[10px] text-gray-500">({evalResult.kebutuhanAirDaily} L/m²)</span>
                            </div>
                            {suhuIklimItems.length > 0 ? (
                              <div className="space-y-3">
                                {suhuIklimItems.map((item, idx) => (
                                  <div key={idx} className="space-y-1">
                                    <span className="font-semibold text-text-main">{item.label}</span>
                                    <p className="leading-relaxed">{item.text}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-emerald-400 flex items-start gap-1.5 leading-relaxed">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <span>Parameter suhu dan curah hujan sangat ideal untuk komoditas ini. Tidak perlu langkah mitigasi iklim khusus.</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Category Drainase */}
                      <div className="bg-bg-dark border border-border-light rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setActiveCategory(activeCategory === 'Drainase' ? '' : 'Drainase')}
                          className="w-full flex items-center justify-between p-4 font-bold text-xs text-text-main hover:bg-white/5 transition-colors text-left"
                        >
                          <span className="flex items-center gap-2">
                            <Droplet className="w-4 h-4 text-blue-400" />
                            <span>2. Sistem Drainase Lahan</span>
                          </span>
                          <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-200 ${activeCategory === 'Drainase' ? 'rotate-180' : ''}`} />
                        </button>
                        {activeCategory === 'Drainase' && (
                          <div className="p-4 border-t border-white/5 bg-white/[0.01] space-y-3 text-xs text-text-muted">
                            {drainaseItems.length > 0 ? (
                              <div className="space-y-3">
                                {drainaseItems.map((item, idx) => (
                                  <div key={idx} className="space-y-1">
                                    <span className="font-semibold text-text-main">{item.label}</span>
                                    <p className="leading-relaxed">{item.text}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-emerald-400 flex items-start gap-1.5 leading-relaxed">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <span>Kondisi drainase lahan Anda dinilai sangat baik (S1).</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Category Tanah */}
                      <div className="bg-bg-dark border border-border-light rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setActiveCategory(activeCategory === 'Tanah' ? '' : 'Tanah')}
                          className="w-full flex items-center justify-between p-4 font-bold text-xs text-text-main hover:bg-white/5 transition-colors text-left"
                        >
                          <span className="flex items-center gap-2">
                            <Sprout className="w-4 h-4 text-emerald-400" />
                            <span>3. Tanah, pH & Siklus Pemupukan</span>
                          </span>
                          <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-200 ${activeCategory === 'Tanah' ? 'rotate-180' : ''}`} />
                        </button>
                        {activeCategory === 'Tanah' && (
                          <div className="p-4 border-t border-white/5 bg-white/[0.01] space-y-4 text-xs text-text-muted">
                            <div className="space-y-2">
                              <span className="text-[10px] text-text-main block uppercase tracking-wider font-extrabold flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-primary" /> Rencana Jadwal Pemupukan
                              </span>
                              <div className="space-y-1.5 pl-1.5 border-l border-primary/30">
                                {evalResult.siklusPemupukan.map((step, i) => (
                                  <div key={i} className="flex gap-2 text-text-muted">
                                    <span className="text-primary font-bold">•</span>
                                    <span>{step}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            {tanahItems.length > 0 && (
                              <div className="space-y-3 pt-3 border-t border-white/5">
                                {tanahItems.map((item, idx) => (
                                  <div key={idx} className="space-y-1">
                                    <span className="font-semibold text-text-main">{item.label}</span>
                                    <p className="leading-relaxed">{item.text}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Category Lereng */}
                      <div className="bg-bg-dark border border-border-light rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setActiveCategory(activeCategory === 'Lereng' ? '' : 'Lereng')}
                          className="w-full flex items-center justify-between p-4 font-bold text-xs text-text-main hover:bg-white/5 transition-colors text-left"
                        >
                          <span className="flex items-center gap-2">
                            <MapIcon className="w-4 h-4 text-lime-400" />
                            <span>4. Kemiringan Lereng & Erosi</span>
                          </span>
                          <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-200 ${activeCategory === 'Lereng' ? 'rotate-180' : ''}`} />
                        </button>
                        {activeCategory === 'Lereng' && (
                          <div className="p-4 border-t border-white/5 bg-white/[0.01] space-y-3 text-xs text-text-muted">
                            {lerengItems.length > 0 ? (
                              <div className="space-y-3">
                                {lerengItems.map((item, idx) => (
                                  <div key={idx} className="space-y-1">
                                    <span className="font-semibold text-text-main">{item.label}</span>
                                    <p className="leading-relaxed">{item.text}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-emerald-400 flex items-start gap-1.5 leading-relaxed">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <span>Kemiringan lereng lahan aman (datar, &lt;3%). Risiko erosi minimal.</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 5: ALTERNATIF & KONFIRMASI */}
              {activeStep === 5 && (
                <motion.div
                  key="step-5"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {/* Alternatives (Grouped into 3 categories: Green, Yellow, Red) */}
                  {evalResult.skor < 90 && alternatifList.filter(a => a.tanaman.id !== selectedCropId).length > 0 && (
                    <div className="bg-bg-dark border border-border-light rounded-2xl p-5 space-y-4 shadow-md">
                      <h4 className="font-bold text-text-main text-sm flex items-center gap-2 border-b border-white/5 pb-2.5">
                        <TrendingUp className="w-4.5 h-4.5 text-primary" />
                        <span>Analisis Alternatif Komoditas Lainnya</span>
                      </h4>
                      <div className="space-y-3">
                        {(() => {
                          const altFiltered = alternatifList.filter(a => a.tanaman.id !== selectedCropId);
                          const ijoItems = altFiltered.filter(a => a.evaluasi.skor >= 80);
                          const kuningItems = altFiltered.filter(a => a.evaluasi.skor >= 50 && a.evaluasi.skor < 80);
                          const merahItems = altFiltered.filter(a => a.evaluasi.skor < 50);

                          const altGroups = [
                            { 
                              id: 'ijo', 
                              label: 'Sesuai (Skor 80-100)', 
                              items: ijoItems, 
                              badgeColor: 'text-green-500 bg-green-500/10',
                              borderColor: 'hover:border-green-500/40',
                              scoreColor: 'text-green-400 bg-green-500/10 border-green-500/20',
                              buttonColor: 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20'
                            },
                            { 
                              id: 'kuning', 
                              label: 'Cukup Sesuai / Marginal (Skor 50-79)', 
                              items: kuningItems, 
                              badgeColor: 'text-yellow-500 bg-yellow-500/10',
                              borderColor: 'hover:border-yellow-500/40',
                              scoreColor: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
                              buttonColor: 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border-yellow-500/20'
                            },
                            { 
                              id: 'merah', 
                              label: 'Tidak Direkomendasikan (Skor < 50)', 
                              items: merahItems, 
                              badgeColor: 'text-red-500 bg-red-500/10',
                              borderColor: 'hover:border-red-500/40',
                              scoreColor: 'text-red-400 bg-red-500/10 border-red-500/20',
                              buttonColor: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                            }
                          ].filter(g => g.items.length > 0);

                          return altGroups.map(group => (
                            <div key={group.id} className="border border-border-medium rounded-xl overflow-hidden shadow-sm">
                              <button
                                type="button"
                                onClick={() => setOpenAltGroup(openAltGroup === group.id ? '' : group.id)}
                                className="w-full flex items-center justify-between p-3.5 bg-bg-card hover:bg-white/5 transition-colors text-left"
                              >
                                <span className="font-semibold text-xs text-text-main">
                                  {group.label} 
                                  <span className={`${group.badgeColor} px-2 py-0.5 rounded-full ml-2 text-[10px] font-bold`}>
                                    {group.items.length} opsi
                                  </span>
                                </span>
                                <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-200 ${openAltGroup === group.id ? 'rotate-180' : ''}`} />
                              </button>
                              
                              <AnimatePresence>
                                {openAltGroup === group.id && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="bg-bg-dark border-t border-border-medium overflow-hidden"
                                  >
                                    <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                                      {group.items.map(alt => (
                                        <div key={alt.tanaman.id} className={`flex items-center justify-between p-3 bg-bg-card border border-border-medium rounded-xl text-xs ${group.borderColor} hover:shadow-md transition-all`}>
                                          <div className="space-y-1">
                                            <strong className="text-text-main text-sm block">{alt.tanaman.nama}</strong>
                                            <span className="text-text-muted block text-[10px]">Estimasi panen: {alt.tanaman.siklus_tanam_days || 120} hari</span>
                                          </div>
                                          <div className="flex items-center gap-4">
                                            <span className={`${group.scoreColor} font-semibold px-2 py-1 rounded border`}>Kecocokan: {alt.evaluasi.skor}%</span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setSelectedCropId(alt.tanaman.id);
                                                setActiveStep(1);
                                                handleResetStressTest();
                                              }}
                                              className={`${group.buttonColor} shadow-sm border font-bold py-1.5 px-3 rounded-lg transition-all text-xs cursor-pointer`}
                                            >
                                              Pilih
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Final Confirmation Buttons */}
                  <div className="flex gap-4 border-t border-border-light pt-6 mt-8">
                    <button 
                      onClick={() => {
                        setCurrentView('dashboard');
                        setSelectedLahan(null);
                        setActiveStep(1);
                        handleResetStressTest();
                      }}
                      className="flex-1 py-3.5 px-4 rounded-xl border border-border-medium hover:bg-border-light text-text-muted font-bold text-sm transition-all text-center"
                    >
                      Batalkan
                    </button>

                    <button 
                      onClick={() => handleConfirmTanam(selectedCropId, evalResult.saranMitigasi)}
                      className={`flex-1 py-3.5 px-4 rounded-xl font-bold text-sm transition-all text-center ${
                        evalResult.layak 
                          ? 'bg-primary hover:bg-primary-dark text-text-inverse shadow-lg shadow-primary/20' 
                          : 'bg-orange-600 hover:bg-orange-700 text-text-inverse shadow-lg shadow-orange-600/20'
                      }`}
                    >
                      {evalResult.layak ? 'Konfirmasi Tanam' : 'Paksa Tanam (Gunakan Mitigasi)'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* STEPPER FOOTER BUTTONS (Back/Next for internal steps 2, 3, 4) */}
            {activeStep > 1 && activeStep < 5 && (
              <div className="flex gap-4 border-t border-border-light pt-6 mt-8">
                <button
                  type="button"
                  onClick={() => setActiveStep(activeStep - 1)}
                  className="flex-1 py-3 px-4 rounded-xl border border-border-medium hover:bg-white/5 text-text-muted font-bold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Kembali</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep(activeStep + 1)}
                  className="flex-1 py-3 px-4 rounded-xl bg-primary hover:bg-primary-dark text-text-inverse font-bold text-sm transition-all text-center flex items-center justify-center gap-2"
                >
                  <span>Lanjutkan</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
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

          {/* Land Card Header */}
          <div className="flex justify-between items-start mb-6 border-b border-border-light pb-4">
            <div>
              <span className="text-xs bg-primary-dark/30 text-primary font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Sedang Ditanam</span>
              <h2 className="text-2xl font-bold text-text-main mt-2">{selectedLahan.nama}</h2>
              <p className="text-sm text-text-muted mt-1">
                Varietas: <strong className="text-text-main">{selectedLahan.varietasDitanam}</strong>
                <span className="mx-2">•</span>
                Tanggal Tanam: <strong className="text-text-main">{selectedLahan.tanggalTanam || 'Tidak tersedia'}</strong>
              </p>
            </div>
            {isExtremeWeather && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-full px-3 py-1 flex items-center gap-1.5 text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Peringatan Cuaca</span>
              </div>
            )}
          </div>

          {/* INNER TABS SELECTOR */}
          <div className="flex border-b border-white/10 gap-6 mb-6 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setInnerTab('overview')}
              className={`pb-3 text-xs font-extrabold relative transition-colors whitespace-nowrap ${
                innerTab === 'overview' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span>Overview Lahan</span>
              {innerTab === 'overview' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>}
            </button>
            <button
              onClick={() => setInnerTab('weather')}
              className={`pb-3 text-xs font-extrabold relative transition-colors whitespace-nowrap ${
                innerTab === 'weather' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span>Pemantauan Iklim & Cuaca</span>
              {innerTab === 'weather' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>}
            </button>
            <button
              onClick={() => setInnerTab('checklist')}
              className={`pb-3 text-xs font-extrabold relative transition-colors whitespace-nowrap ${
                innerTab === 'checklist' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span>Checklist Pemeliharaan</span>
              {innerTab === 'checklist' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>}
            </button>
          </div>

          {/* TAB CONTENT 1: OVERVIEW */}
          {innerTab === 'overview' && (
            <div className="space-y-6">
              {/* METRICS SUMMARY GRID */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                <div className="bg-bg-dark p-5 rounded-2xl border border-border-light flex flex-col justify-between">
                  <div>
                    <span className="text-text-muted text-[11px] block mb-1 uppercase tracking-wider font-semibold">Proyeksi Panen</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <strong className="text-base font-bold text-text-main">{selectedLahan.estimasiPanenDate}</strong>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-border-light/40 pt-2 flex justify-between items-center text-[10px]">
                    <span className="text-text-muted">Tanggal Tanam:</span>
                    <span className="font-semibold text-text-main">{selectedLahan.tanggalTanam || 'Tidak tersedia'}</span>
                  </div>
                </div>
              </div>

              {/* HISTORICAL TREND CHARTS */}
              <div className="bg-bg-dark border border-border-light rounded-3xl p-5">
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

              {/* CATATAN MITIGASI SAAT CHECK SUITABILITY */}
              {selectedLahan.catatanMitigasi && (
                <div className="bg-bg-dark border border-border-light rounded-3xl p-5">
                  <h4 className="font-bold text-text-main mb-3 text-xs uppercase tracking-wider text-text-muted border-b border-border-light/40 pb-2">Instruksi Tanam Awal</h4>
                  <p className="text-xs text-text-muted whitespace-pre-line leading-relaxed">{selectedLahan.catatanMitigasi}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT 2: WEATHER & CLIMATE */}
          {innerTab === 'weather' && (
            <div className="space-y-6">
              <KalenderTanam savedLahans={[selectedLahan]} cropsDbList={cropsList} />
              
              <div className="bg-bg-dark border border-border-medium rounded-2xl p-4 text-xs text-amber-300 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-300 shrink-0" />
                <span>Dibandingkan rata-rata historis 5 tahun terakhir: <strong>+1.2°C lebih panas</strong> akibat pergeseran iklim lokal.</span>
              </div>
            </div>
          )}

          {/* TAB CONTENT 3: CHECKLIST PEMELIHARAAN */}
          {innerTab === 'checklist' && (
            <div className="space-y-6">
              {(() => {
                const requiredItems = isExtremeWeather 
                  ? ['Buka katup drainase sawah', 'Pemangkasan daun terbawah', 'Semprotkan fungisida organik', 'Monitor tanggul bedengan']
                  : ['Irigasi Harian Terjadwal', 'Pembersihan Parit', 'Pengecekan Mulsa Lahan'];
                const completedCount = requiredItems.filter(item => checkedActivities[item]).length;
                const progressPercent = requiredItems.length > 0 ? Math.round((completedCount / requiredItems.length) * 100) : 0;

                return (
                  <div className="bg-bg-dark border border-border-light rounded-3xl p-5">
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
            </div>
          )}

          {/* ACTIONS */}
          <div className="flex gap-4 border-t border-border-light pt-6 mt-6">
            <button 
              onClick={() => {
                setCurrentView('dashboard');
                setSelectedLahan(null);
              }}
              className="flex-1 py-3.5 px-4 rounded-xl border border-border-medium hover:bg-border-light text-text-muted font-bold text-sm transition-all text-center cursor-pointer"
            >
              Kembali ke Dashboard
            </button>

            <button 
              onClick={() => {
                // Initialize default values for the harvest form
                const cropData = cropsList.find(t => t.nama === selectedLahan?.varietasDitanam);
                const hargaDef = cropData?.harga_pasar || 7000; 
                
                setBeratPanen(0);
                setHargaJual(hargaDef);
                setStatusHasil('sukses');
                setCurrentView('panen');
              }}
              className="flex-1 py-3.5 px-4 rounded-xl bg-primary hover:bg-primary-dark text-text-inverse font-bold text-sm transition-all text-center shadow-lg shadow-primary/20 cursor-pointer animate-pulse-soft"
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
    const hargaDefault = cropData?.harga_pasar || 7000;
    
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
              <div className="flex overflow-x-auto no-scrollbar gap-4 pb-4 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6 snap-x snap-mandatory">
            {lahans.map((lahan) => {
              const isExtreme = lahan.ketinggian > 800 && lahan.curahHujan > 250;
              return (
                <div 
                  key={lahan.id}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-primary/30 hover:bg-white/10 hover:shadow-[0_0_25px_rgba(16,185,129,0.1)] transition-all duration-300 flex flex-col justify-between group relative overflow-hidden shrink-0 w-[85vw] sm:w-[350px] md:w-auto snap-start"
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
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary border border-primary/20 font-bold uppercase tracking-wider">Sedang Ditanam</span>
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
                          <span className="text-text-muted">Tanggal Tanam:</span>
                          <strong className="text-text-main">{lahan.tanggalTanam || 'Tidak tersedia'}</strong>
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
                          setActiveStep(1);
                        }}
                        className="flex-1 text-xs font-bold py-2.5 rounded-xl border border-primary/30 text-primary hover:bg-primary/10 transition-colors text-center cursor-pointer"
                      >
                        Cek Kelayakan
                      </button>
                    ) : lahan.status === 'sedang-ditanam' ? (
                      <button 
                        onClick={() => {
                          setSelectedLahan(lahan);
                          setCurrentView('monitoring');
                          setInnerTab('overview');
                        }}
                        className="flex-1 text-xs font-bold py-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 transition-colors text-center flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Activity className="w-3.5 h-3.5" />
                        <span>Pantau Lahan</span>
                      </button>
                    ) : (
                      <button 
                        onClick={async () => {
                          const confirmed = await showConfirmModal(
                            'Catat Hasil Panen',
                            'Apakah Anda yakin ingin mencatat hasil panen untuk lahan ini? Tindakan ini akan mengarahkan Anda ke formulir pencatatan hasil.',
                            'Ya, Catat Sekarang',
                            'Batalkan'
                          );
                          if (confirmed) {
                            setSelectedLahan(lahan);
                            const cropData = cropsList.find(t => t.nama === lahan.varietasDitanam);
                            const hargaDef = cropData?.harga_pasar || 7000;
                            setBeratPanen(0);
                            setHargaJual(hargaDef);
                            setStatusHasil('sukses');
                            setCurrentView('panen');
                          }
                        }}
                        className="flex-1 text-xs font-bold py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-text-inverse transition-colors text-center flex items-center justify-center gap-1 cursor-pointer font-bold"
                      >
                        Catat Hasil Panen
                      </button>
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

            {/* SECTION: AKTIVITAS TERBARU */}
            {(() => {
              const timelineItems = generateTimeline();
              const displayItems = timelineItems.slice(0, 5);

              return (
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-6 mt-8 shadow-lg shadow-black/20">
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
                    <h3 className="font-bold text-text-main text-sm md:text-base flex items-center gap-2">
                      <Clock className="w-4.5 h-4.5 text-primary-light" />
                      <span>Aktivitas Terbaru</span>
                    </h3>
                    {timelineItems.length > 0 && (
                      <span className="bg-primary/10 text-primary-light border border-primary/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {timelineItems.length} Aktivitas
                      </span>
                    )}
                  </div>

                  {timelineItems.length === 0 ? (
                    <div className="text-center py-6 text-xs text-text-muted">
                      Belum ada aktivitas — mulai dengan menambah lahan pertama Anda.
                    </div>
                  ) : (
                    <div className="space-y-0 divide-y divide-white/5">
                      {displayItems.map((item: any) => {
                        let IconComponent = Sprout;
                        let iconColor = 'text-blue-400';
                        let accentBorder = 'border-l-2 border-l-gray-500/30 pl-3';

                        if (item.type === 'anomali') {
                          IconComponent = AlertTriangle;
                          iconColor = 'text-red-400';
                          accentBorder = 'border-l-2 border-l-red-500 pl-3';
                        } else if (item.type === 'panen') {
                          IconComponent = CheckCircle2;
                          iconColor = 'text-emerald-400';
                          accentBorder = 'border-l-2 border-l-emerald-500 pl-3';
                        } else if (item.type === 'checklist') {
                          IconComponent = ClipboardCheck;
                          iconColor = 'text-green-400';
                          accentBorder = 'border-l-2 border-l-green-500 pl-3';
                        } else if (item.type === 'analisis') {
                          IconComponent = FileSpreadsheet;
                          iconColor = 'text-amber-400';
                          accentBorder = item.severity === 'success' 
                            ? 'border-l-2 border-l-emerald-500 pl-3' 
                            : item.severity === 'warning' 
                            ? 'border-l-2 border-l-red-500 pl-3' 
                            : 'border-l-2 border-l-blue-400 pl-3';
                        }

                        return (
                          <div 
                            key={item.id} 
                            className={`flex items-start md:items-center gap-3 py-3.5 transition-all first:pt-0 last:pb-0 ${accentBorder}`}
                          >
                            <div className="p-1.5 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                              <IconComponent className={`w-4 h-4 ${iconColor}`} />
                            </div>
                            <div className="flex-grow min-w-0 pr-2">
                              <p className="text-xs text-text-main font-medium leading-relaxed break-words">
                                {item.message}
                              </p>
                              <span className="text-[10px] text-text-muted md:hidden block mt-1">
                                {formatRelativeTime(item.timestamp)}
                              </span>
                            </div>
                            <span className="text-[10px] text-text-muted shrink-0 hidden md:block ml-auto font-medium">
                              {formatRelativeTime(item.timestamp)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {timelineItems.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-white/5 flex justify-center">
                      <button 
                        onClick={() => {
                          setActivitiesPage(1);
                          setIsActivitiesModalOpen(true);
                        }} 
                        className="text-xs text-primary-light hover:text-primary font-bold transition-all flex items-center gap-1 hover:translate-x-0.5 cursor-pointer"
                      >
                        <span>Lihat Semua Aktivitas</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
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


        </AnimatePresence>

        {/* MODAL: SEMUA AKTIVITAS */}
        <AnimatePresence>
          {isActivitiesModalOpen && (
            <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="bg-zinc-950 border border-white/10 w-full max-w-2xl rounded-2xl flex flex-col max-h-[80vh] shadow-2xl overflow-hidden"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/10">
                  <h3 className="font-bold text-text-main text-base flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary-light" />
                    <span>Semua Riwayat Aktivitas</span>
                  </h3>
                  <button 
                    onClick={() => setIsActivitiesModalOpen(false)}
                    className="p-1.5 hover:bg-white/10 rounded-full transition-all text-text-muted hover:text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="flex-grow p-5 overflow-y-auto no-scrollbar">
                  {(() => {
                    const timeline = generateTimeline();
                    const itemsPerPage = 10;
                    const totalPages = Math.ceil(timeline.length / itemsPerPage);
                    const paginatedItems = timeline.slice((activitiesPage - 1) * itemsPerPage, activitiesPage * itemsPerPage);

                    if (timeline.length === 0) {
                      return (
                        <div className="text-center py-12 text-xs text-text-muted">
                          Belum ada aktivitas.
                        </div>
                      );
                    }

                    return (
                      <div className="flex flex-col h-full justify-between">
                        <div className="space-y-0 divide-y divide-white/5">
                          {paginatedItems.map((item: any) => {
                            let IconComponent = Sprout;
                            let iconColor = 'text-blue-400';
                            let accentBorder = 'border-l-2 border-l-gray-500/30 pl-3';

                            if (item.type === 'anomali') {
                              IconComponent = AlertTriangle;
                              iconColor = 'text-red-400';
                              accentBorder = 'border-l-2 border-l-red-500 pl-3';
                            } else if (item.type === 'panen') {
                              IconComponent = CheckCircle2;
                              iconColor = 'text-emerald-400';
                              accentBorder = 'border-l-2 border-l-emerald-500 pl-3';
                            } else if (item.type === 'checklist') {
                              IconComponent = ClipboardCheck;
                              iconColor = 'text-green-400';
                              accentBorder = 'border-l-2 border-l-green-500 pl-3';
                            } else if (item.type === 'analisis') {
                              IconComponent = FileSpreadsheet;
                              iconColor = 'text-amber-400';
                              accentBorder = item.severity === 'success' 
                                ? 'border-l-2 border-l-emerald-500 pl-3' 
                                : item.severity === 'warning' 
                                ? 'border-l-2 border-l-red-500 pl-3' 
                                : 'border-l-2 border-l-blue-400 pl-3';
                            }

                            return (
                              <div 
                                key={item.id} 
                                className={`flex items-start md:items-center gap-3 py-3.5 transition-all first:pt-0 last:pb-0 ${accentBorder}`}
                              >
                                <div className="p-1.5 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                  <IconComponent className={`w-4 h-4 ${iconColor}`} />
                                </div>
                                <div className="flex-grow min-w-0 pr-2">
                                  <p className="text-xs text-text-main font-medium leading-relaxed break-words">
                                    {item.message}
                                  </p>
                                  <span className="text-[10px] text-text-muted md:hidden block mt-1">
                                    {formatRelativeTime(item.timestamp)}
                                  </span>
                                </div>
                                <span className="text-[10px] text-text-muted shrink-0 hidden md:block ml-auto font-medium">
                                  {formatRelativeTime(item.timestamp)}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Modal Footer / Pagination Controls */}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between pt-5 mt-4 border-t border-white/10 shrink-0">
                            <button
                              disabled={activitiesPage === 1}
                              onClick={() => setActivitiesPage(prev => Math.max(prev - 1, 1))}
                              className="px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-white/5 rounded-lg text-xs font-bold text-white transition-all cursor-pointer flex items-center gap-1"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                              <span>Sebelumnya</span>
                            </button>
                            <span className="text-xs text-text-muted">
                              Halaman {activitiesPage} dari {totalPages}
                            </span>
                            <button
                              disabled={activitiesPage === totalPages}
                              onClick={() => setActivitiesPage(prev => Math.min(prev + 1, totalPages))}
                              className="px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-white/5 rounded-lg text-xs font-bold text-white transition-all cursor-pointer flex items-center gap-1"
                            >
                              <span>Berikutnya</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
            </div>
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



