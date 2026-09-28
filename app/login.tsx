import { View, Text, StyleSheet, TextInput, Button, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useI18n } from '@/i18n';

export default function LoginScreen() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), t('login.fillFields'));
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      router.replace('/');
    } catch (err: any) {
      Alert.alert(t('login.loginFailed'), err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });

      if (error) throw error;
    } catch (err: any) {
      Alert.alert(t('login.googleFailed'), err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nyander</Text>
      <Text style={styles.subtitle}>{t('login.tagline')}</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={t('login.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder={t('login.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </View>

      <Button
        title={t('login.signIn')}
        onPress={handleLogin}
        disabled={loading}
        color="#ff6b6b"
      />

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>{t('login.or')}</Text>
        <View style={styles.line} />
      </View>

      <Button
        title={t('login.google')}
        onPress={handleGoogleSignIn}
        disabled={loading}
        color="#4285F4"
      />

      <View style={styles.links}>
        <Text style={styles.link} onPress={() => router.push('/register')}>
          {t('login.noAccount')}
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
    fontSize: 32,
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#eee',
  },
  dividerText: {
    paddingHorizontal: 10,
    color: '#999',
    fontSize: 14,
  },
  links: {
    marginTop: 20,
    alignItems: 'center',
  },
  link: {
    color: '#ff6b6b',
    textDecorationLine: 'underline',
  },
});
