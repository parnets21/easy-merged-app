// src/screens/enquiry/EnquiryDetailScreen.jsx
//
// Structural parity with RetailerApp/src/screens/enquiries/EnquiryDetailsScreen.jsx,
// adapted for the WHOLESALER (seller) role.
//
// The retailer's detail screen shows seller reply cards (one per wholesaler in a
// broadcast) with per-seller Message and Reply modals. The wholesaler has a
// single conversation with the retailer who enquired, so:
//   • No seller cards — the "Customer" section shows who asked.
//   • One Message modal (negotiation chat with the retailer).
//   • One Reply modal (quote form with reply history above it).
//
// Field mapping: the wholesaler's backend returns flat fields (`retailer_name`,
// `product_name`, `offered_price`, `enq_code`) — same slots as the retailer's
// nested objects, mapped to the real fields.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, TextInput,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// Same icon family as the retailer's detail screen.
import Ionicons from 'react-native-vector-icons/Ionicons';
import ConfirmDialog from '../../components/ConfirmDialog';
import PrimaryButton from '../../components/PrimaryButton';
import { enquiryService } from '../../services/enquiryService';
import { orderService } from '../../services/orderService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { theme } from '../../utils/theme';
import useAuth from '../../hooks/useAuth';
import { enquirySeen } from '../../utils/enquirySeen';

const STATUS_TRANSITIONS = {
  New:         ['Viewed', 'Replied', 'Confirmed', 'Cancelled'],
  Viewed:      ['Replied', 'Confirmed', 'Cancelled'],
  Replied:     ['Confirmed', 'Cancelled'],
};
const CANCELLABLE = ['New', 'Viewed', 'Replied'];

// Per-status chip colours — mirrors the retailer's detail card so a "New"
// enquiry reads blue, "Replied" reads orange, "Confirmed" reads green, etc.
// (The retailer defines this at EnquiryDetailsScreen.jsx:37-44.)
const STATUS_META = {
  New:         { chipBg: '#EFF6FF', chipText: '#2563EB' },
  Viewed:      { chipBg: '#F3F4F6', chipText: '#6B7280' },
  Replied:     { chipBg: '#FFF7ED', chipText: '#D97706' },
  Confirmed:   { chipBg: '#F0FDF4', chipText: '#059669' },
  Cancelled:   { chipBg: '#FEF2F2', chipText: '#DC2626' },
};

