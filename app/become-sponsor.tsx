import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator,
  Image, Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';
import { useI18n } from '@/i18n';

const CATEGORIES = ['Pet Store', 'Veterinarian', 'Grooming', 'Boarding', 'Pet Sitting', 'Training', 'Other'] as const;

const PRICES = {
  trial: { label: 'Trial 14 days', amount: 0 },
  monthly: { label: 'Monthly', amount: 15 },
  yearly: { label: 'Yearly', amount: 150 },
};

export default function BecomeSponsorScreen() {
  const router = useRouter();
  const { t, categoryName } = useI18n();
  const [step, setStep] = useState(1);

  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setLogoUri(result.assets[0].uri);
    }
  };

  const uploadLogo = async (ownerId: string): Promise<string | null> => {
    if (!logoUri) return null;
    try {
      let fileBody: ArrayBuffer | Blob;
      let contentType: string;
      let ext: string;

      if (Platform.OS === 'web') {
        const response = await fetch(logoUri);
        fileBody = await response.blob();
        contentType = fileBody.type || 'image/jpeg';
        ext = contentType.split('/')[1] || 'jpg';
      } else {
        ext = logoUri.split('.').pop()?.toLowerCase() ?? 'jpg';
        const { File } = await import('expo-file-system');
        const imageFile = new File(logoUri);
        fileBody = (await imageFile.bytes()).buffer as ArrayBuffer;
        contentType = `image/${ext === 'png' ? 'png' : 'jpeg'}`;
      }

      const filePath = `${ownerId}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('sponsor_logos')
        .upload(filePath, fileBody, { upsert: true, contentType });

      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('sponsor_logos').getPublicUrl(filePath);
      return publicUrl;
    } catch (err) {
      console.error('Logo upload error:', err);
      return null;
    }
  };

  const handleNext = () => {
    if (!businessName.trim()) {
      Alert.alert(t('common.required'), t('becomeSponsor.nameRequired'));
      return;
    }
    setStep(2);
  };

  const handleSelectPlan = async (plan: string) => {
    setSelectedPlan(plan);
    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        Alert.alert(t('common.required'), t('becomeSponsor.signInRequired'));
        router.replace('/login');
        return;
      }

      const logoUrl = await uploadLogo(session.user.id);

      const rawWebsite = websiteUrl.trim();
      const normalizedWebsite = rawWebsite
        ? (/^https?:\/\//i.test(rawWebsite) ? rawWebsite : `https://${rawWebsite}`)
        : null;

      const sponsorPayload: Record<string, any> = {
        business_name: businessName.trim(),
        description: description.trim() || null,
        website_url: normalizedWebsite,
        category: category || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        logo_url: logoUrl,
        owner_id: session.user.id,
        country_code: null,
        ranking: 0,
      };

      const { data: profile } = await supabase
        .from('profiles')
        .select('country_code')
        .eq('id', session.user.id)
        .maybeSingle();
      if (profile?.country_code) {
        sponsorPayload.country_code = profile.country_code;
      }

      if (plan === 'trial') {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 14);
        sponsorPayload.status = 'trial';
        sponsorPayload.plan = 'trial';
        sponsorPayload.trial_ends_at = trialEnd.toISOString();

        const { error } = await supabase.from('sponsors').insert(sponsorPayload);
        if (error) throw error;
        Alert.alert(t('common.success'), t('becomeSponsor.trialSuccess'));
        router.replace('/sponsors');
        return;
      }

      sponsorPayload.status = 'pending';
      sponsorPayload.plan = plan;
      sponsorPayload.amount = plan === 'monthly' ? PRICES.monthly.amount : PRICES.yearly.amount;
      sponsorPayload.currency = 'USD';

      const { data: newSponsor, error: insertError } = await supabase
        .from('sponsors')
        .insert(sponsorPayload)
        .select()
        .single();
      if (insertError) throw insertError;

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

      if (plan === 'monthly') {
        const res = await fetch(`${apiUrl}/api/paypal/create-sponsor-subscription`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sponsorId: newSponsor.id, amount: PRICES.monthly.amount, currency: 'USD' }),
        });
        const data = await res.json();
        if (data.mock) {
          Alert.alert(t('common.success'), t('becomeSponsor.demoSuccess'));
          router.replace('/sponsors');
          return;
        }
        if (data.approval_url) {
          if (Platform.OS === 'web') {
            window.open(data.approval_url, '_blank');
            router.replace('/sponsors');
          } else {
            const { Linking } = await import('react-native');
            Linking.openURL(data.approval_url);
            router.replace('/sponsors');
          }
        } else {
          throw new Error(data.error || 'No approval URL from PayPal');
        }
      } else {
        const res = await fetch(`${apiUrl}/api/paypal/create-sponsor-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sponsorId: newSponsor.id, amount: PRICES.yearly.amount, currency: 'USD' }),
        });
        const data = await res.json();
        if (data.mock) {
          Alert.alert(t('common.success'), t('becomeSponsor.demoSuccess'));
          router.replace('/sponsors');
          return;
        }
        if (data.approval_url) {
          if (Platform.OS === 'web') {
            window.open(data.approval_url, '_blank');
            router.replace('/sponsors');
          } else {
            const { Linking } = await import('react-native');
            Linking.openURL(data.approval_url);
            router.replace('/sponsors');
          }
        } else {
          throw new Error(data.error || 'No approval URL from PayPal');
        }
      }
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('sponsorBtn.genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t('becomeSponsor.title'), headerTintColor: Colors.primary }} />

      {step === 1 && (
        <>
          <Text style={styles.stepIndicator}>{t('becomeSponsor.step1')}</Text>

          <TouchableOpacity style={styles.logoPicker} onPress={pickLogo}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.logoPreview} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <FontAwesome name="camera" size={28} color={Colors.gray} />
                <Text style={styles.logoPlaceholderText}>{t('becomeSponsor.addLogo')}</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>{t('becomeSponsor.businessName')}</Text>
          <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName} placeholder={t('becomeSponsor.businessNamePh')} />

          <Text style={styles.label}>{t('becomeSponsor.category')}</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.categoryChip, category === c && styles.categoryChipActive]}
                onPress={() => setCategory(category === c ? '' : c)}
              >
                <Text style={[styles.categoryChipText, category === c && styles.categoryChipTextActive]}>{categoryName(c)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>{t('becomeSponsor.description')}</Text>
          <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder={t('becomeSponsor.descriptionPh')} multiline />

          <Text style={styles.label}>{t('becomeSponsor.website')}</Text>
          <TextInput style={styles.input} value={websiteUrl} onChangeText={setWebsiteUrl} placeholder="https://example.com" autoCapitalize="none" keyboardType="url" />

          <Text style={styles.label}>{t('becomeSponsor.phone')}</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+1 555 000 000" keyboardType="phone-pad" />

          <Text style={styles.label}>{t('becomeSponsor.email')}</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="contact@business.com" keyboardType="email-address" autoCapitalize="none" />

          <Text style={styles.label}>{t('becomeSponsor.address')}</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder={t('becomeSponsor.addressPh')} />

          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>{t('becomeSponsor.next')}</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 2 && (
        <>
          <Text style={styles.stepIndicator}>{t('becomeSponsor.step2')}</Text>
          <Text style={styles.businessName}>{businessName}</Text>

          <TouchableOpacity
            style={[styles.planCard, selectedPlan === 'trial' && styles.planCardActive]}
            onPress={() => handleSelectPlan('trial')}
            disabled={submitting}
          >
            <Text style={styles.planEmoji}>🎯</Text>
            <View style={styles.planInfo}>
              <Text style={styles.planName}>{t('becomeSponsor.trial')}</Text>
              <Text style={styles.planDesc}>{t('becomeSponsor.trialDesc')}</Text>
            </View>
            <Text style={styles.planPrice}>{t('becomeSponsor.free')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardActive]}
            onPress={() => handleSelectPlan('monthly')}
            disabled={submitting}
          >
            <Text style={styles.planEmoji}>📅</Text>
            <View style={styles.planInfo}>
              <Text style={styles.planName}>{t('becomeSponsor.monthly')}</Text>
              <Text style={styles.planDesc}>{t('becomeSponsor.monthlyDesc')}</Text>
            </View>
            <Text style={styles.planPrice}>$15/mo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.planCard, styles.planCardBest, selectedPlan === 'yearly' && styles.planCardActive]}
            onPress={() => handleSelectPlan('yearly')}
            disabled={submitting}
          >
            <View style={styles.bestBadge}><Text style={styles.bestBadgeText}>{t('becomeSponsor.bestValue')}</Text></View>
            <Text style={styles.planEmoji}>⭐</Text>
            <View style={styles.planInfo}>
              <Text style={styles.planName}>{t('becomeSponsor.yearly')}</Text>
              <Text style={styles.planDesc}>{t('becomeSponsor.yearlyDesc')}</Text>
            </View>
            <Text style={styles.planPrice}>$150/yr</Text>
          </TouchableOpacity>

          {submitting && <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  stepIndicator: { fontSize: 14, color: Colors.gray, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  logoPicker: { alignSelf: 'center', marginBottom: 20 },
  logoPreview: { width: 96, height: 96, borderRadius: 20 },
  logoPlaceholder: {
    width: 96, height: 96, borderRadius: 20, backgroundColor: '#eef2ff',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#ddd', borderStyle: 'dashed',
  },
  logoPlaceholderText: { fontSize: 11, color: Colors.gray, marginTop: 4 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16,
    backgroundColor: Colors.white,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: '#ddd',
  },
  categoryChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryChipText: { fontSize: 13, color: '#333' },
  categoryChipTextActive: { color: '#fff', fontWeight: '600' },
  nextButton: {
    backgroundColor: Colors.primary, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 24,
  },
  nextButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  businessName: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 20, color: '#111' },
  planCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    padding: 16, borderRadius: 14, marginBottom: 12, borderWidth: 2, borderColor: 'transparent',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4,
  },
  planCardActive: { borderColor: Colors.primary },
  planCardBest: { borderColor: Colors.accent },
  bestBadge: {
    position: 'absolute', top: -8, right: 16, backgroundColor: Colors.accent,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8,
  },
  bestBadgeText: { fontSize: 10, fontWeight: '900', color: '#333' },
  planEmoji: { fontSize: 32, marginRight: 14 },
  planInfo: { flex: 1 },
  planName: { fontSize: 17, fontWeight: '700', color: '#111' },
  planDesc: { fontSize: 13, color: Colors.gray, marginTop: 2 },
  planPrice: { fontSize: 18, fontWeight: '800', color: Colors.primary },
});
