// src/screens/enquiry/EnquiryListScreen.jsx
//
// Structural parity with RetailerApp/src/screens/enquiries/EnquiriesScreen.jsx:
//
//   [ navy navbar: "Enquiries" · "N total · M new" · unread pill · search · refresh ]
//   [ inline search bar (toggled by the search icon)                              ]
//   [ Received / Sent direction bar — two lists, not one                          ]
//   [ status pills: All · New · Viewed · Replied · Negotiation · Confirmed · Cancelled
//                   each with a live count badge                                 ]
//   [ cards: orange strip when New · code + status chip · party · product ·
//            qty / price / location · date + chevron                              ]
//   [ floating "Enquiry" FAB — a wholesaler can ASK too                           ]
//
// The wholesaler can both RECEIVE enquiries and RAISE them. A raised enquiry is
// broadcast to every retailer, every wholesaler AND the Admin team, so it has a
// Sent tab just like the retailer — and the Sent tab groups each broadcast's N
// sibling rows into ONE card.
//
// Field mapping: the wholesaler's backend returns flat fields (`enq_code`,
// `retailer_name`, `product_name`, `offered_price`) so those are used directly.
// Direction comes from the backend's `direction` ('sent' | 'received') — the
// retailer derives it from `is_recipient`, but the wholesaler endpoint computes
// it server-side, so we read the field rather than re-deriving it.
//
// Icons: this screen uses react-native-vector-icons/**Ionicons** — the exact set
// the retailer's `EnquiriesScreen.jsx` uses — so the two apps' discovery lists
// are icon-for-icon identical. (The rest of the wholesaler app uses the
// MaterialCommunityIcons wrapper in `components/Icon`.)
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, RefreshControl, ActivityIndicator, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// Ionicons — the SAME icon family the retailer's enquiry screens use, so the
// wholesaler's discovery/list UI is icon-for-icon identical to the retailer's.
import Ionicons from 'react-native-vector-icons/Ionicons';
import EmptyState from '../../components/EmptyState';
import useEnquiries from '../../hooks/useEnquiries';
import { formatDate } from '../../utils/formatters';
import { theme } from '../../utils/theme';
import { enquirySeen } from '../../utils/enquirySeen';

const STATUS_TABS = ['All', 'New', 'Viewed', 'Replied', 'Confirmed', 'Cancelled'];

