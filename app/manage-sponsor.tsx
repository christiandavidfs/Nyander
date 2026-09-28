import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, TouchableOpacity, Alert, Linking,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';
import { useI18n } from '@/i18n';
import type { Sponsor } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  active: '#34c759',
  trial: '#ff9500',
  pending: '#8e8e93',
  expired: '#ff3b30',
};

export default function ManageSponsorScreen() {
  const router = useRouter();
  const { t, categoryName } = useI18n();
  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  const [clickCount, setClickCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }

    const load = async () => {
      try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const { data } = await supabase
        .from('sponsors')
        .select('*')
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setSponsor(data as Sponsor);
        const { count } = await supabase
          .from('sponsor_clicks')
          .select('*', { count: 'exact', head: true })
          .eq('sponsor_id', data.id);
        setClickCount(count ?? 0);
      }
      } catch (err) {
        console.error('Error loading sponsor listing:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleCancel = async () => {
    if (!sponsor) return;
    Alert.alert(t('manageSponsor.confirmTitle'), t('manageSponsor.confirmMsg'), [
      { text: t('manageSponsor.keep'), style: 'cancel' },
      {
        text: t('manageSponsor.cancel'), style: 'destructive',
        onPress: async () => {
          try {
            if (sponsor.paypal_subscription_id) {
              await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/paypal/cancel-subscription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId: sponsor.paypal_subscription_id }),
              });
            }
            await supabase.from('sponsors').update({ status: 'expired' }).eq('id', sponsor.id);
            setSponsor({ ...sponsor, status: 'expired' });
            Alert.alert(t('common.success'), t('manageSponsor.cancelled'));
          } catch (err: any) {
            Alert.alert(t('common.error'), err.message);
          }
        },
      },
    ]);
  };

  const handleUpgrade = async () => {
    if (!sponsor) return;
    if (sponsor.plan === 'trial') {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
      try {
        const res = await fetch(`${apiUrl}/api/paypal/create-sponsor-subscription`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sponsorId: sponsor.id, amount: 15, currency: 'USD' }),
        });
        const data = await res.json();
        if (data.approval_url) {
          Linking.openURL(data.approval_url);
        }
      } catch (err: any) {
        Alert.alert(t('common.error'), err.message);
      }
    } else {
      Alert.alert(t('common.success'), t('manageSponsor.contactSupport'));
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!sponsor) {
    return (
      <View style={styles.centered}>
        <FontAwesome name="building" size={64} color={Colors.lightGray} />
        <Text style={styles.emptyTitle}>{t('manageSponsor.empty')}</Text>
        <Text style={styles.emptyText}>{t('manageSponsor.emptySub')}</Text>
        <TouchableOpacity style={styles.createButton} onPress={() => router.push('/become-sponsor')}>
          <Text style={styles.createButtonText}>{t('manageSponsor.create')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const planLabel = sponsor.plan === 'trial' ? t('manageSponsor.trialPlan') : sponsor.plan === 'monthly' ? `Monthly $${sponsor.amount}/mo` : `Yearly $${sponsor.amount}/yr`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t('manageSponsor.title'), headerTintColor: Colors.primary }} />

      <View style={styles.logoSection}>
        {sponsor.logo_url ? (
          <Image source={{ uri: sponsor.logo_url }} style={styles.logo} />
        ) : (
          <View style={styles.logoPlaceholder}>
            <FontAwesome name="building" size={40} color={Colors.primary} />
          </View>
        )}
        <Text style={styles.businessName}>{sponsor.business_name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[sponsor.status] + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[sponsor.status] }]} />
          <Text style={[styles.statusText, { color: STATUS_COLORS[sponsor.status] }]}>
            {sponsor.status.charAt(0).toUpperCase() + sponsor.status.slice(1)}
          </Text>
        </View>
        {sponsor.category && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{categoryName(sponsor.category)}</Text>
          </View>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <FontAwesome name="mouse-pointer" size={16} color={Colors.primary} />
          <Text style={styles.statValue}>{clickCount}</Text>
          <Text style={styles.statLabel}>{t('sponsorDetail.clicks')}</Text>
        </View>
        <View style={styles.statBox}>
          <FontAwesome name="star" size={16} color={Colors.accent} />
          <Text style={styles.statValue}>{sponsor.ranking}</Text>
          <Text style={styles.statLabel}>{t('sponsorDetail.ranking')}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('manageSponsor.planDetails')}</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('manageSponsor.plan')}</Text>
          <Text style={styles.detailValue}>{planLabel}</Text>
        </View>
        {sponsor.trial_ends_at && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('manageSponsor.trialEnds')}</Text>
            <Text style={styles.detailValue}>{new Date(sponsor.trial_ends_at).toLocaleDateString()}</Text>
          </View>
        )}
        {sponsor.expires_at && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('manageSponsor.expires')}</Text>
            <Text style={styles.detailValue}>{new Date(sponsor.expires_at).toLocaleDateString()}</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        {sponsor.status === 'trial' && (
          <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
            <FontAwesome name="rocket" size={16} color="#fff" />
            <Text style={styles.buttonText}>{t('manageSponsor.upgrade')}</Text>
          </TouchableOpacity>
        )}
        {(sponsor.status === 'active' || sponsor.status === 'trial') && (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <FontAwesome name="times-circle" size={16} color={Colors.error} />
            <Text style={styles.cancelButtonText}>{t('manageSponsor.deactivate')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.viewButton} onPress={() => router.push(`/sponsors/${sponsor.id}`)}>
          <FontAwesome name="eye" size={16} color={Colors.primary} />
          <Text style={styles.viewButtonText}>{t('manageSponsor.viewPublic')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  emptyText: { fontSize: 14, color: Colors.gray, textAlign: 'center' },
  createButton: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  createButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  logoSection: { alignItems: 'center', marginBottom: 20 },
  logo: { width: 80, height: 80, borderRadius: 18, marginBottom: 12 },
  logoPlaceholder: {
    width: 80, height: 80, borderRadius: 18, backgroundColor: '#eef2ff',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  businessName: { fontSize: 22, fontWeight: '800', color: '#111', textAlign: 'center' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, marginTop: 10,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14, fontWeight: '700' },
  categoryBadge: {
    alignSelf: 'center', backgroundColor: '#e8f5e9', paddingHorizontal: 14, paddingVertical: 4,
    borderRadius: 12, marginTop: 8,
  },
  categoryText: { fontSize: 13, fontWeight: '600', color: '#2e7d32' },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around', backgroundColor: Colors.white,
    padding: 16, borderRadius: 14, marginBottom: 16,
  },
  statBox: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, fontWeight: '700', color: '#111' },
  statLabel: { fontSize: 11, color: Colors.gray },
  section: { backgroundColor: Colors.white, padding: 16, borderRadius: 14, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailLabel: { fontSize: 15, color: Colors.gray },
  detailValue: { fontSize: 15, fontWeight: '600', color: '#111' },
  actions: { gap: 12 },
  upgradeButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.secondary, padding: 14, borderRadius: 14,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.white, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.error,
  },
  cancelButtonText: { color: Colors.error, fontSize: 16, fontWeight: '700' },
  viewButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.white, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.primary,
  },
  viewButtonText: { color: Colors.primary, fontSize: 16, fontWeight: '700' },
});
