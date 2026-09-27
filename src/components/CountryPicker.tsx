import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';
import type { Country } from '@/types';

type Props = {
  value: string | null
  onChange: (code: string) => void
}

export default function CountryPicker({ value, onChange }: Props) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const selected = countries.find((c) => c.code === value);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setCountries([
        { code: 'US', name: 'United States', currency: 'USD', tax_name: 'Sales Tax', tax_rate: 0, flag: '🇺🇸' },
        { code: 'ES', name: 'Spain', currency: 'EUR', tax_name: 'IVA', tax_rate: 0, flag: '🇪🇸' },
        { code: 'MX', name: 'Mexico', currency: 'MXN', tax_name: 'IVA', tax_rate: 0, flag: '🇲🇽' },
      ]);
      setLoading(false);
      return;
    }
    supabase.from('countries').select('*').order('name').then(({ data }) => {
      if (data) setCountries(data as Country[]);
      setLoading(false);
    });
  }, []);

  return (
    <>
      <TouchableOpacity style={styles.selector} onPress={() => setShow(true)}>
        <Text style={styles.selectorText}>
          {selected ? `${selected.flag ?? ''} ${selected.name}` : 'Select country'}
        </Text>
        <FontAwesome name="chevron-down" size={12} color={Colors.gray} />
      </TouchableOpacity>

      <Modal visible={show} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.title}>Select Country</Text>
            {loading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <FlatList
                data={countries}
                keyExtractor={(item) => item.code}
                style={{ maxHeight: 400 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.option, item.code === value && styles.selectedOption]}
                    onPress={() => { onChange(item.code); setShow(false); }}
                  >
                    <Text style={styles.optionFlag}>{item.flag ?? ''}</Text>
                    <Text style={styles.optionName}>{item.name}</Text>
                    {item.code === value && (
                      <FontAwesome name="check" size={14} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12,
  },
  selectorText: { fontSize: 16, color: '#333' },
  overlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modal: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '85%', maxWidth: 400,
    maxHeight: '80%',
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  option: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  selectedOption: { backgroundColor: '#f0f0ff' },
  optionFlag: { fontSize: 22, marginRight: 12 },
  optionName: { flex: 1, fontSize: 16 },
});
