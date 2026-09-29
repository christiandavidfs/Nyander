import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
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
  const [isShelter, setIsShelter] = useState(false);

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
