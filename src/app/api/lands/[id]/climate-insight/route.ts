import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh') === 'true';

    const supabase = await createClient();

    // 1. If not forcing refresh, try to read cached insight from database
    if (!refresh) {
      const { data: cached, error: cacheErr } = await supabase
        .from('climate_insights')
        .select('*')
        .eq('lahan_id', id)
        .maybeSingle();

      if (!cacheErr && cached) {
        return NextResponse.json({ success: true, data: cached });
      }
    }

    // 2. Fetch land details to get GPS coordinates (centroid)
    const { data: land, error: landError } = await supabase
      .from('lahan')
      .select('id, centroid')
      .eq('id', id)
      .single();

    if (landError || !land) {
      return NextResponse.json(
        { error: 'Lahan sawah tidak ditemukan atau gagal diambil.' },
        { status: 404 }
      );
    }

    const centroid = typeof land.centroid === 'string' ? JSON.parse(land.centroid) : land.centroid;
    if (!centroid || !Array.isArray(centroid) || centroid.length < 2) {
      return NextResponse.json(
        { error: 'Koordinat lahan (centroid) tidak valid atau kosong.' },
        { status: 400 }
      );
    }
    const [lat, lng] = centroid;

    // 3. Fetch daily historical/projection climate data from Open-Meteo Climate API
    const start_date = '1995-01-01';
    const end_date = '2024-12-31';
    const climateUrl = `https://climate-api.open-meteo.com/v1/climate?latitude=${lat}&longitude=${lng}&start_date=${start_date}&end_date=${end_date}&models=MRI_AGCM3_2_S&daily=temperature_2m_mean,temperature_2m_max,precipitation_sum&timezone=Asia%2FJakarta`;

    const response = await fetch(climateUrl);
    if (!response.ok) {
      throw new Error(`Gagal mengambil data dari Open-Meteo Climate API: ${response.statusText}`);
    }

    const climateData = await response.json();
    if (!climateData.daily || !climateData.daily.time) {
      throw new Error('Format data Open-Meteo Climate API tidak valid.');
    }

    const { time, temperature_2m_max, precipitation_sum } = climateData.daily;

    // 4. Process daily data into annual aggregates
    const annualData: Record<number, { precipitation: number; extremeHeatDays: number }> = {};

    for (let i = 0; i < time.length; i++) {
      const dateStr = time[i];
      const year = parseInt(dateStr.split('-')[0], 10);

      // Process only complete years within our range (1995 - 2024)
      if (year >= 1995 && year <= 2024) {
        if (!annualData[year]) {
          annualData[year] = { precipitation: 0, extremeHeatDays: 0 };
        }

        const rain = precipitation_sum[i] || 0;
        const maxTemp = temperature_2m_max[i] || 0;

        annualData[year].precipitation += rain;
        if (maxTemp > 33) {
          annualData[year].extremeHeatDays += 1;
        }
      }
    }

    // 5. Calculate averages for two 15-year periods
    // Early Period: 1995 - 2009 (15 years)
    // Recent Period: 2010 - 2024 (15 years)
    let earlyPrecipSum = 0;
    let earlyHeatSum = 0;
    let earlyCount = 0;

    let recentPrecipSum = 0;
    let recentHeatSum = 0;
    let recentCount = 0;

    for (let year = 1995; year <= 2009; year++) {
      if (annualData[year]) {
        earlyPrecipSum += annualData[year].precipitation;
        earlyHeatSum += annualData[year].extremeHeatDays;
        earlyCount++;
      }
    }

    for (let year = 2010; year <= 2024; year++) {
      if (annualData[year]) {
        recentPrecipSum += annualData[year].precipitation;
        recentHeatSum += annualData[year].extremeHeatDays;
        recentCount++;
      }
    }

    const avgPrecipEarly = earlyCount > 0 ? earlyPrecipSum / earlyCount : 0;
    const avgPrecipRecent = recentCount > 0 ? recentPrecipSum / recentCount : 0;
    const precipChange = avgPrecipEarly > 0 ? ((avgPrecipRecent - avgPrecipEarly) / avgPrecipEarly) * 100 : 0;

    const avgHeatEarly = earlyCount > 0 ? earlyHeatSum / earlyCount : 0;
    const avgHeatRecent = recentCount > 0 ? recentHeatSum / recentCount : 0;
    const heatChange = avgHeatEarly > 0 ? ((avgHeatRecent - avgHeatEarly) / avgHeatEarly) * 100 : (avgHeatRecent > 0 ? 100 : 0);

    // 6. Cache processed data to database (upsert)
    const { data: saved, error: saveErr } = await supabase
      .from('climate_insights')
      .upsert({
        lahan_id: id,
        avg_precipitation_early_period: avgPrecipEarly,
        avg_precipitation_recent_period: avgPrecipRecent,
        precipitation_change_percent: precipChange,
        extreme_heat_days_early_period: Math.round(avgHeatEarly),
        extreme_heat_days_recent_period: Math.round(avgHeatRecent),
        extreme_heat_change_percent: heatChange,
        calculated_at: new Date().toISOString()
      }, { onConflict: 'lahan_id' })
      .select()
      .single();

    if (saveErr) {
      console.error('Gagal menyimpan cache climate insight:', saveErr.message);
      // Return the data directly to the client even if cache insert failed (resilience)
      return NextResponse.json({
        success: true,
        data: {
          lahan_id: id,
          avg_precipitation_early_period: avgPrecipEarly,
          avg_precipitation_recent_period: avgPrecipRecent,
          precipitation_change_percent: precipChange,
          extreme_heat_days_early_period: Math.round(avgHeatEarly),
          extreme_heat_days_recent_period: Math.round(avgHeatRecent),
          extreme_heat_change_percent: heatChange,
          calculated_at: new Date().toISOString()
        }
      });
    }

    return NextResponse.json({ success: true, data: saved });
  } catch (err: any) {
    console.error('Terjadi kesalahan di API Climate Insight:', err);
    return NextResponse.json(
      { error: err.message || 'Gagal memproses data perubahan iklim.' },
      { status: 500 }
    );
  }
}
