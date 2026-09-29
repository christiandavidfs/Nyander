import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';
import { useI18n } from '@/i18n';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        // Web: tokens arrive in the URL hash from Supabase.
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        if (!hash) {
          router.replace('/login');
          return;
        }
        const params = new URLSearchParams(hash.slice(1));
        const err = params.get('error');
        if (err) {
          setError((params.get('error_description') || err).replace(/\+/g, ' '));
          return;
        }
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (!access_token || !refresh_token) {
          setError(t('authCallback.invalid'));
          return;
        }
        const { error: sessErr } = await supabase.auth.setSession({ access_token, refresh_token });
        if (sessErr) throw sessErr;
        // Clean the hash so refresh doesn't replay the exchange.
        if (typeof window !== 'undefined') window.location.hash = '';
        router.replace('/');
      } catch (e: any) {
        setError(e.message);
      }
    };
    run();
  }, []);

  return (
    <View style={styles.centered}>
      <Stack.Screen options={{ title: 'Nyander', headerShown: false }} />
      {!error ? (
        <>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.text}>{t('authCallback.loading')}</Text>
        </>
      ) : (
        <>
          <Text style={styles.errorTitle}>{t('common.error')}</Text>
          <Text style={styles.errorText}>{error}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 40, backgroundColor: Colors.background },
  text: { fontSize: 15, color: Colors.gray },
  errorTitle: { fontSize: 18, fontWeight: '700', color: Colors.error },
  errorText: { fontSize: 14, color: Colors.gray, textAlign: 'center' },
});
