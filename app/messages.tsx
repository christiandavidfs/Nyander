import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';
import { useI18n } from '@/i18n';
import type { Conversation, Message } from '@/types';

type EnrichedConversation = Conversation & {
  cat_name: string;
  other_name: string;
  other_avatar: string | null;
  last_message: string | null;
};

export default function MessagesScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [conversations, setConversations] = useState<EnrichedConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    const loadConversations = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }

        const userId = session.user.id;
        const { data } = await supabase
          .from('conversations')
          .select('*')
          .or(`adopter_id.eq.${userId},shelter_id.eq.${userId}`)
          .order('last_message_at', { ascending: false });

        if (!data) { setLoading(false); return; }

        const enriched = await Promise.all(
          data.map(async (conv) => {
            const otherId = conv.adopter_id === userId ? conv.shelter_id : conv.adopter_id;
            const [{ data: cat }, { data: other }, { data: lastMsg }] = await Promise.all([
              supabase.from('cats').select('name').eq('id', conv.cat_id).maybeSingle(),
              supabase.from('profiles').select('display_name, email, avatar_url').eq('id', otherId).maybeSingle(),
              supabase.from('messages').select('content').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
            ]);
            return {
              ...conv,
              cat_name: (cat as any)?.name ?? t('common.unknownCat'),
              other_name: (other as any)?.display_name || (other as any)?.email || t('common.unknownUser'),
              other_avatar: (other as any)?.avatar_url ?? null,
              last_message: (lastMsg as Message)?.content ?? null,
            } as EnrichedConversation;
          })
        );

        setConversations(enriched);
      } catch (err) {
        console.error('Error loading conversations:', err);
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <View style={styles.centered}>
        <FontAwesome name="comments" size={64} color={Colors.lightGray} />
        <Text style={styles.emptyText}>{t('messages.configNeeded')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>{t('messages.title')}</Text>
      </View>
      {conversations.length === 0 ? (
        <View style={styles.centered}>
          <FontAwesome name="comments" size={64} color={Colors.lightGray} />
          <Text style={styles.emptyTitle}>{t('messages.empty')}</Text>
          <Text style={styles.emptyText}>{t('messages.emptySub')}</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.conversationCard}
              onPress={() => router.push(`/messages/${item.id}`)}
            >
              {item.other_avatar ? (
                <Image source={{ uri: item.other_avatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarCircle}>
                  <FontAwesome name="user-circle" size={40} color={Colors.primary} />
                </View>
              )}
              <View style={styles.conversationInfo}>
                <View style={styles.conversationTop}>
                  <Text style={styles.conversationName} numberOfLines={1}>{item.other_name}</Text>
                  <Text style={styles.catLabel}>{item.cat_name}</Text>
                </View>
                {item.last_message ? (
                  <Text style={styles.lastMessage} numberOfLines={1}>{item.last_message}</Text>
                ) : (
                  <Text style={styles.lastMessageEmpty}>{t('messages.noMessages')}</Text>
                )}
              </View>
              <FontAwesome name="chevron-right" size={14} color={Colors.gray} />
            </TouchableOpacity>
          )}
        />
      )}
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
    gap: 12,
    padding: 20,
  },
  header: {
    padding: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.gray,
    textAlign: 'center',
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 14,
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  conversationTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    flexShrink: 1,
  },
  catLabel: {
    fontSize: 12,
    color: Colors.primary,
    backgroundColor: '#eef2ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  lastMessage: {
    fontSize: 14,
    color: Colors.gray,
    marginTop: 4,
  },
  lastMessageEmpty: {
    fontSize: 13,
    color: Colors.lightGray,
    fontStyle: 'italic',
    marginTop: 4,
  },
});
