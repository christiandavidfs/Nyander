import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';
import { useI18n } from '@/i18n';
import type { Sponsorship } from '@/types';

type Enriched = Sponsorship & { cat_name: string };

export default function MySponsorshipsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [items, setItems] = useState<Enriched[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await supabase
          .from('sponsorships')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });
        if (!data) return;
        const enriched = await Promise.all(
          (data as Sponsorship[]).map(async (s) => {
            const { data: cat } = await supabase.from('cats').select('name').eq('id', s.cat_id).maybeSingle();
            return { ...s, cat_name: (cat as any)?.name ?? t('common.cat') };
          })
        );
        setItems(enriched);
      } catch (err) {
        console.error('Error loading sponsorships:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleCancel = (s: Enriched) => {
    Alert.alert(t('sponsorships.confirmTitle'), t('sponsorships.confirmMsg', { name: s.cat_name }), [
      { text: t('sponsorships.keep'), style: 'cancel' },
      {
        text: t('sponsorships.stop'), style: 'destructive',
        onPress: async () => {
          try {
            const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
            await fetch(`${apiUrl}/api/paypal/cancel-subscription`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subscriptionId: s.paypal_subscription_id }),
            }).catch(() => null);
            await supabase.from('sponsorships').update({ status: 'canceled', canceled_at: new Date().toISOString() }).eq('id', s.id);
            setItems((prev) => prev.map((i) => i.id === s.id ? { ...i, status: 'canceled' } : i));
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('sponsorships.title'), headerTintColor: Colors.primary }} />
      <View style={styles.header}>
        <FontAwesome name="heart" size={18} color={Colors.primary} />
        <Text style={styles.headerText}>{t('sponsorships.header')}</Text>
      </View>
      {items.length === 0 ? (
        <View style={styles.centered}>
          <FontAwesome name="heart-o" size={48} color={Colors.lightGray} />
          <Text style={styles.empty}>{t('sponsorships.empty')}</Text>
          <TouchableOpacity style={styles.cta} onPress={() => router.push('/cats')}>
            <Text style={styles.ctaText}>{t('sponsorships.discover')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 12, gap: 12 }}
          renderItem={({ item }) => {
            const statusLabel = item.status === 'active' ? t('sponsorships.active') : item.status === 'pending' ? t('sponsorships.pending') : t('sponsorships.canceled');
            return (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.cat_name}</Text>
                <Text style={styles.meta}>{t('sponsorships.perMonth', { n: item.amount })} • {statusLabel}</Text>
              </View>
              {item.status === 'active' && (
                <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item)}>
                  <Text style={styles.cancelText}>{t('sponsorships.stop')}</Text>
                </TouchableOpacity>
              )}
            </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#eef2ff' },
  headerText: { fontSize: 13, fontWeight: '700', color: Colors.primary, flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 12, gap: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4 },
  name: { fontSize: 16, fontWeight: '700', color: '#111' },
  meta: { fontSize: 12, color: Colors.gray, marginTop: 2 },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.error },
  cancelText: { fontSize: 13, fontWeight: '700', color: Colors.error },
  empty: { fontSize: 14, color: Colors.gray, textAlign: 'center' },
  cta: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
