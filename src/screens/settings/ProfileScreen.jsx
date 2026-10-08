// src/screens/settings/ProfileScreen.jsx
import React, { useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ConfirmDialog  from '../../components/ConfirmDialog';
import FormField      from '../../components/FormField';
import Icon           from '../../components/Icon';
import PrimaryButton  from '../../components/PrimaryButton';
import useAuth        from '../../hooks/useAuth';
import { authService } from '../../services/authService';
import { theme } from '../../utils/theme';
import { useExitToLogin } from '../../shared/ExitToLoginContext';

/* ── Menu rows in the profile page ── */
const MENU_SECTIONS = [
  {
    key: 'business',
    title: 'Reports & Alerts',
    items: [
      { label: 'Reports',       icon: 'chart-bar',        screen: 'ReportCenter',       color: '#2563EB' },
      { label: 'Analytics',     icon: 'chart-arc',        screen: 'AnalyticsDashboard', color: '#7C3AED' },
      { label: 'Notifications', icon: 'bell-outline',     screen: 'NotificationList',   color: theme.colors.accent },
    ],
  },
  {
    key: 'team',
    title: 'Customers',
    items: [
      { label: 'Customers',  icon: 'account-tie-outline',    screen: 'CustomerList',    color: '#0891B2' },
      { label: 'Follow-ups', icon: 'calendar-check-outline', screen: 'CustomerHistory', color: '#D97706' },
    ],
  },
  {
    key: 'finance',
    title: 'Finance',
    items: [
      { label: 'Expenses',      icon: 'receipt-text-outline',  screen: 'ExpenseList',       color: '#DC2626' },
      { label: 'Profit & Loss', icon: 'chart-line',            screen: 'PLDashboard',       color: '#059669' },
      { label: 'Payments',      icon: 'cash-multiple',         screen: 'PaymentReceivable', color: '#7C3AED' },
      { label: 'Accounts',      icon: 'bank-outline',          screen: 'CustomerLedger',    color: '#0891B2' },
    ],
  },
  {
    key: 'account',
    title: 'Account',
    items: [
      { label: 'Subscription', icon: 'star-circle-outline', screen: 'SubscriptionPlan', color: '#D97706' },
    ],
  },
];

/* ── Small menu row ── */
function MenuRow({ icon, label, color, onPress, isLast }) {
  return (
    <TouchableOpacity
      style={[styles.menuRow, !isLast && styles.menuRowBorder]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.menuIconBox, { backgroundColor: color + '18' }]}>
        <Icon name={icon} size={18} color={color} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Icon name="chevron-right" size={18} color={theme.colors.textDisabled} />
    </TouchableOpacity>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user, logout, refreshUser } = useAuth();
  const exitToLogin = useExitToLogin();

  const [name,         setName]         = useState(user?.name    || '');
  const [email,        setEmail]        = useState(user?.email   || '');
  const [editMode,     setEditMode]     = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [logoutDialog, setLogoutDialog] = useState(false);

  const handleLogout = async () => {
    setLogoutDialog(false);
    await logout();
    // Return to the SINGLE shared login screen (not the wholesaler AuthStack).
    exitToLogin();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await authService.updateProfile({ name, email });
      await refreshUser();
      Alert.alert('Success', 'Profile updated successfully');
      setEditMode(false);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const initials = (user?.name || user?.company_name || 'U')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('');

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ══════════════════════════════════
            HEADER — user card
        ══════════════════════════════════ */}
        <View style={styles.header}>
          <View style={styles.hCircle1} />
          <View style={styles.hCircle2} />

          {/* Avatar */}
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>

          <Text style={styles.displayName}>{user?.name || user?.company_name || 'My Account'}</Text>
          <View style={styles.roleBadge}>
            <Icon name="shield-account-outline" size={13} color={theme.colors.accent} />
            <Text style={styles.roleText}>{user?.role || 'Company Owner'}</Text>
          </View>

          {/* Quick info row */}
          <View style={styles.infoRow}>
            {user?.mobile ? (
              <View style={styles.infoItem}>
                <Icon name="phone-outline" size={13} color="rgba(255,255,255,0.7)" />
                <Text style={styles.infoText}>{user.mobile}</Text>
              </View>
            ) : null}
            {user?.email ? (
              <View style={styles.infoItem}>
                <Icon name="email-outline" size={13} color="rgba(255,255,255,0.7)" />
                <Text style={styles.infoText} numberOfLines={1}>{user.email}</Text>
              </View>
            ) : null}
          </View>

          {/* Company info if different from name */}
          {user?.company_name && user?.name && user.company_name !== user.name ? (
            <View style={styles.companyRow}>
              <Icon name="office-building-outline" size={13} color="rgba(255,255,255,0.65)" />
              <Text style={styles.companyText}>{user.company_name}</Text>
            </View>
          ) : null}

          {/* Edit / Save toggle */}
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => editMode ? handleSave() : setEditMode(true)}
            activeOpacity={0.85}
          >
            <Icon name={editMode ? 'content-save-outline' : 'pencil-outline'} size={15} color="#fff" />
            <Text style={styles.editBtnText}>{editMode ? 'Save Changes' : 'Edit Profile'}</Text>
          </TouchableOpacity>
        </View>

        {/* ══════════════════════════════════
            EDIT FORM (shown only in edit mode)
        ══════════════════════════════════ */}
        {editMode && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Edit Profile</Text>
            <FormField
              label="Full Name"
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
            />
            <FormField
              label="Mobile"
              value={user?.mobile || ''}
              editable={false}
              placeholder="Mobile number"
            />
            <FormField
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              placeholder="Email address"
            />
            <View style={styles.formBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditMode(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <PrimaryButton
                title="Save"
                onPress={handleSave}
                loading={saving}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}

        {/* ══════════════════════════════════
            SUBSCRIPTION BADGE
        ══════════════════════════════════ */}
        <TouchableOpacity
          style={styles.subBadge}
          onPress={() => navigation.navigate('SubscriptionPlan')}
          activeOpacity={0.85}
        >
          <View style={styles.subLeft}>
            <Icon name="star-circle" size={22} color="#D97706" />
            <View>
              <Text style={styles.subTitle}>Current Plan</Text>
              <Text style={styles.subPlan}>{user?.subscription_plan || 'Free Plan'}</Text>
            </View>
          </View>
          <View style={styles.subUpgrade}>
            <Text style={styles.subUpgradeText}>Upgrade</Text>
            <Icon name="chevron-right" size={15} color={theme.colors.accent} />
          </View>
        </TouchableOpacity>

        {/* ══════════════════════════════════
            MENU SECTIONS
        ══════════════════════════════════ */}
        {MENU_SECTIONS.map(section => (
          <View key={section.key} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, idx) => (
                <MenuRow
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  color={item.color}
                  isLast={idx === section.items.length - 1}
                  onPress={() => navigation.navigate(item.screen)}
                />
              ))}
            </View>
          </View>
        ))}

        {/* ══════════════════════════════════
            LOGOUT BUTTON
        ══════════════════════════════════ */}
        <View style={styles.logoutWrap}>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => setLogoutDialog(true)}
            activeOpacity={0.85}
          >
            <Icon name="logout" size={18} color="#DC2626" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={logoutDialog}
        title="Logout"
        message="Are you sure you want to logout?"
        onConfirm={handleLogout}
        onCancel={() => setLogoutDialog(false)}
        danger
      />
    </View>
  );
}

