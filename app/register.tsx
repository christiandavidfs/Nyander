import { View, Text, StyleSheet, TextInput, Button, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import CountryPicker from '@/components/CountryPicker';
import { useI18n } from '@/i18n';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'usuario' | 'centro'>('usuario');
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { t } = useI18n();

  const handleRegister = async () => {
    if (!email || !password || !displayName) {
      Alert.alert(t('common.error'), t('register.fillFields'));
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
            role,
            score: 0,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            email: data.user.email,
            role,
            display_name: displayName,
            score: 0,
            country_code: countryCode,
          });

        if (profileError) throw profileError;
      }

      Alert.alert(t('common.success'), t('register.success'));
      router.replace('/login');
    } catch (err: any) {
      Alert.alert(t('register.failed'), err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('register.title')}</Text>
      <Text style={styles.subtitle}>{t('register.subtitle')}</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={t('register.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder={t('register.displayName')}
          value={displayName}
          onChangeText={setDisplayName}
        />
        <TextInput
          style={styles.input}
          placeholder={t('register.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Text style={styles.label}>{t('register.iAm')}</Text>
        <View style={styles.roleSelector}>
          <TouchableOpacity
            style={[styles.roleOption, role === 'usuario' && styles.selectedOption]}
            onPress={() => setRole('usuario')}
          >
            <Text style={[styles.roleText, role === 'usuario' && styles.selectedText]}>
              {t('register.adopter')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleOption, role === 'centro' && styles.selectedOption]}
            onPress={() => setRole('centro')}
          >
            <Text style={[styles.roleText, role === 'centro' && styles.selectedText]}>
              {t('register.shelter')}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>{t('register.businessHint')}</Text>

        <Text style={styles.label}>{t('register.country')}</Text>
        <CountryPicker value={countryCode} onChange={setCountryCode} />
      </View>

      <Button
        title={t('register.createAccount')}
        onPress={handleRegister}
        disabled={loading}
        color="#ff6b6b"
      />

      <View style={styles.links}>
        <Text style={styles.link} onPress={() => router.push('/login')}>
          {t('register.haveAccount')}
        </Text>
      </View>

      {loading && <ActivityIndicator size="small" color="#ff6b6b" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#ff6b6b',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  inputContainer: {
    gap: 15,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 15,
    marginBottom: 5,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  selectedOption: {
    backgroundColor: '#ff6b6b',
    borderColor: '#ff6b6b',
  },
  roleText: {
    color: '#333',
    fontWeight: '500',
    fontSize: 13,
  },
  selectedText: {
    color: '#fff',
  },
  links: {
    marginTop: 20,
    alignItems: 'center',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  link: {
    color: '#ff6b6b',
    textDecorationLine: 'underline',
  },
});
