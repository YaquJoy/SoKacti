import { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, newSession) => {
      setSession(newSession);
    });

    // Android: Chrome Custom Tab fires a system Intent instead of returning to
    // openAuthSessionAsync, so the PKCE code arrives here via deep link.
    let linkSub: ReturnType<typeof Linking.addEventListener> | null = null;
    if (Platform.OS === 'android') {
      linkSub = Linking.addEventListener('url', ({ url }) => {
        if (url.startsWith('sokacti://') && url.includes('code=')) {
          supabase.auth.exchangeCodeForSession(url);
        }
      });
    }

    return () => {
      subscription.unsubscribe();
      linkSub?.remove();
    };
  }, []);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
