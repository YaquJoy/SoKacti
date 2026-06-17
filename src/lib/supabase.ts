import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// On native (Android/iOS) always use AsyncStorage.
// On web, only skip storage during SSR (Node.js), where window is undefined.
// RN 0.74+ removed global.window, so typeof window === 'undefined' is true
// on native too — that's why we check Platform.OS first.
const isSSR = Platform.OS === 'web' && typeof window === 'undefined';

const ssrSafeStorage = {
  getItem: (key: string) =>
    isSSR ? Promise.resolve(null) : AsyncStorage.getItem(key),
  setItem: (key: string, value: string) =>
    isSSR ? Promise.resolve() : AsyncStorage.setItem(key, value),
  removeItem: (key: string) =>
    isSSR ? Promise.resolve() : AsyncStorage.removeItem(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ssrSafeStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
      flowType: 'pkce',
    },
  }
);