const STATUS_META = {
  New:         { bg: '#EFF6FF', text: '#2563EB', dot: '#3B82F6' },
  Viewed:      { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF' },
  Replied:     { bg: '#FFF7ED', text: '#D97706', dot: '#F59E0B' },
  Confirmed:   { bg: '#F0FDF4', text: '#059669', dot: '#10B981' },
  Cancelled:   { bg: '#FEF2F2', text: '#DC2626', dot: '#F87171' },
};

// ── Broadcast grouping ──────────────────────────────────────────────────────
// One broadcast = ONE card. A wholesaler's broadcast is N sibling enquiries —
// one per retailer, one per wholesaler plus the Admin — all sharing an
// `enq_code`. Without grouping the Sent tab shows N near-identical cards for a
// single action, which reads as "it created it many times". Group by code and
// summarise: how many recipients, how many replied.
const STATUS_RANK = { Cancelled: 0, New: 1, Viewed: 2, Replied: 3, Confirmed: 5 };

// "Has this recipient answered?" — matched to the wholesaler's flat row shape
// (the backend's `hasReplied` uses the same three signals).
const rowHasReplied = (r) =>
  ['Replied', 'Confirmed'].includes(r.status)
  || !!(r.distributor_reply || '').trim()
  || r.available_quantity != null;

function groupBroadcasts(rows) {
  const byCode = new Map();
  for (const r of rows) {
    const key = r.enq_code || String(r._id || r.id);
    if (!byCode.has(key)) byCode.set(key, []);
    byCode.get(key).push(r);
  }
  return [...byCode.values()].map(members => {
    // Stable seen-key per broadcast — the enq_code never changes, whereas
    // `members[0]._id` can shift if the API re-orders siblings after a reply.
    // Keying the green-dot's seen-state off this guarantees "mark seen" and
    // "is new?" always agree, so the dot clears reliably on return.
    const seenKey = members[0].enq_code || String(members[0]._id || members[0].id);
    if (members.length === 1) return { ...members[0], __seenKey: seenKey };
    const status = members
      .map(m => m.status)
      .sort((a, b) => (STATUS_RANK[b] ?? 1) - (STATUS_RANK[a] ?? 1))[0];
    const prices = members.map(m => +(m.offered_price || 0)).filter(Boolean);
    // The group's "last activity" is the NEWEST updated_at across every sibling
    // row — so the green dot lights up when ANY recipient acts, not just the
    // first member we happened to spread below.
    const latestUpdated = members
      .map(m => m.updated_at || m.updatedAt || m.created_at)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
    return {
      ...members[0],
      __group: true,
      __count: members.length,
      __replied: members.filter(rowHasReplied).length,
      __seenKey: seenKey,
      status,
      offered_price: prices.length ? Math.min(...prices) : members[0].offered_price,
      updated_at: latestUpdated || members[0].updated_at,
    };
  });
}

export default function EnquiryListScreen({ navigation }) {
  const [tabIdx,  setTabIdx]  = useState(0);
  const [search,  setSearch]  = useState('');
  const [showSearch, setShowSearch] = useState(false);
  // 'received' = sent TO this wholesaler (we owe a reply)
  // 'sent'     = raised BY this wholesaler (we are waiting on answers)
  const [dirTab,  setDirTab]  = useState('received');
  const [refreshing, setRefreshing] = useState(false);
  // Device-local "last seen" map { enquiryId: ISO } — drives the green "new
  // activity" dot. Reloaded on every focus so a dot clears after you open the
  // enquiry and come back.
  const [seenMap, setSeenMap] = useState({});

  const { enquiries, loading, error, refetch } = useEnquiries();

  // Focus reload — returning from a detail screen (where the status may have
  // moved New → Viewed, or where we just marked the enquiry seen) refreshes the
  // list AND re-reads the seen-map so dots update.
  useFocusEffect(useCallback(() => {
    refetch();
    enquirySeen.getAll().then(setSeenMap).catch(() => setSeenMap({}));
  }, [refetch]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // The create screen is a stack screen, so returning here re-fires the
  // focus-effect refetch above and the brand-new enquiry appears immediately.
  const goToCreate = useCallback(
    () => navigation.navigate('CreateEnquiry'),
    [navigation],
  );

  const activeStatus = STATUS_TABS[tabIdx];
  const list = Array.isArray(enquiries) ? enquiries : [];

  // The backend computes `direction` because a broadcast row's `company_id` is
  // the RECIPIENT — the same document is "received" for one company and "sent"
  // for another, so it cannot be derived from a single client-side field.
  const isSentOf    = (e) => e.direction === 'sent';
  const byDirection = list.filter(e => (dirTab === 'received' ? !isSentOf(e) : isSentOf(e)));
  // Received stays one card per enquiry (each is addressed to us and needs its
  // own reply); Sent collapses each broadcast into a single card.
  const dirRows     = dirTab === 'sent' ? groupBroadcasts(byDirection) : byDirection;

  // Does the SENT tab have any unseen activity? Group the sent broadcasts and
  // ask the seen-tracker if any one of them changed since it was last opened —
  // this drives the green notification dot on the "Sent" tab button.
  const sentHasNewActivity = groupBroadcasts(list.filter(isSentOf))
    .some(e => enquirySeen.isNew(e, seenMap));

  // Same for the RECEIVED tab — a new reply/message/status change on an enquiry
  // sent TO us lights its tab dot too. Received rows are per-enquiry (not
  // grouped), so we check them directly.
  const receivedHasNewActivity = list.filter(e => !isSentOf(e))
    .some(e => enquirySeen.isNew(e, seenMap));

  // "New" count for the header — counted as CARDS, not raw rows. The hook's
  // `unreadCount` counts every row with status 'New', so a single broadcast WE
  // sent to N recipients inflates it by N (that was the bogus "7 new" when only
  // 3 cards exist). Group the sent side first, then count 'New' cards on each
  // side, exactly like the "total" count above.
  const newCount = (
    groupBroadcasts(list.filter(isSentOf)).filter(e => e.status === 'New').length
    + list.filter(e => !isSentOf(e) && e.status === 'New').length
  );

  const filtered = dirRows.filter(e => {
    const matchTab = activeStatus === 'All' || e.status === activeStatus;
    const q = search.trim().toLowerCase();
    const matchSearch = !q
      || (e.retailer_name  || '').toLowerCase().includes(q)
      || (e.customer_name  || '').toLowerCase().includes(q)
      || (e.product_name   || '').toLowerCase().includes(q)
      || (e.enq_code       || '').toLowerCase().includes(q);
    return matchTab && matchSearch;
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />

      {/* ══ Navbar ══ */}
      <View style={styles.navbar}>
        <View style={styles.navCircle1} />
        <View style={styles.navCircle2} />

        <View style={styles.navRow}>
          <View style={styles.navTitleWrap}>
            <Text style={styles.navTitle}>Enquiries</Text>
            <Text style={styles.navSub}>
              {/* Count CARDS, not rows: the Sent tab collapses each broadcast into
                  one card, so `list.length` would over-report ("6 total" for a
                  single broadcast to 6 parties). This matches the retailer. */}
              {(() => {
                const sentGrouped = groupBroadcasts(list.filter(e => isSentOf(e))).length;
                const received    = list.filter(e => !isSentOf(e)).length;
                const total       = sentGrouped + received;
                return `${total} total${newCount > 0 ? `  ·  ${newCount} new` : ''}`;
              })()}
            </Text>
          </View>

          {newCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {newCount > 99 ? '99+' : newCount} New
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.navIconBtn}
            onPress={() => { setShowSearch(v => !v); setSearch(''); }}
            activeOpacity={0.8}
          >
            <Ionicons name={showSearch ? 'close' : 'search-outline'} size={20} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.navIconBtn} onPress={refetch} activeOpacity={0.8}>
            <Ionicons name="refresh-outline" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        {showSearch && (
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={17} color={theme.colors.textDisabled} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, product, code…"
              placeholderTextColor={theme.colors.textDisabled}
              value={search}
              onChangeText={setSearch}
              autoFocus
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={theme.colors.textDisabled} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* ══ Received / Sent ══ */}
      {/* Two lists, not one: what was ASKED of us (and needs a reply) versus
          what we ASKED (and are waiting on answers for). */}
      <View style={styles.dirBar}>
        {[
          { key: 'received', label: 'Received' },
          { key: 'sent',     label: 'Sent' },
        ].map(t => {
          const active = dirTab === t.key;
          // Sent counts GROUPED broadcasts (one per broadcast, not one row per
          // recipient) so the pill agrees with the number of cards rendered.
          const rawRows = list.filter(e => (t.key === 'received' ? !isSentOf(e) : isSentOf(e)));
          const n = t.key === 'sent' ? groupBroadcasts(rawRows).length : rawRows.length;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.dirBtn, active && styles.dirBtnActive]}
              onPress={() => { setDirTab(t.key); setTabIdx(0); }}
              activeOpacity={0.85}
            >
              <Text style={[styles.dirBtnText, active && styles.dirBtnTextActive]}>
                {t.label} ({n})
              </Text>
              {/* Notification dot — on EITHER tab when one of its enquiries has
                  unseen activity (a reply/message/status change). Clears once
                  each such enquiry has been opened. */}
              {((t.key === 'sent' && sentHasNewActivity) ||
                (t.key === 'received' && receivedHasNewActivity)) ? (
                <View style={styles.dirBtnDot} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ══ Status tabs ══ */}
      <View style={styles.tabBarWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_TABS}
          keyExtractor={t => t}
          contentContainerStyle={styles.tabList}
          renderItem={({ item: tab, index }) => {
            const active = index === tabIdx;
            // Counts are scoped to the visible direction, matching the retailer.
            const count = tab === 'All'
              ? dirRows.length
              : tab === 'New'
                ? dirRows.filter(e => e.status === 'New').length
                : dirRows.filter(e => e.status === tab).length;
            return (
              <TouchableOpacity
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setTabIdx(index)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab}</Text>
                {count > 0 && (
                  <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>
                      {count > 99 ? '99+' : count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* ══ List ══ */}
      {loading && list.length === 0 ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={theme.colors.textDisabled} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refetch}><Text style={styles.retryText}>Tap to retry</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => String(i._id || i.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />}
          renderItem={({ item }) => (
            <EnquiryCardRow item={item} navigation={navigation} isNewActivity={enquirySeen.isNew(item, seenMap)} />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={<Ionicons name="mail-open-outline" size={52} color={theme.colors.textDisabled} />}
              title={`No ${activeStatus === 'All' ? '' : activeStatus + ' '}enquiries`}
              subtitle={search ? 'Try a different search term.' : 'Raise one to get a price from the seller.'}
              buttonTitle={search ? undefined : 'New Enquiry'}
              onButtonPress={search ? undefined : goToCreate}
            />
          }
        />
      )}

      {/* ══ New enquiry FAB ══ */}
      {/* A wholesaler can also ASK — the request is broadcast to every retailer,
          every wholesaler and the Admin team. Hidden while searching so it does
          not cover the last card. */}
      {!showSearch && (
        <TouchableOpacity style={styles.fab} onPress={goToCreate} activeOpacity={0.85}>
          <Ionicons name="add" size={26} color="#FFF" />
          <Text style={styles.fabLabel}>Enquiry</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const EnquiryCardRow = ({ item, navigation, isNewActivity }) => {
  const meta  = STATUS_META[item.status] || STATUS_META.New;
  const isNew = item.status === 'New';
  const isReceived = item.direction !== 'sent';

  // Who to show on the card's party line — mirrors the retailer's rule, mapped
  // to the wholesaler's flat DTO:
  //  • RECEIVED → the party that SENT it to us (retailer / sender name).
  //  • SENT     → US, the wholesaler who raised the broadcast. The party line
  //    carries the "SENT BY" label plus the recipient summary, matching the
  //    retailer's grouped-broadcast treatment.
  const senderName = isReceived
    ? (item.retailer_name || item.customer_name || item.sender_name || '—')
    : (item.created_by_name || item.retailer_name || 'You');
  const senderMobile = isReceived
    ? (item.retailer_mobile || item.customer_mobile || item.sender_mobile || '')
    : (item.retailer_mobile || '');

  const productName = item.product_name || item.product_code || '—';
  const offeredPrice = item.offered_price || null;
  const availQty = item.available_quantity ?? null;

  return (
    <TouchableOpacity
      style={[styles.card, isNew && styles.cardNew]}
      onPress={() => navigation.navigate('EnquiryDetail', {
        enquiryId: item._id || item.id,
        // Pass the exact `updated_at` the list used to decide the green dot, so
        // the detail screen can store THAT as "seen". Deriving it independently
        // from replies/messages risked landing a hair behind the group's value
        // and leaving the dot lit. Passing it straight through guarantees a match.
        seenUpdatedAt: item.updated_at || item.updatedAt || null,
        // Stable per-broadcast key the dot's seen-state is keyed on.
        seenKey: item.__seenKey || item._id || item.id || null,
        // The list already knows SENT vs RECEIVED (the backend's /enquiries list
        // stamps `direction`). Pass it so the detail screen is correct even if
        // the single-enquiry GET endpoint hasn't been redeployed with direction.
        direction: item.direction || null,
      })}
      activeOpacity={0.78}
    >
      {isNew && <View style={styles.newStrip} />}

      <View style={styles.cardInner}>

        {/* ── Row 1: Code + Status chip ── */}
        <View style={styles.cardRow}>
          <View style={styles.codeWrap}>
            {/* Green "new activity" dot — someone replied / messaged / cancelled
                / moved status since this enquiry was last opened on this device. */}
            {isNewActivity ? <View style={styles.activityDot} /> : null}
            <Ionicons name="pricetag-outline" size={12} color={theme.colors.textDisabled} />
            <Text style={styles.enqCode}>
              {item.enq_code || `#${String(item._id || item.id || '').slice(-6)}`}
            </Text>
          </View>
          <View style={styles.cardRowRight}>
            {isNewActivity ? (
              <View style={styles.newActivityBadge}>
                <Text style={styles.newActivityBadgeText}>NEW</Text>
              </View>
            ) : null}
            <View style={[styles.chip, { backgroundColor: meta.bg }]}>
              <View style={[styles.chipDot, { backgroundColor: meta.dot }]} />
              <Text style={[styles.chipText, { color: meta.text }]}>{item.status}</Text>
            </View>
          </View>
        </View>

        {/* ── Row 2: From (received) or SENT BY (sent) ── */}
        {isReceived ? (
          <View style={{ marginTop: 6, marginBottom: 2 }}>
            <Text style={styles.partyName} numberOfLines={1}>{senderName}</Text>
            {senderMobile ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Ionicons name="call-outline" size={11} color={theme.colors.textDisabled} />
                <Text style={styles.metaText}>{senderMobile}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={{ marginTop: 6, marginBottom: 2 }}>
            {senderName ? (
              <>
                <Text style={styles.partyLabel}>SENT BY</Text>
                <Text style={styles.partyName} numberOfLines={1}>{senderName}</Text>
              </>
            ) : null}
            {senderMobile ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Ionicons name="call-outline" size={11} color={theme.colors.textDisabled} />
                <Text style={styles.metaText}>{senderMobile}</Text>
              </View>
            ) : null}

          </View>
        )}

        {/* ── Row 3: Product ── */}
        <View style={[styles.productRow, { marginTop: 6 }]}>
          <Ionicons name="cube-outline" size={13} color={theme.colors.textSecondary} />
          <Text style={styles.productText} numberOfLines={1}>{productName}</Text>
        </View>

        {/* ── Row 4: Qty · Location ── */}
        <View style={[styles.metaRow, { marginTop: 4 }]}>
          <View style={styles.metaItem}>
            <Ionicons name="layers-outline" size={12} color={theme.colors.textDisabled} />
            <Text style={styles.metaText}>{item.qty || 0} {item.unit || ''}</Text>
          </View>
          {item.location ? (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={12} color={theme.colors.textDisabled} />
              <Text style={styles.metaText} numberOfLines={1}>{item.location}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Row 5: Offered ₹ + Availability (mirrors CRM "Offered ₹" column) ──
            RECEIVED only. On a SENT broadcast the price/qty come from recipients'
            replies, and we deliberately keep reply details OFF the sent card —
            the green dot signals activity; the detail screen shows who said what. */}
        {isReceived && (offeredPrice || availQty != null) ? (
          <View style={[styles.metaRow, { marginTop: 4 }]}>
            {offeredPrice ? (
              <View style={styles.metaItem}>
                <Ionicons name="cash-outline" size={12} color="#10b981" />
                <Text style={[styles.metaText, { color: '#10b981', fontWeight: '700' }]}>
                  ₹{Number(offeredPrice).toLocaleString('en-IN')}
                </Text>
              </View>
            ) : null}
            {availQty != null ? (
              <View style={styles.metaItem}>
                <Ionicons name="archive-outline" size={12} color="#10b981" />
                <Text style={[styles.metaText, { color: '#10b981', fontWeight: '600' }]}>
                  Avail: {availQty} {item.unit || ''}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── Row 6: Date + chevron ── */}
        <View style={[styles.cardRow, styles.cardRowLast, { marginTop: 6 }]}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={11} color={theme.colors.textDisabled} />
            <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={styles.arrowBtn}>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
          </View>
        </View>

      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },

  /* ── Navbar ── */
  navbar: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 24) + 10,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  navCircle1: {
    position: 'absolute', top: -30, right: -30,
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  navCircle2: {
    position: 'absolute', bottom: -20, left: -20,
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navTitleWrap: { flex: 1 },
  navTitle: { fontSize: 20, fontWeight: '800', color: '#FFF', letterSpacing: 0.2 },
  navSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  unreadBadge: {
    backgroundColor: theme.colors.accent,
    borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3,
  },
  unreadBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  navIconBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginTop: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 0 },

  /* ── Received / Sent ── */
  dirBar: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4,
    backgroundColor: '#FFF',
  },
  dirBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: theme.colors.background,
    borderWidth: 1.5, borderColor: 'transparent',
    position: 'relative',
  },
  dirBtnDot: {
    position: 'absolute',
    top: 6, right: 10,
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: theme.colors.success,
    borderWidth: 1.5, borderColor: '#FFF',
  },
  dirBtnActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  dirBtnText: { fontSize: 12.5, fontWeight: '700', color: theme.colors.textSecondary },
  dirBtnTextActive: { color: theme.colors.primary, fontWeight: '800' },

  /* ── Status tabs ── */
  tabBarWrap: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 }, shadowRadius: 3,
  },
  tabList: { paddingHorizontal: 10, paddingVertical: 10, gap: 7, flexDirection: 'row' },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 13, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#F2F4F8',
    borderWidth: 1, borderColor: 'transparent',
  },
  tabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  tabTextActive: { color: '#FFF', fontWeight: '700' },
  tabBadge: {
    backgroundColor: '#E4E8F0', borderRadius: 8, minWidth: 18,
    paddingHorizontal: 4, alignItems: 'center',
  },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabBadgeText: { fontSize: 9, fontWeight: '800', color: theme.colors.textSecondary },
  tabBadgeTextActive: { color: '#FFF' },

  /* ── Cards ── */
  // Extra bottom padding keeps the last card clear of the floating button.
  list: { padding: 12, paddingBottom: 96 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 }, shadowRadius: 3,
  },
  cardNew: { borderColor: theme.colors.accent },
  newStrip: {
    width: 4, backgroundColor: theme.colors.accent,
    borderTopLeftRadius: 14, borderBottomLeftRadius: 14,
  },
  cardInner: { flex: 1, padding: 13 },

  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardRowLast: { marginTop: 4, marginBottom: 0 },
  cardRowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  codeWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  enqCode: { fontSize: 11, fontWeight: '700', color: theme.colors.textDisabled, letterSpacing: 0.3 },

  /* ── New-activity indicators ── */
  activityDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: theme.colors.success,
    marginRight: 2,
  },
  newActivityBadge: {
    backgroundColor: theme.colors.success,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  newActivityBadgeText: {
    fontSize: 9, fontWeight: '800', color: '#FFF', letterSpacing: 0.5,
  },

  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 11, fontWeight: '700' },

  partyName: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 5 },
  partyLabel: { fontSize: 9.5, fontWeight: '800', color: theme.colors.textDisabled, letterSpacing: 0.6, marginBottom: 1 },
  sentToText: { fontSize: 11.5, color: theme.colors.textSecondary, marginTop: 2 },
  groupSub: { fontSize: 11.5, color: theme.colors.primary, fontWeight: '700', marginBottom: 5 },

  productRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  productText: { fontSize: 13, color: theme.colors.textSecondary, flex: 1 },

  metaRow: { flexDirection: 'row', gap: 14, marginBottom: 2, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 12, color: theme.colors.textDisabled },

  dateText: { fontSize: 11, color: theme.colors.textDisabled, marginLeft: 2 },

  arrowBtn: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },
  retryText: { fontSize: 14, color: theme.colors.primary, fontWeight: '700' },

  /* ── Floating "New Enquiry" button ── */
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.accent,
    paddingLeft: 14,
    paddingRight: 18,
    paddingVertical: 13,
    borderRadius: 28,
    elevation: 6,
    shadowColor: '#1A0F40',
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  fabLabel: { fontSize: 13.5, fontWeight: '800', color: '#FFF', letterSpacing: 0.2 },
});
