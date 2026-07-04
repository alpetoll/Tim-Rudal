'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sprout,
  ArrowRight,
  Mail,
  MapPin,
  Activity,
  TrendingUp,
  AlertTriangle,
  Menu,
  X,
  CloudRain,
  Leaf,
  CloudLightning,
  Droplets
} from 'lucide-react';
const EcoTaniAnimatedLogo = () => {
  return (
    <div className="w-full h-full relative flex items-center justify-center">
      <motion.img
        src="/assets/logo.webp"
        alt="EcoTani Loading"
        className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(46,125,50,0.4)]"
        initial={{ scale: 0, opacity: 0, rotate: -30 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ duration: 1.2, type: "spring", bounce: 0.5 }}
      />
    </div>
  );
};

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Ensure dark mode is strictly enforced globally
    document.documentElement.classList.add('dark');
    localStorage.setItem('ecotani_theme', 'dark');

    // Loading screen timer
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3500); // 3.5 detik agar animasi beres
    return () => clearTimeout(timer);
  }, []);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <>
      {/* LOADING SCREEN */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            key="loading-screen"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[9999] bg-[#0a0a0a] flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ opacity: 1 }}
              className="relative w-40 h-40 md:w-56 md:h-56 mb-8"
            >
              <EcoTaniAnimatedLogo />

            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-center"
            >
              <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-widest mb-3 uppercase">EcoTani</h1>
              <div className="flex items-center justify-center gap-2">
                <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0 }} className="w-2 h-2 rounded-full bg-[#8bc34a]" />
                <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} className="w-2 h-2 rounded-full bg-[#8bc34a]" />
                <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }} className="w-2 h-2 rounded-full bg-[#8bc34a]" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-bg-dark text-text-main font-sans overflow-x-hidden min-h-screen">

        {/* NAVBAR CONTAINER (FLOATING OVAL) */}
        <div className="fixed top-4 left-4 right-4 z-50 flex justify-center">
          <header className="w-full max-w-6xl bg-white/5 backdrop-blur-xl rounded-full shadow-2xl border border-white/10 px-6 py-2 flex items-center justify-between h-16 transition-all duration-300">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 pl-2">
              <img src="/assets/logo.webp" alt="Logo EcoTani" className="h-9 w-9 drop-shadow-[0_0_8px_rgba(0,168,89,0.5)]" />
              <span className="font-extrabold text-xl text-white tracking-tight">EcoTani</span>
            </Link>

            {/* Nav Menu (Desktop) */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#hero" className="text-gray-300 hover:text-primary-light font-medium text-sm transition-colors py-1 relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-primary-light hover:after:w-full after:transition-all after:duration-300">Beranda</a>
              <a href="#masalah" className="text-gray-300 hover:text-primary-light font-medium text-sm transition-colors py-1 relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-primary-light hover:after:w-full after:transition-all after:duration-300">Tentang</a>
              <a href="#fitur" className="text-gray-300 hover:text-primary-light font-medium text-sm transition-colors py-1 relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-primary-light hover:after:w-full after:transition-all after:duration-300">Solusi</a>
              <a href="#cara-kerja" className="text-gray-300 hover:text-primary-light font-medium text-sm transition-colors py-1 relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-primary-light hover:after:w-full after:transition-all after:duration-300">Cara Kerja</a>
            </nav>

            {/* Actions (Desktop) */}
            <div className="hidden md:flex items-center gap-3 pr-2">

              <Link href="/auth" className="px-5 py-2 rounded-full font-semibold text-sm text-white bg-primary-dark hover:bg-emerald-800 hover:shadow-md transition-all duration-300 flex items-center gap-2 hover:translate-x-0.5">
                <span>Masuk</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/auth?mode=register" className="px-5 py-2 rounded-full font-semibold text-sm text-white bg-primary hover:bg-emerald-600 hover:shadow-md transition-all duration-300 flex items-center gap-2 hover:translate-x-0.5">
                <span>Daftar</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Hamburger Menu for Mobile */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden flex items-center justify-center p-2 rounded-full hover:bg-white/10 text-white transition-colors"
              aria-label="Buka menu navigasi"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </header>

          {/* Mobile Dropdown Menu (Full Screen Overlay with Crazy Animation) */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, clipPath: 'circle(0% at 90% 10%)' }}
                animate={{ opacity: 1, clipPath: 'circle(150% at 90% 10%)' }}
                exit={{ opacity: 0, clipPath: 'circle(0% at 90% 10%)' }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-0 z-[100] bg-[#050505]/95 backdrop-blur-3xl flex flex-col items-center justify-center p-6 md:hidden overflow-hidden"
              >
                {/* Crazy Background Grid for Menu */}
                <div className="absolute inset-0 z-0 opacity-30 pointer-events-none bg-[linear-gradient(to_right,#00a85920_1px,transparent_1px),linear-gradient(to_bottom,#00a85920_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>

                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="absolute top-6 right-6 p-3 rounded-full bg-white/5 border border-white/10 text-white hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all z-50"
                >
                  <X className="w-8 h-8" />
                </button>

                <nav className="flex flex-col items-center gap-8 w-full relative z-10">
                  {['Beranda', 'Tentang', 'Solusi', 'Cara Kerja'].map((item, i) => {
                    const hrefs = ['#hero', '#masalah', '#fitur', '#cara-kerja'];
                    return (
                      <motion.a
                        key={item}
                        href={hrefs[i]}
                        onClick={() => setMobileMenuOpen(false)}
                        initial={{ y: 50, opacity: 0, scale: 0.9 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 + (i * 0.1), duration: 0.5, type: 'spring', bounce: 0.4 }}
                        className="text-white font-extrabold text-4xl uppercase tracking-widest hover:text-emerald-400 hover:scale-110 transition-all cursor-pointer"
                      >
                        {item}
                      </motion.a>
                    );
                  })}
                </nav>

                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  className="flex flex-col gap-4 w-full max-w-xs mt-12 relative z-10"
                >
                  <Link href="/auth" onClick={() => setMobileMenuOpen(false)} className="w-full py-4 rounded-full font-bold text-lg text-center text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all cursor-pointer">Masuk</Link>
                  <Link href="/auth?mode=register" onClick={() => setMobileMenuOpen(false)} className="w-full py-4 rounded-full font-bold text-lg text-center text-[#050505] bg-emerald-400 hover:bg-emerald-300 transition-colors shadow-[0_0_20px_rgba(52,211,153,0.3)] cursor-pointer">Daftar</Link>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* HERO SECTION - GEOSPATIAL THEME */}
        <section className="min-h-screen flex flex-col justify-center pt-24 pb-12 bg-[#050505] relative overflow-hidden" id="hero">

          {/* Modern GeoSpatial Background (No Radar) */}
          <div className="absolute inset-0 z-0">
            {/* Subtle Grid & Glow */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#8bc34a08_1px,transparent_1px),linear-gradient(to_bottom,#8bc34a08_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]"></div>

            {/* Soft ambient glows */}
            <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-primary/20 rounded-full blur-[100px] opacity-50 mix-blend-screen hidden md:block"></div>
            <div className="absolute top-1/2 right-1/4 w-[400px] h-[400px] bg-primary-light/10 rounded-full blur-[120px] opacity-50 mix-blend-screen hidden md:block"></div>
          </div>

          <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 items-center gap-12 lg:gap-8 relative z-10">

            {/* Hero Content (Left) */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex flex-col items-start text-left"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full mb-6 backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-primary-light animate-pulse"></span>
                <span className="text-primary-light font-medium text-xs tracking-wide">Platform Pemantauan Pertanian Modern</span>
              </div>

              <h1 className="text-white font-extrabold text-4xl md:text-5xl lg:text-6xl leading-[1.15] tracking-tight mb-6">
                EcoTani: <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-light to-primary drop-shadow-sm">
                  Sawah Terlindungi,
                </span><br />
                Panen Terjaga
              </h1>

              <p className="text-gray-400 text-sm md:text-base lg:text-lg mb-10 max-w-lg leading-relaxed">
                Tingkatkan hasil panen Anda dengan platform pemantauan lahan presisi dan peringatan dini cuaca ekstrem berbasis teknologi geospasial real-time.
              </p>

              <Link href="/auth" className="inline-flex items-center gap-3 px-8 py-4 bg-primary text-white font-bold rounded-full hover:bg-primary-dark shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300 group overflow-hidden relative">
                <span className="relative z-10 flex items-center gap-2">
                  Mulai Pantau Lahan Anda
                  <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </Link>
            </motion.div>

            {/* Hero Visuals (Right) */}
            <div className="hidden lg:flex relative h-[400px] md:h-[500px] w-full justify-center items-center">

              {/* Center Visual Box */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, delay: 0.2 }}
                className="absolute w-[80%] md:w-[400px] h-[400px] bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl shadow-primary/20 flex flex-col justify-center items-center"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-primary-dark/40 to-transparent mix-blend-overlay"></div>
                <img src="/assets/logo.webp" alt="EcoTani" className="w-32 h-32 mb-6 drop-shadow-[0_0_20px_rgba(139,195,74,0.4)] z-10" />
                <div className="z-10 text-center px-6">
                  <h3 className="text-xl font-bold text-white mb-2">Sistem Cerdas</h3>
                  <p className="text-sm text-gray-300">Memantau kesehatan tanaman dan cuaca secara presisi</p>
                </div>
              </motion.div>

              {/* Floating Elements (Nature Theme instead of Hacker) */}
              <motion.div
                initial={{ opacity: 0, x: 50, y: -20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                style={{ animation: 'float 6s ease-in-out infinite' }}
                className="absolute top-12 -right-4 lg:-right-8 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-center gap-4 shadow-xl z-20"
              >
                <div className="p-3 rounded-full bg-primary/20 text-primary-light">
                  <CloudRain className="w-6 h-6" />
                </div>
                <div>
                  <span className="block text-xs text-gray-400 font-medium">Prediksi Hujan</span>
                  <span className="block text-sm font-bold text-white">Normal (Aman)</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -50, y: 20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                style={{ animation: 'float 5s ease-in-out infinite reverse' }}
                className="absolute bottom-12 -left-4 lg:-left-8 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-center gap-4 shadow-xl z-20"
              >
                <div className="p-3 rounded-full bg-emerald-500/20 text-emerald-400">
                  <Leaf className="w-6 h-6" />
                </div>
                <div>
                  <span className="block text-xs text-gray-400 font-medium">Kondisi Lahan</span>
                  <span className="block text-sm font-bold text-white">Sangat Optimal</span>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* SECTION 2: PERUBAHAN IKLIM NYATA */}
        <section className="bg-bg-dark py-16 md:py-24 border-t border-border-light" id="masalah">
          <div className="max-w-6xl mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-text-main font-extrabold text-3xl md:text-4xl leading-tight mb-4 tracking-tight">Perubahan Iklim Nyata,<br />Petani Tidak Boleh Sendirian</h2>
              <p className="text-text-muted text-sm md:text-base lg:text-[1.05rem] leading-relaxed">Sektor pertanian adalah yang paling rentan terdampak oleh krisis iklim. Pola cuaca yang tidak menentu, pergeseran musim tanam, hingga ancaman kekeringan mendadak sering kali menjadi dalang utama gagal panen massal yang merugikan petani secara materiel dan waktu.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {/* Card 1 */}
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
                whileHover={{ scale: 1.03 }}
                className="bg-border-light border border-white/[0.06] backdrop-blur-md rounded-2xl p-8 md:p-10 hover:border-primary/30 hover:bg-white/[0.04] transition-colors duration-300 shadow-xl flex flex-col gap-4"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center text-primary-light shadow-[0_0_20px_rgba(139,195,74,0.15)] mb-2">
                  <CloudLightning className="w-7 h-7" />
                </div>
                <h3 className="text-primary-light font-bold text-xl md:text-2xl mb-1">Anomali Cuaca Ekstrem</h3>
                <p className="text-text-muted text-sm md:text-base leading-relaxed">Pemantauan cuaca akurat dan terpercaya, berkontribusi penting meminimalisir kerusakan tanaman tradisional.</p>
              </motion.div>
              {/* Card 2 */}
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: 0.2 }}
                whileHover={{ scale: 1.03 }}
                className="bg-border-light border border-white/[0.06] backdrop-blur-md rounded-2xl p-8 md:p-10 hover:border-primary/30 hover:bg-white/[0.04] transition-colors duration-300 shadow-xl flex flex-col gap-4"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center text-primary-light shadow-[0_0_20px_rgba(139,195,74,0.15)] mb-2">
                  <Droplets className="w-7 h-7" />
                </div>
                <h3 className="text-primary-light font-bold text-xl md:text-2xl mb-1">Krisis Kelembapan Tanah</h3>
                <p className="text-text-muted text-sm md:text-base leading-relaxed">Penyusutan kandungan air tanah yang lambat-laun dapat menyebabkan penurunan hasil panen secara massal.</p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* SECTION 3: TEKNOLOGI CERDAS */}
        <section className="bg-bg-dark py-16 md:py-24 border-t border-border-light" id="fitur">
          <div className="max-w-6xl mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-text-main font-extrabold text-3xl md:text-4xl leading-tight mb-4 tracking-tight">Teknologi Cerdas untuk<br />Pertanian Tangguh Iklim</h2>
              <p className="text-text-muted text-sm md:text-base lg:text-[1.05rem] leading-relaxed">Kami menghadirkan platform mitigasi berbasis data geospasial untuk membantu Anda mengambil langkah tepat sebelum terlambat.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="bg-bg-card border border-white/[0.05] rounded-2xl overflow-hidden flex flex-col h-full hover:border-primary/25 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 group"
              >
                <div className="w-full h-48 md:h-52 overflow-hidden">
                  <img src="/assets/plotting-lahan.jpg" alt="Plotting Lahan" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                </div>
                <div className="p-6 flex flex-col flex-grow">
                  <h3 className="text-primary-light font-bold text-lg md:text-xl mb-3">Plotting Lahan</h3>
                  <p className="text-text-muted text-xs md:text-sm leading-relaxed">Tandai dan petakan koordinat sawah Anda dengan mudah langsung di peta satelit. Sistem kami akan memetakan batas wilayah lahan Anda secara presisi.</p>
                </div>
              </motion.div>

              {/* Feature 2 */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: 0.15 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="bg-bg-card border border-white/[0.05] rounded-2xl overflow-hidden flex flex-col h-full hover:border-primary/25 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 group"
              >
                <div className="w-full h-48 md:h-52 overflow-hidden">
                  <img src="/assets/analisis-satelit.jpg" alt="Analisis Satelit Real-Time" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                </div>
                <div className="p-6 flex flex-col flex-grow">
                  <h3 className="text-primary-light font-bold text-lg md:text-xl mb-3">Analisis Satelit Real-Time</h3>
                  <p className="text-text-muted text-xs md:text-sm leading-relaxed">Pantau indeks kesehatan vegetasi tanaman (NDVI) dan tingkat kelembapan tanah melalui sensor satelit pemantau bumi terbaru di lapangan secara otomatis.</p>
                </div>
              </motion.div>

              {/* Feature 3 */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: 0.3 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="bg-bg-card border border-white/[0.05] rounded-2xl overflow-hidden flex flex-col h-full hover:border-primary/25 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 group"
              >
                <div className="w-full h-48 md:h-52 overflow-hidden">
                  <img src="/assets/early-warning.jpg" alt="Sistem Peringatan Dini" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                </div>
                <div className="p-6 flex flex-col flex-grow">
                  <h3 className="text-primary-light font-bold text-lg md:text-xl mb-3">Sistem Peringatan Dini</h3>
                  <p className="text-text-muted text-xs md:text-sm leading-relaxed">Dapatkan rekomendasi aksi dan notifikasi darurat secara instan jika sistem mendeteksi adanya risiko kekeringan ataupun curah hujan di luar batas normal.</p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* SECTION 4: CARA KERJA */}
        <section className="bg-bg-dark py-16 md:py-24 border-t border-border-light" id="cara-kerja">
          <div className="max-w-6xl mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-text-main font-extrabold text-3xl md:text-4xl leading-tight mb-4 tracking-tight">Langkah Mudah Amankan<br />Panen Anda</h2>
              <p className="text-text-muted text-sm md:text-base lg:text-[1.05rem] leading-relaxed">Kami menghadirkan platform mitigasi berbasis data geospasial untuk membantu Anda mengambil langkah tepat sebelum terlambat.</p>
            </div>

            {/* Timeline Container */}
            <div className="steps-timeline relative flex flex-col md:flex-row md:justify-between md:items-start gap-12 md:gap-8 lg:gap-12 mt-12 md:mt-20">

              {/* Step 1 */}
              <div className="group flex flex-row md:flex-col items-start md:items-center text-left md:text-center w-full gap-6 md:gap-0 relative z-10">
                <div className="shrink-0 md:mb-8">
                  <div className="w-[70px] h-[70px] rounded-full bg-bg-dark border-2 border-border-medium text-primary-light font-bold text-xl flex items-center justify-center shadow-lg shadow-black/80 group-hover:border-primary-light group-hover:bg-primary-dark group-hover:text-text-main transition-all duration-300">01</div>
                </div>
                <div className="flex-grow pt-2 md:pt-0">
                  <h3 className="text-text-main font-bold text-lg md:text-xl mb-2">Buat Akun & Cari Lokasi</h3>
                  <p className="text-text-muted text-sm leading-relaxed max-w-[280px] md:mx-auto">Daftar gratis di platform kami, cari lokasi sawah Anda secara presisi di peta digital.</p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="group flex flex-row md:flex-col items-start md:items-center text-left md:text-center w-full gap-6 md:gap-0 relative z-10">
                <div className="shrink-0 md:mb-8">
                  <div className="w-[70px] h-[70px] rounded-full bg-bg-dark border-2 border-border-medium text-primary-light font-bold text-xl flex items-center justify-center shadow-lg shadow-black/80 group-hover:border-primary-light group-hover:bg-primary-dark group-hover:text-text-main transition-all duration-300">02</div>
                </div>
                <div className="flex-grow pt-2 md:pt-0">
                  <h3 className="text-text-main font-bold text-lg md:text-xl mb-2">Gambar Batas Lahan Anda</h3>
                  <p className="text-text-muted text-sm leading-relaxed max-w-[280px] md:mx-auto">Gunakan alat bantu gambar peta untuk menggaris sudut-sudut sawah Anda. Cukup klik dan hubungkan titiknya untuk membentuk polygon.</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="group flex flex-row md:flex-col items-start md:items-center text-left md:text-center w-full gap-6 md:gap-0 relative z-10">
                <div className="shrink-0 md:mb-8">
                  <div className="w-[70px] h-[70px] rounded-full bg-bg-dark border-2 border-border-medium text-primary-light font-bold text-xl flex items-center justify-center shadow-lg shadow-black/80 group-hover:border-primary-light group-hover:bg-primary-dark group-hover:text-text-main transition-all duration-300">03</div>
                </div>
                <div className="flex-grow pt-2 md:pt-0">
                  <h3 className="text-text-main font-bold text-lg md:text-xl mb-2 flex flex-col md:block">
                    <span>Pantau Dashboard &</span>
                    <span>Terima Notifikasi</span>
                  </h3>
                  <p className="text-text-muted text-sm leading-relaxed max-w-[280px] md:mx-auto">Cek kondisi tanah secara real-time di dashboard dan aktifkan notifikasi agar langsung mendapat peringatan jika cuaca buruk mendekat.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="bg-[#070908] border-t border-border-light pt-16 pb-8">
          <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">

            {/* Brand & Info */}
            <div className="flex flex-col items-start">
              <a href="#" className="flex items-center gap-3 mb-4">
                <img src="/assets/logo.webp" alt="EcoTani Logo" className="h-9 w-9" />
                <span className="text-text-main font-extrabold text-xl tracking-tight">EcoTani</span>
              </a>
              <p className="text-text-muted text-sm md:text-base leading-relaxed mb-6 max-w-sm">Platform cerdas pemetaan sawah untuk mitigasi risiko gagal panen akibat perubahan iklim pertanian Indonesia.</p>
              <a href="mailto:info.ecotani@gmail.com" className="inline-flex items-center gap-2 text-text-main hover:text-primary-light transition-colors text-sm py-1">
                <Mail className="w-4.5 h-4.5 text-primary-light" />
                <span>info.ecotani@gmail.com</span>
              </a>
            </div>

            {/* Footer Navigation Grid */}
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h4 className="text-text-main font-bold text-xs tracking-wider uppercase mb-5">TAUTAN</h4>
                <ul className="flex flex-col gap-3 text-text-muted text-sm">
                  <li><a href="#hero" className="hover:text-primary-light hover:translate-x-1 transition-all inline-block">Beranda</a></li>
                  <li><a href="#masalah" className="hover:text-primary-light hover:translate-x-1 transition-all inline-block">Tentang Kami</a></li>
                  <li><a href="#fitur" className="hover:text-primary-light hover:translate-x-1 transition-all inline-block">Solusi</a></li>
                  <li><a href="#cara-kerja" className="hover:text-primary-light hover:translate-x-1 transition-all inline-block">Cara Kerja</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-text-main font-bold text-xs tracking-wider uppercase mb-5">TATA KELOLA</h4>
                <ul className="flex flex-col gap-3 text-text-muted text-sm">
                  <li><a href="#" className="hover:text-primary-light hover:translate-x-1 transition-all inline-block">Syarat & Ketentuan</a></li>
                  <li><a href="#" className="hover:text-primary-light hover:translate-x-1 transition-all inline-block">Dokumentasi Sistem</a></li>
                  <li><a href="#" className="hover:text-primary-light hover:translate-x-1 transition-all inline-block">Kebijakan Privasi</a></li>
                  <li><a href="#" className="hover:text-primary-light hover:translate-x-1 transition-all inline-block">Kebijakan Cookie</a></li>
                </ul>
              </div>
            </div>

          </div>

          {/* Footer Bottom Copyright & Credits */}
          <div className="border-t border-border-light pt-8">
            <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-xs md:text-sm text-text-muted text-center md:text-left">
              <p>&copy; 2026 EcoTani. Hak Cipta Dilindungi Undang-Undang.</p>
              <p className="md:text-right leading-relaxed">
                Developed by <a href="#" className="text-primary-light hover:underline font-semibold">Tim Rudal</a> <br className="md:hidden" />
                <span className="hidden md:inline"> - </span>Telkom University Purwokerto <span className="text-emerald-500 font-bold mx-1">X</span> Universitas Jendral Soedirman
              </p>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}


