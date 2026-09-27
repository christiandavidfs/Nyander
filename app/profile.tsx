import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Button,
  Alert,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import type { UserProfile } from '@/types';
import { File } from 'expo-file-system';
import { requestLocation } from '@/lib/location';
import * as ImagePicker from 'expo-image-picker';
import CountryPicker from '@/components/CountryPicker';

export default function ProfileScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Editable fields
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [countryCode, setCountryCode] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        setSession(data.session);
        if (data.session?.user) {
          loadProfile(data.session.user.id);
        }
      } catch (err) {
        console.error('Session error:', err);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (cancelled) return;
      setSession(nextSession);
      if (nextSession?.user) {
        loadProfile(nextSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      setProfile(data);
      if (data) {
        setDisplayName(data.display_name ?? '');
        setPhone(data.phone ?? '');
        setAddress(data.address ?? '');
        setPaypalEmail(data.paypal_email ?? '');
        setCountryCode(data.country_code ?? null);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        display_name: displayName || null,
        phone: phone || null,
        address: address || null,
        paypal_email: paypalEmail || null,
        country_code: countryCode || null,
      };

      const loc = await requestLocation();
      if (loc) {
        updates.latitude = loc.latitude;
        updates.longitude = loc.longitude;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', session?.user?.id);

      if (error) throw error;
      setProfile((prev) => prev ? {
        ...prev,
        ...updates,
      } : null);
      setEditing(false);
      Alert.alert('Saved', 'Profile updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const pickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      setUploading(true);
      const uri = result.assets[0].uri;
      let filePath = `${session?.user?.id}/avatar`;

      let fileBody: ArrayBuffer | Blob;
      let contentType: string;

      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        fileBody = await response.blob();
        contentType = fileBody.type || 'image/jpeg';
        const webExt = contentType.split('/')[1] || 'jpg';
        filePath += `.${webExt}`;
      } else {
        const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
        filePath += `.${ext}`;
        const imageFile = new File(uri);
        fileBody = (await imageFile.bytes()).buffer as ArrayBuffer;
        contentType = `image/${ext === 'png' ? 'png' : 'jpeg'}`;
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, fileBody, {
          upsert: true,
          contentType,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', session?.user?.id);

      if (updateError) throw updateError;

      setProfile((prev) => prev ? { ...prev, avatar_url: publicUrl } : null);
    } catch (err: any) {
      Alert.alert('Upload error', err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      router.replace('/');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  if (!session) {
    return (
      <View style={styles.centered}>
        <FontAwesome name="user-circle" size={80} color={Colors.lightGray} />
        <Text style={styles.notLoggedIn}>Not signed in</Text>
        <Button title="Sign In" onPress={() => router.push('/login')} color={Colors.primary} />
        <Button title="Sign Up" onPress={() => router.push('/register')} color={Colors.secondary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header / Avatar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={pickAvatar} disabled={uploading || !editing}>
          {uploading ? (
            <ActivityIndicator size="large" color={Colors.primary} />
          ) : profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <FontAwesome name="user-circle" size={80} color={Colors.primary} />
          )}
          {editing && (
            <View style={styles.avatarOverlay}>
              <FontAwesome name="camera" size={18} color="#fff" />
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.name}>
          {editing ? 'Edit Profile' : (profile?.display_name || session.user?.email)}
        </Text>
        <Text style={styles.email}>{session.user?.email}</Text>

        <View style={styles.scoreContainer}>
          <FontAwesome name="star" size={20} color={Colors.accent} />
          <Text style={styles.score}>XP: {profile?.score ?? 0} • Lv {Math.floor((profile?.score ?? 0) / 200) + 1}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {(profile?.score ?? 0) >= 5 && <View style={{ backgroundColor: '#eef2ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}><Text style={{ fontSize: 11, fontWeight: '700', color: Colors.primary }}>🐾 First Like</Text></View>}
          {(profile?.score ?? 0) >= 50 && <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}><Text style={{ fontSize: 11, fontWeight: '700', color: '#92400e' }}>❤️ Big Heart</Text></View>}
          {(profile?.score ?? 0) >= 500 && <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}><Text style={{ fontSize: 11, fontWeight: '700', color: '#065f46' }}>🏠 Home Giver</Text></View>}
          {profile?.role === 'centro' && <View style={{ backgroundColor: '#fce7f3', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}><Text style={{ fontSize: 11, fontWeight: '700', color: '#9d174d' }}>🏪 Shelter</Text></View>}
        </View>

        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>
            {profile?.role === 'centro' ? '🏪 Shelter / Center' : profile?.role === 'sponsor' ? '💼 Sponsor (legacy)' : '👤 Adopter'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.editToggle, editing && styles.editToggleActive]}
          onPress={() => {
            if (editing) {
              saveProfile();
            } else {
              setEditing(true);
            }
          }}
        >
          <FontAwesome name={editing ? 'check' : 'pencil'} size={14} color={editing ? '#fff' : Colors.primary} />
          <Text style={[styles.editToggleText, editing && { color: '#fff' }]}>
            {editing ? (saving ? 'Saving...' : 'Save') : 'Edit'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Editable fields */}
      {editing ? (
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Display Name</Text>
          <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Your name" />

          <Text style={styles.fieldLabel}>Phone</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+48 000 000 000" keyboardType="phone-pad" />

          <Text style={styles.fieldLabel}>Address</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="City, Street" />

          {profile?.role === 'centro' && (
            <>
              <Text style={styles.fieldLabel}>PayPal Email (for payouts)</Text>
              <TextInput
                style={styles.input}
                value={paypalEmail}
                onChangeText={setPaypalEmail}
                placeholder="shelter@paypal.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </>
          )}
          <Text style={styles.fieldLabel}>Country</Text>
          <CountryPicker value={countryCode} onChange={setCountryCode} />
        </View>
      ) : (
        <>
          {/* Info display */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Info</Text>
            {profile?.phone && (
              <View style={styles.infoRow}>
                <FontAwesome name="phone" size={14} color={Colors.gray} />
                <Text style={styles.infoText}>{profile.phone}</Text>
              </View>
            )}
            {profile?.address && (
              <View style={styles.infoRow}>
                <FontAwesome name="home" size={14} color={Colors.gray} />
                <Text style={styles.infoText}>{profile.address}</Text>
              </View>
            )}
            {!profile?.phone && !profile?.address && (
              <Text style={styles.noData}>No contact info set.</Text>
            )}
          </View>

          {profile?.role === 'centro' && profile?.paypal_email && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment</Text>
              <View style={styles.infoRow}>
                <FontAwesome name="paypal" size={14} color="#0070ba" />
                <Text style={styles.infoText}>{profile.paypal_email}</Text>
              </View>
            </View>
          )}
        </>
      )}

      <View style={styles.actions}>
        <Button title="Sign Out" onPress={handleSignOut} color={Colors.error} />
      </View>
    </View>
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
    gap: 15,
  },
  header: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: Colors.white,
    marginBottom: 1,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 15,
  },
  email: {
    fontSize: 14,
    color: Colors.gray,
    marginTop: 5,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 15,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  score: {
    fontSize: 16,
    fontWeight: '600',
  },
  roleBadge: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
  },
  roleText: {
    fontSize: 14,
    color: Colors.darkGray,
  },
  editToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  editToggleActive: {
    backgroundColor: Colors.primary,
  },
  editToggleText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  notLoggedIn: {
    fontSize: 18,
    color: Colors.gray,
    marginBottom: 10,
  },
  section: {
    backgroundColor: Colors.white,
    padding: 20,
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d1d6',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 15,
    color: '#333',
  },
  noData: {
    fontSize: 14,
    color: Colors.gray,
    fontStyle: 'italic',
  },
  actions: {
    padding: 20,
  },
});
