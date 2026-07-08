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

export type SubscriptionStatus = 'granted' | 'denied' | 'not-asked';

export function useNotificationSubscription(userId: string | undefined) {
  const [status, setStatus] = useState<SubscriptionStatus>('not-asked');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'denied') {
        setStatus('denied');
      }
    }
  }, []);

  const checkSubscriptionStatus = async (): Promise<SubscriptionStatus> => {
    if (!userId || typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return 'denied';
    }
    
    try {
      if (Notification.permission === 'denied') {
        setStatus('denied');
        return 'denied';
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription && Notification.permission === 'granted') {
        // Cek apakah subscription ada di database
        const { data, error } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('user_id', userId)
          .eq('endpoint', subscription.endpoint)
          .maybeSingle();
        
        if (!error && data) {
          setIsSubscribed(true);
          setStatus('granted');
          return 'granted';
        }
      }
      
      setIsSubscribed(false);
      const currentStatus = Notification.permission === 'default' ? 'not-asked' : (Notification.permission === 'granted' ? 'not-asked' : 'denied');
      setStatus(currentStatus);
      return currentStatus;
    } catch (err) {
      console.error('Error checking notification subscription:', err);
      return 'not-asked';
    }
  };

  useEffect(() => {
    checkSubscriptionStatus();
  }, [userId]);

  const subscribeToPush = async () => {
    if (!userId) return false;
    setLoading(true);

    try {
      // 1. Request permission
      const perm = await Notification.requestPermission();
      if (perm === 'denied') {
        setStatus('denied');
        setLoading(false);
        return false;
      }
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

      if (error) {
        console.error('Supabase Error:', error);
        throw new Error(error.message || 'Supabase upsert failed');
      }

      setIsSubscribed(true);
      setStatus('granted');
      setLoading(false);
      return true;
    } catch (err: any) {
      console.error('Failed to subscribe to push notifications:', err.message || err, err);
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
      setStatus('not-asked');
      setLoading(false);
      return true;
    } catch (err) {
      console.error('Failed to unsubscribe from push notifications:', err);
      setLoading(false);
      return false;
    }
  };

  return {
    status,
    isSubscribed,
    loading,
    checkSubscriptionStatus,
    subscribeToPush,
    unsubscribe
  };
}
