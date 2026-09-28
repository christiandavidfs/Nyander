import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Platform } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mockCats } from '@/data/mockCats';
import { Colors } from '@/constants/Colors';
import type { Cat } from '@/types';
import DonateButton from '@/components/DonateButton';
import SponsorButton from '@/components/SponsorButton';
import VideoPlayer from '@/components/VideoPlayer';
import { useI18n } from '@/i18n';

const { width } = Dimensions.get('window');

const toCat = (item: Record<string, unknown>): Cat => ({
  id: (item.id as string) ?? '',
  name: (item.name as string) ?? 'Unknown',
  age: item.age ? String(item.age) : null,
  breed: (item.breed as string) ?? null,
  description: (item.description as string) ?? null,
  location: (item.location as string) ?? null,
  latitude: (item.latitude as number) ?? null,
  longitude: (item.longitude as number) ?? null,
  health_status: (item.health_status as string) ?? null,
  image_urls: (item.image_urls as string[]) ?? [],
  video_urls: (item.video_urls as string[]) ?? [],
  temperament: (item.temperament as Record<string, number>) ?? null,
  likes: (item.likes as number) ?? 0,
  status: (item.status as Cat['status']) ?? 'available',
  shelter_id: (item.shelter_id as string) ?? '',
  country_code: (item.country_code as string) ?? null,
  created_at: (item.created_at as string) ?? new Date().toISOString(),
});

