'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabaseClient';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useNotificationSubscription(userId: string | undefined) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const checkSubscription = async () => {
    if (!userId || typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Cek apakah subscription ada di database
        const { data, error } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('user_id', userId)
          .eq('endpoint', subscription.endpoint)
          .maybeSingle();
        
        if (!error && data) {
          setIsSubscribed(true);
        } else {
          setIsSubscribed(false);
        }
      } else {
        setIsSubscribed(false);
      }
    } catch (err) {
      console.error('Error checking notification subscription:', err);
    }
  };

  useEffect(() => {
    checkSubscription();
  }, [userId]);

  const subscribe = async () => {
    if (!userId) return false;
    setLoading(true);

    try {
      // 1. Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setLoading(false);
        return false;
      }

      // 2. Register/Ready SW
      const registration = await navigator.serviceWorker.ready;

      // 3. Subscribe ke push manager
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY environment variable is not defined.');
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      // Konversi key ke format string
      const subJSON = subscription.toJSON();
      const p256dh = subJSON.keys?.p256dh || '';
      const auth = subJSON.keys?.auth || '';

      // 4. Simpan ke database
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh,
          auth
        }, { onConflict: 'user_id,endpoint' });

      if (error) throw error;

      setIsSubscribed(true);
      setLoading(false);
      return true;
    } catch (err) {
      console.error('Failed to subscribe to push notifications:', err);
      setLoading(false);
      return false;
    }
  };

  const unsubscribe = async () => {
    if (!userId) return false;
    setLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Hapus dari database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', subscription.endpoint);

        // Unsubscribe dari push manager
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      setLoading(false);
      return true;
    } catch (err) {
      console.error('Failed to unsubscribe from push notifications:', err);
      setLoading(false);
      return false;
    }
  };

  return {
    isSubscribed,
    loading,
    permission,
    subscribe,
    unsubscribe
  };
}
