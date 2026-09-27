import { useEffect, useState } from 'react';
import { View, Image, StyleSheet, Text, Platform, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';

type Props = {
  latitude: number;
  longitude: number;
  height?: number;
  zoom?: number;
  markers?: { latitude: number; longitude: number; color?: string; label?: string }[];
};

export default function StaticMap({ latitude, longitude, height = 200, zoom = 13, markers }: Props) {
  // Web: use OSM embed iframe (staticmap.openstreetmap.de is often down/CORS blocked)
  if (Platform.OS === 'web') {
    const delta = zoom > 14 ? 0.01 : zoom > 12 ? 0.02 : 0.05;
    const bbox = `${longitude - delta},${latitude - delta},${longitude + delta},${latitude + delta}`;
    const embedSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`;
    return (
      <View style={[styles.container, { height }]}>
        {/* @ts-ignore - iframe works on react-native-web */}
        <View style={[styles.image, { height, overflow: 'hidden' }] as any}>
          {/* @ts-ignore */}
          <iframe
            src={embedSrc}
            style={{ border: 0, width: '100%', height: '100%' } as any}
            loading="lazy"
            referrerPolicy="no-referrer"
            title="Map"
          />
        </View>
        <View style={styles.attribution}>
          <Text style={styles.attributionText}>© OpenStreetMap</Text>
        </View>
        {markers && markers.length > 1 && (
          <View style={styles.markerCount}>
            <Text style={styles.markerCountText}>📍 {markers.length} locations</Text>
          </View>
        )}
      </View>
    );
  }

  // Native: static image with fallback
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  let src = `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=${zoom}&size=600x300&maptype=mapnik`;
  if (markers?.length) {
    const m = markers.map((mm) => `${mm.latitude},${mm.longitude},${mm.color || 'red'}`).join('|');
    src += `&markers=${encodeURIComponent(m)}`;
  }

  useEffect(() => {
    setFailed(false);
    setLoading(true);
    let cancelled = false;
    Image.prefetch(src).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [src]);

  if (failed) {
    return (
      <View style={[styles.container, styles.fallback, { height }]}>
        <Text style={styles.fallbackTitle}>📍 {latitude.toFixed(4)}, {longitude.toFixed(4)}</Text>
        {markers && markers.length > 1 && <Text style={styles.fallbackSub}>{markers.length - 1} cats nearby</Text>}
        <TouchableOpacity style={styles.fallbackBtn} onPress={() => Linking.openURL(`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=${zoom}/${latitude}/${longitude}`)}>
          <Text style={styles.fallbackBtnText}>Open in Maps</Text>
        </TouchableOpacity>
        <View style={styles.attribution}><Text style={styles.attributionText}>© OpenStreetMap</Text></View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <Image
        source={{ uri: src }}
        style={[styles.image, { height }]}
        resizeMode="cover"
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setFailed(true); setLoading(false); }}
      />
      {loading && !failed && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      )}
      <View style={styles.marker}>
        <Text style={styles.markerText}>📍</Text>
      </View>
      <View style={styles.attribution}>
        <Text style={styles.attributionText}>© OpenStreetMap</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e9ecef',
  },
  image: {
    width: '100%',
  },
  marker: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -12,
    marginTop: -24,
  },
  markerText: {
    fontSize: 24,
  },
  attribution: {
    position: 'absolute',
    bottom: 4,
    right: 6,
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  attributionText: {
    fontSize: 9,
    color: '#555',
  },
  markerCount: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  markerCountText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(233,236,239,0.6)',
  },
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  fallbackTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
  },
  fallbackSub: {
    fontSize: 12,
    color: '#666',
  },
  fallbackBtn: {
    marginTop: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fallbackBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
