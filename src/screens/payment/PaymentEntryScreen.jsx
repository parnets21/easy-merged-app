// src/screens/payment/PaymentEntryScreen.jsx
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FormField from '../../components/FormField';
import PrimaryButton from '../../components/PrimaryButton';
import { paymentService } from '../../services/paymentService';
import { validateAmount } from '../../utils/validators';
import { theme } from '../../utils/theme';

const MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'];

export default function PaymentEntryScreen({ route, navigation }) {
  const { partyType, partyId, partyName } = route?.params || {};
  const [amount,   setAmount]   = useState('');
  const [mode,     setMode]     = useState('Cash');
  const [refNo,    setRefNo]    = useState('');
  const [date,     setDate]     = useState('');
  const [notes,    setNotes]    = useState('');
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);

  const handleSave = async () => {
    const amtErr = validateAmount(amount);
    if (amtErr) { setErrors({ amount: amtErr }); return; }
    setErrors({});
    setLoading(true);
    try {
      await paymentService.create({ party_type: partyType || 'Customer', party_id: partyId, party_name: partyName, amount: parseFloat(amount), payment_mode: mode, reference_no: refNo, date: date || new Date().toISOString(), notes });
      Alert.alert('Success', 'Payment recorded successfully');
      navigation.goBack();
    } catch (e) { Alert.alert('Error', e?.message || 'Payment entry failed'); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
      >
        {partyName && <Text style={styles.partyName}>{partyType}: {partyName}</Text>}
        <FormField label="Amount (₹) *" value={amount} onChangeText={v => { setAmount(v); setErrors({}); }} keyboardType="decimal-pad" error={errors.amount} />
        <Text style={styles.label}>Payment Mode</Text>
        <View style={styles.pills}>
          {MODES.map(m => (
            <TouchableOpacity key={m} style={[styles.pill, mode === m && styles.pillActive]} onPress={() => setMode(m)}>
              <Text style={[styles.pillText, mode === m && styles.pillTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <FormField label="Reference No"     value={refNo} onChangeText={setRefNo} placeholder="Cheque No / UTR / Transaction ID" />
        <FormField label="Date (DD-MM-YYYY)" value={date}  onChangeText={setDate}  placeholder="Leave blank for today" />
        <FormField label="Notes"             value={notes} onChangeText={setNotes} multiline />
        <PrimaryButton title="Record Payment" onPress={handleSave} loading={loading} style={styles.btn} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:     { padding: 20, backgroundColor: theme.colors.background, flexGrow: 1, paddingBottom: 48 },
  partyName:     { fontSize: 16, fontWeight: '700', color: theme.colors.primary, marginBottom: 14 },
  label:         { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 8 },
  pills:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  pill:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: theme.colors.border },
  pillActive:    { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  pillText:      { fontSize: 13, color: theme.colors.textSecondary },
  pillTextActive:{ color: '#fff', fontWeight: '700' },
  btn:           { marginTop: 8 },
});