// ─────────────────────────────────────────────
const SHADOW = {
  shadowColor: '#1A0F40',
  shadowOpacity: 0.08,
  shadowOffset: { width: 0, height: 3 },
  shadowRadius: 8,
  elevation: 4,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F4F8' },

  /* ── Header ── */
  header: {
    backgroundColor: theme.colors.primary,
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 16,
    paddingBottom: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    overflow: 'hidden',
  },
  hCircle1: {
    position: 'absolute', top: -40, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  hCircle2: {
    position: 'absolute', bottom: -20, left: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  avatarRing: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 3, borderColor: theme.colors.accent,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },

  displayName: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 6, textAlign: 'center' },

  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
    marginBottom: 12,
  },
  roleText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  infoRow: { flexDirection: 'row', gap: 18, marginBottom: 6, flexWrap: 'wrap', justifyContent: 'center' },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoText: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },

  companyRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2, marginBottom: 14 },
  companyText: { fontSize: 12, color: 'rgba(255,255,255,0.65)' },

  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 18, paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  /* ── Edit form ── */
  formCard: {
    backgroundColor: '#fff',
    marginHorizontal: 14, marginTop: 14,
    borderRadius: 16, padding: 16,
    ...SHADOW,
  },
  formTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 12 },
  formBtns: { flexDirection: 'row', gap: 10, marginTop: 6 },
  cancelBtn: {
    flex: 1, paddingVertical: 12,
    borderRadius: 10, borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary },

  /* ── Subscription badge ── */
  subBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff',
    marginHorizontal: 14, marginTop: 14,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#FBBF2430',
    ...SHADOW,
  },
  subLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  subTitle: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '500' },
  subPlan:  { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  subUpgrade: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  subUpgradeText: { fontSize: 12, fontWeight: '700', color: theme.colors.accent },

  /* ── Menu sections ── */
  section: { marginHorizontal: 14, marginTop: 14 },
  sectionTitle: {
    fontSize: 11, fontWeight: '800',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 6, paddingLeft: 2,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    ...SHADOW,
  },
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 13, gap: 12,
  },
  menuRowBorder: {
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  menuIconBox: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: {
    flex: 1, fontSize: 14, fontWeight: '500',
    color: theme.colors.textPrimary,
  },

  /* ── Logout ── */
  logoutWrap: { marginHorizontal: 14, marginTop: 14 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: '#FECACA',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
});