export default function CatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [cat, setCat] = useState<Cat | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMedia, setActiveMedia] = useState(0);
  const { t } = useI18n();

  const mediaItems = useMemo(() => {
    if (!cat) return [];
    const items: { uri: string; type: 'image' | 'video' }[] = [];
    for (const url of cat.image_urls ?? []) {
      items.push({ uri: url, type: 'image' });
    }
    for (const url of cat.video_urls ?? []) {
      items.push({ uri: url, type: 'video' });
    }
    return items;
  }, [cat]);

  useEffect(() => {
    if (!id) return;

    if (!isSupabaseConfigured) {
      const found = mockCats.find((c) => c.id === id);
      if (found) setCat(toCat(found as unknown as Record<string, unknown>));
      setLoading(false);
      return;
    }

    supabase
      .from('cats')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching cat:', error);
        } else if (data) {
          setCat(toCat(data));
        }
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!cat) {
    return (
      <View style={styles.centered}>
        <FontAwesome name="paw" size={64} color={Colors.lightGray} />
        <Text style={{ marginTop: 12, color: Colors.gray }}>{t('catDetail.notFound')}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: cat.name, headerTintColor: Colors.primary }} />
      <ScrollView style={styles.container} bounces={false}>
        {/* Media gallery (images + videos) */}
        <View style={styles.galleryContainer}>
          {mediaItems.length > 0 ? (
            <>
              <FlatList
                data={mediaItems}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                  setActiveMedia(idx);
                }}
                renderItem={({ item }) =>
                  item.type === 'video' ? (
                    <VideoPlayer uri={item.uri} style={styles.galleryImage} />
                  ) : (
                    <Image source={{ uri: item.uri }} style={styles.galleryImage} />
                  )
                }
                keyExtractor={(_, i) => String(i)}
              />
              {mediaItems.length > 1 && (
                <View style={styles.dots}>
                  {mediaItems.map((_, i) => (
                    <View
                      key={i}
                      style={[styles.dot, i === activeMedia && styles.dotActive]}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.placeholderImage}>
              <FontAwesome name="paw" size={64} color="#ddd" />
            </View>
          )}

          {/* Status badge */}
          {cat.status !== 'available' && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{cat.status.toUpperCase()}</Text>
            </View>
          )}
        </View>

        {/* Info section */}
        <View style={styles.section}>
          <Text style={styles.name}>{cat.name}</Text>
          <Text style={styles.meta}>
            {cat.age ?? t('catDetail.ageUnknown')} • {cat.breed ?? t('catDetail.mixedBreed')}
          </Text>

          <View style={styles.infoRow}>
            <FontAwesome name="map-marker" size={14} color={Colors.gray} />
            <Text style={styles.infoText}>{cat.location ?? t('catDetail.locationUnknown')}</Text>
          </View>

          {cat.health_status && (
            <View style={styles.healthBadge}>
              <FontAwesome name="medkit" size={12} color="#0066ff" />
              <Text style={styles.healthText}>{cat.health_status}</Text>
            </View>
          )}

          <View style={styles.likesRow}>
            <FontAwesome name="heart" size={16} color="#ff3b30" />
            <Text style={styles.likesText}>{t('catDetail.peopleInterested', { n: cat.likes })}</Text>
          </View>
          {cat.temperament && Object.keys(cat.temperament).length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {Object.entries(cat.temperament).map(([trait, score]) => (
                <View key={trait} style={{ backgroundColor: '#eef2ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.primary }}>{trait} {score}/5</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('catDetail.about', { name: cat.name })}</Text>
          <Text style={styles.description}>{cat.description ?? t('catDetail.noDescription')}</Text>
        </View>

        {/* Actions */}
        {cat.status === 'available' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('catDetail.support', { name: cat.name })}</Text>
            <View style={styles.buttonRow}>
              <DonateButton catId={cat.id} catName={cat.name} shelterId={cat.shelter_id} />
              <SponsorButton catId={cat.id} catName={cat.name} shelterId={cat.shelter_id} />
            </View>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, alignSelf: 'center' }} onPress={async () => {
              const link = `https://nyander.app/c/${cat.id}`;
              try { if (Platform.OS === 'web') { await navigator.clipboard.writeText(link); Alert.alert(t('catDetail.linkCopied'), link); } else { const Sharing = await import('expo-sharing'); if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(link as any); else Alert.alert(t('catDetail.shareLink'), link); } } catch { Alert.alert(t('catDetail.shareLink'), link); }
            }}>
              <FontAwesome name="qrcode" size={16} color={Colors.primary} />
              <Text style={{ color: Colors.primary, fontWeight: '700' }}>{t('catDetail.shareQr')} nyander.app/c/{cat.id.slice(0,8)}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Adoption request */}
        {cat.status === 'available' && (
          <View style={styles.section}>
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={styles.adoptButton}
                onPress={async () => {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) {
                    Alert.alert(t('catDetail.signInRequired'), t('catDetail.signInToAdopt'));
                    router.push('/login');
                    return;
                  }
                  const { error } = await supabase.from('adoption_requests').insert({
                    cat_id: cat.id,
                    user_id: session.user.id,
                    shelter_id: cat.shelter_id,
                    status: 'pending',
                  });
                  if (error) {
                    Alert.alert('Error', error.message);
                  } else {
                    Alert.alert(t('common.success'), t('catDetail.requestSent'));
                  }
                }}
              >
                <FontAwesome name="handshake-o" size={18} color="#fff" />
                <Text style={styles.adoptButtonText}>{t('catDetail.requestAdoption')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.contactButton}
                onPress={async () => {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) {
                    Alert.alert(t('catDetail.signInRequired'), t('catDetail.signInToContact'));
                    router.push('/login');
                    return;
                  }
                  if (session.user.id === cat.shelter_id) {
                    Alert.alert(t('common.cat'), t('catDetail.yourCat'));
                    return;
                  }

                  const { data: existing } = await supabase
                    .from('conversations')
                    .select('id')
                    .eq('cat_id', cat.id)
                    .eq('adopter_id', session.user.id)
                    .eq('shelter_id', cat.shelter_id)
                    .maybeSingle();

                  if (existing) {
                    router.push(`/messages/${existing.id}`);
                    return;
                  }

                  const { data: newConv, error } = await supabase
                    .from('conversations')
                    .insert({
                      cat_id: cat.id,
                      adopter_id: session.user.id,
                      shelter_id: cat.shelter_id,
                    })
                    .select('id')
                    .single();

                  if (error) {
                    Alert.alert('Error', error.message);
                  } else if (newConv) {
                    router.push(`/messages/${newConv.id}`);
                  }
                }}
              >
                <FontAwesome name="envelope" size={18} color={Colors.primary} />
                <Text style={styles.contactButtonText}>{t('catDetail.contactShelter')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  galleryContainer: {
    position: 'relative',
  },
  galleryImage: {
    width,
    height: width * 0.85,
    backgroundColor: '#eceff3',
  },
  placeholderImage: {
    width,
    height: width * 0.85,
    backgroundColor: '#eceff3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 20,
  },
  statusBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 1,
  },
  name: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111',
  },
  meta: {
    fontSize: 15,
    color: Colors.gray,
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  infoText: {
    fontSize: 14,
    color: Colors.gray,
    flex: 1,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#e8f4ff',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  healthText: {
    color: '#0066ff',
    fontSize: 13,
    fontWeight: '700',
  },
  likesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  likesText: {
    color: '#9b1d1d',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    color: '#111',
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    color: '#333',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  contactButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  adoptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  adoptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
