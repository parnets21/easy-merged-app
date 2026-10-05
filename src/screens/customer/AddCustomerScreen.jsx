// src/screens/customer/AddCustomerScreen.jsx
// Create or edit a customer (retailer) profile.
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FormField from '../../components/FormField';
import { customerService } from '../../services/customerService';
import { theme } from '../../utils/theme';

export default function AddCustomerScreen({ route, navigation }) {
  const editing = route?.params?.customer || null;

  const [form, setForm] = useState({
    name:       editing?.name       || '',
    mobile:     editing?.mobile     || '',
    email:      editing?.email      || '',
    gst_number: editing?.gst_number || '',
    address:    editing?.address    || '',
    city:       editing?.city       || '',
    state:      editing?.state      || '',
    pincode:    editing?.pincode    || '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: null })); };

  const handleSave = async () => {
    const e = {};
    if (!form.name.trim())   e.name = 'Customer name is required';
    if (form.mobile.trim().length !== 10) e.mobile = 'Enter a valid 10-digit mobile';
    setErrors(e);
    if (Object.keys(e).length) return;

    const payload = {
      name:       form.name.trim(),
      mobile:     form.mobile.trim(),
      email:      form.email.trim(),
      gst_number: form.gst_number.trim().toUpperCase(),
      address:    form.address.trim(),
      city:       form.city.trim(),
      state:      form.state.trim(),
      pincode:    form.pincode.trim(),
    };

    setSaving(true);
    try {
      if (editing) {
        await customerService.update(editing._id, payload);
        Alert.alert('Saved', 'Customer updated.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } else {
        await customerService.create(payload);
        Alert.alert('Saved', 'Customer added.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch (err) {
      Alert.alert('Failed', err?.message || 'Could not save customer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>{editing ? 'Edit Customer' : 'Add Customer'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <FormField label="Customer Name *" value={form.name} onChangeText={v => set('name', v)} placeholder="Full name / shop name" error={errors.name} />
          <FormField label="Mobile Number *" value={form.mobile} onChangeText={v => set('mobile', v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={10} placeholder="10-digit mobile" error={errors.mobile} />
          <FormField label="Email" value={form.email} onChangeText={v => set('email', v)} keyboardType="email-address" autoCapitalize="none" placeholder="Optional" />
          <FormField label="GST Number" value={form.gst_number} onChangeText={v => set('gst_number', v.toUpperCase())} autoCapitalize="characters" maxLength={15} placeholder="22AAAAA0000A1Z5" />
        </View>

        <View style={styles.card}>
          <FormField label="Address" value={form.address} onChangeText={v => set('address', v)} multiline placeholder="Street / area" />
          <View style={styles.row}>
            <View style={styles.col}><FormField label="City" value={form.city} onChangeText={v => set('city', v)} placeholder="City" /></View>
            <View style={styles.col}><FormField label="State" value={form.state} onChangeText={v => set('state', v)} placeholder="State" /></View>
          </View>
          <FormField label="Pincode" value={form.pincode} onChangeText={v => set('pincode', v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} placeholder="6-digit" />
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : (editing ? 'Save Changes' : 'Add Customer')}</Text>
        </TouchableOpacity>
        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: theme.colors.primary,
    paddingTop: Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 24) + 12,
    paddingBottom: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  back: { color: '#fff', fontSize: 24, fontWeight: '700' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  container: { padding: 16, backgroundColor: theme.colors.background, paddingBottom: 40 },
  card: { backgroundColor: theme.colors.surface, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: theme.colors.border },
  row: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  saveBtn: { backgroundColor: theme.colors.accent, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
