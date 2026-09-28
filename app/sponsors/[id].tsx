import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Image, Linking, TouchableOpacity, ScrollView,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';
import { useI18n } from '@/i18n';
import type { Sponsor } from '@/types';

export default function SponsorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, categoryName } = useI18n();
  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  const [clickCount, setClickCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !id) { setLoading(false); return; }

    const load = async () => {
      try {
      const [{ data }, { data: { session } }] = await Promise.all([
        supabase.from('sponsors').select('*').eq('id', id).maybeSingle(),
        supabase.auth.getSession(),
      ]);
      if (data) {
        setSponsor(data as Sponsor);
        if (session?.user) {
          setIsOwner((data as Sponsor).owner_id === session.user.id);
        }
        const { count } = await supabase
          .from('sponsor_clicks')
          .select('*', { count: 'exact', head: true })
          .eq('sponsor_id', id);
        setClickCount(count ?? 0);
      }
      } catch (err) {
        console.error('Error loading sponsor:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const trackAndOpen = async () => {
    if (!sponsor?.website_url) return;
    await supabase.from('sponsor_clicks').insert({ sponsor_id: id });
    Linking.openURL(sponsor.website_url);
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
        <Text style={styles.emptyText}>{t('sponsorDetail.notFound')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: sponsor.business_name, headerTintColor: Colors.primary }} />

      <View style={styles.logoSection}>
        {sponsor.logo_url ? (
          <Image source={{ uri: sponsor.logo_url }} style={styles.logo} />
        ) : (
          <View style={styles.logoPlaceholder}>
            <FontAwesome name="building" size={48} color={Colors.primary} />
          </View>
        )}
        <Text style={styles.businessName}>{sponsor.business_name}</Text>
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
        {sponsor.plan && (
          <View style={styles.statBox}>
            <FontAwesome name={sponsor.plan === 'trial' ? 'flask' : 'credit-card'} size={16} color={Colors.secondary} />
            <Text style={styles.statValue}>{sponsor.plan === 'trial' ? t('sponsorDetail.trial') : sponsor.plan === 'yearly' ? '$150/yr' : '$15/mo'}</Text>
            <Text style={styles.statLabel}>{t('sponsorDetail.plan')}</Text>
          </View>
        )}
        <View style={styles.statBox}>
          <FontAwesome name="star" size={16} color={Colors.accent} />
          <Text style={styles.statValue}>{sponsor.ranking}</Text>
          <Text style={styles.statLabel}>{t('sponsorDetail.ranking')}</Text>
        </View>
      </View>

      {sponsor.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('sponsorDetail.about')}</Text>
          <Text style={styles.description}>{sponsor.description}</Text>
        </View>
      )}

      {(sponsor.website_url || sponsor.phone || sponsor.address || sponsor.email) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('sponsorDetail.contactInfo')}</Text>
          {sponsor.website_url && (
            <TouchableOpacity style={styles.infoRow} onPress={trackAndOpen}>
              <FontAwesome name="globe" size={16} color={Colors.primary} />
              <Text style={styles.linkText} numberOfLines={1}>{sponsor.website_url}</Text>
            </TouchableOpacity>
          )}
          {sponsor.phone && (
            <View style={styles.infoRow}>
              <FontAwesome name="phone" size={16} color={Colors.gray} />
              <Text style={styles.infoText}>{sponsor.phone}</Text>
            </View>
          )}
          {sponsor.email && (
            <View style={styles.infoRow}>
              <FontAwesome name="envelope" size={16} color={Colors.gray} />
              <Text style={styles.infoText}>{sponsor.email}</Text>
            </View>
          )}
          {sponsor.address && (
            <View style={styles.infoRow}>
              <FontAwesome name="map-marker" size={16} color={Colors.gray} />
              <Text style={styles.infoText}>{sponsor.address}</Text>
            </View>
          )}
        </View>
      )}

      {sponsor.website_url && (
        <TouchableOpacity style={styles.visitButton} onPress={trackAndOpen}>
          <FontAwesome name="external-link" size={16} color="#fff" />
          <Text style={styles.visitButtonText}>{t('sponsorDetail.visitWebsite')}</Text>
        </TouchableOpacity>
      )}

      {isOwner && (
        <TouchableOpacity style={styles.manageButton} onPress={() => router.push('/manage-sponsor')}>
          <FontAwesome name="cog" size={16} color={Colors.primary} />
          <Text style={styles.manageButtonText}>{t('sponsorDetail.manageListing')}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: Colors.gray },
  logoSection: { alignItems: 'center', marginBottom: 20 },
  logo: { width: 96, height: 96, borderRadius: 20, marginBottom: 12 },
  logoPlaceholder: {
    width: 96, height: 96, borderRadius: 20, backgroundColor: '#eef2ff',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  businessName: { fontSize: 24, fontWeight: '800', color: '#111', textAlign: 'center' },
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
  statValue: { fontSize: 16, fontWeight: '700', color: '#111' },
  statLabel: { fontSize: 11, color: Colors.gray },
  section: { backgroundColor: Colors.white, padding: 16, borderRadius: 14, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 8 },
  description: { fontSize: 15, color: '#333', lineHeight: 22 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  linkText: { fontSize: 15, color: Colors.primary, textDecorationLine: 'underline', flex: 1 },
  infoText: { fontSize: 15, color: '#333', flex: 1 },
  visitButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, padding: 16, borderRadius: 14,
  },
  visitButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  manageButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.white, padding: 16, borderRadius: 14, marginTop: 12,
    borderWidth: 1, borderColor: Colors.primary,
  },
  manageButtonText: { fontSize: 16, fontWeight: '700', color: Colors.primary },
});
