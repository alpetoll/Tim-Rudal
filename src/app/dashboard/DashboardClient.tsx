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
import { useNotificationSubscription } from '@/hooks/useNotificationSubscription';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface DashboardClientProps {
  initialUser: any;
}

export default function DashboardClient({ initialUser }: DashboardClientProps) {
  // --- AUTH STATES ---
  const [user, setUser] = useState<any>(initialUser);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  const { isSubscribed, subscribe, unsubscribe } = useNotificationSubscription(user?.id);
  const [notifLoading, setNotifLoading] = useState(false);

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
    
    const isFirstLahan = lahans.length === 0;
    setDataLoading(true);
    const result = await insertLahan(lahanData, user.id);
    setDataLoading(false);

    if (result) {
      setLahans(prev => [...prev, result]);
      setCurrentView('dashboard');
      await showAlertModal('Berhasil', 'Lahan sawah berhasil disimpan!', 'success');
      
      if (isFirstLahan) {
        const confirmPush = await showConfirmModal(
          'Aktifkan Notifikasi',
          'Aktifkan notifikasi supaya kami bisa memberi tahu Anda kalau ada cuaca ekstrem terdeteksi di lahan Anda',
          'Aktifkan',
          'Nanti saja'
        );
        if (confirmPush) {
          await subscribe();
        }
      }
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

  const handleToggleNotification = async () => {
    if (notifLoading) return;
    setNotifLoading(true);

    try {
      if (isSubscribed) {
        const success = await unsubscribe();
        if (success) {
          await showAlertModal('Dinonaktifkan', 'Notifikasi push berhasil dinonaktifkan.', 'success');
        } else {
          await showAlertModal('Gagal', 'Gagal menonaktifkan notifikasi push.', 'error');
        }
      } else {
        const success = await subscribe();
        if (success) {
          await showAlertModal('Diaktifkan', 'Notifikasi push berhasil diaktifkan!', 'success');
        } else {
          await showAlertModal('Peringatan', 'Gagal mengaktifkan notifikasi push. Pastikan izin notifikasi diberikan pada browser Anda.', 'warning');
        }
      }
    } catch (err) {
      console.error('Error toggling push notifications:', err);
    } finally {
      setNotifLoading(false);
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
      <div className="min-h-screen bg-[#050505] py-12 px-4 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="max-w-3xl mx-auto bg-gradient-to-br from-white/10 to-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-[32px] p-6 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] relative z-10">
          <button 
            onClick={() => {
              setCurrentView('dashboard');
              setSelectedLahan(null);
              setActiveStep(1);
              handleResetStressTest();
            }}
            className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 px-4 py-2 rounded-full transition-all mb-8 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Dashboard</span>
          </button>

          <h2 className="text-3xl font-extrabold text-white tracking-tight mb-2">Cek Kelayakan Lahan Tanam</h2>
          <p className="text-xs text-gray-400 mb-8 leading-relaxed">
            Menilai kesesuaian lahan <strong className="text-white font-semibold">{selectedLahan.nama}</strong> berdasarkan parameter geospasial tanah dan iklim.
            {liveWeather && (
              <span className="block mt-2 text-primary flex items-center gap-1.5 font-medium">
                <CloudRain className="w-3.5 h-3.5" /> Terhubung dengan data cuaca live ({liveWeather.suhu}°C, {liveWeather.curahHujan} mm/bln)
              </span>
            )}
          </p>

          {/* SLEEK STEPPER INDICATOR */}
          <div className="mb-10">
            <div className="flex items-center justify-between relative">
              {/* Background Line */}
              <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-white/5 -translate-y-1/2 z-0" />
              {/* Active Progress Line */}
              <div 
                className="absolute top-1/2 left-0 h-[2px] bg-primary -translate-y-1/2 z-0 transition-all duration-300"
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
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 border cursor-pointer ${
                        isCompleted ? 'bg-primary border-primary text-black shadow-md shadow-primary/20' :
                        isActive ? 'bg-[#050505] border-primary text-primary ring-4 ring-primary/10 scale-110 font-black' :
                        'bg-[#0c0c0c] border-white/10 text-gray-500 hover:border-white/20'
                      }`}
                    >
                      {isCompleted ? '✓' : s.number}
                    </button>
                    <span className={`text-[10px] font-extrabold mt-2.5 hidden sm:inline uppercase tracking-wider ${
                      isActive ? 'text-primary' : isCompleted ? 'text-white' : 'text-gray-500'
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
                  <div className="bg-white/5 border border-white/5 rounded-3xl p-6 shadow-xl">
                    
                    {/* DROPDOWN KATEGORI */}
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Pilih Kategori</label>
                    <div className="relative mb-6">
                      <button
                        type="button"
                        onClick={() => setIsKategoriDropdownOpen(!isKategoriDropdownOpen)}
                        className={`w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-left focus:outline-none focus:border-primary transition-all text-sm flex justify-between items-center cursor-pointer ${selectedKategori ? 'text-white font-bold' : 'text-gray-400 font-normal'}`}
                      >
                        <span>{selectedKategori || 'Pilih Kategori...'}</span>
                        <ChevronDown className={`w-4 h-4 transform transition-transform duration-200 ${isKategoriDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isKategoriDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsKategoriDropdownOpen(false)} />
                          <div className="absolute z-50 mt-2 w-full bg-zinc-950/95 border border-white/10 rounded-2xl shadow-2xl p-2 space-y-1 backdrop-blur-xl">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedKategori('');
                                setIsKategoriDropdownOpen(false);
                                setSelectedCropId('');
                              }}
                              className={`w-full text-left px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                                selectedKategori === '' ? 'bg-primary/20 border border-primary/30 text-white font-bold' : 'hover:bg-white/5 text-gray-400 hover:text-white'
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
                                className={`w-full text-left px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                                  kat === selectedKategori ? 'bg-primary/20 border border-primary/30 text-white font-bold' : 'hover:bg-white/5 text-gray-400 hover:text-white'
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
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Pilih Komoditas Tanaman</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsCropDropdownOpen(!isCropDropdownOpen)}
                        className={`w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-left focus:outline-none focus:border-primary transition-all text-sm flex justify-between items-center cursor-pointer ${activeCrop ? 'text-white font-bold' : 'text-gray-400 font-normal'}`}
                      >
                        <span>
                          {activeCrop ? `${activeCrop.nama} ${activeCrop.nama_latin ? `(${activeCrop.nama_latin})` : ''}` : 'Pilih Komoditas Tanaman...'}
                        </span>
                        <ChevronDown className={`w-4 h-4 transform transition-transform duration-200 ${isCropDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isCropDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => { setIsCropDropdownOpen(false); setCropSearchQuery(''); }} />
                          <div className="absolute z-50 mt-2 w-full bg-zinc-950/95 border border-white/10 rounded-2xl shadow-2xl p-4 space-y-3 backdrop-blur-xl">
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Cari komoditas..."
                                value={cropSearchQuery}
                                onChange={(e) => setCropSearchQuery(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white focus:outline-none focus:border-primary transition-all text-xs"
                                autoFocus
                              />
                              <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-gray-400" />
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
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex flex-col cursor-pointer ${
                                      crop.id === selectedCropId
                                        ? 'bg-primary/20 border border-primary/30 text-white font-bold'
                                        : 'hover:bg-white/5 text-gray-400 hover:text-white'
                                    }`}
                                  >
                                    <span className="font-bold">{crop.nama}</span>
                                    {crop.nama_latin && <span className="text-[10px] italic opacity-60">{crop.nama_latin}</span>}
                                  </button>
                                ))
                              ) : (
                                <div className="text-center py-4 text-xs text-gray-400">Komoditas tidak ditemukan</div>
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
                      className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-primary hover:bg-primary-dark text-black font-bold text-xs tracking-wider uppercase transition-all text-center flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer"
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
                  <div className="flex flex-col items-center justify-center p-8 bg-white/5 border border-white/5 rounded-3xl shadow-xl">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Skor Kecocokan</span>
                    
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
                        <span className="text-4xl font-extrabold text-white tracking-tight">{score}%</span>
                        {potentialScore > score && (
                          <span className="text-[9px] text-primary-light font-extrabold mt-1 tracking-wider uppercase">Potensi: {potentialScore}%</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 text-center">
                      <span className={`px-4 py-1.5 rounded-full text-xs font-bold border uppercase tracking-wider ${
                        score >= 75 ? 'bg-primary/10 text-primary border-primary/20' :
                        score >= 50 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                        'bg-red-500/10 text-red-500 border-red-500/20'
                      }`}>
                        {score >= 75 ? 'Lahan Sangat Layak' : score >= 50 ? 'Cukup Layak (Butuh Mitigasi)' : 'Tidak Layak / Berisiko'}
                      </span>
                    </div>
                  </div>

                  {/* Constraint summary & Climate change positioning */}
                  <div className="bg-white/5 border border-white/5 rounded-3xl p-6 space-y-4 shadow-xl">
                    <h4 className="font-bold text-[10px] uppercase tracking-widest text-gray-400">Ringkasan Kendala Utama</h4>
                    {mainConstraint ? (
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-white leading-relaxed">
                          {mainConstraint}
                        </p>
                        {isClimateAnomaly && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-wider">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            <span>Dipengaruhi Anomali Iklim</span>
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-300 leading-relaxed">Selamat! Parameter lingkungan terdeteksi sangat cocok dengan kebutuhan varietas tanaman ini.</p>
                    )}
                  </div>

                  {/* Simulasi Musim Sulit Section */}
                  <div className="bg-white/5 border border-white/5 rounded-3xl p-6 space-y-4 mt-6 shadow-xl">
                    <div className="flex flex-col mb-2">
                      <h4 className="font-bold text-sm text-white">Simulasi Musim Sulit</h4>
                      <span className="text-xs text-gray-400">Bagaimana jika iklim berubah ekstrem?</span>
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
                              className={`flex-1 py-3.5 px-4 rounded-2xl border font-bold text-xs transition-all text-center flex items-center justify-center gap-2 cursor-pointer ${
                                isSelected 
                                  ? 'bg-primary/20 border-primary text-white' 
                                  : 'bg-black/30 border-white/5 hover:border-primary/40 text-gray-300 hover:text-white hover:bg-white/5'
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
                          className="bg-black/40 border border-white/10 rounded-2xl p-5 space-y-4 overflow-hidden"
                        >
                          <div className="space-y-1">
                            <h5 className="font-bold text-[10px] uppercase tracking-widest text-gray-400">Konfirmasi Simulasi</h5>
                            <p className="text-xs text-white leading-relaxed">{selectedScenario.deskripsi}</p>
                          </div>
                          <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex justify-between items-center text-xs">
                            <div>
                              <span className="text-[10px] text-gray-400 block uppercase tracking-wider font-semibold">Modifikasi Suhu</span>
                              <strong className="text-orange-400 font-bold">{selectedScenario.delta_suhu > 0 ? `+${selectedScenario.delta_suhu}` : selectedScenario.delta_suhu} °C</strong>
                            </div>
                            <div className="w-[1px] h-8 bg-white/10" />
                            <div>
                              <span className="text-[10px] text-gray-400 block uppercase tracking-wider font-semibold">Modifikasi Curah Hujan</span>
                              <strong className="text-blue-400 font-bold">{selectedScenario.delta_curah_hujan_persen > 0 ? `+${selectedScenario.delta_curah_hujan_persen}` : selectedScenario.delta_curah_hujan_persen} %</strong>
                            </div>
                          </div>
                          <div className="flex gap-3 justify-end pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setIsStressTestModalOpen(false);
                                setSelectedScenario(null);
                              }}
                              className="px-4 py-2 rounded-full border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExecuteStressTest(activeCrop, score)}
                              disabled={isSimulating}
                              className="px-4 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-orange-600/20"
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
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 space-y-2">
                              <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest block">Kondisi Normal</span>
                              <div className="flex justify-between items-baseline">
                                <strong className="text-2xl font-extrabold text-emerald-400">{score}%</strong>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  score >= 75 ? 'bg-primary/20 text-primary border border-primary/20' :
                                  score >= 50 ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                  'bg-red-500/10 text-red-500 border border-red-500/20'
                                }`}>
                                  {score >= 75 ? 'S1' : score >= 50 ? 'S2' : 'N'}
                                </span>
                              </div>
                              <div className="text-xs text-gray-400 space-y-1 pt-2 border-t border-white/5">
                                <div className="flex justify-between">
                                  <span>Suhu:</span>
                                  <span className="text-white">{liveWeather ? liveWeather.suhu : selectedLahan.suhu} °C</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Curah Hujan:</span>
                                  <span className="text-white">{liveWeather ? liveWeather.curahHujan : selectedLahan.curahHujan} mm/bln</span>
                                </div>
                              </div>
                            </div>

                            {/* Kondisi Skenario */}
                            <div className="bg-orange-600/10 border border-orange-500/20 rounded-2xl p-4 space-y-2">
                              <span className="text-[10px] text-orange-400 font-extrabold uppercase tracking-widest block">Skenario {selectedScenario.nama_skenario.split('(')[0].trim()}</span>
                              <div className="flex justify-between items-baseline">
                                <strong className="text-2xl font-extrabold text-orange-400">{stressTestResult.skor}%</strong>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  stressTestResult.skor >= 75 ? 'bg-primary/20 text-primary border border-primary/20' :
                                  stressTestResult.skor >= 50 ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                  'bg-red-500/10 text-red-500 border border-red-500/20'
                                }`}>
                                  {stressTestResult.skor >= 75 ? 'S1' : stressTestResult.skor >= 50 ? 'S2' : 'N'}
                                </span>
                              </div>
                              <div className="text-xs text-gray-400 space-y-1 pt-2 border-t border-white/5">
                                {(() => {
                                  const modified = applyScenarioDelta(
                                    liveWeather ? { ...selectedLahan, suhu: liveWeather.suhu, curahHujan: liveWeather.curahHujan } : selectedLahan,
                                    selectedScenario
                                  );
                                  return (
                                    <>
                                      <div className="flex justify-between">
                                        <span>Suhu:</span>
                                        <span className="text-white">{modified.suhu} °C</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Curah Hujan:</span>
                                        <span className="text-white">{modified.curahHujan} mm/bln</span>
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
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-2xl p-4 flex items-center gap-2 shadow-lg">
                                  <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" />
                                  <span>Penurunan skor {diff} poin — lahan ini rentan terhadap {selectedScenario.nama_skenario.split('(')[0].trim()}</span>
                                </div>
                              );
                            } else if (diff < 0) {
                              return (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-2xl p-4 flex items-center gap-2 shadow-lg">
                                  <Sparkles className="w-5 h-5 shrink-0 text-emerald-400" />
                                  <span>Peningkatan skor {Math.abs(diff)} poin — kondisi ini justru menguntungkan komoditas ini!</span>
                                </div>
                              );
                            } else {
                              return (
                                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-semibold rounded-2xl p-4 flex items-center gap-2 shadow-lg">
                                  <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
                                  <span>Skor kelayakan stabil pada {score}%, namun kondisi ekstrem {selectedScenario.nama_skenario.split('(')[0].trim()} tetap berisiko menimbulkan tekanan iklim (climate stress) pada tanaman dalam jangka panjang. Sangat disarankan menerapkan adaptasi di bawah.</span>
                                </div>
                              );
                            }
                          })()}

                          {/* Rekomendasi Adaptasi */}
                          <div className="bg-black/20 border border-white/5 rounded-2xl p-5 space-y-3">
                            <span className="text-xs font-extrabold text-white block uppercase tracking-wider">Rekomendasi Adaptasi</span>
                            <div className="text-xs text-gray-300 space-y-2 leading-relaxed">
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
                                  <div className="space-y-2">
                                    {recomms.map((rec, i) => (
                                      <div key={i} className="flex gap-2">
                                        <span className="text-primary font-extrabold">•</span>
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
                              className="flex-1 py-3 px-4 rounded-full bg-primary hover:bg-primary-dark text-black text-xs font-bold transition-all text-center cursor-pointer shadow-lg shadow-primary/20"
                            >
                              Tetap Tanam Komoditas Ini
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStressTestDecision('pilih_alternatif')}
                              className="flex-1 py-3 px-4 rounded-full bg-teal-950/40 hover:bg-teal-900/60 border border-teal-500/30 text-teal-300 text-xs font-bold transition-all text-center cursor-pointer shadow-lg shadow-teal-950/20"
                            >
                              Pilih Alternatif
                            </button>
                            <button
                              type="button"
                              onClick={handleResetStressTest}
                              className="py-3 px-5 rounded-full border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white text-xs font-bold transition-all text-center cursor-pointer"
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
                    <div className="bg-white/5 border border-white/5 rounded-3xl p-6 shadow-xl">
                      <h4 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
                        <Activity className="w-4.5 h-4.5 text-primary" />
                        <span>Detail Perbandingan Parameter</span>
                      </h4>
                      <p className="text-[10px] text-gray-400 mb-5 flex items-center gap-1.5">
                        <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Klik pada baris parameter untuk melihat penjelasan detail.</span>
                      </p>
                      
                      <div className="overflow-x-auto rounded-2xl border border-white/5">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-white/5 border-b border-white/10 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                              <th className="p-3.5">Parameter</th>
                              <th className="p-3.5">Aktual</th>
                              <th className="p-3.5">Batas Ideal</th>
                              <th className="p-3.5 text-right">Status</th>
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
                                    <td className="p-3.5 font-bold text-white flex items-center gap-2">
                                      <span>{detail.label}</span>
                                      <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                    </td>
                                    <td className="p-3.5 text-gray-300 font-medium">{detail.actual}</td>
                                    <td className="p-3.5 text-gray-300 font-medium">{detail.ideal}</td>
                                    <td className="p-3.5 text-right">
                                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${ratingBadgeColor}`}>
                                        {detail.rating}
                                      </span>
                                    </td>
                                  </tr>
                                  
                                  {isExpanded && (
                                    <tr className="bg-white/[0.01]">
                                      <td colSpan={4} className="p-4 border-t border-white/5">
                                        <p className="text-[11px] text-gray-400 leading-relaxed font-medium">
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
                    <div className="text-center py-8 text-xs text-gray-400">Detail parameter tidak tersedia.</div>
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
                    <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />
                      <span>Rencana Perawatan & Mitigasi Taktis</span>
                    </h4>

                    <div className="space-y-3">
                      {/* Category Suhu */}
                      <div className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden shadow-md">
                        <button
                          type="button"
                          onClick={() => setActiveCategory(activeCategory === 'Suhu' ? '' : 'Suhu')}
                          className="w-full flex items-center justify-between p-4 font-bold text-xs text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <ThermometerSun className="w-4 h-4 text-orange-400" />
                            <span>1. Suhu, Iklim & Kebutuhan Air</span>
                          </span>
                          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${activeCategory === 'Suhu' ? 'rotate-180' : ''}`} />
                        </button>
                        {activeCategory === 'Suhu' && (
                          <div className="p-5 border-t border-white/5 bg-black/10 space-y-4 text-xs text-gray-300">
                            <div className="bg-black/30 p-4 rounded-xl border border-white/5 flex justify-between items-center">
                              <div>
                                <span className="text-[10px] text-gray-400 block mb-0.5 uppercase tracking-wider font-semibold">Estimasi Air Harian</span>
                                <strong className="text-white text-sm">{(evalResult.kebutuhanAirDaily * selectedLahan.luas).toLocaleString('id-ID')} Liter/Hari</strong>
                              </div>
                              <span className="text-[10px] text-gray-500 font-medium">({evalResult.kebutuhanAirDaily} L/m²)</span>
                            </div>
                            {suhuIklimItems.length > 0 ? (
                              <div className="space-y-4">
                                {suhuIklimItems.map((item, idx) => (
                                  <div key={idx} className="space-y-1">
                                    <span className="font-bold text-white block">{item.label}</span>
                                    <p className="leading-relaxed text-gray-400">{item.text}</p>
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
                      <div className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden shadow-md">
                        <button
                          type="button"
                          onClick={() => setActiveCategory(activeCategory === 'Drainase' ? '' : 'Drainase')}
                          className="w-full flex items-center justify-between p-4 font-bold text-xs text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <Droplet className="w-4 h-4 text-blue-400" />
                            <span>2. Sistem Drainase Lahan</span>
                          </span>
                          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${activeCategory === 'Drainase' ? 'rotate-180' : ''}`} />
                        </button>
                        {activeCategory === 'Drainase' && (
                          <div className="p-5 border-t border-white/5 bg-black/10 space-y-3 text-xs text-gray-300">
                            {drainaseItems.length > 0 ? (
                              <div className="space-y-4">
                                {drainaseItems.map((item, idx) => (
                                  <div key={idx} className="space-y-1">
                                    <span className="font-bold text-white block">{item.label}</span>
                                    <p className="leading-relaxed text-gray-400">{item.text}</p>
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
                      <div className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden shadow-md">
                        <button
                          type="button"
                          onClick={() => setActiveCategory(activeCategory === 'Tanah' ? '' : 'Tanah')}
                          className="w-full flex items-center justify-between p-4 font-bold text-xs text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <Sprout className="w-4 h-4 text-emerald-400" />
                            <span>3. Tanah, pH & Siklus Pemupukan</span>
                          </span>
                          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${activeCategory === 'Tanah' ? 'rotate-180' : ''}`} />
                        </button>
                        {activeCategory === 'Tanah' && (
                          <div className="p-5 border-t border-white/5 bg-black/10 space-y-4 text-xs text-gray-300">
                            <div className="space-y-2">
                              <span className="text-[10px] text-white block uppercase tracking-wider font-extrabold flex items-center gap-2 mb-3">
                                <Calendar className="w-4 h-4 text-primary" /> Rencana Jadwal Pemupukan
                              </span>
                              <div className="space-y-2 pl-2 border-l-2 border-primary/30">
                                {evalResult.siklusPemupukan.map((step, i) => (
                                  <div key={i} className="flex gap-2 text-gray-400">
                                    <span className="text-primary font-bold">•</span>
                                    <span>{step}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            {tanahItems.length > 0 && (
                              <div className="space-y-4 pt-4 border-t border-white/5">
                                {tanahItems.map((item, idx) => (
                                  <div key={idx} className="space-y-1">
                                    <span className="font-bold text-white block">{item.label}</span>
                                    <p className="leading-relaxed text-gray-400">{item.text}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Category Lereng */}
                      <div className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden shadow-md">
                        <button
                          type="button"
                          onClick={() => setActiveCategory(activeCategory === 'Lereng' ? '' : 'Lereng')}
                          className="w-full flex items-center justify-between p-4 font-bold text-xs text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <MapIcon className="w-4 h-4 text-lime-400" />
                            <span>4. Kemiringan Lereng & Erosi</span>
                          </span>
                          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${activeCategory === 'Lereng' ? 'rotate-180' : ''}`} />
                        </button>
                        {activeCategory === 'Lereng' && (
                          <div className="p-5 border-t border-white/5 bg-black/10 space-y-3 text-xs text-gray-300">
                            {lerengItems.length > 0 ? (
                              <div className="space-y-4">
                                {lerengItems.map((item, idx) => (
                                  <div key={idx} className="space-y-1">
                                    <span className="font-bold text-white block">{item.label}</span>
                                    <p className="leading-relaxed text-gray-400">{item.text}</p>
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
                    <div className="bg-white/5 border border-white/5 rounded-3xl p-6 space-y-4 shadow-xl">
                      <h4 className="font-bold text-white text-sm flex items-center gap-2 border-b border-white/5 pb-3">
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
                              badgeColor: 'text-green-400 bg-green-500/10',
                              borderColor: 'hover:border-green-500/40',
                              scoreColor: 'text-green-400 bg-green-500/10 border-green-500/20',
                              buttonColor: 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20'
                            },
                            { 
                              id: 'kuning', 
                              label: 'Cukup Sesuai / Marginal (Skor 50-79)', 
                              items: kuningItems, 
                              badgeColor: 'text-yellow-400 bg-yellow-500/10',
                              borderColor: 'hover:border-yellow-500/40',
                              scoreColor: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
                              buttonColor: 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border-yellow-500/20'
                            },
                            { 
                              id: 'merah', 
                              label: 'Tidak Direkomendasikan (Skor < 50)', 
                              items: merahItems, 
                              badgeColor: 'text-red-400 bg-red-500/10',
                              borderColor: 'hover:border-red-500/40',
                              scoreColor: 'text-red-400 bg-red-500/10 border-red-500/20',
                              buttonColor: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                            }
                          ].filter(g => g.items.length > 0);

                          return altGroups.map(group => (
                            <div key={group.id} className="border border-white/5 rounded-2xl overflow-hidden shadow-sm bg-black/10">
                              <button
                                type="button"
                                onClick={() => setOpenAltGroup(openAltGroup === group.id ? '' : group.id)}
                                className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 transition-colors text-left cursor-pointer"
                              >
                                <span className="font-semibold text-xs text-white">
                                  {group.label} 
                                  <span className={`${group.badgeColor} px-2.5 py-0.5 rounded-full ml-2 text-[10px] font-extrabold border border-white/5`}>
                                    {group.items.length} opsi
                                  </span>
                                </span>
                                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${openAltGroup === group.id ? 'rotate-180' : ''}`} />
                              </button>
                              
                              <AnimatePresence>
                                {openAltGroup === group.id && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="bg-black/30 border-t border-white/5 overflow-hidden"
                                  >
                                    <div className="p-4 space-y-2.5 max-h-[400px] overflow-y-auto custom-scrollbar">
                                      {group.items.map(alt => (
                                        <div key={alt.tanaman.id} className={`flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl text-xs ${group.borderColor} hover:shadow-md transition-all`}>
                                          <div className="space-y-1">
                                            <strong className="text-white text-sm block">{alt.tanaman.nama}</strong>
                                            <span className="text-gray-400 block text-[10px]">Estimasi panen: {alt.tanaman.siklus_tanam_days || 120} hari</span>
                                          </div>
                                          <div className="flex items-center gap-4">
                                            <span className={`${group.scoreColor} font-semibold px-2.5 py-1 rounded-full border text-[10px] uppercase tracking-wider`}>Kecocokan: {alt.evaluasi.skor}%</span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setSelectedCropId(alt.tanaman.id);
                                                setActiveStep(1);
                                                handleResetStressTest();
                                              }}
                                              className={`${group.buttonColor} shadow-sm border font-bold py-1.5 px-4 rounded-full transition-all text-xs cursor-pointer`}
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
                  <div className="flex flex-col sm:flex-row gap-4 border-t border-white/10 pt-6 mt-8">
                    <button 
                      onClick={() => {
                        setCurrentView('dashboard');
                        setSelectedLahan(null);
                        setActiveStep(1);
                        handleResetStressTest();
                      }}
                      className="flex-1 py-3.5 px-6 rounded-full border border-white/10 hover:bg-white/5 text-gray-300 hover:text-white font-bold text-xs tracking-wider uppercase transition-all text-center cursor-pointer"
                    >
                      Batalkan
                    </button>

                    <button 
                      onClick={() => handleConfirmTanam(selectedCropId, evalResult.saranMitigasi)}
                      className={`flex-1 py-3.5 px-6 rounded-full font-bold text-xs tracking-wider uppercase transition-all text-center cursor-pointer ${
                        evalResult.layak 
                          ? 'bg-primary hover:bg-primary-dark text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]' 
                          : 'bg-orange-600 hover:bg-orange-700 text-white shadow-[0_0_20px_rgba(234,88,12,0.3)]'
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
              <div className="flex flex-col sm:flex-row gap-4 border-t border-white/10 pt-6 mt-8">
                <button
                  type="button"
                  onClick={() => setActiveStep(activeStep - 1)}
                  className="flex-1 py-3.5 px-6 rounded-full border border-white/10 hover:bg-white/5 text-gray-300 hover:text-white font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Kembali</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep(activeStep + 1)}
                  className="flex-1 py-3.5 px-6 rounded-full bg-primary hover:bg-primary-dark text-black font-bold text-xs tracking-wider uppercase transition-all text-center flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-pointer"
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
      <div className="min-h-screen bg-[#050505] py-12 px-4 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="max-w-4xl mx-auto bg-gradient-to-br from-white/10 to-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-[32px] p-6 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] relative z-10">
          
          <button 
            onClick={() => {
              setCurrentView('dashboard');
              setSelectedLahan(null);
            }}
            className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 px-4 py-2 rounded-full transition-all mb-8 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Dashboard</span>
          </button>

          {/* Land Card Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-white/10 pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">Sedang Ditanam</span>
                {isExtremeWeather && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-full px-2.5 py-0.5 flex items-center gap-1 text-[10px] font-bold">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Peringatan Cuaca</span>
                  </div>
                )}
              </div>
              <h2 className="text-3xl font-extrabold text-white tracking-tight mt-2">{selectedLahan.nama}</h2>
              <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1.5 flex-wrap">
                <span>Varietas:</span> <strong className="text-white font-semibold">{selectedLahan.varietasDitanam}</strong>
                <span className="text-white/20">•</span>
                <span>Tanggal Tanam:</span> <strong className="text-white font-semibold">{selectedLahan.tanggalTanam || 'Tidak tersedia'}</strong>
              </p>
            </div>
          </div>

          {/* INNER TABS SELECTOR (Premium Capsule) */}
          <div className="inline-flex bg-white/5 backdrop-blur-md border border-white/10 rounded-full p-1.5 mb-8 overflow-x-auto no-scrollbar max-w-full">
            <button
              onClick={() => setInnerTab('overview')}
              className={`py-2 px-5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                innerTab === 'overview' 
                  ? 'bg-white text-black shadow-md' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Overview Lahan
            </button>
            <button
              onClick={() => setInnerTab('weather')}
              className={`py-2 px-5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                innerTab === 'weather' 
                  ? 'bg-white text-black shadow-md' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Pemantauan Iklim & Cuaca
            </button>
            <button
              onClick={() => setInnerTab('checklist')}
              className={`py-2 px-5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                innerTab === 'checklist' 
                  ? 'bg-white text-black shadow-md' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Checklist Pemeliharaan
            </button>
          </div>

          {/* TAB CONTENT 1: OVERVIEW */}
          {innerTab === 'overview' && (
            <div className="space-y-8">
              {/* METRICS SUMMARY GRID (Bento Mini) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Kelembapan */}
                <div className="bg-white/5 backdrop-blur-md border border-white/5 p-5 rounded-2xl flex flex-col justify-between group hover:bg-white/10 transition-colors shadow-lg">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Sensor Kelembapan</span>
                    <div className="flex items-baseline gap-2 mt-2">
                      <strong className="text-3xl font-extrabold text-white tracking-tight">78%</strong>
                      <span className="text-[9px] text-emerald-400 font-extrabold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Optimal</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">Kondisi media tanam optimal untuk perakaran.</p>
                </div>

                {/* Suhu */}
                <div className="bg-white/5 backdrop-blur-md border border-white/5 p-5 rounded-2xl flex flex-col justify-between group hover:bg-white/10 transition-colors shadow-lg">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Suhu & Cuaca</span>
                    <div className="flex items-center gap-2 mt-2">
                      <CloudRain className="w-5 h-5 text-blue-400 shrink-0" />
                      <strong className="text-2xl font-extrabold text-white tracking-tight">
                        {liveWeather ? `${liveWeather.currentTemp}°C` : '24°C'}
                      </strong>
                      <span className="text-[10px] text-gray-400 font-medium">
                        ({liveWeather ? liveWeather.weatherDesc : 'Hujan Ringan'})
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">Suhu rata-rata harian terpantau stabil.</p>
                </div>

                {/* Proyeksi Panen */}
                <div className="bg-white/5 backdrop-blur-md border border-white/5 p-5 rounded-2xl flex flex-col justify-between group hover:bg-white/10 transition-colors shadow-lg">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Proyeksi Panen</span>
                    <div className="mt-2">
                      <strong className="text-lg font-bold text-amber-400 tracking-tight block truncate">{selectedLahan.estimasiPanenDate}</strong>
                    </div>
                  </div>
                  <div className="mt-4 pt-2 border-t border-white/5 flex justify-between items-center text-[10px] text-gray-400">
                    <span>Mulai Tanam:</span>
                    <span className="font-semibold text-white">{selectedLahan.tanggalTanam || 'Tidak tersedia'}</span>
                  </div>
                </div>

              </div>

              {/* HISTORICAL TREND CHARTS */}
              <div className="bg-white/5 border border-white/10 rounded-[24px] p-5 md:p-6 shadow-xl">
                <h3 className="font-bold text-white text-sm mb-5 flex items-center gap-2 border-b border-white/5 pb-3">
                  <Activity className="w-4.5 h-4.5 text-primary" />
                  <span>Tren Sensor Lahan (7 Hari Terakhir)</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Chart 1: Kelembapan */}
                  <div className="space-y-3">
                    <span className="text-xs font-semibold text-gray-400 block">Status Kelembapan Lahan (%)</span>
                    <div className="bg-black/30 border border-white/5 rounded-2xl p-3">
                      <ResponsiveContainer width="100%" height={160}>
                        <AreaChart data={mockTrendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorMoisture" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                          <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} domain={[60, 100]} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#09090b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                            labelStyle={{ color: '#a1a1aa', fontWeight: 'bold', fontSize: '11px' }}
                            itemStyle={{ color: '#10b981', fontSize: '12px' }}
                          />
                          <Area type="monotone" dataKey="kelembapan" name="Kelembapan" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorMoisture)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 2: Suhu */}
                  <div className="space-y-3">
                    <span className="text-xs font-semibold text-gray-400 block">Suhu Udara (°C)</span>
                    <div className="bg-black/30 border border-white/5 rounded-2xl p-3">
                      <ResponsiveContainer width="100%" height={160}>
                        <AreaChart data={mockTrendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f5a623" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#f5a623" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                          <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} domain={[15, 35]} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#09090b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                            labelStyle={{ color: '#a1a1aa', fontWeight: 'bold', fontSize: '11px' }}
                            itemStyle={{ color: '#f5a623', fontSize: '12px' }}
                          />
                          <Area type="monotone" dataKey="suhu" name="Suhu" stroke="#f5a623" strokeWidth={2} fillOpacity={1} fill="url(#colorTemp)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              {/* CATATAN MITIGASI SAAT CHECK SUITABILITY */}
              {selectedLahan.catatanMitigasi && (
                <div className="bg-white/5 border border-white/5 rounded-[24px] p-5 md:p-6 shadow-xl">
                  <h4 className="font-bold text-white mb-3 text-xs uppercase tracking-widest text-gray-400 border-b border-white/5 pb-2">Instruksi Tanam Awal</h4>
                  <p className="text-xs text-gray-300 whitespace-pre-line leading-relaxed">{selectedLahan.catatanMitigasi}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT 2: WEATHER & CLIMATE */}
          {innerTab === 'weather' && (
            <div className="space-y-6">
              <KalenderTanam savedLahans={[selectedLahan]} cropsDbList={cropsList} />
              
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 text-xs text-amber-300 flex items-center gap-3 shadow-lg">
                <Lightbulb className="w-5 h-5 text-amber-400 shrink-0" />
                <p className="leading-relaxed">Dibandingkan rata-rata historis 5 tahun terakhir: <strong className="text-white">+1.2°C lebih panas</strong> akibat pergeseran iklim lokal.</p>
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
                  <div className="bg-white/5 border border-white/5 rounded-[24px] p-5 md:p-6 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-white/5">
                      <h3 className="font-bold text-white text-sm flex items-center gap-2">
                        <CheckCircle2 className={`w-5 h-5 ${isExtremeWeather ? 'text-amber-500' : 'text-primary'}`} />
                        <span>{isExtremeWeather ? 'Checklist Tindakan Penyelamatan Lahan' : 'Checklist Tindakan Pemeliharaan Rutin'}</span>
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider">Progres:</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          progressPercent === 100 ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-white/5 text-gray-400 border border-white/10'
                        }`}>
                          {progressPercent}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-black/40 h-2.5 rounded-full overflow-hidden mb-6 border border-white/5 p-[1px] relative">
                      <div 
                        className="h-full rounded-full transition-all duration-500 bg-primary"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    
                    <p className="text-xs text-gray-300 mb-6 leading-relaxed">
                      {isExtremeWeather 
                        ? `Kami mendeteksi anomali cuaca berupa curah hujan ekstrim (${selectedLahan.curahHujan} mm/bln) di ketinggian lahan ${selectedLahan.ketinggian} mdpl. Jalankan rekomendasi taktis berikut segera:`
                        : `Kondisi curah hujan (${selectedLahan.curahHujan} mm/bln) dan suhu udara (${selectedLahan.suhu}°C) stabil di batas optimal. Jalankan perawatan harian berikut untuk memaksimalkan pertumbuhan varietas ${selectedLahan.varietasDitanam}:`}
                    </p>

                    <div className="space-y-3">
                      {isExtremeWeather ? (
                        <>
                          <div className="flex items-start gap-3 p-4 bg-black/20 border border-white/5 rounded-2xl text-xs hover:border-amber-500/20 transition-all">
                            <input 
                              type="checkbox" 
                              checked={checkedActivities['Buka katup drainase sawah'] || false}
                              onChange={(e) => handleToggleActivity('Buka katup drainase sawah', e.target.checked)}
                              className="mt-0.5 rounded border-white/10 text-amber-500 focus:ring-0 focus:ring-offset-0 bg-transparent cursor-pointer" 
                            />
                            <div className="text-white">
                              <strong className={checkedActivities['Buka katup drainase sawah'] ? 'line-through text-gray-500 font-semibold' : 'font-semibold'}>Buka katup drainase sawah</strong>
                              <p className="text-[10px] text-gray-400 mt-1">Keluarkan limpahan air berlebih untuk mencegah busuk akar.</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-4 bg-black/20 border border-white/5 rounded-2xl text-xs hover:border-amber-500/20 transition-all">
                            <input 
                              type="checkbox" 
                              checked={checkedActivities['Pemangkasan daun terbawah'] || false}
                              onChange={(e) => handleToggleActivity('Pemangkasan daun terbawah', e.target.checked)}
                              className="mt-0.5 rounded border-white/10 text-amber-500 focus:ring-0 focus:ring-offset-0 bg-transparent cursor-pointer" 
                            />
                            <div className="text-white">
                              <strong className={checkedActivities['Pemangkasan daun terbawah'] ? 'line-through text-gray-500 font-semibold' : 'font-semibold'}>Pemangkasan daun terbawah</strong>
                              <p className="text-[10px] text-gray-400 mt-1">Kurangi kelembapan rumpun tanaman varietas {selectedLahan.varietasDitanam}.</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-4 bg-black/20 border border-white/5 rounded-2xl text-xs hover:border-amber-500/20 transition-all">
                            <input 
                              type="checkbox" 
                              checked={checkedActivities['Semprotkan fungisida organik'] || false}
                              onChange={(e) => handleToggleActivity('Semprotkan fungisida organik', e.target.checked)}
                              className="mt-0.5 rounded border-white/10 text-amber-500 focus:ring-0 focus:ring-offset-0 bg-transparent cursor-pointer" 
                            />
                            <div className="text-white">
                              <strong className={checkedActivities['Semprotkan fungisida organik'] ? 'line-through text-gray-500 font-semibold' : 'font-semibold'}>Semprotkan fungisida organik</strong>
                              <p className="text-[10px] text-gray-400 mt-1">Lakukan pencegahan awal terhadap serangan jamur patogen.</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-4 bg-black/20 border border-white/5 rounded-2xl text-xs hover:border-amber-500/20 transition-all">
                            <input 
                              type="checkbox" 
                              checked={checkedActivities['Monitor tanggul bedengan'] || false}
                              onChange={(e) => handleToggleActivity('Monitor tanggul bedengan', e.target.checked)}
                              className="mt-0.5 rounded border-white/10 text-amber-500 focus:ring-0 focus:ring-offset-0 bg-transparent cursor-pointer" 
                            />
                            <div className="text-white">
                              <strong className={checkedActivities['Monitor tanggul bedengan'] ? 'line-through text-gray-500 font-semibold' : 'font-semibold'}>Monitor tanggul bedengan</strong>
                              <p className="text-[10px] text-gray-400 mt-1">Pastikan tidak terjadi sumbatan aliran air di saluran irigasi utama.</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-start gap-3 p-4 bg-black/20 border border-white/5 rounded-2xl text-xs hover:border-primary/20 transition-all">
                            <input 
                              type="checkbox" 
                              checked={checkedActivities['Irigasi Harian Terjadwal'] || false}
                              onChange={(e) => handleToggleActivity('Irigasi Harian Terjadwal', e.target.checked)}
                              className="mt-0.5 rounded border-white/10 text-primary focus:ring-0 focus:ring-offset-0 bg-transparent cursor-pointer" 
                            />
                            <div className="text-white">
                              <strong className={checkedActivities['Irigasi Harian Terjadwal'] ? 'line-through text-gray-500 font-semibold' : 'font-semibold'}>Irigasi Harian Terjadwal</strong>
                              <p className="text-[10px] text-gray-400 mt-1">Salurkan air irigasi sebanyak {(selectedLahan.kebutuhanAirDaily || 5) * selectedLahan.luas} Liter di pagi hari.</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-4 bg-black/20 border border-white/5 rounded-2xl text-xs hover:border-primary/20 transition-all">
                            <input 
                              type="checkbox" 
                              checked={checkedActivities['Pembersihan Parit'] || false}
                              onChange={(e) => handleToggleActivity('Pembersihan Parit', e.target.checked)}
                              className="mt-0.5 rounded border-white/10 text-primary focus:ring-0 focus:ring-offset-0 bg-transparent cursor-pointer" 
                            />
                            <div className="text-white">
                              <strong className={checkedActivities['Pembersihan Parit'] ? 'line-through text-gray-500 font-semibold' : 'font-semibold'}>Pembersihan Parit</strong>
                              <p className="text-[10px] text-gray-400 mt-1">Bersihkan parit irigasi dari sisa gulma atau lumpur penyumbat.</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-4 bg-black/20 border border-white/5 rounded-2xl text-xs hover:border-primary/20 transition-all">
                            <input 
                              type="checkbox" 
                              checked={checkedActivities['Pengecekan Mulsa Lahan'] || false}
                              onChange={(e) => handleToggleActivity('Pengecekan Mulsa Lahan', e.target.checked)}
                              className="mt-0.5 rounded border-white/10 text-primary focus:ring-0 focus:ring-offset-0 bg-transparent cursor-pointer" 
                            />
                            <div className="text-white">
                              <strong className={checkedActivities['Pengecekan Mulsa Lahan'] ? 'line-through text-gray-500 font-semibold' : 'font-semibold'}>Pengecekan Mulsa Lahan</strong>
                              <p className="text-[10px] text-gray-400 mt-1">Pastikan mulsa organik/jerami penutup tanah tidak tergeser.</p>
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
          <div className="flex flex-col sm:flex-row gap-4 border-t border-white/10 pt-6 mt-8">
            <button 
              onClick={() => {
                setCurrentView('dashboard');
                setSelectedLahan(null);
              }}
              className="flex-1 py-3.5 px-6 rounded-full border border-white/10 hover:bg-white/5 text-gray-300 hover:text-white font-bold text-xs tracking-wider uppercase transition-all text-center cursor-pointer"
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
              className="flex-1 py-3.5 px-6 rounded-full bg-primary hover:bg-primary-dark text-black font-bold text-xs tracking-wider uppercase transition-all text-center shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-pointer"
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

            {/* Toggle Notifikasi Push */}
            <div className="border-t border-border-medium pt-4 mt-4">
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Notifikasi Dini Cuaca</label>
              <div className="flex items-center justify-between p-3 bg-bg-dark border border-border-medium rounded-xl">
                <span className="text-sm font-semibold text-text-main">Aktifkan Notifikasi Push</span>
                <button
                  type="button"
                  disabled={notifLoading}
                  onClick={handleToggleNotification}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 ${
                    isSubscribed ? "bg-emerald-500 justify-end" : "bg-white/10 justify-start"
                  }`}
                >
                  <motion.div 
                    layout 
                    className="bg-white w-4 h-4 rounded-full shadow-md"
                  />
                </button>
              </div>
              <p className="text-xs text-text-muted mt-2 leading-relaxed">
                Terima pemberitahuan langsung di perangkat Anda ketika ada anomali cuaca ekstrem terdeteksi pada lahan yang Anda tanam.
              </p>
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
        {/* Bento Stats Grid (Premium Modern) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 mb-10">
          
          {/* Lahan Summary - Large Bento Cell */}
          <div className="md:col-span-8 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-2xl border border-white/10 p-6 md:p-8 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:border-white/20 transition-all shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none transition-all group-hover:bg-primary/20"></div>
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-[0.2em] mb-2 block">Portofolio Lahan</span>
              <div className="flex items-end gap-3">
                <strong className="text-5xl md:text-6xl font-extrabold text-white tracking-tighter leading-none">{lahans.length}</strong>
                <span className="text-lg text-gray-400 font-medium mb-1">Bidang Aktif</span>
              </div>
            </div>
            
            <div className="h-full w-full md:w-px md:h-16 bg-white/10"></div>
            
            <div className="flex-1">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 block">Total Luas Kelolaan</span>
              <strong className="text-2xl md:text-3xl text-white font-bold tracking-tight">
                {lahans.reduce((sum, l) => sum + l.luas, 0).toLocaleString('id-ID')} <span className="text-lg text-primary">m²</span>
              </strong>
            </div>
          </div>

          {/* Panen Sukses - Small Bento Cell */}
          <div className="md:col-span-4 bg-white/5 backdrop-blur-xl border border-white/10 p-6 md:p-8 rounded-3xl flex flex-col justify-between gap-4 hover:bg-white/10 transition-colors shadow-xl group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-[0.15em]">Panen Sukses</span>
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div>
              <strong className="text-4xl text-white font-extrabold tracking-tighter block">{panens.filter(p => p.statusHasil === 'sukses').length}</strong>
              <span className="text-sm text-gray-400 mt-1 block">Siklus Diselesaikan</span>
            </div>
          </div>

        </div>

        {/* ALERTS SECTION (CUACA BURUK) */}
        {activeAlerts.length > 0 && (
          <div className="bg-gradient-to-r from-red-500/10 to-transparent border-l-4 border-l-red-500 border-y border-r border-white/5 backdrop-blur-md rounded-r-2xl p-6 mb-10 flex items-start gap-4 shadow-lg">
            <div className="p-2 bg-red-500/20 rounded-xl border border-red-500/30 shrink-0 animate-pulse">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h3 className="font-bold text-white tracking-tight text-base mb-1.5">Peringatan Dini Cuaca Ekstrem Terdeteksi</h3>
              <p className="text-sm text-gray-300 leading-relaxed max-w-3xl">
                Terdapat <strong>{activeAlerts.length} Lahan</strong> Anda berada di profil cuaca ekstrem. Silakan klik tombol "Pantau Lahan" di lahan yang bersangkutan untuk mendapatkan rincian panduan mitigasi bencana pertanian.
              </p>
            </div>
          </div>
        )}

        {/* TABS (Lahan Sawah vs Riwayat Panen) */}
        {/* MODERN NAVIGATION PILLS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-5">
          <div className="inline-flex bg-white/5 backdrop-blur-md border border-white/10 rounded-full p-1.5">
            <button 
              onClick={() => setActiveTab('lahan')}
              className={`py-2.5 px-6 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'lahan' 
                  ? 'bg-white text-black shadow-md' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <MapIcon className="w-4 h-4"/> Daftar Lahan
            </button>
            <button 
              onClick={() => setActiveTab('panen')}
              className={`py-2.5 px-6 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'panen' 
                  ? 'bg-white text-black shadow-md' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4"/> Riwayat Panen
            </button>
          </div>

          {activeTab === 'lahan' && (
            <button 
              onClick={() => setCurrentView('add-lahan')}
              className="bg-primary hover:bg-primary-dark text-black font-bold py-3 px-6 rounded-full text-sm transition-all flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] w-full md:w-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Lahan Baru</span>
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
                  className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-3xl p-6 hover:bg-white/10 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden shrink-0 w-[85vw] sm:w-[350px] md:w-auto snap-start"
                >
                  <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-[60px] -mr-16 -mt-16 pointer-events-none group-hover:bg-primary/20 transition-all duration-500"></div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-white font-extrabold text-xl leading-tight group-hover:text-primary transition-colors tracking-tight">{lahan.nama}</h3>
                        <span className="text-sm text-gray-400 mt-1 block font-medium">Luas: {lahan.luas.toLocaleString('id-ID')} m²</span>
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



