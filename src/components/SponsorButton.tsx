import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/i18n';

type Props = {
  catId: string
  catName: string
  shelterId: string
}

const SPONSOR_AMOUNTS = [10, 20, 50]

export default function SponsorButton({ catId, catName, shelterId }: Props) {
  const { t } = useI18n();
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSponsor = async (amount: number) => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId) {
        Alert.alert(t('common.required'), t('sponsorBtn.signInRequired'))
        setLoading(false)
        setShowModal(false)
        return
      }
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'
      const res = await fetch(`${apiUrl}/api/paypal/create-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catId, shelterId, amount, userId }),
      })
      const data = await res.json()
      if (data.mock) {
        Alert.alert(t('sponsorBtn.demoSuccess'), t('sponsorBtn.demoThanks'))
        return
      }
      if (data.approval_url) {
        if (Platform.OS === 'web') {
          window.open(data.approval_url, '_blank')
        } else {
          Linking.openURL(data.approval_url)
        }
      } else if (data.error) {
        Alert.alert('Error', data.error)
      }
    } catch (err: any) {
      console.error('Sponsorship error:', err)
      const msg = err?.message?.includes('Failed to fetch') ? t('sponsorBtn.serverUnreachable') : t('sponsorBtn.genericError')
      Alert.alert(t('common.error'), msg)
    } finally {
      setLoading(false)
      setShowModal(false)
    }
  }

  return (
    <>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setShowModal(true)}
      >
        <FontAwesome name="heart" size={14} color="#fff" />
        <Text style={styles.label} numberOfLines={1}>{t('sponsorBtn.button')}</Text>
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.title}>{t('sponsorBtn.title', { name: catName })}</Text>
            <Text style={styles.subtitle}>{t('sponsorBtn.sub')}</Text>

            <View style={styles.amounts}>
              {SPONSOR_AMOUNTS.map((a) => (
                <TouchableOpacity
                  key={a}
                  style={styles.amountBtn}
                  onPress={() => handleSponsor(a)}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.amountText}>€{a}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.cancelText}>{t('sponsorBtn.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#007aff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 140,
    minWidth: 0,
  },
  label: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 320,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 20,
  },
  amounts: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  amountBtn: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  amountText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 8,
  },
  cancelText: {
    color: Colors.gray,
    fontSize: 14,
  },
})
