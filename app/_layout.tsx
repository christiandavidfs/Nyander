import { Platform, Linking, Alert } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { I18nProvider, useI18n } from '@/i18n';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

function TabLayoutInner() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const router = useRouter();
  const [isShelter, setIsShelter] = useState(false);

  // Email-confirmation / magic links land here (web hash or nyander:// deep link):
  // exchange tokens for a session instead of stranding the user on a dead URL.
  useEffect(() => {
    const handleUrl = async (url: string) => {
      try {
        const hashIndex = url.indexOf('#');
        if (hashIndex === -1) return;
        const params = new URLSearchParams(url.slice(hashIndex + 1));
        const err = params.get('error');
        if (err) {
          const desc = (params.get('error_description') || err).replace(/\+/g, ' ');
          Alert.alert(t('common.error'), desc);
          return;
        }
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (!error) router.replace('/');
        }
      } catch (_) {}
    };
    Linking.getInitialURL().then((u) => { if (u) handleUrl(u); }).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    const loadRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user || cancelled) return;
        const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
        if (!cancelled) setIsShelter((data as any)?.role === 'centro');
      } catch (_) {}
    };
    loadRole();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s?.user) { setIsShelter(false); return; }
      supabase.from('profiles').select('role').eq('id', s.user.id).maybeSingle().then(({ data }) => {
        if (!cancelled) setIsShelter((data as any)?.role === 'centro');
      });
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  // Same staleness guard as the Pets screen: re-check role on navigation.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user || cancelled) return;
          const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
          if (!cancelled) setIsShelter((data as any)?.role === 'centro');
        } catch (_) {}
      })();
      return () => { cancelled = true; };
    }, [])
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray,
        tabBarStyle: {
          borderTopColor: Colors.lightGray,
          borderTopWidth: 1,
          backgroundColor: Colors.white,
          paddingTop: 6,
          paddingBottom: insets.bottom,
          height: 60 + insets.bottom,
        },
        tabBarHideOnKeyboard: true,
        // Asegura que el contenido no quede debajo de la barra
        sceneStyle: {
          backgroundColor: Colors.background,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.discover'),
          tabBarIcon: ({ color }) => <FontAwesome name="paw" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cats"
        options={{
          title: t('tabs.pets'),
          tabBarIcon: ({ color }) => <FontAwesome name="heart" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="crossed"
        options={{
          title: t('tabs.crossed'),
          href: isShelter ? null : undefined,
          tabBarIcon: ({ color }) => <FontAwesome name="map-marker" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sponsors"
        options={{
          title: t('tabs.allies'),
          tabBarIcon: ({ color }) => <FontAwesome name="building" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('tabs.messages'),
          tabBarIcon: ({ color }) => <FontAwesome name="envelope" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => <FontAwesome name="user" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sponsorships"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="messages/[id]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="sponsors/[id]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="become-sponsor"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="manage-sponsor"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="cat/[id]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="c/[id]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="login"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="register"
        options={{ href: null }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  return (
    <I18nProvider>
      <TabLayoutInner />
    </I18nProvider>
  );
}
