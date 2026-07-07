'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  Droplets,
  Sparkles,
  ChevronDown
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
  const [videoError, setVideoError] = useState(false);
  const [isMobile, setIsMobile] = useState(true);
  const router = useRouter();
  const [heroEmail, setHeroEmail] = useState('');

  const handleCobaSekarang = () => {
    if (heroEmail.trim()) {
      router.push(`/auth?mode=register&email=${encodeURIComponent(heroEmail.trim())}`);
    } else {
      router.push('/auth?mode=register');
    }
  };

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Ensure dark mode is strictly enforced globally
    document.documentElement.classList.add('dark');
    localStorage.setItem('ecotani_theme', 'dark');

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);

    // Loading screen timer
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3500); // 3.5 detik agar animasi beres
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
    };
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
          <header className={`w-full max-w-6xl rounded-full px-6 py-2 flex items-center justify-between h-16 transition-all duration-300 ${
            isScrolled 
              ? 'bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.8)] shadow-black/80' 
              : 'bg-white/5 backdrop-blur-xl border border-white/10 shadow-none'
          }`}>

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

              <Link href="/auth" className="px-5 py-2 rounded-full font-semibold text-sm text-white bg-primary-dark hover:bg-primary hover:shadow-md transition-all duration-300 flex items-center gap-2 hover:translate-x-0.5">
                <span>Masuk</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/auth?mode=register" className="px-5 py-2 rounded-full font-semibold text-sm text-[#050505] bg-primary-light hover:bg-primary hover:text-white hover:shadow-md transition-all duration-300 flex items-center gap-2 hover:translate-x-0.5">
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
                        className="text-white font-extrabold text-4xl uppercase tracking-widest hover:text-primary-light hover:scale-110 transition-all cursor-pointer"
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
                  <Link href="/auth" onClick={() => setMobileMenuOpen(false)} className="w-full py-4 rounded-full font-bold text-lg text-center text-primary-light bg-primary-light/10 border border-primary-light/30 hover:bg-primary-light hover:text-[#050505] hover:shadow-[0_0_20px_rgba(139,195,74,0.4)] transition-all cursor-pointer">Masuk</Link>
                  <Link href="/auth?mode=register" onClick={() => setMobileMenuOpen(false)} className="w-full py-4 rounded-full font-bold text-lg text-center text-[#050505] bg-primary-light hover:bg-primary hover:text-white transition-all shadow-[0_0_20px_rgba(139,195,74,0.4)] cursor-pointer">Daftar</Link>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* HERO SECTION - GEOSPATIAL THEME */}
        <section className="min-h-screen flex flex-col justify-center pt-24 pb-12 bg-[#050505] relative overflow-hidden" id="hero">

          {/* Modern GeoSpatial Background (No Radar) */}
          <div 
            className="absolute inset-0 z-0 bg-[#050505]"
            style={{
              backgroundImage: videoError ? "url('/videos/hero-poster.jpg')" : "url('/videos/hero-poster.jpg')",
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {/* Video Background */}
            {!videoError && (
              <video
                autoPlay
                loop
                muted
                playsInline
                poster="/videos/hero-poster.jpg"
                onError={() => setVideoError(true)}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0 opacity-70"
                style={{ mixBlendMode: 'normal' }}
              >
                <source src="/videos/bg-hero.webm" type="video/webm" />
                <source src="/videos/hero-bg.webm" type="video/webm" />
                <source src="/videos/hero-bg.mp4" type="video/mp4" />
              </video>
            )}

            {/* Overlay Gradient (consistent with dark theme) */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/85 via-[#050505]/65 to-[#0c0c0c] z-10 pointer-events-none" />

            {/* Subtle Grid & Glow (z-20 so it floats on top of video/gradient overlay) */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#8bc34a08_1px,transparent_1px),linear-gradient(to_bottom,#8bc34a08_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] z-20 pointer-events-none"></div>

            {/* Soft ambient glows (z-20) */}
            <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-primary/20 rounded-full blur-[100px] opacity-40 mix-blend-screen hidden md:block z-20 pointer-events-none"></div>
            <div className="absolute top-1/2 right-1/4 w-[400px] h-[400px] bg-primary-light/10 rounded-full blur-[120px] opacity-40 mix-blend-screen hidden md:block z-20 pointer-events-none"></div>
          </div>

          <div className="max-w-7xl mx-auto px-4 relative z-10">

            {/* HERO CONTENT (Universal/Responsive) */}
            <div className="flex flex-col items-center text-center max-w-5xl mx-auto py-12">
              {/* Pill Badge */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full mb-6 backdrop-blur-sm cursor-pointer hover:bg-primary/20 transition-all duration-300"
              >
                <span className="bg-primary px-2.5 py-0.5 rounded-full text-[10px] font-extrabold text-white flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-white shrink-0" />
                  <span>Rilis</span>
                </span>
                <span className="text-primary-light font-bold text-[10px] sm:text-xs tracking-wide flex items-center gap-1">
                  Mulai Simulasi Iklim Ekstrem Sekarang <ArrowRight className="w-3 h-3" />
                </span>
              </motion.div>

              {/* Main Heading */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
                className="text-white font-extrabold text-4xl md:text-5xl lg:text-6xl leading-[1.1] tracking-tight mb-6 max-w-3xl"
              >
                Sawah Terlindungi, <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-light via-primary to-[#8bc34a] drop-shadow-sm">
                  Panen Melimpah.
                </span> <br /> Secara Presisi.
              </motion.h1>

              {/* Subtext */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="text-text-muted text-sm md:text-lg mb-10 max-w-2xl leading-relaxed"
              >
                Platform pemantauan sawah cerdas bertenaga geospasial real-time. Deteksi kelayakan tanam, simulasikan risiko iklim ekstrem, dan amankan ketahanan pangan Anda.
              </motion.p>

              {/* Email Signup Form */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="flex flex-row items-center gap-2 md:gap-3 bg-zinc-900 border border-zinc-800 p-1.5 rounded-xl w-full max-w-md mx-auto mb-12 focus-within:border-primary/50 transition-all"
              >
                <input 
                  type="email" 
                  value={heroEmail}
                  onChange={(e) => setHeroEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCobaSekarang();
                    }
                  }}
                  placeholder="Masukkan alamat email Anda..." 
                  className="w-full bg-transparent border-0 p-2 outline-none text-white text-[11px] md:text-sm placeholder:text-text-muted focus:ring-0 focus:outline-none"
                />
                <button 
                  type="button"
                  onClick={() => handleCobaSekarang()}
                  className="bg-primary hover:bg-primary-dark text-white font-bold text-[11px] md:text-sm px-4 md:px-6 py-2.5 md:py-3 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-primary/20 hover:translate-x-0.5 cursor-pointer shrink-0"
                >
                  <span>Coba Sekarang</span>
                  <ArrowRight className="w-3 h-3 md:w-4 md:h-4" />
                </button>
              </motion.div>

              {/* Scroll Indicator */}
              <motion.a
                href="#masalah"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.8 }}
                className="mt-16 md:mt-24 flex flex-col items-center justify-center text-text-muted/60 hover:text-primary-light transition-colors animate-bounce cursor-pointer"
              >
                <span className="text-[10px] md:text-xs uppercase tracking-widest mb-2 font-semibold">Scroll ke Bawah</span>
                <ChevronDown className="w-5 h-5 md:w-6 md:h-6" />
              </motion.a>
            </div>

          </div>
        </section>

        {/* SECTION 2: PERUBAHAN IKLIM NYATA */}
        <section className="bg-bg-dark py-32 md:py-48 border-t border-border-light relative overflow-hidden" id="masalah">
          {/* Subtle Ambient Background */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,#1b5e2015,transparent_45%)] pointer-events-none z-0" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#8bc34a0a,transparent_40%)] pointer-events-none z-0" />

          <div className="max-w-6xl mx-auto px-4 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center mb-20">
              <div className="lg:col-span-6">
                <h2 className="text-white font-extrabold text-3xl md:text-5xl leading-[1.1] tracking-tight mb-6">
                  Perubahan Iklim Nyata, <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-light to-[#8bc34a]">
                    Petani Tidak Boleh Sendirian
                  </span>
                </h2>
              </div>
              <div className="lg:col-span-6">
                <p className="text-text-muted text-base md:text-lg leading-relaxed border-l-2 border-primary-light/30 pl-6">
                  Sektor pertanian adalah yang paling rentan terdampak oleh krisis iklim. Pola cuaca yang tidak menentu, pergeseran musim tanam, hingga ancaman kekeringan mendadak sering kali menjadi dalang utama gagal panen massal yang merugikan petani secara materiel dan waktu.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 max-w-5xl mx-auto">
              {/* Card 1 */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.7 }}
                whileHover={{ y: -6 }}
                className="md:col-span-7 bg-[#111111]/60 border border-white/[0.05] backdrop-blur-md rounded-3xl p-8 md:p-12 hover:border-primary-light/20 hover:bg-[#161616]/80 transition-all duration-500 shadow-2xl relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-primary-light/5 to-transparent rounded-bl-full pointer-events-none" />
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary-light/10 flex items-center justify-center text-primary-light shadow-[0_0_30px_rgba(139,195,74,0.15)] mb-8">
                  <CloudLightning className="w-8 h-8" />
                </div>
                <h3 className="text-white font-extrabold text-2xl md:text-3xl mb-4 tracking-tight">Anomali Cuaca Ekstrem</h3>
                <p className="text-text-muted text-sm md:text-base leading-relaxed max-w-md">
                  Pola cuaca ekstrem yang sulit ditebak merusak siklus tanam konvensional. Sistem peringatan dini kami membantu petani mengambil tindakan mitigasi preventif sebelum badai atau kemarau panjang menyerang.
                </p>
              </motion.div>

              {/* Card 2 */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.7, delay: 0.2 }}
                whileHover={{ y: -6 }}
                className="md:col-span-5 bg-[#111111]/60 border border-white/[0.05] backdrop-blur-md rounded-3xl p-8 md:p-12 hover:border-primary-light/20 hover:bg-[#161616]/80 transition-all duration-500 shadow-2xl relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-500/5 to-transparent rounded-bl-full pointer-events-none" />
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary-light/10 flex items-center justify-center text-primary-light shadow-[0_0_30px_rgba(139,195,74,0.15)] mb-8">
                  <Droplets className="w-8 h-8" />
                </div>
                <h3 className="text-white font-extrabold text-2xl md:text-3xl mb-4 tracking-tight">Krisis Air Tanah</h3>
                <p className="text-text-muted text-sm md:text-base leading-relaxed">
                  Penyusutan kandungan air tanah secara diam-diam menghambat pertumbuhan akar padi. Kami melacak tingkat kelembapan secara real-time langsung ke genggaman Anda.
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* SECTION 3: TEKNOLOGI CERDAS */}
        <section className="bg-[#0a0a0a] py-32 md:py-48 border-t border-border-light relative overflow-hidden" id="fitur">
          {/* Background Ambient Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none z-0" />

          <div className="max-w-6xl mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto text-center mb-20">
              <h2 className="text-white font-extrabold text-3xl md:text-5xl leading-tight mb-6 tracking-tight">
                Teknologi Cerdas untuk<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-light to-primary">
                  Pertanian Tangguh Iklim
                </span>
              </h2>
              <p className="text-text-muted text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
                Kami menghadirkan platform mitigasi berbasis data geospasial untuk membantu Anda mengambil langkah tepat sebelum terlambat.
              </p>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 grid-flow-row-dense gap-6 max-w-5xl mx-auto">
              
              {/* Card 1: Plotting Lahan (Big Card - col-span-8, row-span-2) */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6 }}
                className="md:col-span-8 md:row-span-2 bg-[#121212] border border-white/[0.04] rounded-3xl overflow-hidden flex flex-col justify-between hover:border-primary-light/20 transition-all duration-500 group shadow-xl min-h-[450px]"
              >
                <div className="p-8 md:p-10">
                  <span className="text-xs font-bold text-primary-light uppercase tracking-widest mb-3 inline-block">Geospasial Presisi</span>
                  <h3 className="text-white font-extrabold text-2xl md:text-3xl mb-4 group-hover:text-primary-light transition-colors">Plotting Lahan Sawah</h3>
                  <p className="text-text-muted text-sm md:text-base leading-relaxed max-w-lg">
                    Tandai dan petakan koordinat sawah Anda dengan mudah langsung di peta satelit. Sistem kami akan memetakan batas wilayah lahan Anda secara presisi untuk pemantauan yang terisolasi dan akurat.
                  </p>
                </div>
                <div className="w-full h-64 overflow-hidden relative mt-auto border-t border-white/[0.04]">
                  <img 
                    src="/assets/plotting-lahan.jpg" 
                    alt="Plotting Lahan" 
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 contrast-110 opacity-90 brightness-95" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-transparent pointer-events-none" />
                </div>
              </motion.div>

              {/* Card 2: Analisis Satelit (col-span-4, row-span-1) */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="md:col-span-4 bg-[#121212] border border-white/[0.04] rounded-3xl overflow-hidden flex flex-col justify-between hover:border-primary-light/20 transition-all duration-500 group shadow-xl min-h-[215px]"
              >
                <div className="p-8">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-primary-light uppercase tracking-widest">Real-Time NDVI</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <h3 className="text-white font-extrabold text-xl mb-3">Analisis Satelit</h3>
                  <p className="text-text-muted text-xs md:text-sm leading-relaxed">
                    Pantau indeks vegetasi tanaman dan kelembapan tanah secara otomatis melalui sensor satelit Sentinel-2.
                  </p>
                </div>
              </motion.div>

              {/* Card 3: Early Warning (col-span-4, row-span-1) */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="md:col-span-4 bg-[#121212] border border-white/[0.04] rounded-3xl overflow-hidden flex flex-col justify-between hover:border-primary-light/20 transition-all duration-500 group shadow-xl min-h-[215px]"
              >
                <div className="p-8">
                  <span className="text-xs font-bold text-[#8bc34a] uppercase tracking-widest mb-4 inline-block">Mitigasi Risiko</span>
                  <h3 className="text-white font-extrabold text-xl mb-3">Peringatan Dini</h3>
                  <p className="text-text-muted text-xs md:text-sm leading-relaxed">
                    Dapatkan rekomendasi aksi dan notifikasi darurat instan jika sistem mendeteksi cuaca ekstrem.
                  </p>
                </div>
              </motion.div>

              {/* Card 4: Stats Filler (col-span-12 - Full Width Bottom) */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="md:col-span-12 bg-gradient-to-r from-[#121212] to-[#161616] border border-white/[0.04] rounded-3xl p-8 md:p-10 hover:border-primary-light/10 transition-all duration-500 shadow-xl"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
                  <div className="flex flex-col gap-2">
                    <span className="text-text-muted text-xs uppercase tracking-wider font-semibold">Tingkat Akurasi</span>
                    <span className="text-white font-black text-3xl md:text-4xl">98.7%</span>
                    <p className="text-text-muted text-xs">Peta prediksi cuaca lokal berbasis AI.</p>
                  </div>
                  <div className="flex flex-col gap-2 border-t md:border-t-0 md:border-x border-white/[0.06] pt-6 md:pt-0 md:px-8">
                    <span className="text-text-muted text-xs uppercase tracking-wider font-semibold">Lahan Terlindungi</span>
                    <span className="text-primary-light font-black text-3xl md:text-4xl">12,400+ Ha</span>
                    <p className="text-text-muted text-xs">Sawah yang telah dipetakan di Indonesia.</p>
                  </div>
                  <div className="flex flex-col gap-2 border-t md:border-t-0 pt-6 md:pt-0">
                    <span className="text-text-muted text-xs uppercase tracking-wider font-semibold">Waktu Respon EWS</span>
                    <span className="text-white font-black text-3xl md:text-4xl">&lt; 3 Detik</span>
                    <p className="text-text-muted text-xs">Pengiriman pesan push cuaca buruk.</p>
                  </div>
                </div>
              </motion.div>

            </div>
          </div>
        </section>

        {/* SECTION 4: CARA KERJA */}
        <section className="bg-bg-dark py-32 md:py-48 border-t border-border-light relative overflow-hidden" id="cara-kerja">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,#8bc34a05,transparent_40%)] pointer-events-none z-0" />

          <div className="max-w-6xl mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto text-center mb-24">
              <h2 className="text-white font-extrabold text-3xl md:text-5xl leading-tight mb-6 tracking-tight">
                Langkah Mudah Amankan<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-light to-[#8bc34a]">
                  Panen Anda
                </span>
              </h2>
              <p className="text-text-muted text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
                Kami menghadirkan platform mitigasi berbasis data geospasial untuk membantu Anda mengambil langkah tepat sebelum terlambat.
              </p>
            </div>

            {/* Timeline Container */}
            <div className="steps-timeline relative flex flex-col md:flex-row md:justify-between md:items-start gap-16 md:gap-8 lg:gap-12 mt-12 md:mt-20">

              {/* Step 1 */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6 }}
                className="group flex flex-row md:flex-col items-start md:items-center text-left md:text-center w-full gap-6 md:gap-0 relative z-10"
              >
                <div className="shrink-0 md:mb-8">
                  <div className="w-20 h-20 rounded-full bg-[#111111] border-2 border-white/[0.08] text-primary-light font-black text-2xl flex items-center justify-center shadow-2xl group-hover:border-primary-light group-hover:bg-gradient-to-br group-hover:from-primary group-hover:to-primary-light group-hover:text-[#050505] group-hover:shadow-[0_0_30px_rgba(139,195,74,0.3)] transition-all duration-500">01</div>
                </div>
                <div className="flex-grow pt-2 md:pt-0">
                  <h3 className="text-white font-extrabold text-lg md:text-xl mb-3 group-hover:text-primary-light transition-colors">Buat Akun & Cari Lokasi</h3>
                  <p className="text-text-muted text-sm leading-relaxed max-w-[280px] md:mx-auto">Daftar gratis di platform kami, cari lokasi sawah Anda secara presisi di peta digital.</p>
                </div>
              </motion.div>

              {/* Step 2 */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="group flex flex-row md:flex-col items-start md:items-center text-left md:text-center w-full gap-6 md:gap-0 relative z-10"
              >
                <div className="shrink-0 md:mb-8">
                  <div className="w-20 h-20 rounded-full bg-[#111111] border-2 border-white/[0.08] text-primary-light font-black text-2xl flex items-center justify-center shadow-2xl group-hover:border-primary-light group-hover:bg-gradient-to-br group-hover:from-primary group-hover:to-primary-light group-hover:text-[#050505] group-hover:shadow-[0_0_30px_rgba(139,195,74,0.3)] transition-all duration-500">02</div>
                </div>
                <div className="flex-grow pt-2 md:pt-0">
                  <h3 className="text-white font-extrabold text-lg md:text-xl mb-3 group-hover:text-primary-light transition-colors">Gambar Batas Lahan</h3>
                  <p className="text-text-muted text-sm leading-relaxed max-w-[280px] md:mx-auto">Gunakan alat gambar peta untuk menandai sawah Anda secara langsung dengan membuat polygon.</p>
                </div>
              </motion.div>

              {/* Step 3 */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="group flex flex-row md:flex-col items-start md:items-center text-left md:text-center w-full gap-6 md:gap-0 relative z-10"
              >
                <div className="shrink-0 md:mb-8">
                  <div className="w-20 h-20 rounded-full bg-[#111111] border-2 border-white/[0.08] text-primary-light font-black text-2xl flex items-center justify-center shadow-2xl group-hover:border-primary-light group-hover:bg-gradient-to-br group-hover:from-primary group-hover:to-primary-light group-hover:text-[#050505] group-hover:shadow-[0_0_30px_rgba(139,195,74,0.3)] transition-all duration-500">03</div>
                </div>
                <div className="flex-grow pt-2 md:pt-0">
                  <h3 className="text-white font-extrabold text-lg md:text-xl mb-3 group-hover:text-primary-light transition-colors flex flex-col md:block">
                    <span>Pantau & Terima Notifikasi</span>
                  </h3>
                  <p className="text-text-muted text-sm leading-relaxed max-w-[280px] md:mx-auto">Cek kondisi tanah secara real-time di dashboard dan terima pesan peringatan EWS jika anomali mendekat.</p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="bg-[#050505] border-t border-white/[0.04] pt-24 pb-12 relative overflow-hidden">
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none z-0" />
          
          <div className="max-w-6xl mx-auto px-6 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-16 mb-16">

            {/* Brand & Info */}
            <div className="lg:col-span-6 flex flex-col items-start gap-6">
              <a href="#" className="flex items-center gap-3">
                <img src="/assets/logo.webp" alt="EcoTani Logo" className="h-10 w-10 filter drop-shadow-[0_0_15px_rgba(46,125,50,0.3)]" />
                <span className="text-white font-extrabold text-2xl tracking-tight">EcoTani</span>
              </a>
              <p className="text-text-muted text-sm md:text-base leading-relaxed max-w-md">
                Platform cerdas pemetaan sawah berbasis data satelit real-time untuk mitigasi kegagalan panen dan pemantauan anomali cuaca ekstrim di Indonesia.
              </p>
              <a 
                href="mailto:info.ecotani@gmail.com" 
                className="inline-flex items-center gap-3 text-text-muted hover:text-primary-light transition-colors text-sm py-1.5"
              >
                <Mail className="w-5 h-5 text-primary-light" />
                <span className="font-semibold">info.ecotani@gmail.com</span>
              </a>
            </div>

            {/* Footer Navigation Grid */}
            <div className="lg:col-span-6 grid grid-cols-2 gap-12 w-full">
              <div className="flex flex-col gap-6">
                <h4 className="text-white font-black text-xs tracking-widest uppercase opacity-80">Menu Utama</h4>
                <ul className="flex flex-col gap-4 text-text-muted text-sm">
                  <li><a href="#hero" className="hover:text-primary-light hover:translate-x-1.5 transition-all duration-300 inline-block">Beranda</a></li>
                  <li><a href="#masalah" className="hover:text-primary-light hover:translate-x-1.5 transition-all duration-300 inline-block">Tentang Kami</a></li>
                  <li><a href="#fitur" className="hover:text-primary-light hover:translate-x-1.5 transition-all duration-300 inline-block">Teknologi</a></li>
                  <li><a href="#cara-kerja" className="hover:text-primary-light hover:translate-x-1.5 transition-all duration-300 inline-block">Cara Kerja</a></li>
                </ul>
              </div>

              <div className="flex flex-col gap-6">
                <h4 className="text-white font-black text-xs tracking-widest uppercase opacity-80">Legalitas</h4>
                <ul className="flex flex-col gap-4 text-text-muted text-sm">
                  <li><a href="#" className="hover:text-primary-light hover:translate-x-1.5 transition-all duration-300 inline-block">Syarat & Ketentuan</a></li>
                  <li><a href="#" className="hover:text-primary-light hover:translate-x-1.5 transition-all duration-300 inline-block">Dokumentasi</a></li>
                  <li><a href="#" className="hover:text-primary-light hover:translate-x-1.5 transition-all duration-300 inline-block">Kebijakan Privasi</a></li>
                  <li><a href="#" className="hover:text-primary-light hover:translate-x-1.5 transition-all duration-300 inline-block">Kebijakan Cookie</a></li>
                </ul>
              </div>
            </div>

          </div>

          {/* Footer Bottom Copyright & Credits */}
          <div className="border-t border-white/[0.04] pt-8 mt-8">
            <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6 text-xs md:text-sm text-text-muted text-center md:text-left">
              <p>&copy; 2026 EcoTani. Hak Cipta Dilindungi Undang-Undang.</p>
              <p className="leading-relaxed md:text-right">
                Developed by <a href="#" className="text-primary-light hover:underline font-extrabold">Tim Rudal</a> <br className="md:hidden" />
                <span className="hidden md:inline"> | </span>Telkom University Purwokerto <span className="text-emerald-500 font-bold mx-1">X</span> Universitas Jenderal Soedirman
              </p>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}


