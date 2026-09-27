import { View, Text, StyleSheet, Button, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import type { UserProfile } from '@/types';

type HomeSession = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];

export default function IndexScreen() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<HomeSession>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!isSupabaseConfigured) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        setSession(data.session);
        if (data.session?.user) {
          const { data: p } = await supabase.from('profiles').select('*').eq('id', data.session.user.id).single();
          if (!cancelled) setProfile(p);
        }
      } catch (err) {
        console.error('Session error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    if (!isSupabaseConfigured) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        supabase.from('profiles').select('*').eq('id', nextSession.user.id).single().then(
          ({ data: p }) => { if (p && !cancelled) setProfile(p); }
        );
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text>Loading...</Text>
      </View>
    );
  }

  const isShelter = profile?.role === 'centro';

  return (
    <View style={styles.container}>
      <FontAwesome name="paw" size={48} color={Colors.primary} />
      <Text style={styles.title}>Nyander</Text>
      <Text style={styles.subtitle}>
        {isShelter ? 'Manage your cats and find adopters' : 'Find your perfect feline friend'}
      </Text>
      {!isSupabaseConfigured && (
        <Text style={styles.notice}>
          Demo mode is active. Configure Supabase env vars to enable real accounts.
        </Text>
      )}
      {session || !isSupabaseConfigured ? (
        <View style={styles.buttons}>
          <Text style={styles.welcome}>
            Welcome, {profile?.display_name ?? session?.user?.email ?? 'Guest'}!
          </Text>
          <Button
            title={isShelter ? 'My Cats' : 'View Pets'}
            onPress={() => router.push('/cats')}
            color={Colors.primary}
          />
          <Button title="Messages" onPress={() => router.push('/messages')} color={Colors.secondary} />
          <Button title="Profile" onPress={() => router.push('/profile')} color={Colors.gray} />
          {session && (
            <Button title="Sign Out" onPress={async () => {
              await supabase.auth.signOut();
              setProfile(null);
            }} color={Colors.error} />
          )}
        </View>
      ) : (
        <View style={styles.buttons}>
          <Button title="Sign In" onPress={() => router.push('/login')} color={Colors.primary} />
          <Button title="Sign Up" onPress={() => router.push('/register')} color={Colors.secondary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#111',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 6,
    textAlign: 'center',
  },
  welcome: {
    fontSize: 18,
    textAlign: 'center',
    margin: 10,
    fontWeight: '600',
  },
  notice: {
    color: '#666',
    marginBottom: 16,
    paddingHorizontal: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  buttons: {
    gap: 10,
    width: '80%',
    marginTop: 20,
  },
});
