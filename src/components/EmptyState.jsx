// src/components/EmptyState.jsx
import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { theme } from '../utils/theme';

// `icon` is a rendered node (callers pass an <Icon …/>, but a plain emoji still
// works). `subtitle` is the secondary line. An OPTIONAL action button appears
// when `buttonTitle` is supplied — used by the enquiry list's empty state so an
// empty Sent tab still offers a way to raise one.
export default function EmptyState({ icon = '📭', title, subtitle, buttonTitle, onButtonPress }) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title || 'No data found'}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {buttonTitle ? (
        <TouchableOpacity style={styles.button} onPress={onButtonPress} activeOpacity={0.85}>
          <Text style={styles.buttonText}>{buttonTitle}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  icon:      { fontSize: 48, marginBottom: 12 },
  title:     { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary, textAlign: 'center' },
  subtitle:  { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 6 },
  button: {
    marginTop: 18, paddingHorizontal: 22, paddingVertical: 11,
    borderRadius: 24, backgroundColor: theme.colors.primary,
    elevation: 2, shadowColor: '#1A0F40', shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 6,
  },
  buttonText: { fontSize: 13.5, fontWeight: '800', color: '#FFF', letterSpacing: 0.2 },
});
