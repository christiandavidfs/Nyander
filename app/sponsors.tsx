import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Linking,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';
import { useI18n } from '@/i18n';
import type { Sponsor } from '@/types';

type SponsorWithClicks = Sponsor & { click_count: number };

export default function SponsorsScreen() {
  const router = useRouter();
  const { t, categoryName } = useI18n();
  const [sponsors, setSponsors] = useState<SponsorWithClicks[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [mySponsorId, setMySponsorId] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }

    const loadSponsors = async () => {
      try {
      const { data: { session: s } } = await supabase.auth.getSession();
      setSession(s);

      // Check if user owns a sponsor listing
      if (s?.user) {
        const { data: mySponsor } = await supabase
          .from('sponsors')
          .select('id')
          .eq('owner_id', s.user.id)
          .maybeSingle();
        if (mySponsor) setMySponsorId(mySponsor.id);
      }

      // Filter by user's country
      let countryFilter: string | null = null;
      if (s?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('country_code')
          .eq('id', s.user.id)
          .maybeSingle();
        if (profile?.country_code) {
          countryFilter = profile.country_code;
        }
      }

      let query = supabase.from('sponsors').select('*').in('status', ['active', 'trial']);
      if (countryFilter) {
        query = query.eq('country_code', countryFilter);
      }
      const { data } = await query
        .order('ranking', { ascending: false })
        .order('created_at', { ascending: false });

      if (!data) { setLoading(false); return; }

      const withClicks = await Promise.all(
        (data as any[]).map(async (s) => {
          const { count } = await supabase
            .from('sponsor_clicks')
            .select('*', { count: 'exact', head: true })
            .eq('sponsor_id', s.id);
          return { ...s, click_count: count ?? 0 } as SponsorWithClicks;
        })
      );

      setSponsors(withClicks);
      } catch (err) {
        console.error('Error loading sponsors:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSponsors();
  }, []);

  const trackAndOpen = async (sponsor: SponsorWithClicks) => {
    await supabase.from('sponsor_clicks').insert({ sponsor_id: sponsor.id });
    if (sponsor.website_url) {
      Linking.openURL(sponsor.website_url);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <View style={styles.centered}>
        <FontAwesome name="building" size={64} color={Colors.lightGray} />
        <Text style={styles.emptyText}>{t('sponsors.configNeeded')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('sponsors.title'), headerTintColor: Colors.primary }} />
      <View style={styles.header}>
        <Text style={styles.heading}>{t('sponsors.title')}</Text>
        <Text style={styles.subtitle}>{t('sponsors.subtitle')}</Text>
      </View>
      {mySponsorId ? (
        <TouchableOpacity style={styles.myListingBanner} onPress={() => router.push('/manage-sponsor')}>
          <FontAwesome name="id-card" size={18} color="#fff" />
          <Text style={styles.myListingText}>{t('sponsors.myBusiness')}</Text>
          <FontAwesome name="chevron-right" size={14} color="#fff" />
        </TouchableOpacity>
      ) : session ? (
        <TouchableOpacity style={styles.ctaBanner} onPress={() => router.push('/become-sponsor')}>
          <FontAwesome name="rocket" size={18} color="#fff" />
          <Text style={styles.ctaText}>{t('sponsors.advertiseCta')}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.ctaBanner} onPress={() => router.push('/login')}>
          <FontAwesome name="sign-in" size={18} color="#fff" />
          <Text style={styles.ctaText}>{t('sponsors.signInCta')}</Text>
        </TouchableOpacity>
      )}

      {sponsors.length === 0 ? (
        <View style={styles.centered}>
          <FontAwesome name="building" size={64} color={Colors.lightGray} />
          <Text style={styles.emptyTitle}>No sponsors yet</Text>
          <Text style={styles.emptyText}>Check back soon for pet-friendly businesses.</Text>
        </View>
      ) : (
        <FlatList
          data={sponsors}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/sponsors/${item.id}`)}
              activeOpacity={0.8}
            >
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>#{index + 1}</Text>
              </View>
              {item.logo_url ? (
                <Image source={{ uri: item.logo_url }} style={styles.logo} />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <FontAwesome name="building" size={28} color={Colors.primary} />
                </View>
              )}
              <View style={styles.info}>
                <Text style={styles.businessName} numberOfLines={1}>{item.business_name}</Text>
                {item.category && (
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{categoryName(item.category)}</Text>
                  </View>
                )}
                {item.description && (
                  <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
                )}
                <View style={styles.stats}>
                  <FontAwesome name="mouse-pointer" size={12} color={Colors.gray} />
                  <Text style={styles.statText}>{t('sponsors.clicks', { n: item.click_count })}</Text>
                  {item.plan === 'trial' && (
                    <View style={styles.trialBadge}>
                      <Text style={styles.trialText}>{t('sponsors.trial')}</Text>
                    </View>
                  )}
                </View>
              </View>
              {item.website_url && (
                <TouchableOpacity
                  style={styles.visitButton}
                  onPress={() => trackAndOpen(item)}
                >
                  <FontAwesome name="external-link" size={14} color="#fff" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, gap: 12, padding: 20 },
  header: { padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.lightGray },
  heading: { fontSize: 24, fontWeight: '800', color: '#111' },
  subtitle: { fontSize: 14, color: Colors.gray, marginTop: 2 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  emptyText: { fontSize: 14, color: Colors.gray, textAlign: 'center' },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    padding: 14, marginBottom: 10, borderRadius: 14, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4,
    position: 'relative',
  },
  rankBadge: {
    position: 'absolute', top: -6, left: -6,
    backgroundColor: Colors.accent, width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center', zIndex: 1,
  },
  rankText: { fontSize: 11, fontWeight: '900', color: '#333' },
  logo: { width: 52, height: 52, borderRadius: 12 },
  logoPlaceholder: {
    width: 52, height: 52, borderRadius: 12, backgroundColor: '#eef2ff',
    justifyContent: 'center', alignItems: 'center',
  },
  info: { flex: 1, marginLeft: 12 },
  businessName: { fontSize: 16, fontWeight: '700', color: '#111' },
  categoryBadge: {
    alignSelf: 'flex-start', backgroundColor: '#e8f5e9', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 8, marginTop: 4,
  },
  categoryText: { fontSize: 11, fontWeight: '600', color: '#2e7d32' },
  description: { fontSize: 13, color: Colors.gray, marginTop: 4, lineHeight: 18 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  statText: { fontSize: 11, color: Colors.gray },
  trialBadge: {
    backgroundColor: '#fff3e0', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, marginLeft: 8,
  },
  trialText: { fontSize: 10, fontWeight: '700', color: '#e65100' },
  visitButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },
  myListingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.secondary,
    marginHorizontal: 12, marginTop: 10, padding: 14, borderRadius: 12,
  },
  myListingText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700' },
  ctaBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary,
    marginHorizontal: 12, marginTop: 10, padding: 14, borderRadius: 12,
  },
  ctaText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700' },
});
