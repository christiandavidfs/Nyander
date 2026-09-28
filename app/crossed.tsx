import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { haversineDistance, requestLocation } from '@/lib/location';
import StaticMap from '@/components/StaticMap';
import { Colors } from '@/constants/Colors';
import { useI18n } from '@/i18n';
import type { Cat } from '@/types';

export default function CrossedPathsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [cats, setCats] = useState<(Cat & { distance_km: number })[]>([]);
  const [myPos, setMyPos] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      let loc = await requestLocation();
      let countryFilter: string | null = null;
      // Fallback to profile location or Madrid if web permission denied
      if (isSupabaseConfigured) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: p } = await supabase.from('profiles').select('latitude,longitude,country_code').eq('id', session.user.id).maybeSingle();
          if (!loc && p?.latitude && p?.longitude) loc = { latitude: Number(p.latitude), longitude: Number(p.longitude) };
          if (p?.country_code) countryFilter = p.country_code;
        }
      }
      if (!loc) loc = { latitude: 40.4168, longitude: -3.7038 }; // Madrid fallback so map always visible
      setMyPos(loc);
      if (!isSupabaseConfigured) { return; }
      let query = supabase.from('cats').select('*').eq('status', 'available');
      if (countryFilter) query = query.eq('country_code', countryFilter);
      const { data } = await query.range(0, 99);
      const all = (data || []) as any[];
      const nearby = all
        .map((c) => ({
          ...c,
          distance_km: c.latitude && c.longitude ? haversineDistance(loc!.latitude, loc!.longitude, Number(c.latitude), Number(c.longitude)) : Infinity,
          image_urls: c.image_urls || [],
          video_urls: c.video_urls || [],
        }))
        .filter((c) => c.distance_km < 1)
        .sort((a, b) => a.distance_km - b.distance_km) as (Cat & { distance_km: number })[];
      setCats(nearby);
    } catch (e) { console.error(e); } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('crossed.title'), headerTintColor: Colors.primary }} />
      {myPos ? (
        <StaticMap
          latitude={myPos.latitude}
          longitude={myPos.longitude}
          height={180}
          zoom={14}
          markers={[
            { latitude: myPos.latitude, longitude: myPos.longitude, color: 'blue' },
            ...cats.filter((c) => c.latitude && c.longitude).map((c) => ({ latitude: Number(c.latitude), longitude: Number(c.longitude), color: 'red' })),
          ]}
        />
      ) : (
        <View style={[styles.mapPlaceholder, { height: 180 }]}>
          <FontAwesome name="map" size={32} color={Colors.gray} />
          <Text style={styles.mapPlaceholderText}>Enable location to see crossed paths</Text>
        </View>
      )}
      <View style={styles.header}>
        <FontAwesome name="map-marker" size={18} color={Colors.primary} />
        <Text style={styles.headerText}>{cats.length === 0 ? 'No cats crossed today' : `${cats.length} cat${cats.length === 1 ? '' : 's'} crossed <1km today`}</Text>
      </View>
      <FlatList
        data={cats}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 12, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/cat/${item.id}`)}>
            {item.image_urls[0] ? <Image source={{ uri: item.image_urls[0] }} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' }]}><FontAwesome name="paw" size={24} color="#ccc" /></View>}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{item.breed || t('cats.mixedBreed')} • {(item.distance_km * 1000).toFixed(0)}m</Text>
            </View>
            <FontAwesome name="chevron-right" size={14} color={Colors.gray} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<View style={styles.centered}><FontAwesome name="paw" size={48} color={Colors.lightGray} /><Text style={styles.empty}>{t('crossed.walkAround')}</Text></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#eef2ff' },
  headerText: { fontSize: 13, fontWeight: '700', color: Colors.primary, flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12, gap: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4 },
  thumb: { width: 56, height: 56, borderRadius: 10 },
  name: { fontSize: 16, fontWeight: '700', color: '#111' },
  meta: { fontSize: 12, color: Colors.gray, marginTop: 2 },
  bonus: { fontSize: 11, fontWeight: '700', color: Colors.primary, marginTop: 4 },
  empty: { fontSize: 14, color: Colors.gray, textAlign: 'center', marginTop: 12 },
  mapPlaceholder: { backgroundColor: '#e9ecef', justifyContent: 'center', alignItems: 'center', gap: 8, borderRadius: 12, margin: 12 },
  mapPlaceholderText: { fontSize: 13, color: Colors.gray },
});
