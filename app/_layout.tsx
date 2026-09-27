import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

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
          title: 'Discover',
          tabBarIcon: ({ color }) => <FontAwesome name="paw" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cats"
        options={{
          title: 'Pets',
          tabBarIcon: ({ color }) => <FontAwesome name="heart" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="crossed"
        options={{
          title: 'Crossed',
          tabBarIcon: ({ color }) => <FontAwesome name="map-marker" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sponsors"
        options={{
          title: 'Sponsors',
          tabBarIcon: ({ color }) => <FontAwesome name="building" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => <FontAwesome name="envelope" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <FontAwesome name="user" size={22} color={color} />,
        }}
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
