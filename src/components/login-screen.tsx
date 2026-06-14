import { Ionicons } from '@expo/vector-icons';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

const TEAL = '#2BBFAE';

export function LoginScreen() {
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    try {
      if (Platform.OS === 'web') {
        // Web: full-page redirect — Supabase handles callback via detectSessionInUrl
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        });
        if (error) throw error;
        // Browser navigates away; loading state stays true intentionally
        return;
      }

      // Mobile: in-app browser session
      // Explicitly specify the native scheme so makeRedirectUri returns sokacti://
      // regardless of whether running in Expo Go or a production build.
      const redirectTo = makeRedirectUri({ native: 'sokacti://' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });

      if (error) throw error;
      if (!data.url) throw new Error('No auth URL returned from Supabase');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success') {
        // new URL('sokacti://?code=...') fails in Android's Hermes engine for
        // custom schemes, so extract the code with regex instead of passing the
        // full URL — supabase-js skips URL parsing when given a plain code string.
        const match = result.url.match(/[?&]code=([^&#]+)/);
        const code = match?.[1];
        if (!code) throw new Error(`OAuth 回调中未找到授权码\n${result.url}`);

        const { error: codeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (codeErr) throw codeErr;
      }
    } catch (err) {
      Alert.alert('登录失败', err instanceof Error ? err.message : '请稍后重试');
    } finally {
      if (Platform.OS !== 'web') setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container}>
        {/* Logo area */}
        <View style={styles.logoArea}>
          <View style={styles.logoRing}>
            <View style={styles.logoCircle}>
              <Ionicons name="leaf" size={52} color="white" />
            </View>
          </View>
          <Text style={styles.appName}>我的多肉</Text>
          <Text style={styles.tagline}>记录你的每一株植物</Text>
        </View>

        {/* Auth buttons */}
        <View style={styles.buttonArea}>
          <Pressable
            style={({ pressed }) => [styles.googleBtn, (pressed || loading) && styles.btnPressed]}
            onPress={signInWithGoogle}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#555" size="small" />
            ) : (
              <>
                <View style={styles.googleIconWrap}>
                  <Text style={styles.googleG}>G</Text>
                </View>
                <Text style={styles.googleBtnText}>使用 Google 账号登录</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>登录即表示你同意我们的服务条款与隐私政策</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: TEAL,
  },
  container: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'space-between',
    paddingBottom: 32,
  },

  // Logo
  logoArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingTop: 48,
  },
  logoRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appName: {
    fontSize: 34,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 0.5,
  },

  // Buttons
  buttonArea: {
    gap: 14,
    paddingBottom: 28,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 30,
    height: 56,
    paddingHorizontal: 24,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  btnPressed: {
    opacity: 0.75,
  },
  googleIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleG: {
    color: 'white',
    fontWeight: '800',
    fontSize: 15,
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },

  // Footer
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 18,
  },
});
