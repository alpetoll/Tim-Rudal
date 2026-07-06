'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sprout, Eye, EyeOff } from 'lucide-react';
import { showAlertModal } from '@/utils/swal';

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode');

  // --- AUTH STATES ---
  const emailParam = searchParams.get('email') || '';
  const [authEmail, setAuthEmail] = useState<string>(emailParam);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setAuthEmail(emailParam);
    }
  }, [searchParams]);

  const [authPassword, setAuthPassword] = useState<string>('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(mode === 'register');
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  const translateAuthError = (message: string): string => {
    const lowercase = message.toLowerCase();
    if (lowercase.includes('invalid login credentials')) {
      return 'Email atau kata sandi yang Anda masukkan salah.';
    }
    if (lowercase.includes('email not confirmed')) {
      return 'Email Anda belum dikonfirmasi. Silakan periksa kotak masuk email Anda.';
    }
    if (lowercase.includes('user already registered') || lowercase.includes('already exists')) {
      return 'Alamat email ini sudah terdaftar. Silakan gunakan email lain atau masuk.';
    }
    if (lowercase.includes('password should be at least 6 characters')) {
      return 'Kata sandi harus terdiri dari minimal 6 karakter.';
    }
    if (lowercase.includes('rate limit exceeded')) {
      return 'Batas permintaan terlampaui. Silakan coba beberapa saat lagi.';
    }
    if (lowercase.includes('invalid email')) {
      return 'Format email tidak valid.';
    }
    return message;
  };

  // --- SUBMIT HANDLER ---
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (isRegisterMode && authPassword !== authConfirmPassword) {
      setAuthError('Kata sandi dan konfirmasi kata sandi tidak cocok.');
      return;
    }

    setAuthLoading(true);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authEmail.trim(),
          password: authPassword,
          confirmPassword: authConfirmPassword,
          action: isRegisterMode ? 'signup' : 'login',
        }),
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error || 'Terjadi kesalahan autentikasi.');
      }

      if (isRegisterMode) {
        await showAlertModal(
          'Pendaftaran Berhasil',
          resData.message || 'Silakan periksa kotak masuk email Anda untuk melakukan verifikasi akun.',
          'success'
        );
        setIsRegisterMode(false);
        setAuthPassword('');
        setAuthConfirmPassword('');
      } else {
        // Refresh router so Next.js Middleware/Server Components pick up the new cookies
        router.refresh();
        router.push('/dashboard');
      }
    } catch (err: any) {
      setAuthError(translateAuthError(err.message || 'Terjadi kesalahan autentikasi.'));
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-white dark:bg-[#111111] transition-colors duration-300">
      
      {/* LEFT FORM SIDE */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 md:p-16 lg:px-24">
        
        {/* Logo */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link href="/" className="flex items-center gap-2 group w-fit">
            <img src="/assets/logo.webp" alt="EcoTani" className="w-8 h-8 group-hover:rotate-12 transition-transform duration-300" />
            <span className="font-extrabold text-2xl text-gray-900 dark:text-white tracking-tight">EcoTani</span>
          </Link>
        </motion.div>
 
        {/* Form Container */}
        <div className="flex-grow flex flex-col justify-center max-w-md w-full mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base font-medium mb-1">
              {isRegisterMode ? 'Mulai Pantau Lahan' : 'Selamat Datang Kembali'}
            </p>
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-8 tracking-tight">
              {isRegisterMode ? 'Daftar ke' : 'Masuk ke'} <span className="text-primary">EcoTani</span>
            </h1>
          </motion.div>

          {authError && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-xl text-sm font-semibold mb-6 leading-relaxed shadow-lg shadow-red-500/5"
            >
              {authError}
            </motion.div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-5 relative z-50">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <input
                type="email"
                placeholder="Email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
                className="w-full px-5 py-4 rounded-xl bg-gray-200/80 dark:bg-white border border-transparent focus:border-primary focus:bg-white outline-none transition-all duration-300 text-gray-900 font-medium text-base placeholder:text-gray-400"
              />
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="relative"
            >
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Kata Sandi"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
                className="w-full pl-5 pr-12 py-4 rounded-xl bg-gray-200/80 dark:bg-white border border-transparent focus:border-primary focus:bg-white outline-none transition-all duration-300 text-gray-900 font-medium text-base placeholder:text-gray-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-text-main focus:outline-none cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </motion.div>

            {isRegisterMode && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.35 }}
                className="relative"
              >
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Konfirmasi Kata Sandi"
                  value={authConfirmPassword}
                  onChange={(e) => setAuthConfirmPassword(e.target.value)}
                  required
                  className="w-full pl-5 pr-12 py-4 rounded-xl bg-gray-200/80 dark:bg-white border border-transparent focus:border-primary focus:bg-white outline-none transition-all duration-300 text-gray-900 font-medium text-base placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-text-main focus:outline-none cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="pt-4"
            >
              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-primary hover:bg-primary-light hover:text-[#050505] text-white font-bold py-4 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 flex justify-center items-center gap-2"
              >
                {authLoading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  isRegisterMode ? 'Daftar' : 'Masuk'
                )}
              </button>
            </motion.div>
          </form>
        </div>

        {/* Footer Link */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-8"
        >
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
            {isRegisterMode ? 'Sudah punya akun?' : 'Belum punya akun?'}
            <button 
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setAuthError('');
                setAuthConfirmPassword('');
                setShowPassword(false);
                setShowConfirmPassword(false);
              }}
              className="ml-2 text-primary font-bold hover:underline bg-transparent border-none cursor-pointer"
            >
              {isRegisterMode ? 'Masuk' : 'Daftar'}
            </button>
          </p>
        </motion.div>
        
      </div>

      {/* RIGHT IMAGE SIDE */}
      <div className="hidden lg:block w-1/2 relative overflow-hidden">
        <motion.div 
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="w-full h-full"
        >
          <img 
            src="/assets/plotting-lahan.jpg" 
            alt="Pemandangan Sawah EcoTani" 
            className="w-full h-full object-cover"
          />
          {/* Subtle gradient overlay to make it look premium */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        </motion.div>
      </div>

    </div>
  );
}
