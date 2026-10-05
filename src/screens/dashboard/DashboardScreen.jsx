// src/screens/dashboard/DashboardScreen.jsx

import React, { useCallback, useEffect, useState } from 'react';

import {
  Dimensions,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import ErrorMessage from '../../components/ErrorMessage';
import LoadingSpinner from '../../components/LoadingSpinner';
import useAuth from '../../hooks/useAuth';
import usePermissions from '../../hooks/usePermissions';

import { enquiryService } from '../../services/enquiryService';
import { reportsService } from '../../services/reportsService';
import { inventoryService } from '../../services/inventoryService';
import { paymentService } from '../../services/paymentService';

import { formatCurrency } from '../../utils/formatters';
import { theme } from '../../utils/theme';

const { width: SW } = Dimensions.get('window');

/* ── Brand palette (logo-matched) ── */
const NAVY       = theme.colors.primary;      // #01152D
const NAVY_MID   = theme.colors.primaryMid;   // #02203F
const ORANGE     = theme.colors.accent;       // #FD5C02
const ORANGE_LT  = theme.colors.accentLight;  // #FFF3EC

const BG             = '#F4F6F9';
const WHITE          = '#FFFFFF';
const TEXT           = '#0F1729';
const TEXT_SECONDARY = '#64748B';
const TEXT_MUTED     = '#94A3B8';
const BORDER         = '#EDF0F5';

const H_PADDING = 16;
const GAP       = 12;
const STAT_W    = (SW - H_PADDING * 2 - GAP) / 2;


/* ============================================================
   HELPERS
============================================================ */

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function todayLabel() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function initials(name) {
  if (!name) return 'EE';
  const parts = String(name).trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'EE';
}


const CARD_SHADOW = {
  shadowColor:   '#0F1729',
  shadowOpacity: 0.06,
  shadowOffset:  { width: 0, height: 6 },
  shadowRadius:  16,
  elevation:     4,
};


/* ============================================================
   STAT CARD
============================================================ */

function StatCard({ icon, iconBg, iconColor, label, value, sub, subColor, onPress }) {
  return (
    <TouchableOpacity style={styles.statCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.statTop}>
        <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
          <Icon name={icon} size={19} color={iconColor} />
        </View>
        {sub ? (
          <View style={[styles.statPill, { backgroundColor: `${subColor}14` }]}>
            <Text style={[styles.statPillText, { color: subColor }]}>{sub}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}


/* ============================================================
   QUICK ACTION
============================================================ */

function QuickAction({ icon, iconColor, bg, label, onPress }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.quickIcon, { backgroundColor: bg }]}>
        <Icon name={icon} size={23} color={iconColor} />
      </View>
      <Text style={styles.quickLabel} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}


/* ============================================================
   SECTION HEADER
============================================================ */

function SectionHeader({ title, action, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleWrap}>
        <View style={styles.sectionAccent} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action ? (
        <TouchableOpacity style={styles.viewAllBtn} onPress={onAction} activeOpacity={0.7}>
          <Text style={styles.viewAllText}>{action}</Text>
          <Icon name="chevron-right" size={15} color={ORANGE} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}


const ENQ_STATUS = {
  New:         { color: '#2563EB', bg: '#EFF6FF' },
  Viewed:      { color: '#6B7280', bg: '#F3F4F6' },
  Replied:     { color: '#D97706', bg: '#FFF7ED' },
  Negotiation: { color: '#7C3AED', bg: '#F5F3FF' },
  Confirmed:   { color: '#059669', bg: '#ECFDF5' },
  Cancelled:   { color: '#DC2626', bg: '#FEF2F2' },
};


/* ============================================================
   ENQUIRY CARD
============================================================ */

function EnqCard({ item, onPress, isLast }) {
  const meta = ENQ_STATUS[item.status] || ENQ_STATUS.New;

  const enquiryCode =
    item.enq_code || item.enquiry_code || `#${item._id?.slice(-6) || '------'}`;
  const product =
    item.product_name || item.product_code || item.product?.design_name || 'Product';
  const quantity = item.qty ?? item.quantity ?? 0;

  // Direction matters for the label:
  //  • RECEIVED → the party that sent it (retailer / customer name).
  //  • SENT (we raised the broadcast) → showing our own name is noise, so the
  //    PRODUCT becomes the headline and we surface how many replies came back.
  const isSent = item.direction === 'sent';
  const customer = item.retailer_name || item.customer_name || item.retailer?.name || 'Customer';
  const headline = isSent ? product : customer;

  const repliedNote = isSent && item.__replied > 0
    ? `${item.__replied} ${item.__replied === 1 ? 'reply' : 'replies'} received`
    : null;

  return (
    <TouchableOpacity
      style={[styles.enquiryCard, isLast && { borderBottomWidth: 0 }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.enqAvatar, { backgroundColor: meta.bg }]}>
        <Text style={[styles.enqAvatarText, { color: meta.color }]}>{initials(headline)}</Text>
      </View>

      <View style={styles.enquiryBody}>
        <View style={styles.enquiryTop}>
          <Text style={styles.customerName} numberOfLines={1}>{headline}</Text>
          <View style={[styles.statusChip, { backgroundColor: meta.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
            <Text style={[styles.statusText, { color: meta.color }]}>{item.status || 'New'}</Text>
          </View>
        </View>

        <View style={styles.enquiryMeta}>
          <Text style={styles.enquiryCode}>{enquiryCode}</Text>
          {isSent ? (
            <Text style={styles.metaText} numberOfLines={1}>
              · To {item.__count || 1} recipient{(item.__count || 1) === 1 ? '' : 's'}
            </Text>
          ) : (
            <>
              <View style={styles.metaDot} />
              <Icon name="cube-outline" size={11} color={TEXT_MUTED} />
              <Text style={styles.metaText} numberOfLines={1}>{product}</Text>
            </>
          )}
          <View style={styles.metaDot} />
          <Text style={styles.metaText}>Qty {quantity}</Text>
        </View>

        {repliedNote ? (
          <Text style={{ fontSize: 10, color: '#10b981', fontWeight: '700', marginTop: 2 }}>
            {repliedNote}
          </Text>
        ) : null}
      </View>

      <Icon name="chevron-right" size={18} color="#C7CCD6" />
    </TouchableOpacity>
  );
}


/* ============================================================
   ALERT ROW
============================================================ */

function AlertRow({ icon, iconColor, bg, accent, title, sub, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.alertRow, { backgroundColor: bg, borderLeftColor: accent }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.alertIcon, { backgroundColor: `${iconColor}18` }]}>
        <Icon name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.alertContent}>
        <Text style={styles.alertTitle}>{title}</Text>
        <Text style={styles.alertSub}>{sub}</Text>
      </View>
      <Icon name="chevron-right" size={16} color={iconColor} />
    </TouchableOpacity>
  );
}


/* ============================================================
   MAIN DASHBOARD
============================================================ */

export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { can } = usePermissions();

  const [dashData,  setDashData]  = useState(null);
  const [enquiries, setEnquiries] = useState([]);
  const [invSummary, setInvSummary] = useState(null);   // live inventory summary
  const [payables,   setPayables]   = useState([]);     // money owed to suppliers
  const [pl,         setPl]         = useState(null);    // this-month P&L snapshot
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // This month range for the P&L snapshot.
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const to   = now.toISOString().slice(0, 10);
    try {
      const [dashboardR, enquiryR, invR, payR, plR] = await Promise.allSettled([
        reportsService.dashboard(),
        enquiryService.list({}),
        inventoryService.summary(),
        paymentService.payables({ limit: 500 }),
        reportsService.plReport({ from_date: from, to_date: to }),
      ]);

      if (dashboardR.status === 'fulfilled') {
        setDashData(dashboardR.value?.data ?? dashboardR.value ?? {});
      }
      if (enquiryR.status === 'fulfilled') {
        // Raw backend envelope: `{ success, message, data: { enquiries, pagination } }`.
        // `enquiryR.value.data` is that wrapper object — NOT the row array — so
        // unwrap `data.enquiries` first, then the bare shapes. (The same fix as
        // `hooks/useEnquiries.js`; without it this section is always empty.)
        const v = enquiryR.value;
        const list =
          (Array.isArray(v?.data) ? v.data : null)
          ?? v?.data?.enquiries
          ?? v?.enquiries
          ?? (Array.isArray(v) ? v : []);
        setEnquiries(Array.isArray(list) ? list : []);
      }
      if (invR.status === 'fulfilled') {
        setInvSummary(invR.value?.data ?? invR.value ?? {});
      }
      if (payR.status === 'fulfilled') {
        const pd = payR.value?.data ?? payR.value ?? {};
        setPayables(Array.isArray(pd?.payables) ? pd.payables : (Array.isArray(pd) ? pd : []));
      }
      if (plR.status === 'fulfilled') {
        setPl(plR.value?.data ?? plR.value ?? {});
      }
    } catch (err) {
      if (!dashData) setError('Could not load home. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  if (loading && !dashData) return <LoadingSpinner fullScreen />;
  if (!dashData && error)   return <ErrorMessage message={error} onRetry={load} />;

  const sd         = dashData || {};
  const orders     = sd.orders || {};
  const inv        = invSummary || {};
  const plData     = pl || {};

  // Prefer live inventory summary; fall back to dashboard payload.
  const lowStock   = inv.low_stock     ?? sd.lowStockCount   ?? sd.low_stock_count    ?? 0;
  const outOfStock = inv.out_of_stock  ?? sd.outOfStockCount ?? sd.out_of_stock_count ?? 0;
  const paymentDue = sd.paymentDue      ?? sd.payment_due        ?? 0;

  // Payables (money owed to suppliers) — sum outstanding of non-paid payables.
  const payableDue = (Array.isArray(payables) ? payables : [])
    .filter(p => p.status !== 'Paid')
    .reduce((sum, p) => sum + (p.outstanding ?? 0), 0);

  // This-month P&L snapshot (backend returns camelCase: totalSales/totalPurchase/totalExpenses/netProfit).
  const monthSales    = plData.totalSales    ?? plData.total_sales    ?? 0;
  const monthPurchase = plData.totalPurchase ?? plData.total_purchase ?? 0;
  const monthExpense  = plData.totalExpenses ?? plData.total_expense  ?? 0;
  const monthProfit   = plData.netProfit     ?? plData.net_profit     ?? (monthSales - monthPurchase - monthExpense);

  // ── Enquiry roll-up ──
  // A broadcast fans out to ONE ROW PER RECIPIENT sharing a single `enq_code`.
  // Counting rows would report "11 new" for ONE broadcast sent to 11 parties,
  // which is misleading — so collapse each broadcast to a single logical
  // enquiry FIRST, then count. This is the ONE source of truth for both the
  // summary numbers AND the Recent Enquiries cards, so they always agree.
  const dedupedEnquiries = (() => {
    const byCode = new Map();
    for (const e of enquiries) {
      const key = e.enq_code || e.enquiry_code || e._id || e.id;
      if (!byCode.has(key)) byCode.set(key, []);
      byCode.get(key).push(e);
    }
    return [...byCode.values()].map(members => {
      if (members.length === 1) return members[0];
      // The broadcast's roll-up status = the FURTHEST-ALONG sibling, so one
      // answered recipient lifts the whole enquiry out of "New".
      const RANK = { Cancelled: 0, New: 1, Viewed: 2, Replied: 3, Negotiation: 4, Confirmed: 5 };
      const status = members
        .map(m => m.status)
        .sort((a, b) => (RANK[b] ?? 1) - (RANK[a] ?? 1))[0];
      // How many recipients have answered (for the "N replies received" note).
      const replied = members.filter(m =>
        ['Replied', 'Negotiation', 'Confirmed'].includes(m.status)
        || !!String(m.distributor_reply || '').trim()
        || m.available_quantity != null,
      ).length;
      const prices = members.map(m => +(m.offered_price || 0)).filter(Boolean);
      return {
        ...members[0],
        __group: true,
        __count: members.length,
        __replied: replied,
        status,
        offered_price: prices.length ? Math.min(...prices) : members[0].offered_price,
      };
    });
  })();

  // "Active" = anything not yet Confirmed/Cancelled (i.e. still needs attention).
  // The home screen's headline number, matching the retailer's home.
  const enquiryNew       = dedupedEnquiries.filter(i => i.status === 'New').length;
  const enquiryActive    = dedupedEnquiries.filter(i => !['Confirmed', 'Cancelled'].includes(i.status)).length;
  const enquiryConfirmed = dedupedEnquiries.filter(i => i.status === 'Confirmed').length;
  const enquiryReplied   = dedupedEnquiries.filter(i => ['Replied', 'Negotiation'].includes(i.status)).length;

  // RECEIVED first (they need our reply), then SENT broadcasts, newest first.
  // Built from the SAME deduped set the summary counts use, so the numbers and
  // the cards can never disagree.
  const recvRows    = dedupedEnquiries.filter(e => e.direction !== 'sent');
  const sentGrouped = dedupedEnquiries.filter(e => e.direction === 'sent');
  const recentEnquiries = [...recvRows, ...sentGrouped]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 4);

  const companyName = user?.company_name || user?.companyName || 'EzyEnquiry';

  // Modules grouped into clean, scannable categories (instead of one flat 16-icon grid).
  const MODULE_GROUPS = [
    {
      title: 'Marketplace',
      items: [
        { icon: 'package-variant',        iconColor: ORANGE,    bg: ORANGE_LT, label: 'Products',   module: 'products',    onPress: () => navigation.navigate('Products') },
        { icon: 'message-text-outline',   iconColor: '#2563EB', bg: '#EFF6FF', label: 'Enquiries',  module: 'enquiries',   onPress: () => navigation.navigate('Enquiries') },
        { icon: 'clipboard-list-outline', iconColor: '#0891B2', bg: '#ECFEFF', label: 'Orders',     module: 'orders',      onPress: () => navigation.navigate('OrderList') },
        { icon: 'truck-delivery',         iconColor: '#7C3AED', bg: '#F5F3FF', label: 'Dispatch',   module: 'dispatches',  onPress: () => navigation.navigate('DispatchTracking') },
      ],
    },
    {
      title: 'Inventory & Purchase',
      items: [
        { icon: 'warehouse',        iconColor: '#0891B2', bg: '#ECFEFF', label: 'Inventory', module: 'inventory', onPress: () => navigation.navigate('Inventory') },
        { icon: 'cart-arrow-down',  iconColor: '#DC2626', bg: '#FEF2F2', label: 'Purchase',  module: 'purchases', onPress: () => navigation.navigate('PurchaseList') },
      ],
    },
    {
      title: 'Finance',
      items: [
        { icon: 'currency-inr',          iconColor: '#059669', bg: '#ECFDF5', label: 'Sales',         module: 'sales',       onPress: () => navigation.navigate('SalesList') },
        { icon: 'file-document-outline', iconColor: ORANGE,    bg: ORANGE_LT, label: 'Invoices',      module: 'invoices',    onPress: () => navigation.navigate('InvoiceList') },
        { icon: 'receipt-text-outline',  iconColor: '#DC2626', bg: '#FEF2F2', label: 'Expense',       module: 'expenses',    onPress: () => navigation.navigate('ExpenseList') },
        { icon: 'chart-line',            iconColor: '#059669', bg: '#ECFDF5', label: 'Profit & Loss', module: 'profit_loss', onPress: () => navigation.navigate('PLDashboard') },
      ],
    },
    {
      title: 'CRM',
      items: [
        { icon: 'account-group-outline', iconColor: '#7C3AED', bg: '#F5F3FF', label: 'Customers', module: 'customers', onPress: () => navigation.navigate('CustomerList') },
        { icon: 'target',                iconColor: '#DB2777', bg: '#FDF2F8', label: 'Leads',     module: 'leads',     onPress: () => navigation.navigate('LeadList') },
      ],
    },
    {
      title: 'Tools',
      items: [
        { icon: 'calculator-variant', iconColor: ORANGE, bg: ORANGE_LT, label: 'Stone Calc', onPress: () => navigation.navigate('StoneCalculation') },
      ],
    },
    {
      title: 'More',
      items: [
        { icon: 'chart-box-outline',   iconColor: '#2563EB', bg: '#EFF6FF', label: 'Reports',   module: 'reports',   onPress: () => navigation.navigate('ReportCenter') },
        { icon: 'chart-arc',           iconColor: '#DB2777', bg: '#FDF2F8', label: 'Analytics', module: 'reports',   onPress: () => navigation.navigate('AnalyticsDashboard') },
        { icon: 'account-tie-outline', iconColor: '#6D28D9', bg: '#F5F3FF', label: 'Staff',     module: 'staff',     onPress: () => navigation.navigate('StaffList') },
        { icon: 'folder-outline',      iconColor: '#0891B2', bg: '#ECFEFF', label: 'Documents', module: 'documents', onPress: () => navigation.navigate('DocumentList') },
      ],
    },
  ];

  // Keep only items the role can access; drop groups that become empty.
  const visibleGroups = MODULE_GROUPS
    .map(g => ({ ...g, items: g.items.filter(a => !a.module || can(a.module)) }))
    .filter(g => g.items.length > 0);

  // Primary quick-add shortcuts (spec §4): Add Product, Reply Enquiry, Create Order, Stock Entry.
  const PRIMARY_ACTIONS = [
    { icon: 'plus-box',              color: ORANGE,    bg: ORANGE_LT, label: 'Add Product',  module: 'products',   onPress: () => navigation.navigate('AddProduct') },
    { icon: 'reply-outline',         color: '#2563EB', bg: '#EFF6FF', label: 'Reply Enquiry', module: 'enquiries', onPress: () => navigation.navigate('Enquiries') },
    { icon: 'cart-plus',             color: '#059669', bg: '#ECFDF5', label: 'Create Order',  module: 'orders',     onPress: () => navigation.navigate('SalesEntry') },
    { icon: 'archive-arrow-down-outline', color: '#7C3AED', bg: '#F5F3FF', label: 'Stock Entry', module: 'inventory', onPress: () => navigation.navigate('StockAdjust', { mode: 'in' }) },
  ];
  const primaryActions = PRIMARY_ACTIONS.filter(a => !a.module || can(a.module));

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[ORANGE]} tintColor={ORANGE} />}
      >
        {/* ── HEADER ── */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <View style={styles.headerCircle1} />
          <View style={styles.headerCircle2} />

          <View style={styles.headerTop}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(companyName)}</Text>
              </View>
              <View style={styles.headerText}>
                <Text style={styles.greeting}>{getGreeting()} 👋</Text>
                <Text style={styles.companyName} numberOfLines={1}>{companyName}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.notificationBtn}
              onPress={() => navigation.navigate('NotificationList')}
              activeOpacity={0.8}
            >
              <Icon name="bell-outline" size={21} color="#FFFFFF" />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
          </View>

          <View style={styles.dateRow}>
            <Icon name="calendar-today" size={12} color="rgba(255,255,255,0.65)" />
            <Text style={styles.dateText}>{todayLabel()}</Text>
          </View>

          {/* Summary strip */}
          <View style={styles.headerSummary}>
            <TouchableOpacity style={styles.headerSummaryItem} activeOpacity={0.8} onPress={() => navigation.navigate('Enquiries')}>
              <Text style={styles.headerSummaryValue}>{enquiryActive}</Text>
              <Text style={styles.headerSummaryLabel}>Active Enquiries</Text>
            </TouchableOpacity>
            <View style={styles.headerSummaryDivider} />
            <TouchableOpacity style={styles.headerSummaryItem} activeOpacity={0.8} onPress={() => navigation.navigate('OrderList')}>
              <Text style={styles.headerSummaryValue}>{orders.pending ?? orders.pending_orders ?? 0}</Text>
              <Text style={styles.headerSummaryLabel}>Pending Orders</Text>
            </TouchableOpacity>
            <View style={styles.headerSummaryDivider} />
            <TouchableOpacity style={styles.headerSummaryItem} activeOpacity={0.8} onPress={() => navigation.navigate('Inventory')}>
              <Text style={styles.headerSummaryValue}>{lowStock}</Text>
              <Text style={styles.headerSummaryLabel}>Low Stock</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── KPI CARDS ── */}
        <View style={styles.statGrid}>
          <StatCard icon="currency-inr" iconBg="#ECFDF5" iconColor="#059669"
            label="Today's Sales" value={formatCurrency(sd.todaySales ?? 0)} sub="Revenue" subColor="#059669"
            onPress={() => navigation.navigate('SalesList')} />
          <StatCard icon="shopping-outline" iconBg={ORANGE_LT} iconColor={ORANGE}
            label="Today's Orders" value={String(orders.todayTotal ?? orders.today_total ?? orders.total ?? 0)} sub="Orders" subColor={ORANGE}
            onPress={() => navigation.navigate('SalesList')} />
          <StatCard icon="clock-alert-outline" iconBg="#FFFBEB" iconColor="#CA8A04"
            label="Pending Orders" value={String(orders.pending ?? orders.pending_orders ?? 0)} sub="Pending" subColor="#CA8A04"
            onPress={() => navigation.navigate('OrderList')} />
          <StatCard icon="credit-card-off-outline" iconBg="#FEF2F2" iconColor="#DC2626"
            label="Receivable" value={formatCurrency(paymentDue)} sub="They owe" subColor="#DC2626"
            onPress={() => navigation.navigate('PaymentReceivable')} />
          <StatCard icon="cash-minus" iconBg="#FFF7ED" iconColor="#EA580C"
            label="Payable" value={formatCurrency(payableDue)} sub="You owe" subColor="#EA580C"
            onPress={() => navigation.navigate('PaymentPayable')} />
        </View>

        {/* ── THIS MONTH SNAPSHOT ── */}
        {can('profit_loss') || can('sales') ? (
          <View style={styles.block}>
            <SectionHeader title="This Month" action="Details" onAction={() => navigation.navigate('PLDashboard')} />
            <View style={styles.plCard}>
              <View style={styles.plRow}>
                <View style={styles.plItem}>
                  <Text style={[styles.plValue, { color: '#059669' }]}>{formatCurrency(monthSales)}</Text>
                  <Text style={styles.plLabel}>Sales</Text>
                </View>
                <View style={styles.plDivider} />
                <View style={styles.plItem}>
                  <Text style={[styles.plValue, { color: '#2563EB' }]}>{formatCurrency(monthPurchase)}</Text>
                  <Text style={styles.plLabel}>Purchase</Text>
                </View>
                <View style={styles.plDivider} />
                <View style={styles.plItem}>
                  <Text style={[styles.plValue, { color: '#DC2626' }]}>{formatCurrency(monthExpense)}</Text>
                  <Text style={styles.plLabel}>Expense</Text>
                </View>
              </View>
              <View style={styles.plProfitRow}>
                <Text style={styles.plProfitLabel}>Net Profit</Text>
                <Text style={[styles.plProfitValue, { color: monthProfit >= 0 ? '#059669' : '#DC2626' }]}>
                  {formatCurrency(monthProfit)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* ── PRIMARY QUICK-ADD ROW (spec §4) ── */}
        <View style={styles.block}>
          <SectionHeader title="Quick Add" />
          <View style={styles.primaryRow}>
            {primaryActions.map(a => (
              <TouchableOpacity key={a.label} style={styles.primaryBtn} onPress={a.onPress} activeOpacity={0.85}>
                <View style={[styles.primaryIcon, { backgroundColor: a.bg }]}>
                  <Icon name={a.icon} size={22} color={a.color} />
                </View>
                <Text style={styles.primaryLabel} numberOfLines={2}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── MODULES (grouped, clean) ── */}
        {visibleGroups.map(group => (
          <View style={styles.block} key={group.title}>
            <SectionHeader title={group.title} />
            <View style={styles.quickCard}>
              <View style={styles.quickGrid}>
                {group.items.map(action => (
                  <QuickAction key={action.label} {...action} />
                ))}
              </View>
            </View>
          </View>
        ))}

        {/* ── ENQUIRIES ── */}
        <View style={styles.block}>
          <SectionHeader title="Recent Enquiries" action="View All" onAction={() => navigation.navigate('Enquiries')} />

          <View style={styles.enquirySummary}>
            {[
              { label: 'Active', value: enquiryActive,    color: ORANGE,    bg: ORANGE_LT },
              { label: 'New',    value: enquiryNew,        color: '#2563EB', bg: '#EFF6FF' },
              { label: 'Replied', value: enquiryReplied,   color: '#7C3AED', bg: '#F5F3FF' },
              { label: 'Done',   value: enquiryConfirmed,  color: '#059669', bg: '#ECFDF5' },
            ].map(item => (
              <View key={item.label} style={[styles.enquirySummaryItem, { backgroundColor: item.bg }]}>
                <Text style={[styles.enquirySummaryValue, { color: item.color }]}>{item.value}</Text>
                <Text style={[styles.enquirySummaryLabel, { color: item.color }]}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.listCard}>
            {recentEnquiries.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Icon name="message-text-outline" size={28} color={ORANGE} />
                </View>
                <Text style={styles.emptyTitle}>No enquiries yet</Text>
                <Text style={styles.emptySubtitle}>New retailer enquiries will appear here.</Text>
              </View>
            ) : (
              recentEnquiries.map((item, idx) => (
                <EnqCard
                  key={item._id || item.id}
                  item={item}
                  isLast={idx === recentEnquiries.length - 1}
                  onPress={() => navigation.navigate('EnquiryDetail', { enquiryId: item._id || item.id })}
                />
              ))
            )}
          </View>
        </View>

        {/* ── ALERTS ── */}
        {(lowStock > 0 || outOfStock > 0 || paymentDue > 0 || payableDue > 0) ? (
          <View style={styles.block}>
            <SectionHeader title="Alerts" />
            {lowStock > 0 ? (
              <AlertRow icon="alert-circle-outline" iconColor="#D97706" bg="#FFFBEB" accent="#F59E0B"
                title={`Low Stock — ${lowStock} product${lowStock > 1 ? 's' : ''}`} sub="Tap to view and restock"
                onPress={() => navigation.navigate('Inventory')} />
            ) : null}
            {outOfStock > 0 ? (
              <AlertRow icon="close-circle-outline" iconColor="#DC2626" bg="#FEF2F2" accent="#F87171"
                title={`Out of Stock — ${outOfStock} product${outOfStock > 1 ? 's' : ''}`} sub="Immediate restocking needed"
                onPress={() => navigation.navigate('Inventory')} />
            ) : null}
            {paymentDue > 0 ? (
              <AlertRow icon="cash-clock" iconColor={ORANGE} bg={ORANGE_LT} accent={ORANGE}
                title={`Receivable — ${formatCurrency(paymentDue)}`} sub="Money retailers owe you"
                onPress={() => navigation.navigate('PaymentReceivable')} />
            ) : null}
            {payableDue > 0 ? (
              <AlertRow icon="cash-minus" iconColor="#EA580C" bg="#FFF7ED" accent="#EA580C"
                title={`Payable — ${formatCurrency(payableDue)}`} sub="Money you owe suppliers"
                onPress={() => navigation.navigate('PaymentPayable')} />
            ) : null}
          </View>
        ) : null}

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}


/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: BG },
  scrollContent: { paddingBottom: 32 },

  /* ── Header ── */
  header: {
    backgroundColor:   NAVY,
    paddingHorizontal: 20,
    paddingBottom:     74,
    borderBottomLeftRadius:  28,
    borderBottomRightRadius: 28,
    overflow:          'hidden',
  },
  headerCircle1: {
    position: 'absolute', width: 240, height: 240, borderRadius: 120,
    right: -90, top: -110, backgroundColor: 'rgba(253,92,2,0.10)',
  },
  headerCircle2: {
    position: 'absolute', width: 150, height: 150, borderRadius: 75,
    right: 40, top: 30, backgroundColor: 'rgba(255,255,255,0.04)',
  },

  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatarWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: {
    width: 46, height: 46, borderRadius: 14, marginRight: 12,
    backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  headerText: { flex: 1 },
  greeting:   { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.70)', marginBottom: 3 },
  companyName:{ fontSize: 20, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.1 },

  notificationBtn: {
    width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    marginLeft: 12,
  },
  notificationDot: {
    position: 'absolute', width: 9, height: 9, borderRadius: 5, right: 10, top: 9,
    backgroundColor: ORANGE, borderWidth: 1.5, borderColor: NAVY,
  },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14 },
  dateText:{ fontSize: 11, color: 'rgba(255,255,255,0.65)' },

  headerSummary: {
    flexDirection: 'row', alignItems: 'center', marginTop: 20, padding: 15, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  headerSummaryItem:    { flex: 1, alignItems: 'center' },
  headerSummaryValue:   { fontSize: 19, fontWeight: '800', color: '#FFFFFF', marginBottom: 3 },
  headerSummaryLabel:   { fontSize: 9.5, color: 'rgba(255,255,255,0.62)' },
  headerSummaryDivider: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.16)' },

  /* ── KPI Grid ── */
  statGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: GAP,
    paddingHorizontal: H_PADDING, marginTop: -50, zIndex: 5,
  },
  statCard: {
    width: STAT_W, minHeight: 118, backgroundColor: WHITE, borderRadius: 20, padding: 16, ...CARD_SHADOW,
  },
  statTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  statPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9 },
  statPillText: { fontSize: 9.5, fontWeight: '700' },
  statValue: { marginTop: 16, fontSize: 21, fontWeight: '800', color: TEXT, letterSpacing: -0.5 },
  statLabel: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY, marginTop: 3 },

  /* ── Block ── */
  block: { marginTop: 26, paddingHorizontal: H_PADDING },

  /* ── This-month P&L card ── */
  plCard:    { backgroundColor: WHITE, borderRadius: 20, padding: 16, ...CARD_SHADOW },
  plRow:     { flexDirection: 'row', alignItems: 'center' },
  plItem:    { flex: 1, alignItems: 'center' },
  plValue:   { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  plLabel:   { fontSize: 10.5, fontWeight: '600', color: TEXT_SECONDARY, marginTop: 3 },
  plDivider: { width: 1, height: 32, backgroundColor: BORDER },
  plProfitRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER,
  },
  plProfitLabel: { fontSize: 12.5, fontWeight: '700', color: TEXT },
  plProfitValue: { fontSize: 17, fontWeight: '800', letterSpacing: -0.4 },

  /* ── Section Header ── */
  sectionHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  sectionTitleWrap: { flexDirection: 'row', alignItems: 'center' },
  sectionAccent:    { width: 4, height: 20, borderRadius: 3, backgroundColor: ORANGE, marginRight: 9 },
  sectionTitle:     { fontSize: 16, fontWeight: '800', color: TEXT },
  viewAllBtn:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingLeft: 8 },
  viewAllText:      { fontSize: 12, fontWeight: '700', color: ORANGE },

  /* ── Primary Quick-Add row ── */
  primaryRow:  { flexDirection: 'row', gap: 10 },
  primaryBtn:  { flex: 1, backgroundColor: WHITE, borderRadius: 18, paddingVertical: 14, alignItems: 'center', ...CARD_SHADOW },
  primaryIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  primaryLabel:{ fontSize: 10.5, fontWeight: '700', color: TEXT, textAlign: 'center', lineHeight: 13.5, maxWidth: 74 },

  /* ── Quick Actions ── */
  quickCard: { backgroundColor: WHITE, borderRadius: 20, paddingVertical: 18, paddingHorizontal: 6, ...CARD_SHADOW },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  quickAction: { width: '25%', minHeight: 88, alignItems: 'center', paddingHorizontal: 4, paddingVertical: 6 },
  quickIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickLabel:{ fontSize: 10.5, lineHeight: 13.5, fontWeight: '700', color: TEXT, textAlign: 'center', maxWidth: 72 },

  /* ── Enquiry Summary ── */
  enquirySummary:      { flexDirection: 'row', gap: 9, marginBottom: 13 },
  enquirySummaryItem:  { flex: 1, minHeight: 66, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  enquirySummaryValue: { fontSize: 20, fontWeight: '800' },
  enquirySummaryLabel: { fontSize: 9.5, fontWeight: '700', marginTop: 3, opacity: 0.9 },

  /* ── List card ── */
  listCard: { backgroundColor: WHITE, borderRadius: 20, overflow: 'hidden', ...CARD_SHADOW },

  /* ── Enquiry Card ── */
  enquiryCard: {
    minHeight: 74, flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  enqAvatar:     { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  enqAvatarText: { fontSize: 13, fontWeight: '800' },
  enquiryBody:   { flex: 1 },
  enquiryTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  customerName:  { fontSize: 13.5, fontWeight: '700', color: TEXT, flex: 1, marginRight: 8 },
  statusChip:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusDot:     { width: 5, height: 5, borderRadius: 3 },
  statusText:    { fontSize: 9, fontWeight: '700' },
  enquiryMeta:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  enquiryCode:   { fontSize: 9.5, fontWeight: '700', color: TEXT_MUTED, letterSpacing: 0.3 },
  metaText:      { fontSize: 10, color: TEXT_SECONDARY, flexShrink: 1 },
  metaDot:       { width: 3, height: 3, borderRadius: 2, backgroundColor: '#C5C8D0' },

  /* ── Empty State ── */
  emptyState:    { minHeight: 170, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyIconWrap: { width: 58, height: 58, borderRadius: 18, backgroundColor: ORANGE_LT, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle:    { fontSize: 14, fontWeight: '800', color: TEXT, marginBottom: 5 },
  emptySubtitle: { fontSize: 11, color: TEXT_SECONDARY, textAlign: 'center', lineHeight: 16 },

  /* ── Alerts ── */
  alertRow: {
    minHeight: 66, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4,
    borderRadius: 16, marginBottom: 10, paddingHorizontal: 13, ...CARD_SHADOW,
  },
  alertIcon:    { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  alertContent: { flex: 1 },
  alertTitle:   { fontSize: 12.5, fontWeight: '800', color: TEXT, marginBottom: 3 },
  alertSub:     { fontSize: 10.5, color: TEXT_SECONDARY },

  bottomSpace: { height: 20 },
});
