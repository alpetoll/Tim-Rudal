import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { checkWeatherAnomaly } from "../_shared/anomalyDetection.ts";

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Ambil semua lahan dengan status "sedang-ditanam"
    const { data: lahans, error: lahanError } = await supabase
      .from("lahan")
      .select("*")
      .eq("status", "sedang-ditanam");

    if (lahanError) throw lahanError;

    let processedCount = 0;
    let anomalyCount = 0;

    for (const lahan of lahans) {
      const centroid = typeof lahan.centroid === "string" ? JSON.parse(lahan.centroid) : lahan.centroid;
      if (!centroid || !Array.isArray(centroid) || centroid.length < 2) {
        continue;
      }
      const [lat, lng] = centroid;

      // 2. Fetch data cuaca terkini dari API cuaca (Open-Meteo) untuk 3 hari ke depan
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=precipitation_sum,temperature_2m_max,windspeed_10m_max&timezone=Asia%2FJakarta&forecast_days=3`;
      
      const response = await fetch(weatherUrl);
      if (!response.ok) {
        console.error(`Failed to fetch weather for lahan ${lahan.nama}: ${response.statusText}`);
        continue;
      }
      const weatherData = await response.json();
      processedCount++;

      if (weatherData.daily) {
        for (let i = 0; i < weatherData.daily.time.length; i++) {
          const date = weatherData.daily.time[i];
          const rain = weatherData.daily.precipitation_sum[i];
          const temp = weatherData.daily.temperature_2m_max[i];
          const wind = weatherData.daily.windspeed_10m_max[i];

          // 3. Bandingkan nilai cuaca dengan threshold anomali menggunakan shared logic
          const check = checkWeatherAnomaly(rain, temp, wind, lahan.nama);

          if (check.isAnomaly && check.type) {
            // Cek apakah sudah ada notifikasi serupa yang terkirim dalam 24 jam terakhir untuk lahan ini
            const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            
            const { data: existingLogs, error: logError } = await supabase
              .from("weather_anomaly_logs")
              .select("*")
              .eq("lahan_id", lahan.id)
              .eq("anomaly_type", check.type)
              .eq("notified", true)
              .gt("created_at", dayAgo);

            if (logError) {
              console.error(`Error checking anomaly logs for lahan ${lahan.nama}: ${logError.message}`);
              continue;
            }

            if (existingLogs && existingLogs.length > 0) {
              // Jika sudah pernah dikirim dalam 24 jam terakhir, skip agar tidak spamming
              continue;
            }

            // Simpan log anomali ke DB
            const { data: newLog, error: insertError } = await supabase
              .from("weather_anomaly_logs")
              .insert({
                lahan_id: lahan.id,
                anomaly_type: check.type,
                detected_value: check.value,
                notified: false
              })
              .select()
              .single();

            if (insertError) {
              console.error(`Error inserting anomaly log for lahan ${lahan.nama}: ${insertError.message}`);
              continue;
            }

            // Panggil Edge Function send-push-notification untuk mengirim push message ke pemilik lahan
            const notifyResponse = await fetch(
              `${supabaseUrl}/functions/v1/send-push-notification`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${supabaseServiceKey}`
                },
                body: JSON.stringify({
                  user_id: lahan.petani_id,
                  title: `Peringatan Cuaca Ekstrem: ${check.type}`,
                  body: check.message,
                  url: `/dashboard`
                })
              }
            );

            if (notifyResponse.ok) {
              anomalyCount++;
              // Update log menjadi notified = true
              await supabase
                .from("weather_anomaly_logs")
                .update({ notified: true })
                .eq("id", newLog.id);
            } else {
              const errorText = await notifyResponse.text();
              console.error(`Failed to trigger push notification: ${errorText}`);
            }
            break; // Hanya deteksi dan kirim 1 alert cuaca per lahan per interval pemeriksaan
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, processedCount, anomalyCount }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
