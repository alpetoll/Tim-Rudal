import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { sendNotification, type PushSubscription, type VapidDetails } from "npm:web-push-neo";

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      }
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, title, body, url } = await req.json();

    if (!user_id || !title || !body) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // Ambil VAPID keys dari environment secrets
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
    const vapidEmail = Deno.env.get("VAPID_EMAIL") || "mailto:contact@ecotani.id";

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error("VAPID keys not configured in Edge Function environment");
    }

    const vapidDetails: VapidDetails = {
      subject: vapidEmail,
      publicKey: vapidPublicKey,
      privateKey: vapidPrivateKey,
    };

    // Ambil push subscriptions milik user_id
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (subError) throw subError;

    let successCount = 0;
    let failureCount = 0;

    for (const sub of subscriptions) {
      const pushSubscription: PushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      const payload = JSON.stringify({
        title,
        body,
        url: url || "/dashboard"
      });

      try {
        await sendNotification({
          subscription: pushSubscription,
          vapidDetails,
          payload
        });
        successCount++;
      } catch (err) {
        console.error(`Failed to send notification to subscription ${sub.id}: ${err.message}`);
        failureCount++;

        // Hapus subscription dari database jika endpoint sudah invalid/expired (push service mengembalikan error 404/410)
        if (err.statusCode === 404 || err.statusCode === 410) {
          const { error: deleteError } = await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
          
          if (deleteError) {
            console.error(`Error deleting expired subscription ${sub.id}: ${deleteError.message}`);
          } else {
            console.log(`Deleted expired subscription: ${sub.id}`);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, successCount, failureCount }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      }
    );
  }
});
