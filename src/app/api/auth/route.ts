import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, password, confirmPassword, action } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan kata sandi wajib diisi.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    if (action === 'signup') {
      // 1. Local password match validation
      if (password !== confirmPassword) {
        return NextResponse.json(
          { error: 'Kata sandi dan konfirmasi kata sandi tidak cocok.' },
          { status: 400 }
        );
      }

      // 2. Pre-check if email already exists in petani profile records to prevent duplicates
      try {
        const { data: existingPetani, error: checkError } = await supabase
          .from('petani')
          .select('id')
          .eq('email', email.trim())
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          console.warn('Profile table check failed:', checkError.message);
        } else if (existingPetani) {
          return NextResponse.json(
            { error: 'Alamat email ini sudah terdaftar!' },
            { status: 400 }
          );
        }
      } catch (checkErr: any) {
        console.warn('Bypassing profile check due to unexpected error:', checkErr.message);
      }

      // 3. Perform Sign Up with dynamic local redirect origin
      const requestUrl = new URL(request.url);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${requestUrl.origin}/dashboard?confirmed=true`,
        }
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'Pendaftaran berhasil! Silakan periksa email Anda untuk verifikasi atau langsung login jika konfirmasi otomatis aktif.'
      });

    } else if (action === 'login') {
      // Perform Sign In
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        user: data.user,
        session: data.session
      });

    } else {
      return NextResponse.json(
        { error: 'Aksi autentikasi tidak valid.' },
        { status: 400 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Terjadi kesalahan internal.' },
      { status: 500 }
    );
  }
}