export default function EnquiryDetailScreen({ navigation, route }) {
  const { user } = useAuth();
  // `seenUpdatedAt` is the exact `updated_at` the list used to light the green
  // dot; `seenKey` is the stable per-broadcast key the dot is keyed on. We store
  // the timestamp under that key so the dot reliably clears on return.
  // `routeDirection` is the SENT/RECEIVED hint the list passes (the GET endpoint
  // may not stamp `direction`), used as a fallback below.
  const { enquiryId, seenUpdatedAt, seenKey, direction: routeDirection } = route.params;

  const [enquiry, setEnquiry]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // ── Negotiation thread ──
  const [offers, setOffers]     = useState([]);
  const [messages, setMessages] = useState([]);
  // Broadcast replies roster (who answered a SENT enquiry). The retailer fetches
  // this so the Sent tab can show who replied; the wholesaler can also RAISE
  // broadcasts, so it needs the same roster. (Retailer EnquiryDetailsScreen.jsx:54)
  const [replies, setReplies] = useState(null);

  // ── Reply history ──
  const [replyHistory, setReplyHistory] = useState([]);

  // ── Inline panel toggles (parity with the retailer's showMessage/showReply) ──
  // Message and Reply are inline panels rendered in place (NOT Modals), driven
  // by these two flags — mirroring EnquiryDetailsScreen.jsx in the retailer app.
  const [showMessage, setShowMessage] = useState(false);
  const [showReply,   setShowReply]   = useState(false);
  // The enquiry row the inline Message/Reply panels act on. Defaults to the
  // opened enquiry; a reply card sets it to THAT replier's own row so the
  // conversation/history stays scoped to that one party.
  const [activeRowId, setActiveRowId] = useState(null);
  const [modalSending, setModalSending] = useState(false);

  // ── Modal message composer ──
  const [messageText, setMessageText] = useState('');

  // ── Modal reply form ──
  const [modalReplyForm, setModalReplyForm] = useState({
    rate: '', gst: '18', transport: '', packing: '',
    available_qty: '', timeline: '', remarks: '',
  });

  // ── Confirm dialog for status changes ──
  const [dialog, setDialog] = useState({ visible: false, targetStatus: '' });

  // ── Scroll handles (parity with the retailer) ───────────────────────────────
  // The chat composer and the reply form sit at the BOTTOM of the page, so when
  // one of them opens we scroll it into view — otherwise it lands underneath the
  // keyboard and the user has to hunt for it. `chatScrollRef` keeps the MODAL
  // thread pinned to its newest message.
  const scrollRef = useRef(null);
  const chatScrollRef = useRef(null);
  const scrollToBottomSoon = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
  };

  const isMarketplace = !!(enquiry?.buyer_company_id);

  const load = useCallback(async () => {
    if (!enquiryId) return;
    setError('');
    try {
      const [enqRes, offersRes, msgRes, repliesRes, historyRes] = await Promise.allSettled([
        enquiryService.get(enquiryId),
        enquiryService.listOffers(enquiryId),
        enquiryService.listMessages(enquiryId),
        enquiryService.listReplies(enquiryId),
        enquiryService.listReplyHistory(enquiryId),
      ]);

      if (enqRes.status === 'rejected') throw enqRes.reason;
      const data = enqRes.value?.data ?? enqRes.value;
      setEnquiry(data);

      const offerList = offersRes.status === 'fulfilled'
        ? (offersRes.value?.data?.offers ?? offersRes.value?.offers ?? offersRes.value?.data ?? [])
        : [];
      setOffers(Array.isArray(offerList) ? offerList : []);

      const msgList = msgRes.status === 'fulfilled'
        ? (msgRes.value?.data?.messages ?? msgRes.value?.messages ?? [])
        : [];
      setMessages(Array.isArray(msgList) ? msgList : []);

      const repliesEnvelope = repliesRes.status === 'fulfilled' ? (repliesRes.value || null) : null;
      setReplies(repliesEnvelope);

      // ── Mark SEEN at the LATEST activity timestamp ──
      // The list's green dot compares the group's newest `updated_at` (across
      // every recipient sibling) against what we last saw. The enquiry row we
      // just opened only carries ITS OWN `updated_at`, which is older than a
      // reply sitting on a sibling row — so storing that would leave the dot
      // on forever. Instead, store the MAX of: the enquiry's own updated_at,
      // every reply's responded_at, and the newest message time. That matches
      // (or exceeds) whatever the list can compute, so the dot clears.
      const repliedRows =
        (Array.isArray(repliesEnvelope?.data?.replied) ? repliesEnvelope.data.replied
          : Array.isArray(repliesEnvelope?.replied) ? repliesEnvelope.replied
          : []);
      const candidateTimes = [
        // The value the list itself used — guarantees the stored "seen" is never
        // behind what the dot compares against.
        seenUpdatedAt,
        data?.updated_at || data?.updatedAt,
        ...repliedRows.map(r => r.responded_at || r.updated_at || r.created_at),
        ...msgList.map(m => m.created_at),
      ].filter(Boolean).map(t => new Date(t).getTime()).filter(n => !Number.isNaN(n));
      // Add a 1s cushion so the stored "seen" is a hair AHEAD of the list's
      // value — strict-greater comparisons then read it as fully seen.
      const latestSeen = candidateTimes.length
        ? new Date(Math.max(...candidateTimes) + 1000).toISOString()
        : new Date().toISOString();
      // Mark seen under the SAME key the list's dot checks. `seenKey` (the
      // broadcast's enq_code) is stable; fall back to the enquiry id.
      enquirySeen.markSeen(seenKey || enquiryId, latestSeen).catch(() => {});

      const historyList = historyRes?.status === 'fulfilled'
        ? (historyRes.value?.data?.replies ?? historyRes.value?.replies ?? historyRes.value?.data ?? [])
        : [];
      setReplyHistory(Array.isArray(historyList) ? historyList : []);

      // Auto-mark New → Viewed
      if (data?.status === 'New') {
        enquiryService.update(enquiryId, { status: 'Viewed' }).catch(() => {});
      }
    } catch (err) {
      setError(err?.message || 'Could not load enquiry.');
    }
  }, [enquiryId, seenKey, seenUpdatedAt]);

  useEffect(() => {
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // ── Send message from inline panel — optimistic bubble ──
  const sendMessageFromModal = async () => {
    const text = messageText.trim();
    if (!text || modalSending) return;
    setModalSending(true);
    const optimistic = {
      id: `tmp-${Date.now()}`,
      message: text,
      sender_side: 'seller',
      created_at: new Date().toISOString(),
      __pending: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setMessageText('');
    // Target the active row (a specific replier's row when opened from a reply
    // card), falling back to the opened enquiry.
    const targetId = activeRowId || enquiryId;
    try {
      await enquiryService.sendMessage(targetId, text, `c${Date.now()}`);
      const res = await enquiryService.listMessages(targetId);
      const list = Array.isArray(res?.messages) ? res.messages
        : (Array.isArray(res?.data?.messages) ? res.data.messages : []);
      setMessages(list);
      scrollToBottomSoon();
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setMessageText(text);
      Alert.alert('Could not send', err.message || 'Please try again.');
    } finally {
      setModalSending(false);
    }
  };

  // ── Send reply — saves to history AND updates the enquiry ──
  // Matches the retailer's sendReplyFromModal: append to history optimistically
  // and KEEP the panel open so the user sees their reply land above the form.
  const sendReplyFromModal = async () => {
    if (!modalReplyForm.rate.trim()) {
      Alert.alert('Rate required', 'Enter your rate per unit before sending.');
      return;
    }
    setModalSending(true);
    try {
      const payload = {
        offered_price:      parseFloat(modalReplyForm.rate),
        available_quantity: modalReplyForm.available_qty ? parseFloat(modalReplyForm.available_qty) : undefined,
        delivery_timeline:  modalReplyForm.timeline,
        remarks:            modalReplyForm.remarks,
        unit:               enquiry?.unit || '',
      };

      // Target the active row (a specific replier's row when opened from a reply
      // card), falling back to the opened enquiry.
      const targetId = activeRowId || enquiryId;

      // 1. Save to reply history (new record every time) — append optimistically.
      let newEntry = null;
      try {
        const saved = await enquiryService.createReplyHistory(targetId, payload);
        newEntry = saved?.data ?? saved;
        if (newEntry) {
          setReplyHistory(prev => [...(Array.isArray(prev) ? prev : []), newEntry]);
        }
      } catch { /* non-fatal — history is for tracking only */ }

      // 2. Update the enquiry itself
      if (isMarketplace) {
        await enquiryService.sendOffer(targetId, {
          unit_price:         parseFloat(modalReplyForm.rate),
          gst_percent:        modalReplyForm.gst ? parseFloat(modalReplyForm.gst) : undefined,
          transport_charge:   modalReplyForm.transport ? parseFloat(modalReplyForm.transport) : 0,
          packing_charge:     modalReplyForm.packing ? parseFloat(modalReplyForm.packing) : 0,
          available_quantity: modalReplyForm.available_qty ? parseFloat(modalReplyForm.available_qty) : undefined,
          delivery_timeline:  modalReplyForm.timeline,
          notes:              modalReplyForm.remarks,
        });
      } else {
        await enquiryService.reply(targetId, {
          status:             'Replied',
          offered_price:      parseFloat(modalReplyForm.rate),
          available_quantity: modalReplyForm.available_qty ? parseFloat(modalReplyForm.available_qty) : undefined,
          delivery_timeline:  modalReplyForm.timeline,
          distributor_reply:  modalReplyForm.remarks,
          negotiation_note:   modalReplyForm.remarks,
        });
      }

      // Clear the form so the next reply starts fresh; keep the panel open.
      setModalReplyForm({ rate: '', gst: '18', transport: '', packing: '', available_qty: '', timeline: '', remarks: '' });
      // Reflect status locally without a full reload.
      setEnquiry(prev => ({ ...prev, status: prev?.status === 'New' ? 'Replied' : prev?.status }));
      Alert.alert('Sent', isMarketplace ? 'Your offer has been sent.' : 'Your quote has been sent.');
      load();
    } catch (err) {
      Alert.alert('Could not send', err.message || 'Please try again.');
    } finally {
      setModalSending(false);
    }
  };

  // ── Status change ──
  const changeStatus = async (status) => {
    setDialog({ visible: false, targetStatus: '' });
    setActionLoading(true);
    try {
      await enquiryService.update(enquiryId, { status });
      setEnquiry(prev => ({ ...prev, status }));
      if (status === 'Confirmed') {
        try {
          const r = await orderService.createFromEnquiry({
            enquiry_id: enquiryId,
            rate: enquiry?.offered_price || enquiry?.proposed_price || undefined,
            gst_percent: enquiry?.gst_percent || undefined,
          });
          const order = r?.data ?? r;
          Alert.alert('Enquiry Confirmed', `Order ${order?.order_code || ''} created.`, [
            { text: 'View Order', onPress: () => order?._id && navigation.navigate('OrderDetail', { orderId: order._id }) },
            { text: 'OK' },
          ]);
        } catch (e) {
          Alert.alert('Confirmed', `Status changed to Confirmed, but order creation failed: ${e?.message || 'unknown error'}`);
        }
      } else {
        Alert.alert('Updated', `Status changed to ${status}.`);
      }
    } catch (err) {
      Alert.alert('Could not update', err.message || 'Status update failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Reject / cancel ──
  const rejectEnquiry = () => {
    Alert.alert(
      'Reject enquiry?',
      'This enquiry will be marked as Cancelled.',
      [
        { text: 'Keep', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: () => changeStatus('Cancelled') },
      ]
    );
  };

  // ── Loading / error states ──
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
        <TopBar code="" onBack={() => navigation.goBack()} />
        <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!enquiry) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
        <TopBar code="" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Ionicons name="document-text-outline" size={40} color={theme.colors.textDisabled} />
          <Text style={styles.errorText}>{error || 'Enquiry not found.'}</Text>
          <TouchableOpacity onPress={onRefresh}><Text style={styles.retryText}>Tap to retry</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const code         = enquiry.enq_code || enquiry.enquiry_code || enquiryId || 'Enquiry';
  const productName  = enquiry.product_name || enquiry.product?.name || enquiry.product_code || '—';
  const productCode  = enquiry.product_code || enquiry.product?.code || '';
  const qty          = enquiry.qty ?? enquiry.quantity;
  const unit         = enquiry.unit || '';
  // Prefer the enquiry's own `direction` (now stamped by the GET endpoint); fall
  // back to the hint the list passed so SENT enquiries are correct even against
  // an older backend. Only 'sent' means NOT received.
  const effectiveDirection = enquiry.direction || routeDirection;
  const isReceived   = effectiveDirection !== 'sent';
  // SENT BY = who raised this enquiry.
  //  • RECEIVED → the party that sent it to us (retailer / sender).
  //  • SENT     → US, the wholesaler who raised the broadcast.
  const partyName = isReceived
    ? (enquiry.retailer_name || enquiry.customer_name || enquiry.sender_name || '—')
    : (enquiry.created_by?.company || enquiry.created_by?.name || enquiry.retailer_name || 'You');
  const partyMobile = isReceived
    ? (enquiry.retailer_mobile || enquiry.customer_mobile || enquiry.sender_mobile || '')
    : (enquiry.created_by?.mobile || enquiry.retailer_mobile || '');
  const partyEmail = isReceived
    ? (enquiry.retailer_email || enquiry.customer_email || enquiry.sender_email || '')
    : (enquiry.created_by?.email || enquiry.retailer_email || '');
  const retailerName   = partyName;
  const retailerMobile = partyMobile;
  const location     = enquiry.location || enquiry.delivery_location || '';
  const remarks      = enquiry.remarks || enquiry.notes || '';
  const proposed     = enquiry.proposed_price ?? enquiry.offered_price ?? null;
  const hasQuote     = enquiry.offered_price != null || enquiry.available_quantity != null || enquiry.delivery_timeline;
  const nextStatuses = STATUS_TRANSITIONS[enquiry.status] || [];
  const hasOrder     = !!enquiry.order_id;

  // ── Replies roster ──
  // The /replies endpoint returns the whole envelope:
  //   { data: { replied: [...], awaiting: [...], counts: {...} } }
  // We only care about who actually ANSWERED, so unwrap `replied`. The envelope
  // can arrive as `replies.data.replied`, `replies.replied`, or (older shape) a
  // bare array — accept all three so the cards render regardless of wrapper.
  const repliedList = Array.isArray(replies?.data?.replied) ? replies.data.replied
    : Array.isArray(replies?.replied)   ? replies.replied
    : Array.isArray(replies?.data)      ? replies.data
    : Array.isArray(replies)            ? replies
    : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <TopBar code={code} onBack={() => navigation.goBack()} />

      {/* The reply form's SEND button sits at the BOTTOM of this screen. Without a
          KeyboardAvoidingView the keyboard covers it and, because it is the last
          thing in the ScrollView, there is nothing left to scroll — so the button
          became unreachable. `padding` on iOS lifts the content above the keyboard;
          Android's default `adjustResize` already shrinks the window, so it needs no
          behaviour. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
      <ScrollView
        ref={scrollRef}
        style={styles.scrollArea}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />}
      >
        {error ? (
          <View style={styles.inlineError}>
            <Ionicons name="alert-circle" size={15} color={theme.colors.danger} />
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        ) : null}

        {/* ══ CRM-style detail card — parity with retailer EnquiryDetailsScreen.jsx:462-571 ══
            Orange header (code + date + status chip), then SENT BY, then SENT TO
            (only for enquiries WE raised), then the ENQUIRY DETAILS grid, then the
            SPECIFICATIONS block parsed from remarks. */}
        <View style={styles.detailCard}>

          {/* ── Orange header: code + date + status ── */}
          <View style={styles.detailCardHeader}>
            <View>
              <Text style={styles.detailCardLabel}>ENQUIRY CODE</Text>
              <Text style={styles.detailCardCode}>{code}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={styles.detailCardDate}>{formatDate(enquiry.created_at)}</Text>
              <View style={[styles.statusChip, { backgroundColor: (STATUS_META[enquiry.status] || STATUS_META.New).chipBg }]}>
                <Text style={[styles.statusChipText, { color: (STATUS_META[enquiry.status] || STATUS_META.New).chipText }]}>
                  {enquiry.status || 'New'}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Sent By ── */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionLabel}>SENT BY</Text>
            <Text style={styles.detailSenderName}>{partyName}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
              {partyMobile ? (
                <View style={styles.detailContact}>
                  <Ionicons name="call-outline" size={12} color={theme.colors.textSecondary} />
                  <Text style={styles.detailContactText}>{partyMobile}</Text>
                </View>
              ) : null}
              {partyEmail ? (
                <View style={styles.detailContact}>
                  <Ionicons name="mail-outline" size={12} color={theme.colors.textSecondary} />
                  <Text style={styles.detailContactText}>{partyEmail}</Text>
                </View>
              ) : null}
            </View>
            {location ? (
              <View style={[styles.detailContact, { marginTop: 4 }]}>
                <Ionicons name="location-outline" size={12} color={theme.colors.textSecondary} />
                <Text style={styles.detailContactText}>{location}</Text>
              </View>
            ) : null}
          </View>

          {/* ── Sent To ──
              Only for a SINGLE-SELLER enquiry we raised. A BROADCAST goes to
              many recipients, so naming one is misleading — recipients show in
              the Replies section instead. Suppressed for broadcasts. */}
          {!isReceived && !enquiry.broadcast_audience && enquiry.seller?.name ? (
            <View style={[styles.detailSection, { backgroundColor: '#fafafa' }]}>
              <Text style={styles.detailSectionLabel}>SENT TO</Text>
              <Text style={styles.detailSenderName}>{enquiry.seller.name}</Text>
              {(enquiry.seller?.city || enquiry.seller?.state) ? (
                <View style={[styles.detailContact, { marginTop: 4 }]}>
                  <Ionicons name="location-outline" size={12} color={theme.colors.textSecondary} />
                  <Text style={styles.detailContactText}>
                    {[enquiry.seller.city, enquiry.seller.state].filter(Boolean).join(', ')}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* ── Enquiry Details: Product · Qty · Budget ── */}
          <View style={[styles.detailSection, { backgroundColor: '#fafafa' }]}>
            <Text style={styles.detailSectionLabel}>ENQUIRY DETAILS</Text>
            <View style={{ flexDirection: 'row', gap: 0, marginTop: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailFieldLabel}>Product</Text>
                <Text style={styles.detailFieldValue}>{productName}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailFieldLabel}>Quantity</Text>
                <Text style={styles.detailFieldValue}>{qty ?? '—'} {unit}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailFieldLabel}>Budget</Text>
                <Text style={styles.detailFieldValue}>
                  {proposed ? formatCurrency(proposed) : 'Flexible'}
                </Text>
              </View>
            </View>

            {/* Specifications — parsed from remarks */}
            {remarks ? (
              <View style={styles.specsBox}>
                <Text style={styles.detailSectionLabel}>SPECIFICATIONS</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
                  {remarks.split('\n').filter(l => l.includes(':')).map((line, i) => {
                    const colonIdx = line.indexOf(':');
                    const label = line.slice(0, colonIdx).trim();
                    const value = line.slice(colonIdx + 1).trim();
                    return (
                      <View key={i} style={styles.specItem}>
                        <Text style={styles.specLabel}>{label}: </Text>
                        <Text style={styles.specValue}>{value}</Text>
                      </View>
                    );
                  })}
                  {!remarks.includes(':') ? (
                    <Text style={styles.specValue}>{remarks}</Text>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Your Quote (if already replied) ──
            Hidden whenever reply cards exist: those cards already show the
            price/qty/timeline per replier, so a separate "Your Quote" block
            would duplicate them. Only a RECEIVED enquiry WE quoted (with no
            incoming replies) shows it. Gating on `repliedList` rather than only
            `isReceived` keeps it correct even if direction detection is off. */}
        {hasQuote && isReceived && repliedList.length === 0 ? (
          <Section title="Your Quote">
            {enquiry.offered_price != null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="cash-outline" size={14} color={theme.colors.success} />
                <Text style={styles.quotePrice}>{formatCurrency(enquiry.offered_price)}</Text>
                <Text style={styles.sub}> / {unit || 'unit'}</Text>
              </View>
            ) : null}
            {enquiry.available_quantity != null ? (
              <Text style={styles.sub}>Available Qty: {enquiry.available_quantity} {unit}</Text>
            ) : null}
            {enquiry.delivery_timeline ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Ionicons name="time-outline" size={12} color={theme.colors.textSecondary} />
                <Text style={styles.sub}>{enquiry.delivery_timeline}</Text>
              </View>
            ) : null}
            {enquiry.distributor_reply ? (
              <View style={styles.replyBox}>
                <Text style={styles.replyLabel}>Your Reply:</Text>
                <Text style={styles.replyText}>{enquiry.distributor_reply}</Text>
              </View>
            ) : null}
          </Section>
        ) : null}

        {/* ── Offers (marketplace only) ── */}
        {isMarketplace && offers.length > 0 ? (
          <Section title={`Offers (${offers.length})`}>
            {offers.map((o) => (
              <View key={o.id || o._id} style={styles.offerCard}>
                <View style={styles.offerTop}>
                  <Text style={styles.offerPrice}>{formatCurrency(o.unit_price)} / {o.unit || 'unit'}</Text>
                  <View style={[styles.offerStatus, o.status === 'Accepted' && styles.offerAccepted, o.status === 'Rejected' && styles.offerRejected]}>
                    <Text style={styles.offerStatusText}>{o.status}</Text>
                  </View>
                </View>
                <Text style={styles.offerMeta}>
                  Total {formatCurrency(o.total_amount)}
                  {o.available_quantity != null ? `  ·  Avail ${o.available_quantity}` : ''}
                  {o.delivery_timeline ? `  ·  ${o.delivery_timeline}` : ''}
                </Text>
                {o.notes ? <Text style={styles.offerNotes}>{o.notes}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null}

        {/* ── Date + status ── */}
        <View style={styles.metaRow}>
          <Text style={styles.sub}>Date: {formatDate(enquiry.created_at)}</Text>
          <View style={styles.metaStatusChip}>
            <Text style={styles.statusText}>{enquiry.status || 'New'}</Text>
          </View>
        </View>

        {/* ══ Replies section (if this is a SENT enquiry with replies) ══ */}
        {repliedList.length > 0 ? (
          <Section title={`Replies (${repliedList.length})`}>
            {repliedList.map((reply, idx) => {
              // Each reply card targets THAT replier's own enquiry row id, so the
              // chat/reply history opened from it is only the conversation with
              // THAT party — never another recipient's.
              const rowId = reply.id || reply._id || enquiryId;
              return (
              <ReplyCard
                key={rowId || idx}
                reply={reply}
                enquiryId={rowId}
                onReply={() => {
                  setShowMessage(false);
                  setActiveRowId(rowId);
                  setShowReply(true);
                  enquiryService.listReplyHistory(rowId)
                    .then(r => setReplyHistory(r?.data?.replies ?? r?.replies ?? r?.data ?? []))
                    .catch(() => setReplyHistory([]));
                  scrollToBottomSoon();
                }}
                onMessage={() => {
                  setShowReply(false);
                  setActiveRowId(rowId);
                  setShowMessage(true);
                  enquiryService.listMessages(rowId)
                    .then(r => setMessages(Array.isArray(r?.messages) ? r.messages
                      : (Array.isArray(r?.data?.messages) ? r.data.messages : [])))
                    .catch(() => setMessages([]));
                  scrollToBottomSoon();
                }}
                navigation={navigation}
              />
              );
            })}
          </Section>
        ) : null}

        {/* ══ Inline Message / Reply panels + order/status blocks ══
            The old top-level action-button row is gone. Message/Reply now open
            from each reply card, so these panels only render once a reply
            exists and the user taps its button. ══ */}
        {(() => {
          const isCancelled = enquiry.status === 'Cancelled';
          const isConfirmed = enquiry.status === 'Confirmed';
          const canAct      = !isCancelled;
          const canCancel   = !isCancelled && !isConfirmed && CANCELLABLE.includes(enquiry.status);
          // Show the shared Message / Reply / Cancel row ONLY when there are no
          // reply cards: i.e. a RECEIVED enquiry we must answer, OR a SENT one
          // nobody has replied to yet. The moment reply cards exist, THEY carry
          // the actions, so this shared row would duplicate them — hide it.
          const showSharedActions = isReceived && repliedList.length === 0;
          return (
            <>
              {showSharedActions ? (
                <View style={styles.crmActions}>
                  {/* Message */}
                  <TouchableOpacity
                    style={[styles.crmBtn, styles.crmBtnOrange, !canAct && styles.crmBtnDisabled]}
                    onPress={() => {
                      if (!canAct) return;
                      setShowReply(false);
                      setActiveRowId(enquiryId);
                      const willOpen = !showMessage;
                      setShowMessage(willOpen);
                      if (willOpen) {
                        enquiryService.listMessages(enquiryId)
                          .then(r => setMessages(Array.isArray(r?.messages) ? r.messages
                            : (Array.isArray(r?.data?.messages) ? r.data.messages : [])))
                          .catch(() => setMessages([]));
                        scrollToBottomSoon();
                      }
                    }}
                    activeOpacity={canAct ? 0.8 : 1}
                  >
                    <Ionicons name="chatbubble-outline" size={14} color="#FFF" />
                    <Text style={styles.crmBtnText}>Message</Text>
                  </TouchableOpacity>

                  {/* Reply */}
                  <TouchableOpacity
                    style={[styles.crmBtn, styles.crmBtnOrange, !canAct && styles.crmBtnDisabled]}
                    onPress={() => {
                      if (!canAct) return;
                      setShowMessage(false);
                      setActiveRowId(enquiryId);
                      const willOpen = !showReply;
                      setShowReply(willOpen);
                      if (willOpen) {
                        setModalReplyForm({
                          rate: '', gst: enquiry?.gst_percent != null ? String(enquiry.gst_percent) : '18',
                          transport: '', packing: '',
                          available_qty: '', timeline: '', remarks: '',
                        });
                        enquiryService.listReplyHistory(enquiryId)
                          .then(r => setReplyHistory(r?.data?.replies ?? r?.replies ?? r?.data ?? []))
                          .catch(() => setReplyHistory([]));
                        scrollToBottomSoon();
                      }
                    }}
                    activeOpacity={canAct ? 0.8 : 1}
                  >
                    <Ionicons name="return-down-forward-outline" size={14} color="#FFF" />
                    <Text style={styles.crmBtnText}>{isMarketplace ? 'Offer' : 'Reply'}</Text>
                  </TouchableOpacity>

                  {/* Cancel */}
                  <TouchableOpacity
                    style={[styles.crmBtn, styles.crmBtnRed, !canCancel && styles.crmBtnDisabledRed]}
                    onPress={() => {
                      if (!canCancel) return;
                      if (isMarketplace) { rejectEnquiry(); return; }
                      setDialog({ visible: true, targetStatus: 'Cancelled' });
                    }}
                    activeOpacity={canCancel ? 0.8 : 1}
                  >
                    <Ionicons name="ban-outline" size={14} color={canCancel ? '#FFF' : '#ef4444'} />
                    <Text style={[styles.crmBtnText, !canCancel && { color: '#ef4444' }]}>
                      {isCancelled ? 'Cancelled' : isConfirmed ? 'Confirmed' : 'Cancel'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* ── Inline Message panel ── */}
              {showMessage ? (
                <View style={styles.inlinePanel}>
                  <View style={styles.inlinePanelHeader}>
                    <Ionicons name="chatbubbles-outline" size={14} color="#FFF" />
                    <Text style={styles.inlinePanelTitle}>Chat with {partyName}</Text>
                    <TouchableOpacity onPress={() => setShowMessage(false)}>
                      <Ionicons name="close" size={16} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    ref={chatScrollRef}
                    style={styles.inlineChatBody}
                    contentContainerStyle={styles.inlineChatBodyContent}
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: false })}
                  >
                    {messages.length === 0 ? (
                      <View style={styles.threadEmpty}>
                        <Ionicons name="chatbubbles-outline" size={28} color="#ccc" />
                        <Text style={styles.threadEmptyText}>No messages yet.{'\n'}Start the conversation below.</Text>
                      </View>
                    ) : (
                      messages.map((m, i) => {
                        // "Mine" = sent by this wholesaler. The backend tags the
                        // seller's own messages as sender_side 'seller', so we key
                        // off that plus the optimistic-pending flag.
                        const myUserId  = String(user?._id || user?.id || '');
                        const msgSender = String(m.sender?.id || m.sender_user_id || '');
                        const mine = m.__pending
                          || m.sender_side === 'seller'
                          || (myUserId && msgSender && myUserId === msgSender);
                        const time = m.created_at
                          ? new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                          : '';
                        const senderName = mine ? 'You' : (m.sender?.name || partyName);
                        return (
                          <View key={m.id || m._id || i} style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
                            <Text style={{ fontSize: 10, color: '#888', marginBottom: 2, paddingHorizontal: 4 }}>
                              {senderName}
                            </Text>
                            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, m.__pending && { opacity: 0.6 }]}>
                              <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.message}</Text>
                              <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>{time}{m.__pending ? ' · sending…' : ''}</Text>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </ScrollView>
                  <View style={styles.inlineChatInput}>
                    <TextInput
                      style={styles.inlineMsgInput}
                      placeholder="Type a message…"
                      placeholderTextColor={theme.colors.textDisabled}
                      value={messageText}
                      onChangeText={setMessageText}
                      multiline
                      returnKeyType="send"
                      blurOnSubmit={false}
                      onSubmitEditing={() => { if (messageText.trim()) sendMessageFromModal(); }}
                    />
                    <TouchableOpacity
                      style={[styles.inlineSendBtn, (!messageText.trim() || modalSending) && styles.msgSendDisabled]}
                      onPress={sendMessageFromModal}
                      disabled={!messageText.trim() || modalSending}
                      activeOpacity={0.8}
                    >
                      {modalSending
                        ? <ActivityIndicator size="small" color="#FFF" />
                        : <Ionicons name="send" size={16} color="#FFF" />}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {/* ── Inline Reply panel ── */}
              {showReply ? (
                <View style={styles.inlinePanel}>
                  <View style={styles.inlinePanelHeader}>
                    <Ionicons name="return-down-forward-outline" size={14} color="#FFF" />
                    <Text style={styles.inlinePanelTitle}>
                      {isMarketplace ? 'Send Offer' : 'Reply with Availability & Price'}
                    </Text>
                    <TouchableOpacity onPress={() => setShowReply(false)}>
                      <Ionicons name="close" size={16} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                  <View style={{ padding: 16 }}>
                    {/* Reply history */}
                    {replyHistory.length > 0 ? (
                      <View style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <Ionicons name="time-outline" size={12} color={theme.colors.textSecondary} />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Your Reply History ({replyHistory.length})
                          </Text>
                        </View>
                        {replyHistory.map((h, i) => (
                          <View key={h.id || h._id || i} style={{
                            backgroundColor: '#fff', borderRadius: 10,
                            borderWidth: i === replyHistory.length - 1 ? 2 : 1,
                            borderColor: i === replyHistory.length - 1 ? theme.colors.primary : '#e2e8f0',
                            padding: 10, marginBottom: 8,
                          }}>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 4 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="pricetag-outline" size={12} color={theme.colors.primary} />
                                <Text style={{ fontSize: 15, fontWeight: '800', color: theme.colors.primary }}>{formatCurrency(h.offered_price)}</Text>
                              </View>
                              {h.available_quantity != null && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Ionicons name="cube-outline" size={11} color={theme.colors.textSecondary} />
                                  <Text style={{ fontSize: 12, color: '#64748b' }}>{h.available_quantity} {h.unit || unit || ''}</Text>
                                </View>
                              )}
                            </View>
                            {h.delivery_timeline ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                                <Ionicons name="time-outline" size={11} color={theme.colors.textSecondary} />
                                <Text style={{ fontSize: 12, color: '#64748b' }}>{h.delivery_timeline}</Text>
                              </View>
                            ) : null}
                            {h.remarks ? <Text style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginBottom: 4 }}>&quot;{h.remarks}&quot;</Text> : null}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                              <Text style={{ fontSize: 10, color: '#94a3b8' }}>
                                {h.sender_name || 'You'} · {h.created_at ? new Date(h.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                              </Text>
                              {i === replyHistory.length - 1 && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#dcfce7', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                                  <Ionicons name="checkmark-circle-outline" size={10} color="#16a34a" />
                                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#16a34a' }}>Latest</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {/* New reply form */}
                    <Field label="Your Rate (₹ per unit) *" value={modalReplyForm.rate}
                      onChangeText={v => setModalReplyForm(f => ({ ...f, rate: v }))} keyboardType="decimal-pad" />
                    <Field label={`Available Quantity${unit ? ` (${unit})` : ''}`} value={modalReplyForm.available_qty}
                      onChangeText={v => setModalReplyForm(f => ({ ...f, available_qty: v }))} keyboardType="decimal-pad"
                      placeholder={qty ? `Requested: ${qty}` : 'How much can you supply'} />
                    <Field label="Delivery Timeline" value={modalReplyForm.timeline}
                      onChangeText={v => setModalReplyForm(f => ({ ...f, timeline: v }))} placeholder="e.g. 3-5 days / Ready stock" />
                    <Field label="Message / Remarks" value={modalReplyForm.remarks}
                      onChangeText={v => setModalReplyForm(f => ({ ...f, remarks: v }))} multiline />
                    <PrimaryButton
                      title={modalSending ? 'SENDING…' : `SEND ${isMarketplace ? 'OFFER' : 'REPLY'}${replyHistory.length > 0 ? ` #${replyHistory.length + 1}` : ''}`}
                      onPress={sendReplyFromModal}
                      loading={modalSending}
                      disabled={!modalReplyForm.rate.trim()}
                      variant="primary"
                      style={{ marginTop: 16 }}
                    />
                  </View>
                </View>
              ) : null}

              {/* Order button if confirmed */}
              {hasOrder ? (
                <View style={{ marginTop: 12 }}>
                  <PrimaryButton
                    title="VIEW SALES ORDER"
                    onPress={() => navigation.navigate('OrderDetail', { orderId: enquiry.order_id })}
                    variant="primary"
                  />
                </View>
              ) : null}

              {/* "Move status" is only for RECEIVED enquiries — the wholesaler
                  drives the status of what was sent TO it. On a SENT enquiry WE
                  raised, the recipients reply and we don't push the status, so
                  this block is hidden there (it was the extra button row). */}
              {isReceived && !isMarketplace && !isCancelled && nextStatuses.length > 0 ? (
                <View style={[styles.actionsCard, styles.statusCard]}>
                  <Text style={styles.statusCardLabel}>Move status</Text>
                  <View style={styles.statusRow}>
                    {nextStatuses.map(s => (
                      <TouchableOpacity
                        key={s}
                        style={[
                          styles.statusBtn,
                          s === 'Confirmed' && styles.statusConfirmed,
                          s === 'Cancelled' && styles.statusCancelled,
                        ]}
                        onPress={() => setDialog({ visible: true, targetStatus: s })}
                        disabled={actionLoading}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.statusBtnText}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          );
        })()}
      </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Confirm dialog for status changes ── */}
      <ConfirmDialog
        visible={dialog.visible}
        title={`Change to ${dialog.targetStatus}?`}
        message={`Move this enquiry to "${dialog.targetStatus}"?`}
        confirmLabel="Confirm"
        onConfirm={() => changeStatus(dialog.targetStatus)}
        onCancel={() => setDialog({ visible: false, targetStatus: '' })}
        danger={dialog.targetStatus === 'Cancelled'}
      />
    </SafeAreaView>
  );
}

const TopBar = ({ code, onBack }) => (
  <View style={styles.topBar}>
    <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Ionicons name="arrow-back" size={22} color="#FFF" />
    </TouchableOpacity>
    <Text style={styles.topBarTitle} numberOfLines={1}>{code}</Text>
    <View style={styles.backBtn} />
  </View>
);

// ── Section helper ──
const Section = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionContent}>{children}</View>
  </View>
);

// ── Reply card component ──
// Shows a clean card for each reply: replier info (name, phone, company),
// their message, and 3 action buttons (Message, Reply, Cancel).
const ReplyCard = ({ reply, enquiryId, onReply, onMessage, navigation }) => {
  // The /replies endpoint shapes each row via `shapeReply`:
  //   { id, company: { name, mobile, city, state, email }, status,
  //     offered_price, available_quantity, delivery_timeline, message, responded_at }
  // Fall back to the older flat shape too, so this works regardless.
  const company       = reply.company || null;
  const replyerName   = company?.name || reply.company_name || reply.retailer_name || reply.wholesaler_name || 'Unknown';
  const replierPhone  = company?.mobile || reply.mobile || reply.phone || '';
  const replierCity   = company?.city || reply.city || '';
  const offeredPrice  = reply.offered_price ?? reply.unit_price ?? null;
  const availQty      = reply.available_quantity ?? null;
  const deliveryTime  = reply.delivery_timeline || '';
  const replyMessage  = reply.message || reply.notes || reply.remarks || '';
  const replyStatus   = reply.status || '';
  const unit          = reply.unit || '';
  const respondedAt   = reply.responded_at || reply.created_at;
  const replyTime = respondedAt
    ? new Date(respondedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <View style={styles.replyCard}>
      {/* ── Header: Who replied ── */}
      <View style={styles.replyCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.replyCardName}>{replyerName}</Text>
          {replierPhone ? (
            <View style={styles.replyCardInfo}>
              <Ionicons name="call-outline" size={12} color={theme.colors.textDisabled} />
              <Text style={styles.replyCardInfoText}>{replierPhone}</Text>
            </View>
          ) : null}
          {replierCity ? (
            <View style={styles.replyCardInfo}>
              <Ionicons name="location-outline" size={12} color={theme.colors.textDisabled} />
              <Text style={styles.replyCardInfoText}>{replierCity}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {replyStatus ? (
            // A reply having arrived is a positive signal — show it GREEN so a
            // Replied / Negotiation / Confirmed card reads at a glance as "they
            // answered". Only Cancelled stays red.
            <View style={[
              styles.replyCardStatusChip,
              replyStatus === 'Cancelled' ? styles.replyCardStatusChipRed : styles.replyCardStatusChipGreen,
            ]}>
              <Text style={[
                styles.replyCardStatusText,
                replyStatus === 'Cancelled' ? styles.replyCardStatusTextRed : styles.replyCardStatusTextGreen,
              ]}>{replyStatus}</Text>
            </View>
          ) : null}
          {replyTime ? <Text style={styles.replyCardTime}>{replyTime}</Text> : null}
        </View>
      </View>

      {/* ── Offer details (price / qty / delivery) ── */}
      {(offeredPrice != null || availQty != null || deliveryTime) ? (
        <View style={styles.replyCardOffer}>
          {offeredPrice != null ? (
            <View style={styles.replyCardOfferItem}>
              <Ionicons name="pricetag-outline" size={13} color={theme.colors.primary} />
              <Text style={styles.replyCardPrice}>{formatCurrency(offeredPrice)}{unit ? ` / ${unit}` : ''}</Text>
            </View>
          ) : null}
          {availQty != null ? (
            <View style={styles.replyCardOfferItem}>
              <Ionicons name="cube-outline" size={12} color={theme.colors.textSecondary} />
              <Text style={styles.replyCardOfferText}>Avail: {availQty} {unit}</Text>
            </View>
          ) : null}
          {deliveryTime ? (
            <View style={styles.replyCardOfferItem}>
              <Ionicons name="time-outline" size={12} color={theme.colors.textSecondary} />
              <Text style={styles.replyCardOfferText}>{deliveryTime}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── Message body ── */}
      {replyMessage ? (
        <View style={styles.replyCardMessage}>
          <Text style={styles.replyCardMessageText}>{replyMessage}</Text>
        </View>
      ) : null}

      {/* ── Action buttons: Message, Reply, Cancel ── */}
      <View style={styles.replyCardActions}>
        <TouchableOpacity
          style={[styles.replyCardBtn, styles.replyCardBtnOrange]}
          onPress={onMessage}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-outline" size={14} color="#FFF" />
          <Text style={styles.replyCardBtnText}>Message</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.replyCardBtn, styles.replyCardBtnOrange]}
          onPress={onReply}
          activeOpacity={0.8}
        >
          <Ionicons name="return-down-forward-outline" size={14} color="#FFF" />
          <Text style={styles.replyCardBtnText}>Reply</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.replyCardBtn, styles.replyCardBtnRed]}
          onPress={() => {
            Alert.alert(
              'Cancel this enquiry?',
              'This enquiry will be marked as Cancelled.',
              [
                { text: 'Keep', style: 'cancel' },
                { text: 'Cancel', style: 'destructive', onPress: async () => {
                  try {
                    await enquiryService.update(enquiryId, { status: 'Cancelled' });
                    Alert.alert('Cancelled', 'Enquiry cancelled.');
                  } catch (err) {
                    Alert.alert('Error', err.message || 'Could not cancel.');
                  }
                }}
              ]
            );
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="close-circle-outline" size={14} color="#FFF" />
          <Text style={styles.replyCardBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Field renders its own TextInput (parity with the retailer's Field helper) so
// the inline reply form can declare label + value + onChangeText in one line.
const Field = ({ label, ...rest }) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.fieldInput, rest.multiline && styles.fieldInputMulti]}
      placeholderTextColor={theme.colors.textDisabled}
      multiline={!!rest.multiline}
      {...rest}
    />
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  // Reusable flex:1 for the KeyboardAvoidingView wrappers (main scroll + modals).
  flex: { flex: 1 },
  scrollArea: { flex: 1, backgroundColor: theme.colors.background },
  // Generous bottom padding leaves the reply SEND button clear of the keyboard.
  scroll: { padding: 16, paddingBottom: 120 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },
  retryText: { fontSize: 14, color: theme.colors.primary, fontWeight: '700' },

  /* ── TopBar ── */
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8, paddingTop: 8, paddingBottom: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontSize: 17, color: '#FFF', fontWeight: '700', flex: 1, textAlign: 'center' },

  /* ── Section ── */
  sub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  quotePrice: { fontSize: 18, fontWeight: '800', color: theme.colors.success },

  /* ── Reply box ── */
  replyBox: {
    backgroundColor: '#E8F5E9', borderRadius: 8, padding: 10, marginTop: 8,
  },
  replyLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.success, marginBottom: 4 },
  replyText: { fontSize: 13, color: theme.colors.textPrimary },

  /* ── Offers ── */
  offerCard: {
    backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, marginTop: 8,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  offerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  offerPrice: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  offerStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#FEF3C7' },
  offerAccepted: { backgroundColor: '#DCFCE7' },
  offerRejected: { backgroundColor: '#FEE2E2' },
  offerStatusText: { fontSize: 9.5, fontWeight: '700', color: '#92400E' },
  offerMeta: { fontSize: 11.5, color: theme.colors.textSecondary, marginTop: 4 },
  offerNotes: { fontSize: 12, color: theme.colors.textPrimary, marginTop: 4, fontStyle: 'italic' },

  /* ── Meta row ── */
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  metaStatusChip: {
    backgroundColor: theme.colors.primary + '22',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
  },
  statusText: { color: theme.colors.primary, fontWeight: '700', fontSize: 12 },

  /* ── Inline error ── */
  inlineError: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    backgroundColor: '#FEF2F2', borderRadius: 8, padding: 8, marginBottom: 10,
  },
  inlineErrorText: { fontSize: 12, color: theme.colors.danger, flex: 1 },

  /* ── Actions ── */
  actionsCard: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginTop: 10,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 }, shadowRadius: 4,
  },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
    backgroundColor: theme.colors.primary,
  },
  statusConfirmed: { backgroundColor: theme.colors.success },
  statusCancelled: { backgroundColor: theme.colors.danger },
  statusBtnText: { color: '#FFF', fontWeight: '600', fontSize: 13 },

  /* ── Reply form fields (parity with the retailer's Field helper) ── */
  fieldWrap: { marginTop: 14 },
  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: theme.colors.background, borderRadius: 8,
    borderWidth: 1.5, borderColor: theme.colors.border,
    paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14, color: theme.colors.textPrimary, minHeight: 46,
  },
  fieldInputMulti: { minHeight: 80, textAlignVertical: 'top' },

  /* ── Chat bubbles ── */
  threadEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  threadEmptyText: { fontSize: 13, color: theme.colors.textDisabled, textAlign: 'center' },
  bubble: { maxWidth: '82%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  bubbleMine: { backgroundColor: theme.colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#EEF1F6', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 13.5, color: theme.colors.textPrimary, lineHeight: 19 },
  bubbleTextMine: { color: '#FFF' },
  bubbleTime: { fontSize: 10, color: theme.colors.textSecondary, marginTop: 3 },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },
  msgSendDisabled: { opacity: 0.5 },

  /* ── CRM-style detail card (parity with the retailer EnquiryDetailsScreen) ── */
  detailCard: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14 },
  detailCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14,
    backgroundColor: '#f97316',
  },
  detailCardLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  detailCardCode:  { fontSize: 15, fontWeight: '800', color: '#fff' },
  detailCardDate:  { fontSize: 11, color: 'rgba(255,255,255,0.85)' },
  statusChip: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  detailSection: { padding: 14, borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#fff' },
  detailSectionLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  detailSenderName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  detailContact: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailContactText: { fontSize: 12, color: '#64748b' },
  sentToHint: { fontSize: 11, color: '#f97316', fontWeight: '700', marginTop: 6 },
  detailFieldLabel: { fontSize: 10, color: '#94a3b8', marginBottom: 3 },
  detailFieldValue: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  specsBox: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  specItem: { flexDirection: 'row', width: '50%', marginBottom: 4 },
  specLabel: { fontSize: 12, color: '#94a3b8' },
  specValue: { fontSize: 12, fontWeight: '600', color: '#334155', flex: 1 },

  /* ── CRM-style 3-button action row (parity with the retailer) ──
     Three equal buttons, orange for the two "do something" actions and red for
     the destructive one, with an outline-only treatment when Cancel is
     unavailable because the enquiry is already Confirmed/Cancelled. */
  crmActions: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  crmBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 11, borderRadius: 8,
  },
  crmBtnOrange: { backgroundColor: theme.colors.accent },
  crmBtnRed: { backgroundColor: '#ef4444' },
  crmBtnDisabled: { backgroundColor: theme.colors.accent, opacity: 0.45 },
  crmBtnDisabledRed: { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#ef4444' },
  crmBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },

  /* ── Inline Message / Reply panels (parity with the retailer) ── */
  inlinePanel: { borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: '#f97316', marginBottom: 14 },
  inlinePanelHeader: { backgroundColor: '#f97316', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  inlinePanelTitle: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 13 },
  inlineChatBody: { minHeight: 180, maxHeight: 260, backgroundColor: '#f8fafc' },
  // Padding lives on the CONTENT so the inner scroll can breathe (a ScrollView's
  // own padding is applied outside the scrollable area and would clip bubbles).
  inlineChatBodyContent: { padding: 12, flexGrow: 1 },
  inlineChatInput: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, backgroundColor: theme.colors.background },
  inlineMsgInput: { flex: 1, backgroundColor: '#FFF', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, fontSize: 14, color: theme.colors.textPrimary, maxHeight: 80, borderWidth: 1, borderColor: theme.colors.border },
  inlineSendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },

  /* Status-transition block, shown BELOW the action row for manual enquiries. */
  statusCard: { marginTop: 0 },
  statusCardLabel: {
    fontSize: 10, fontWeight: '800', color: theme.colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },

  /* ── Section (generic) ── */
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 13, fontWeight: '800', color: theme.colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  sectionContent: { gap: 10 },

  /* ── Reply card ── */
  replyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  replyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  replyCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  replyCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  replyCardInfoText: {
    fontSize: 11,
    color: theme.colors.textDisabled,
  },
  replyCardTime: {
    fontSize: 10,
    color: theme.colors.textDisabled,
    marginTop: 4,
  },
  replyCardStatusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  replyCardStatusChipGreen: { backgroundColor: '#DCFCE7' },
  replyCardStatusChipRed:   { backgroundColor: '#FEE2E2' },
  replyCardStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  replyCardStatusTextGreen: { color: '#16a34a' },
  replyCardStatusTextRed:   { color: '#DC2626' },
  replyCardOffer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  replyCardOfferItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  replyCardPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  replyCardOfferText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  replyCardMessage: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  replyCardMessageText: {
    fontSize: 13,
    color: theme.colors.textPrimary,
    lineHeight: 18,
  },
  replyCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  replyCardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  replyCardBtnOrange: {
    backgroundColor: theme.colors.accent,
  },
  replyCardBtnRed: {
    backgroundColor: '#ef4444',
  },
  replyCardBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
});
