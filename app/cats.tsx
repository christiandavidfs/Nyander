import { Animated, Dimensions, Image, PanResponder, Pressable, StyleSheet, Text, TouchableOpacity, View, FlatList, Alert, TextInput, Modal, ScrollView, ActivityIndicator, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { FontAwesome } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { mockCats } from '@/data/mockCats';
import type { Cat, UserProfile, AdoptionRequest } from '@/types';
import DonateButton from '@/components/DonateButton';
import SponsorButton from '@/components/SponsorButton';
import { Colors } from '@/constants/Colors';
import { File } from 'expo-file-system';
import { haversineDistance, requestLocation } from '@/lib/location';
import StaticMap from '@/components/StaticMap';
import * as ImagePicker from 'expo-image-picker';

const PASSED_IDS_KEY = 'nyander_passed_cat_ids';

const { width } = Dimensions.get('window');
const swipeThreshold = Math.min(width * 0.25, 120);
const flyAwayDistance = width + 160;

const distanceLabel = (km: number | null | undefined): string => {
  if (km == null) return 'Distance unknown';
  if (km < 1) return 'Less than 1 km away';
  if (km === 1) return '1 km away';
  return `${Math.round(km)} km away`;
};

const toCat = (item: Record<string, unknown>): Cat => ({
  id: (item.id as string) ?? `cat-${Date.now()}`,
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

export default function CatDeckScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<any>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [likedIds, setLikedIds] = useState(new Set<string>());
  const [passedIds, setPassedIds] = useState(new Set<string>());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const pan = useRef(new Animated.ValueXY()).current;

  const [maxDistance, setMaxDistance] = useState(50);
  const [showMap, setShowMap] = useState(false);
  const [myLat, setMyLat] = useState<number | null>(null);
  const [myLng, setMyLng] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [temperamentFilter, setTemperamentFilter] = useState<string | null>(null);

  const filteredCats = cats.filter((c: Cat) => {
    // distance — compute on the fly if not yet calculated (e.g. profile location was null at fetch)
    let dist: number | null | undefined = c.distance_km;
    if ((dist == null || dist === undefined) && myLat != null && myLng != null && c.latitude != null && c.longitude != null) {
      dist = haversineDistance(myLat, myLng, Number(c.latitude), Number(c.longitude));
    }
    if (dist != null && dist > maxDistance) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !(c.breed || '').toLowerCase().includes(q) && !(c.description || '').toLowerCase().includes(q)) return false;
    }
    if (temperamentFilter && (!c.temperament || !c.temperament[temperamentFilter])) return false;
    return true;
  });

  useEffect(() => {
    setCurrentIndex(0);
  }, [filteredCats.length]);

  const currentCat = filteredCats[currentIndex];
  const nextCat = filteredCats[currentIndex + 1];

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!isSupabaseConfigured) {
        if (!cancelled) setCats(mockCats.map(toCat));
        if (!cancelled) setLoading(false);
        return;
      }

      const { data: { session: s } } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(s);

      let lat: number | null = null;
      let lng: number | null = null;
      let myCountry: string | null = null;

      if (s?.user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', s.user.id).single();
        if (!cancelled) setProfile(p);
        if (p?.latitude && p?.longitude) {
          lat = Number(p.latitude);
          lng = Number(p.longitude);
        }
        myCountry = p?.country_code ?? null;
      }

      if (!lat || !lng) {
        const loc = await requestLocation();
        if (loc) {
          lat = loc.latitude;
          lng = loc.longitude;
          if (s?.user && isSupabaseConfigured) {
            await supabase.from('profiles').update({ latitude: lat, longitude: lng }).eq('id', s.user.id);
          }
        }
      }

      if (!cancelled) { setMyLat(lat); setMyLng(lng); if (lat && lng) setShowMap(true); }

      let catQuery: any = supabase.from('cats').select('*').eq('status', 'available');
      if (myCountry) catQuery = catQuery.eq('country_code', myCountry);
      catQuery = catQuery.order('created_at', { ascending: false }).range(0, 49);
      const { data, error } = await catQuery;
      if (cancelled) return;

      if (error) {
        console.error('Error fetching cats:', error);
        setCats([]);
      } else {
        let allCats = data && data.length > 0 ? data.map(toCat) : [];

        // Exclude already-swiped cats
        const swipedIds = new Set<string>();
        if (s?.user && isSupabaseConfigured) {
          const { data: likes } = await supabase
            .from('likes')
            .select('cat_id')
            .eq('user_id', s.user.id);
          likes?.forEach((l) => swipedIds.add(l.cat_id));
        }
        try {
          const passed = await AsyncStorage.getItem(PASSED_IDS_KEY);
          if (passed) {
            JSON.parse(passed).forEach((id: string) => swipedIds.add(id));
          }
        } catch (_) {}

        allCats = allCats.filter((c: Cat) => !swipedIds.has(c.id));

        if (lat && lng) {
          allCats = allCats.map((c: Cat) => ({
            ...c,
            distance_km: c.latitude && c.longitude
              ? haversineDistance(lat, lng, Number(c.latitude), Number(c.longitude))
              : null,
          }));
          allCats.sort((a: Cat, b: Cat) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
        }
        setCats(allCats);
      }
      setLoading(false);
    };

    init();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setCurrentIndex(0);
    pan.setValue({ x: 0, y: 0 });
    setExpanded(false);
  }, [pan]);

  useEffect(() => {
    pan.setValue({ x: 0, y: 0 });
    setExpanded(false);
  }, [currentIndex, pan]);

  const rotate = pan.x.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });

  const likeOpacity = pan.x.interpolate({
    inputRange: [0, swipeThreshold],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const passOpacity = pan.x.interpolate({
    inputRange: [-swipeThreshold, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const animatedCardStyle = {
    transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }],
  };

  const updateLike = async (catId: string, shelterId?: string) => {
    setCats((current) =>
      current.map((item) =>
        item.id === catId ? { ...item, likes: (item.likes ?? 0) + 1 } : item
      ),
    );

    if (!isSupabaseConfigured || catId.startsWith('demo-')) return;

    try {
      const { error } = await supabase.rpc('increment_cat_likes', { cat_id: catId });
      if (error) {
        console.error('Error liking cat:', error);
        setCats((current) =>
          current.map((item) =>
            item.id === catId ? { ...item, likes: (item.likes ?? 1) - 1 } : item
          ),
        );
      } else if (shelterId) {
        try { await supabase.rpc('increment_shelter_earnings', { shelter_id: shelterId, amount: 5 }); } catch (_) {}
      }
    } catch (err) {
      console.error('Exception liking cat:', err);
      setCats((current) =>
        current.map((item) =>
          item.id === catId ? { ...item, likes: (item.likes ?? 1) - 1 } : item
        ),
      );
    }

    // Record the like in the likes table so it doesn't reappear on reload
    if (session?.user) {
      try {
        const { error: upsertErr } = await supabase.from('likes').upsert(
          { cat_id: catId, user_id: session.user.id },
          { onConflict: 'cat_id, user_id' },
        );
        if (upsertErr) console.error('Error recording like:', upsertErr);
      } catch (err) {
        console.error('Exception recording like:', err);
      }
    }
  };

  const advanceCard = () => {
    setCurrentIndex((index) => Math.min(index + 1, cats.length));
  };

  const handleDecision = async (decision: 'pass' | 'like') => {
    if (!currentCat) return;

    if (decision === 'like') {
      if (likedIds.has(currentCat.id)) return;
      setLikedIds((prev) => new Set(prev).add(currentCat.id));
      await updateLike(currentCat.id, currentCat.shelter_id);
    } else {
      if (passedIds.has(currentCat.id)) return;
      setPassedIds((prev) => new Set(prev).add(currentCat.id));
      try {
        const raw = await AsyncStorage.getItem(PASSED_IDS_KEY);
        const ids: string[] = raw ? JSON.parse(raw) : [];
        if (!ids.includes(currentCat.id)) {
          ids.push(currentCat.id);
          await AsyncStorage.setItem(PASSED_IDS_KEY, JSON.stringify(ids));
        }
      } catch (err) {
        console.error('Error saving pass:', err);
      }
    }

    advanceCard();
  };

  const animateDecision = (decision: 'pass' | 'like') => {
    Animated.timing(pan, {
      toValue: {
        x: decision === 'like' ? flyAwayDistance : -flyAwayDistance,
        y: 24,
      },
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      handleDecision(decision);
    });
  };

  const resetDeck = () => {
    setCurrentIndex(0);
    setExpanded(false);
    pan.setValue({ x: 0, y: 0 });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8,
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > swipeThreshold) {
            animateDecision('like');
            return;
          }

          if (gesture.dx < -swipeThreshold) {
            animateDecision('pass');
            return;
          }

          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 6,
            useNativeDriver: false,
          }).start();
        },
      }),
    [currentCat, pan],
  );

  const renderCatCard = (cat: Cat, isTopCard: boolean) => (
    <View style={[styles.card, !isTopCard && styles.nextCard]}>
      {cat.image_urls && cat.image_urls.length > 0 ? (
        <Image source={{ uri: cat.image_urls[0] }} style={styles.image} />
      ) : (
        <View style={styles.placeholderImage}>
          <FontAwesome name="paw" size={64} color="#ddd" />
        </View>
      )}

      {isTopCard && (
        <>
          <Animated.View style={[styles.stamp, styles.likeStamp, { opacity: likeOpacity }]}>
            <Text style={[styles.stampText, styles.likeStampText]}>LIKE</Text>
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.passStamp, { opacity: passOpacity }]}>
            <Text style={[styles.stampText, styles.passStampText]}>NOPE</Text>
          </Animated.View>
        </>
      )}

      <View style={styles.cardContent}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.name}>{cat.name}</Text>
            <Text style={styles.meta}>
              {cat.age ?? 'Age unknown'} • {cat.breed ?? 'Mixed breed'}
            </Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <FontAwesome name="map-marker" size={14} color="#666" />
          <Text style={styles.detailText}>{distanceLabel(cat.distance_km)} • {cat.location}</Text>
        </View>

        <View style={styles.badgeRow}>
          {!!cat.health_status && (
            <View style={styles.healthBadge}>
              <Text style={styles.healthText}>{cat.health_status}</Text>
            </View>
          )}
        </View>

        <Pressable onPress={() => setExpanded((value) => !value)}>
          <Text numberOfLines={expanded ? undefined : 2} style={styles.description}>
            {cat.description}
          </Text>
        </Pressable>

        <View style={styles.monetizationBar}>
          <DonateButton catId={cat.id} catName={cat.name} shelterId={cat.shelter_id} />
          <SponsorButton catId={cat.id} catName={cat.name} shelterId={cat.shelter_id} />
        </View>

        <TouchableOpacity
          style={styles.viewDetails}
          onPress={() => router.push(`/cat/${cat.id}`)}
        >
          <Text style={styles.viewDetailsText}>View full profile</Text>
          <FontAwesome name="chevron-right" size={12} color={Colors.primary} />
        </TouchableOpacity>

        <View style={styles.likesRow}>
          <FontAwesome name="heart" size={14} color="#ff3b30" />
          <Text style={styles.likesText}>{cat.likes} people interested</Text>
        </View>
      </View>
    </View>
  );

  if (profile?.role === 'centro') {
    return <ShelterDashboard profile={profile} />;
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {loading ? (
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading cats...</Text>
        </View>
      ) : (
        <>
          {!isSupabaseConfigured && (
            <View style={styles.demoBanner}>
              <Text style={styles.demoBannerText}>
                Demo mode: configure Supabase env vars to load real pets.
              </Text>
            </View>
          )}

          <View style={styles.header}>
            <View>
              <Text style={styles.heading}>Matches nearby</Text>
              <Text style={styles.subheading}>Swipe to like or pass</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity onPress={() => setShowMap(!showMap)}>
                <FontAwesome name={showMap ? 'list' : 'map'} size={20} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.progress}>
                {filteredCats.length === 0 ? 0 : Math.min(currentIndex + 1, filteredCats.length)} / {filteredCats.length}
              </Text>
            </View>
          </View>

          <View style={styles.searchRow}>
            <FontAwesome name="search" size={14} color={Colors.gray} />
            <TextInput placeholder="Search breed, name..." value={search} onChangeText={setSearch} style={styles.searchInput} placeholderTextColor={Colors.gray} />
            {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><FontAwesome name="times-circle" size={16} color={Colors.gray} /></TouchableOpacity>}
          </View>
          <View style={styles.filterRow}>
            <FontAwesome name="smile-o" size={14} color={Colors.gray} />
            {['friendly','playful','calm','cuddly'].map((t) => (
              <TouchableOpacity key={t} style={[styles.distChip, temperamentFilter===t && styles.distChipActive]} onPress={()=>setTemperamentFilter(temperamentFilter===t?null:t)}>
                <Text style={[styles.distChipText, temperamentFilter===t && styles.distChipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {myLat && myLng && (
            <View style={styles.filterRow}>
              <FontAwesome name="location-arrow" size={14} color={Colors.gray} />
              {[1, 5, 10, 25, 50, 100, 200].map((km) => (
                <TouchableOpacity
                  key={km}
                  style={[styles.distChip, maxDistance === km && styles.distChipActive]}
                  onPress={() => setMaxDistance(km)}
                >
                  <Text style={[styles.distChipText, maxDistance === km && styles.distChipTextActive]}>
                    {km}
                  </Text>
                </TouchableOpacity>
              ))}
              <Text style={styles.filterLabel}>km</Text>
            </View>
          )}

          {showMap && myLat && myLng && (
            <View style={{ marginBottom: 10 }}>
              <StaticMap latitude={myLat} longitude={myLng} height={220} zoom={10} />
            </View>
          )}

          <View style={styles.deck}>
            {currentCat ? (
              <>
                {nextCat && renderCatCard(nextCat, false)}
                <Animated.View
                  style={[styles.topCard, animatedCardStyle]}
                  {...panResponder.panHandlers}
                >
                  {renderCatCard(currentCat, true)}
                </Animated.View>
              </>
            ) : (
              <View style={styles.doneState}>
                <FontAwesome name="search" size={54} color="#0066ff" />
                <Text style={styles.doneTitle}>No more cats nearby</Text>
                <Text style={styles.doneText}>Check back soon or adjust your search area.</Text>
                <Pressable style={styles.resetButton} onPress={resetDeck}>
                  <Text style={styles.resetButtonText}>Reload matches</Text>
                </Pressable>
              </View>
            )}
          </View>

          {currentCat && (
            <View style={styles.actions}>
              <Pressable
                accessibilityLabel="Pass"
                style={[styles.actionButton, styles.passButton]}
                onPress={() => animateDecision('pass')}
              >
                <FontAwesome name="times" size={28} color="#ff3b30" />
              </Pressable>
              <Pressable
                accessibilityLabel="Like"
                style={[styles.actionButton, styles.likeButton]}
                onPress={() => animateDecision('like')}
              >
                <FontAwesome name="heart" size={28} color="#1fbf75" />
              </Pressable>
            </View>
          )}
        </>
      )}
    </View>
  );
}

function ShelterDashboard({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [myCats, setMyCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);

  const [formName, setFormName] = useState('');
  const [formAge, setFormAge] = useState('');
  const [formBreed, setFormBreed] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formHealth, setFormHealth] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formVideos, setFormVideos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [requests, setRequests] = useState<(AdoptionRequest & { cat_name?: string; user_name?: string; user_phone?: string })[]>([]);
  const [showRequests, setShowRequests] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);

  const loadMyCats = async () => {
    if (!isSupabaseConfigured) {
      setMyCats(mockCats.map(toCat).filter(c => c.shelter_id === profile.id));
      setLoading(false);
      return;
    }
    const { data } = await supabase.from('cats').select('*').eq('shelter_id', profile.id);
    setMyCats(data && data.length > 0 ? data.map(toCat) : []);
    setLoading(false);
  };

  useEffect(() => { loadMyCats(); }, []);

  const loadRequests = async () => {
    if (!isSupabaseConfigured) return;
    setRequestsLoading(true);
    try {
      const { data } = await supabase
        .from('adoption_requests')
        .select('*')
        .eq('shelter_id', profile.id)
        .order('created_at', { ascending: false });

      if (!data) { setRequests([]); return; }

      const enriched = await Promise.all(
        data.map(async (r) => {
          const { data: cat } = await supabase.from('cats').select('name').eq('id', r.cat_id).single();
          const { data: user } = await supabase.from('profiles').select('display_name, phone').eq('id', r.user_id).single();
          return {
            ...r,
            cat_name: (cat as any)?.name ?? 'Unknown cat',
            user_name: (user as any)?.display_name ?? 'Unknown user',
            user_phone: (user as any)?.phone ?? null,
          };
        })
      );
      setRequests(enriched);
    } catch (err) {
      console.error('Error loading requests:', err);
    } finally {
      setRequestsLoading(false);
    }
  };

  const handleRequestAction = async (requestId: string, newStatus: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('adoption_requests')
        .update({ status: newStatus })
        .eq('id', requestId);
      if (error) throw error;
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: newStatus } : r));
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const uploadMedia = async (uri: string, folder: string): Promise<string | null> => {
    if (!isSupabaseConfigured) return null;
    try {
      let filePath: string;
      let fileBody: ArrayBuffer | Blob;
      let contentType: string;

      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        fileBody = await response.blob();
        contentType = fileBody.type || 'image/jpeg';
        const webExt = contentType.split('/')[1] || 'jpg';
        filePath = `${profile.id}/${folder}/${Date.now()}.${webExt}`;
      } else {
        const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
        filePath = `${profile.id}/${folder}/${Date.now()}.${ext}`;
        const mediaFile = new File(uri);
        fileBody = (await mediaFile.bytes()).buffer as ArrayBuffer;
        const videoMatch = uri.match(/\.(mp4|mov|avi|webm)$/i);
        if (videoMatch) {
          const videoTypes: Record<string, string> = { mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', webm: 'video/webm' };
          contentType = videoTypes[videoMatch[1].toLowerCase()] || 'video/mp4';
        } else {
          contentType = `image/${ext === 'png' ? 'png' : 'jpeg'}`;
        }
      }

      const { error } = await supabase.storage
        .from('cat_media')
        .upload(filePath, fileBody, { upsert: true, contentType });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('cat_media').getPublicUrl(filePath);
      return publicUrl;
    } catch (err) {
      console.error('Upload error:', err);
      return null;
    }
  };

  const handleAddCat = async () => {
    if (!formName.trim()) { Alert.alert('Required', 'Name is required.'); return; }
    setSubmitting(true);
    try {
      let imageUrls: string[] = [];
      let videoUrls: string[] = [];

      if (isSupabaseConfigured) {
        for (const uri of formImages) {
          const url = await uploadMedia(uri, 'images');
          if (url) imageUrls.push(url);
        }
        for (const uri of formVideos) {
          const url = await uploadMedia(uri, 'videos');
          if (url) videoUrls.push(url);
        }
      }

      const { error } = await supabase.from('cats').insert({
        shelter_id: profile.id,
        name: formName.trim(),
        age: formAge || null,
        breed: formBreed || null,
        description: formDescription || null,
        health_status: formHealth || null,
        location: formLocation || profile.address || null,
        latitude: profile.latitude,
        longitude: profile.longitude,
        image_urls: imageUrls,
        video_urls: videoUrls,
        country_code: profile.country_code,
        status: 'available',
      });
      if (error) throw error;
      Alert.alert('Added', `${formName} has been added.`);
      setAddModal(false);
      resetForm();
      loadMyCats();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCat = async (catId: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const { error } = await supabase.from('cats').delete().eq('id', catId);
      if (error) throw error;
      setMyCats(prev => prev.filter(c => c.id !== catId));
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const pickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets) {
        setFormImages(prev => [...prev, ...result.assets.map((a: any) => a.uri)]);
      }
    } catch (err) {
      console.error('Picker error:', err);
    }
  };

  const pickVideos = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets) {
        setFormVideos(prev => [...prev, ...result.assets.map((a: any) => a.uri)]);
      }
    } catch (err) {
      console.error('Picker error:', err);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormAge('');
    setFormBreed('');
    setFormDescription('');
    setFormHealth('');
    setFormLocation('');
    setFormImages([]);
    setFormVideos([]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>My Cats</Text>
          <Text style={styles.subheading}>{myCats.length} cats registered</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {isSupabaseConfigured && (
            <TouchableOpacity style={shelterStyles.requestsBtn} onPress={() => { loadRequests(); setShowRequests(true); }}>
              <FontAwesome name="clipboard" size={14} color={Colors.primary} />
              <Text style={shelterStyles.requestsBtnText}>Requests</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.addButton} onPress={() => setAddModal(true)}>
            <FontAwesome name="plus" size={16} color="#fff" />
            <Text style={styles.addButtonText}>Add Pet</Text>
          </TouchableOpacity>
        </View>
      </View>

      {myCats.length === 0 ? (
        <View style={styles.doneState}>
          <FontAwesome name="paw" size={54} color="#ccc" />
          <Text style={styles.doneTitle}>No cats yet</Text>
          <Text style={styles.doneText}>Add your first cat to start finding adopters.</Text>
        </View>
      ) : (
        <FlatList
          data={myCats}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={shelterStyles.catCard}
              onPress={() => router.push(`/cat/${item.id}`)}
            >
              {item.image_urls && item.image_urls.length > 0 ? (
                <Image source={{ uri: item.image_urls[0] }} style={shelterStyles.catImage} />
              ) : (
                <View style={[shelterStyles.catImage, shelterStyles.catImagePlaceholder]}>
                  <FontAwesome name="paw" size={28} color="#ddd" />
                </View>
              )}
              <View style={shelterStyles.catInfo}>
                <Text style={shelterStyles.catName}>{item.name}</Text>
                <Text style={shelterStyles.catMeta}>
                  {item.age ?? 'Unknown'} • {item.breed ?? 'Mixed'}
                </Text>
                <View style={shelterStyles.badgeRow}>
                  <View style={[shelterStyles.statusBadge, {
                    backgroundColor: item.status === 'available' ? '#e8fce8' : '#fce8e8'
                  }]}>
                    <Text style={[shelterStyles.statusText, {
                      color: item.status === 'available' ? '#1fbf75' : '#ff3b30'
                    }]}>{item.status}</Text>
                  </View>
                  <View style={shelterStyles.likesBadge}>
                    <FontAwesome name="heart" size={10} color="#ff3b30" />
                    <Text style={shelterStyles.likesBadgeText}>{item.likes}</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={shelterStyles.deleteBtn}
                onPress={() => {
                  Alert.alert('Delete Cat', `Remove ${item.name}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => handleDeleteCat(item.id) },
                  ]);
                }}
              >
                <FontAwesome name="trash" size={16} color="#ff3b30" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={addModal} animationType="slide" transparent>
        <View style={[shelterStyles.modalOverlay, { paddingBottom: insets.bottom }]}>
          <ScrollView style={shelterStyles.modalContent} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
            <Text style={shelterStyles.modalTitle}>Add New Pet</Text>

            <Text style={shelterStyles.fieldLabel}>Name *</Text>
            <TextInput style={shelterStyles.input} value={formName} onChangeText={setFormName} placeholder="Pet's name" />

            <Text style={shelterStyles.fieldLabel}>Age</Text>
            <TextInput style={shelterStyles.input} value={formAge} onChangeText={setFormAge} placeholder="e.g. 2 years" />

            <Text style={shelterStyles.fieldLabel}>Breed</Text>
            <TextInput style={shelterStyles.input} value={formBreed} onChangeText={setFormBreed} placeholder="e.g. Siamese" />

            <Text style={shelterStyles.fieldLabel}>Health Status</Text>
            <TextInput style={shelterStyles.input} value={formHealth} onChangeText={setFormHealth} placeholder="e.g. Vaccinated, neutered" />

            <Text style={shelterStyles.fieldLabel}>Location</Text>
            <TextInput style={shelterStyles.input} value={formLocation} onChangeText={setFormLocation} placeholder="City, area" />

            <Text style={shelterStyles.fieldLabel}>Description</Text>
            <TextInput style={[shelterStyles.input, { height: 80 }]} value={formDescription} onChangeText={setFormDescription} placeholder="Tell us about the pet..." multiline />

            <Text style={shelterStyles.fieldLabel}>Photos</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {formImages.map((uri, i) => (
                <Image key={i} source={{ uri }} style={{ width: 64, height: 64, borderRadius: 8 }} />
              ))}
              <TouchableOpacity style={shelterStyles.mediaPicker} onPress={pickImages}>
                <FontAwesome name="image" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            <Text style={shelterStyles.fieldLabel}>Videos</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {formVideos.map((uri, i) => (
                <View key={i} style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: '#eceff3', justifyContent: 'center', alignItems: 'center' }}>
                  <FontAwesome name="video-camera" size={20} color="#666" />
                </View>
              ))}
              <TouchableOpacity style={shelterStyles.mediaPicker} onPress={pickVideos}>
                <FontAwesome name="video-camera" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <TouchableOpacity style={shelterStyles.cancelBtn} onPress={() => { setAddModal(false); resetForm(); }}>
                <Text style={shelterStyles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={shelterStyles.submitBtn} onPress={handleAddCat} disabled={submitting}>
                <Text style={shelterStyles.submitBtnText}>{submitting ? 'Adding...' : 'Add Pet'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showRequests} animationType="slide" transparent>
        <View style={[shelterStyles.modalOverlay, { paddingBottom: insets.bottom }]}>
          <ScrollView style={shelterStyles.modalContent} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={shelterStyles.modalTitle}>Adoption Requests</Text>
              <TouchableOpacity onPress={() => setShowRequests(false)}>
                <FontAwesome name="times" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {requests.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <FontAwesome name="inbox" size={48} color="#ccc" />
                <Text style={{ marginTop: 12, color: '#999', fontSize: 15 }}>No requests yet</Text>
              </View>
            ) : (
              requests.map((req) => (
                <View key={req.id} style={shelterStyles.requestCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={shelterStyles.requestCat}>{req.cat_name}</Text>
                    <View style={[shelterStyles.reqStatusBadge, {
                      backgroundColor: req.status === 'pending' ? '#fff3cd' : req.status === 'approved' ? '#d4edda' : '#f8d7da'
                    }]}>
                      <Text style={[shelterStyles.reqStatusText, {
                        color: req.status === 'pending' ? '#856404' : req.status === 'approved' ? '#155724' : '#721c24'
                      }]}>{req.status}</Text>
                    </View>
                  </View>
                  <View style={{ marginTop: 8 }}>
                    <Text style={shelterStyles.requestUser}>{req.user_name}</Text>
                    {req.user_phone && <Text style={shelterStyles.requestPhone}>{req.user_phone}</Text>}
                  </View>
                  {req.message && (
                    <Text style={shelterStyles.requestMsg}>"{req.message}"</Text>
                  )}
                  {req.status === 'pending' && (
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                      <TouchableOpacity
                        style={[shelterStyles.reqActionBtn, { backgroundColor: '#34c759' }]}
                        onPress={() => handleRequestAction(req.id, 'approved')}
                      >
                        <FontAwesome name="check" size={12} color="#fff" />
                        <Text style={shelterStyles.reqActionText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[shelterStyles.reqActionBtn, { backgroundColor: '#ff3b30' }]}
                        onPress={() => handleRequestAction(req.id, 'rejected')}
                      >
                        <FontAwesome name="times" size={12} color="#fff" />
                        <Text style={shelterStyles.reqActionText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const shelterStyles = StyleSheet.create({
  catCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 12,
    marginTop: 10,
    padding: 10,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  catImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#eceff3',
  },
  catImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  catInfo: {
    flex: 1,
    marginLeft: 12,
  },
  catName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
  },
  catMeta: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  likesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likesBadgeText: {
    fontSize: 12,
    color: '#666',
  },
  deleteBtn: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
    color: '#111',
  },
  fieldLabel: {
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d1d6',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d1d6',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#666',
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  mediaPicker: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  requestsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  requestsBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  requestCat: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  requestUser: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  requestPhone: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  requestMsg: {
    fontSize: 13,
    color: '#555',
    fontStyle: 'italic',
    marginTop: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#ddd',
  },
  reqStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  reqStatusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  reqActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  reqActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6f8',
    padding: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
  },
  demoBanner: {
    backgroundColor: '#fff7e6',
    borderColor: '#f2c46d',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    padding: 10,
  },
  demoBannerText: {
    color: '#76520f',
    fontSize: 13,
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  heading: {
    color: '#111',
    fontSize: 24,
    fontWeight: '800',
  },
  subheading: {
    color: '#666',
    fontSize: 13,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 4,
    flexWrap: 'wrap',
  },
  filterLabel: {
    fontSize: 12,
    color: Colors.gray,
    fontWeight: '600',
  },
  distChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  distChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  distChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  distChipTextActive: {
    color: '#fff',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111',
    paddingVertical: 0,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  progress: {
    color: '#666',
    fontSize: 14,
    fontWeight: '700',
  },
  deck: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 430,
  },
  topCard: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    elevation: 6,
    height: '100%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
  },
  nextCard: {
    opacity: 0.72,
    transform: [{ scale: 0.95 }, { translateY: 16 }],
  },
  image: {
    backgroundColor: '#e7e7e7',
    height: '50%',
    width: '100%',
  },
  placeholderImage: {
    alignItems: 'center',
    backgroundColor: '#eceff3',
    height: '50%',
    justifyContent: 'center',
    width: '100%',
  },
  stamp: {
    borderRadius: 8,
    borderWidth: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    position: 'absolute',
    top: 26,
    zIndex: 2,
  },
  likeStamp: {
    borderColor: '#1fbf75',
    right: 24,
    transform: [{ rotate: '12deg' }],
  },
  passStamp: {
    borderColor: '#ff3b30',
    left: 24,
    transform: [{ rotate: '-12deg' }],
  },
  stampText: {
    fontSize: 28,
    fontWeight: '900',
  },
  likeStampText: {
    color: '#1fbf75',
  },
  passStampText: {
    color: '#ff3b30',
  },
  cardContent: {
    flex: 1,
    padding: 14,
  },
  titleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
  },
  name: {
    color: '#111',
    fontSize: 26,
    fontWeight: '900',
  },
  meta: {
    color: '#555',
    fontSize: 13,
    marginTop: 2,
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  detailText: {
    color: '#666',
    flex: 1,
    fontSize: 13,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  healthBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e8f4ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  healthText: {
    color: '#0066ff',
    fontSize: 12,
    fontWeight: '700',
  },
  description: {
    color: '#333',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 9,
  },
  monetizationBar: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  viewDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  viewDetailsText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  likesRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 'auto',
    paddingTop: 8,
  },
  likesText: {
    color: '#9b1d1d',
    fontSize: 12,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 28,
    justifyContent: 'center',
    paddingBottom: 8,
    paddingTop: 16,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 999,
    elevation: 3,
    height: 64,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    width: 64,
  },
  passButton: {
    borderColor: '#ffd2d2',
    borderWidth: 1,
  },
  likeButton: {
    borderColor: '#c8f1dc',
    borderWidth: 1,
  },
  doneState: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    gap: 10,
    justifyContent: 'center',
    minHeight: 420,
    padding: 24,
  },
  doneTitle: {
    color: '#111',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  doneText: {
    color: '#666',
    fontSize: 15,
    textAlign: 'center',
  },
  resetButton: {
    backgroundColor: '#0066ff',
    borderRadius: 8,
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  resetButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
});
