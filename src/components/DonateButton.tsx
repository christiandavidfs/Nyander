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
import { useI18n } from '@/i18n';

type Props = {
  catId: string
  catName: string
  shelterId: string
}

const DONATION_AMOUNTS = [5, 10, 25, 50]

export default function DonateButton({ catId, catName, shelterId }: Props) {
  const { t } = useI18n();
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isMonthly, setIsMonthly] = useState(false)

  const handleDonate = async (amount: number) => {
    setLoading(true)
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        Alert.alert(t('common.required'), t('donate.signInRequired'))
        return
      }
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'
      const endpoint = isMonthly ? '/api/paypal/create-subscription' : '/api/paypal/create-order'
      const res = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catId, shelterId, amount, userId: session.user.id }),
      })
      const data = await res.json()
      if (data.mock) {
        Alert.alert(isMonthly ? t('donate.demoMonthly') : t('donate.demoOne'), t('donate.thanks'))
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
      console.error('Donation error:', err)
      const msg = err?.message?.includes('Failed to fetch') ? t('donate.serverUnreachable') : t('donate.genericError')
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
        <FontAwesome name="dollar" size={14} color="#fff" />
        <Text style={styles.label} numberOfLines={1}>{t('donate.button')}</Text>
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.title}>{t('donate.title', { name: catName })}</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity style={[styles.toggleBtn, !isMonthly && styles.toggleBtnActive]} onPress={() => setIsMonthly(false)}>
                <Text style={[styles.toggleText, !isMonthly && styles.toggleTextActive]}>{t('donate.oneTime')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, isMonthly && styles.toggleBtnActive]} onPress={() => setIsMonthly(true)}>
                <Text style={[styles.toggleText, isMonthly && styles.toggleTextActive]}>{t('donate.monthly')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>{isMonthly ? t('donate.monthlySub') : t('donate.oneTimeSub')}</Text>

            <View style={styles.amounts}>
              {DONATION_AMOUNTS.map((a) => (
                <TouchableOpacity
                  key={a}
                  style={styles.amountBtn}
                  onPress={() => handleDonate(a)}
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
              <Text style={styles.cancelText}>{t('donate.cancel')}</Text>
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
    backgroundColor: '#34c759',
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
    backgroundColor: Colors.primary,
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
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: Colors.primary,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.gray,
  },
  toggleTextActive: {
    color: '#fff',
  },
})
