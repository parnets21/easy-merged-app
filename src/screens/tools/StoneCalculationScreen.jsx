// src/screens/tools/StoneCalculationScreen.jsx
//
// Stone Calculation tool (mobile).
// Distinct mobile-native design (not a copy of the CRM web layout):
//   • Product select = full-width gradient-accent rows
//   • Sheets = receipt/ticket cards with a colored side stripe + big total badge
//   • Rows = per-row cards (L × W → area chip), not a spreadsheet grid
//   • In-app calendar date picker (no extra library)
//
// Real calc: convert L & W to the OUTPUT unit, then multiply.
//   122 in × 38 in → feet = 10.16667 × 3.16667 = 32.1944 ft²
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Share from 'react-native-share';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { theme } from '../../utils/theme';
import { stoneService } from '../../services/stoneService';
import {
  UNITS, AREA_SYMBOL, unitLabel, rowArea, sumArea, fmtArea,
  STONE_PRODUCTS, productMeta,
} from '../../utils/stoneCalc';

const NAVY   = theme.colors.primary;      // #01152D
const ORANGE = theme.colors.accent;       // #FD5C02
const ORANGE_LT = theme.colors.accentLight;
const BG     = '#EEF1F6';
const WHITE  = '#FFFFFF';
const TEXT   = '#0F1729';
const MUTED  = '#64748B';
const BORDER = '#E2E8F0';

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/* ═══════════════════════════════════════════════════════════ */
export default function StoneCalculationScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [view, setView]     = useState('list');
  const [sheets, setSheets] = useState([]);
  const [active, setActive] = useState(null);
  const [search, setSearch] = useState('');
  const [newFor, setNewFor] = useState(null);

  const refresh = useCallback(async () => {
    setSheets(await stoneService.list());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sheets;
    return sheets.filter(s =>
      (s.party || '').toLowerCase().includes(q) ||
      (s.name || '').toLowerCase().includes(q) ||
      (s.product || '').toLowerCase().includes(q),
    );
  }, [sheets, search]);

  const openNew  = (sheet) => { setActive(sheet); setView('edit'); };
  const openEdit = (sheet) => { setActive(sheet); setView('edit'); };
  const openView = (sheet) => { setActive(sheet); setView('view'); };

  const handleDelete = (sheet) => {
    Alert.alert(
      'Delete Sheet',
      `Delete "${sheet.party}" (${productMeta(sheet.product).label})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => { await stoneService.remove(sheet.id); refresh(); } },
      ],
    );
  };

  const handleShare = async (sheet) => {
    const meta = productMeta(sheet.product);
    const lines = [
      `${sheet.party} — ${meta.label}${sheet.name ? ` (${sheet.name})` : ''}`,
      `Date: ${fmtDate(sheet.date)}`,
      '',
      ...sheet.rows.map((r, i) =>
        `${i + 1}. ${r.length} x ${r.width} = ${fmtArea(rowArea(r.length, r.width, sheet.inputUnit, sheet.outputUnit))} ${AREA_SYMBOL[sheet.outputUnit]}`),
      '',
      `Total: ${fmtArea(sheet.total)} ${AREA_SYMBOL[sheet.outputUnit]}`,
    ];
    try { await Share.open({ title: 'Stone Sheet', message: lines.join('\n') }); } catch {}
  };

  const totalArea = sheets.reduce((a, s) => a + (Number(s.total) || 0), 0);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerGlow} />
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => (view === 'list' ? navigation.goBack() : (setView('list'), refresh()))}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerKicker}>TOOLS</Text>
            <Text style={styles.headerTitle}>Stone Calculator</Text>
          </View>
          <View style={styles.headerBadge}>
            <Icon name="ruler-square" size={20} color={ORANGE} />
          </View>
        </View>

        {view === 'list' && (
          <View style={styles.headerStat}>
            <View style={styles.headerStatItem}>
              <Text style={styles.headerStatValue}>{sheets.length}</Text>
              <Text style={styles.headerStatLabel}>Sheets</Text>
            </View>
            <View style={styles.headerStatDivider} />
            <View style={styles.headerStatItem}>
              <Text style={styles.headerStatValue}>{fmtArea(totalArea, 2)}</Text>
              <Text style={styles.headerStatLabel}>Total Area</Text>
            </View>
          </View>
        )}
      </View>

      {view === 'list' && (
        <ListView
          sheets={filtered}
          search={search} setSearch={setSearch}
          onNew={setNewFor}
          onView={openView} onEdit={openEdit}
          onDelete={handleDelete} onShare={handleShare}
        />
      )}

      {view === 'edit' && active && (
        <EditView sheet={active} onSaved={() => { refresh(); setView('list'); }} />
      )}

      {view === 'view' && active && (
        <SheetView sheet={active} onShare={() => handleShare(active)} onEdit={() => openEdit(active)} />
      )}

      <NewSheetModal
        productKey={newFor}
        onClose={() => setNewFor(null)}
        onCreate={(sheet) => { setNewFor(null); openNew(sheet); }}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════
   LIST VIEW
═══════════════════════════════════════════════════════════ */
function ListView({ sheets, search, setSearch, onNew, onView, onEdit, onDelete, onShare }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      {/* Product select — full-width accent rows */}
      <Text style={styles.blockTitle}>Start a New Sheet</Text>
      <View style={{ gap: 10, marginBottom: 24 }}>
        {STONE_PRODUCTS.map(p => (
          <TouchableOpacity key={p.key} activeOpacity={0.85} onPress={() => onNew(p.key)} style={styles.productRow}>
            <View style={[styles.productStripe, { backgroundColor: p.color }]} />
            <View style={[styles.productIcon, { backgroundColor: p.bg }]}>
              <Icon name={p.icon} size={24} color={p.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName}>{p.label}</Text>
              <Text style={styles.productHint}>Tap to create a {p.label.toLowerCase()} sheet</Text>
            </View>
            <View style={[styles.productPlus, { backgroundColor: p.color }]}>
              <Icon name="plus" size={18} color="#fff" />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* My Sheets */}
      <Text style={styles.blockTitle}>My Sheets</Text>
      <View style={styles.searchBox}>
        <Icon name="magnify" size={18} color={MUTED} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search customer or product…"
          placeholderTextColor={MUTED}
        />
      </View>

      {sheets.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Icon name="file-document-outline" size={34} color={ORANGE} />
          </View>
          <Text style={styles.emptyTitle}>No sheets yet</Text>
          <Text style={styles.emptyText}>Pick a product above to create your first measurement sheet.</Text>
        </View>
      ) : (
        sheets.map(s => {
          const meta = productMeta(s.product);
          return (
            <View key={s.id} style={styles.ticket}>
              <View style={[styles.ticketStripe, { backgroundColor: meta.color }]} />
              <View style={{ flex: 1, padding: 14 }}>
                <View style={styles.ticketTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ticketParty} numberOfLines={1}>{s.party || '—'}</Text>
                    <View style={styles.ticketTagRow}>
                      <View style={[styles.ticketTag, { backgroundColor: meta.bg }]}>
                        <Icon name={meta.icon} size={12} color={meta.color} />
                        <Text style={[styles.ticketTagText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                      {!!s.name && <Text style={styles.ticketName} numberOfLines={1}>{s.name}</Text>}
                    </View>
                  </View>
                  <View style={styles.ticketTotalBox}>
                    <Text style={styles.ticketTotal}>{fmtArea(s.total, 2)}</Text>
                    <Text style={styles.ticketUnit}>{AREA_SYMBOL[s.outputUnit]}</Text>
                  </View>
                </View>

                <View style={styles.ticketMetaRow}>
                  <Icon name="calendar-blank-outline" size={12} color={MUTED} />
                  <Text style={styles.ticketDate}>{fmtDate(s.date)}</Text>
                  <View style={styles.metaDot} />
                  <Icon name="table-row" size={12} color={MUTED} />
                  <Text style={styles.ticketDate}>{s.rows.length} rows</Text>
                </View>

                <View style={styles.ticketActions}>
                  <TouchableOpacity style={styles.ticketBtn} onPress={() => onView(s)}>
                    <Icon name="eye-outline" size={16} color="#2563EB" />
                    <Text style={[styles.ticketBtnText, { color: '#2563EB' }]}>View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ticketBtn} onPress={() => onEdit(s)}>
                    <Icon name="pencil-outline" size={16} color="#059669" />
                    <Text style={[styles.ticketBtnText, { color: '#059669' }]}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ticketBtn} onPress={() => onShare(s)}>
                    <Icon name="share-variant" size={16} color={NAVY} />
                    <Text style={[styles.ticketBtnText, { color: NAVY }]}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ticketBtn} onPress={() => onDelete(s)}>
                    <Icon name="trash-can-outline" size={16} color="#DC2626" />
                    <Text style={[styles.ticketBtnText, { color: '#DC2626' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

/* ═══════════════════════════════════════════════════════════
   CALENDAR PICKER — self-contained month grid (no extra libs)
═══════════════════════════════════════════════════════════ */
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const toISO = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

function CalendarPicker({ visible, value, onClose, onSelect }) {
  const init = value ? new Date(value) : new Date();
  const safe = isNaN(init) ? new Date() : init;
  const [vy, setVy] = useState(safe.getFullYear());
  const [vm, setVm] = useState(safe.getMonth());

  useEffect(() => {
    if (visible) {
      const d = value ? new Date(value) : new Date();
      const s = isNaN(d) ? new Date() : d;
      setVy(s.getFullYear()); setVm(s.getMonth());
    }
  }, [visible, value]);

  const firstDay = new Date(vy, vm, 1).getDay();
  const days = new Date(vy, vm + 1, 0).getDate();
  const todayIso = todayISO();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);

  const prev = () => (vm === 0 ? (setVm(11), setVy(y => y - 1)) : setVm(m => m - 1));
  const next = () => (vm === 11 ? (setVm(0), setVy(y => y + 1)) : setVm(m => m + 1));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.calCard} onPress={() => {}}>
          <View style={styles.calHeader}>
            <TouchableOpacity style={styles.calNavBtn} onPress={prev} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="chevron-left" size={22} color={NAVY} />
            </TouchableOpacity>
            <Text style={styles.calTitle}>{MONTHS[vm]} {vy}</Text>
            <TouchableOpacity style={styles.calNavBtn} onPress={next} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="chevron-right" size={22} color={NAVY} />
            </TouchableOpacity>
          </View>
          <View style={styles.calWeekRow}>
            {WEEKDAYS.map(w => <Text key={w} style={styles.calWeekday}>{w}</Text>)}
          </View>
          <View style={styles.calGrid}>
            {cells.map((d, i) => {
              if (d === null) return <View key={`b${i}`} style={styles.calCell} />;
              const iso = toISO(vy, vm, d);
              const selected = iso === value;
              const isToday = iso === todayIso;
              return (
                <TouchableOpacity key={iso} style={styles.calCell} onPress={() => onSelect(iso)} activeOpacity={0.7}>
                  <View style={[styles.calDay, isToday && !selected && styles.calDayToday, selected && styles.calDaySelected]}>
                    <Text style={[styles.calDayText, isToday && !selected && { color: ORANGE, fontWeight: '800' }, selected && { color: '#fff', fontWeight: '800' }]}>{d}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.calFooter}>
            <TouchableOpacity onPress={() => onSelect(todayIso)}><Text style={styles.calTodayLink}>Today</Text></TouchableOpacity>
            <TouchableOpacity onPress={onClose}><Text style={styles.calCloseLink}>Close</Text></TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════
   NEW SHEET MODAL
═══════════════════════════════════════════════════════════ */
function NewSheetModal({ productKey, onClose, onCreate }) {
  const meta = productKey ? productMeta(productKey) : null;
  const [name, setName]   = useState('');
  const [party, setParty] = useState('');
  const [date, setDate]   = useState(todayISO());
  const [rows, setRows]   = useState('1');
  const [err, setErr]     = useState('');
  const [showCal, setShowCal] = useState(false);

  useEffect(() => {
    if (productKey) { setName(''); setParty(''); setDate(todayISO()); setRows('1'); setErr(''); setShowCal(false); }
  }, [productKey]);

  const create = () => {
    if (!name.trim())  return setErr(`${meta.label} name is required`);
    if (!party.trim()) return setErr('Party name is required');
    if (!date.trim())  return setErr('Please choose a date');
    const n = Math.max(1, Math.min(200, parseInt(rows, 10) || 1));
    onCreate({
      id: null, product: productKey, name: name.trim(), party: party.trim(), date: date.trim(),
      inputUnit: 'inch', outputUnit: 'feet',
      rows: Array.from({ length: n }, () => ({ length: '', width: '' })), total: 0,
    });
  };

  return (
    <Modal visible={!!productKey} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.centerOverlay} onPress={onClose}>
          <Pressable style={styles.centerCard} onPress={() => {}}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 20 }}
            >
              <View style={styles.modalHeader}>
                {meta && (
                  <View style={[styles.modalIconLg, { backgroundColor: meta.bg }]}>
                    <Icon name={meta.icon} size={24} color={meta.color} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>New {meta?.label} Sheet</Text>
                  <Text style={styles.modalSub}>Enter the sheet details</Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Icon name="close" size={22} color={MUTED} />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>{meta?.label} Name *</Text>
              <TextInput style={styles.input} value={name} onChangeText={t => { setName(t); setErr(''); }} placeholder="e.g. Kajria" placeholderTextColor={MUTED} returnKeyType="next" />

              <Text style={styles.fieldLabel}>Party Name *</Text>
              <TextInput style={styles.input} value={party} onChangeText={t => { setParty(t); setErr(''); }} placeholder="e.g. Shubham" placeholderTextColor={MUTED} returnKeyType="next" />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1.3 }}>
                  <Text style={styles.fieldLabel}>Choose Date *</Text>
                  <TouchableOpacity style={styles.dateField} activeOpacity={0.7} onPress={() => setShowCal(true)}>
                    <Icon name="calendar-month-outline" size={18} color={ORANGE} />
                    <Text style={styles.dateFieldText}>{fmtDate(date)}</Text>
                    <Icon name="chevron-down" size={18} color={MUTED} />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Rows</Text>
                  <TextInput style={styles.input} value={rows} onChangeText={t => setRows(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="1" placeholderTextColor={MUTED} />
                </View>
              </View>

              {!!err && <Text style={styles.errText}>{err}</Text>}

              <View style={styles.modalBtnRow}>
                <TouchableOpacity style={styles.btnGhost} onPress={onClose}>
                  <Text style={styles.btnGhostText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnPrimary} onPress={create}>
                  <Icon name="arrow-right" size={17} color="#fff" />
                  <Text style={styles.btnPrimaryText}>Create Sheet</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <CalendarPicker
              visible={showCal}
              value={date}
              onClose={() => setShowCal(false)}
              onSelect={(iso) => { setDate(iso); setErr(''); setShowCal(false); }}
            />
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════
   EDIT VIEW — per-row cards (not a spreadsheet)
═══════════════════════════════════════════════════════════ */
function EditView({ sheet, onSaved }) {
  const insets = useSafeAreaInsets();
  const meta = productMeta(sheet.product);
  const [rows, setRows]           = useState(sheet.rows.length ? sheet.rows : [{ length: '', width: '' }]);
  const [inputUnit, setInputUnit] = useState(sheet.inputUnit || 'inch');
  const [outputUnit, setOutput]   = useState(sheet.outputUnit || 'feet');
  const [saving, setSaving]       = useState(false);
  const [pickerFor, setPickerFor] = useState(null);

  const sym = AREA_SYMBOL[outputUnit];
  const total = useMemo(() => sumArea(rows, inputUnit, outputUnit), [rows, inputUnit, outputUnit]);

  const setCell = (i, field, val) => setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  const addRow = () => setRows(rs => [...rs, { length: '', width: '' }]);
  const removeRow = (i) => setRows(rs => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs));
  const copyPrevious = () => setRows(rs => rs.map((r, i) => {
    if (i === 0) return r;
    const prev = rs[i - 1];
    return { ...r, length: r.length === '' ? prev.length : r.length, width: r.width === '' ? prev.width : r.width };
  }));

  const save = async () => {
    setSaving(true);
    const payload = { product: sheet.product, name: sheet.name, party: sheet.party, date: sheet.date, inputUnit, outputUnit, rows, total };
    if (sheet.id) await stoneService.update(sheet.id, payload);
    else          await stoneService.create(payload);
    setSaving(false);
    onSaved();
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 200 + insets.bottom }} showsVerticalScrollIndicator={false}>
        {/* sheet meta banner */}
        <View style={styles.editBanner}>
          <View style={[styles.modalIconLg, { backgroundColor: meta.bg }]}>
            <Icon name={meta.icon} size={22} color={meta.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.editParty}>{sheet.party}</Text>
            <Text style={styles.editSub}>{sheet.name} · {meta.label} · {fmtDate(sheet.date)}</Text>
          </View>
        </View>

        {/* units */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <UnitField label="Input unit"  value={inputUnit}  accent={NAVY}   onPress={() => setPickerFor('input')} />
          <UnitField label="Output unit" value={outputUnit} accent={ORANGE} onPress={() => setPickerFor('output')} />
        </View>

        {/* per-row cards */}
        {rows.map((r, i) => {
          const area = rowArea(r.length, r.width, inputUnit, outputUnit);
          return (
            <View key={i} style={styles.rowCard}>
              <View style={styles.rowNum}><Text style={styles.rowNumText}>{i + 1}</Text></View>
              <View style={styles.rowInputWrap}>
                <Text style={styles.rowFieldLabel}>L</Text>
                <TextInput style={styles.rowInput} value={String(r.length)} onChangeText={t => setCell(i, 'length', t.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#CBD5E1" />
              </View>
              <Icon name="close" size={13} color="#CBD5E1" />
              <View style={styles.rowInputWrap}>
                <Text style={styles.rowFieldLabel}>W</Text>
                <TextInput style={styles.rowInput} value={String(r.width)} onChangeText={t => setCell(i, 'width', t.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#CBD5E1" />
              </View>
              <View style={styles.rowAreaChip}>
                <Text style={styles.rowAreaText}>{area ? fmtArea(area, 2) : '—'}</Text>
                <Text style={styles.rowAreaUnit}>{sym}</Text>
              </View>
              <TouchableOpacity onPress={() => removeRow(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="close-circle" size={18} color="#E2E8F0" />
              </TouchableOpacity>
            </View>
          );
        })}

        {/* add / copy */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
          <TouchableOpacity style={styles.dashBtn} onPress={addRow}>
            <Icon name="plus" size={16} color={ORANGE} />
            <Text style={styles.dashBtnText}>Add Row</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dashBtn} onPress={copyPrevious}>
            <Icon name="content-copy" size={15} color={ORANGE} />
            <Text style={styles.dashBtnText}>Copy Previous</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* sticky footer: total + save */}
      <View style={[styles.stickyFooter, { paddingBottom: 14 + insets.bottom }]}>
        <View>
          <Text style={styles.footerLabel}>Sum Total</Text>
          <Text style={styles.footerTotal}>{fmtArea(total, 2)} <Text style={styles.footerUnit}>{sym}</Text></Text>
        </View>
        <TouchableOpacity style={[styles.footerSave, saving && { opacity: 0.7 }]} onPress={save} disabled={saving}>
          <Icon name="content-save-outline" size={18} color="#fff" />
          <Text style={styles.footerSaveText}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      {/* unit picker */}
      <Modal visible={!!pickerFor} transparent animationType="fade" onRequestClose={() => setPickerFor(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPickerFor(null)}>
          <Pressable style={styles.calCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{pickerFor === 'input' ? 'Input Unit' : 'Output Unit'}</Text>
            {UNITS.map(u => {
              const selected = (pickerFor === 'input' ? inputUnit : outputUnit) === u.key;
              return (
                <TouchableOpacity key={u.key} style={[styles.pickerRow, selected && { backgroundColor: ORANGE_LT }]} onPress={() => {
                  if (pickerFor === 'input') setInputUnit(u.key); else setOutput(u.key);
                  setPickerFor(null);
                }}>
                  <Text style={[styles.pickerText, selected && { color: ORANGE, fontWeight: '800' }]}>{u.label}</Text>
                  {selected && <Icon name="check" size={18} color={ORANGE} />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function UnitField({ label, value, accent, onPress }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity style={[styles.unitSelect, { borderColor: accent + '55' }]} onPress={onPress} activeOpacity={0.7}>
        <Text style={[styles.unitSelectText, { color: accent }]}>{unitLabel(value)}</Text>
        <Icon name="chevron-down" size={18} color={accent} />
      </TouchableOpacity>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════
   SHEET VIEW — read-only
═══════════════════════════════════════════════════════════ */
function SheetView({ sheet, onShare, onEdit }) {
  const insets = useSafeAreaInsets();
  const meta = productMeta(sheet.product);
  const sym = AREA_SYMBOL[sheet.outputUnit];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={styles.editBanner}>
          <View style={[styles.modalIconLg, { backgroundColor: meta.bg }]}>
            <Icon name={meta.icon} size={22} color={meta.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.editParty}>{sheet.party}</Text>
            <Text style={styles.editSub}>{sheet.name} · {meta.label} · {fmtDate(sheet.date)}</Text>
            <Text style={styles.editSub}>Input {unitLabel(sheet.inputUnit)} → Output {unitLabel(sheet.outputUnit)}</Text>
          </View>
        </View>

        {sheet.rows.map((r, i) => {
          const area = rowArea(r.length, r.width, sheet.inputUnit, sheet.outputUnit);
          return (
            <View key={i} style={styles.viewRow}>
              <View style={styles.rowNum}><Text style={styles.rowNumText}>{i + 1}</Text></View>
              <Text style={styles.viewDim}>{r.length} <Text style={styles.viewX}>×</Text> {r.width}</Text>
              <View style={styles.rowAreaChip}>
                <Text style={styles.rowAreaText}>{fmtArea(area, 2)}</Text>
                <Text style={styles.rowAreaUnit}>{sym}</Text>
              </View>
            </View>
          );
        })}

        <View style={styles.viewTotalCard}>
          <Text style={styles.footerLabel}>Sum Total</Text>
          <Text style={styles.viewTotalValue}>{fmtArea(sheet.total, 2)} <Text style={styles.footerUnit}>{sym}</Text></Text>
        </View>
      </ScrollView>

      <View style={[styles.stickyFooter, { paddingBottom: 14 + insets.bottom }]}>
        <TouchableOpacity style={[styles.footerSave, { flex: 1, backgroundColor: NAVY, marginRight: 10 }]} onPress={onEdit}>
          <Icon name="pencil-outline" size={17} color="#fff" />
          <Text style={styles.footerSaveText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.footerSave, { flex: 1 }]} onPress={onShare}>
          <Icon name="share-variant" size={17} color="#fff" />
          <Text style={styles.footerSaveText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════ */
const SHADOW = { shadowColor: '#0F1729', shadowOpacity: 0.07, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 3 };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  /* header */
  header: {
    backgroundColor: NAVY, paddingBottom: 22, paddingHorizontal: 16,
    borderBottomLeftRadius: 26, borderBottomRightRadius: 26, overflow: 'hidden',
  },
  headerGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, right: -70, top: -90, backgroundColor: 'rgba(253,92,2,0.14)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  headerKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: ORANGE },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#fff', marginTop: 1 },
  headerBadge: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  headerStat: { flexDirection: 'row', alignItems: 'center', marginTop: 18, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 16, paddingVertical: 12 },
  headerStatItem: { flex: 1, alignItems: 'center' },
  headerStatValue: { fontSize: 20, fontWeight: '900', color: '#fff' },
  headerStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  headerStatDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.16)' },

  blockTitle: { fontSize: 14, fontWeight: '900', color: TEXT, marginBottom: 12, letterSpacing: 0.2 },

  /* product rows */
  productRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, borderRadius: 16, paddingVertical: 12, paddingRight: 12, overflow: 'hidden', ...SHADOW },
  productStripe: { width: 5, alignSelf: 'stretch', marginRight: 12 },
  productIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  productName: { fontSize: 16, fontWeight: '800', color: TEXT },
  productHint: { fontSize: 11.5, color: MUTED, marginTop: 2 },
  productPlus: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

  /* search */
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: WHITE, borderRadius: 12, paddingHorizontal: 12, height: 46, borderWidth: 1, borderColor: BORDER, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14, color: TEXT, padding: 0 },

  /* empty */
  empty: { alignItems: 'center', paddingVertical: 36 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: ORANGE_LT, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: TEXT, marginBottom: 5 },
  emptyText: { fontSize: 12.5, color: MUTED, textAlign: 'center', lineHeight: 18, paddingHorizontal: 30 },

  /* ticket */
  ticket: { flexDirection: 'row', backgroundColor: WHITE, borderRadius: 16, marginBottom: 12, overflow: 'hidden', ...SHADOW },
  ticketStripe: { width: 6 },
  ticketTop: { flexDirection: 'row', alignItems: 'flex-start' },
  ticketParty: { fontSize: 16, fontWeight: '900', color: TEXT },
  ticketTagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  ticketTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  ticketTagText: { fontSize: 11, fontWeight: '800' },
  ticketName: { fontSize: 12, color: MUTED, flexShrink: 1 },
  ticketTotalBox: { alignItems: 'flex-end', paddingLeft: 8 },
  ticketTotal: { fontSize: 20, fontWeight: '900', color: ORANGE },
  ticketUnit: { fontSize: 11, color: MUTED, marginTop: -2 },
  ticketMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  ticketDate: { fontSize: 11.5, color: MUTED },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#CBD5E1', marginHorizontal: 2 },
  ticketActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  ticketBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ticketBtnText: { fontSize: 12, fontWeight: '800' },

  /* modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,22,38,0.55)', justifyContent: 'center', padding: 20 },
  centerOverlay: { flex: 1, backgroundColor: 'rgba(15,22,38,0.55)', justifyContent: 'center', alignItems: 'center', padding: 18 },
  centerCard: { width: '100%', maxWidth: 460, maxHeight: '86%', backgroundColor: WHITE, borderRadius: 22, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  modalIconLg: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '900', color: TEXT },
  modalSub: { fontSize: 12, color: MUTED, marginTop: 1 },

  fieldLabel: { fontSize: 12, fontWeight: '800', color: MUTED, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 12, height: 48, fontSize: 14, color: TEXT },
  dateField: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 12, height: 48 },
  dateFieldText: { flex: 1, fontSize: 14, color: TEXT, fontWeight: '700' },
  errText: { color: '#DC2626', fontSize: 13, fontWeight: '600', marginTop: 12 },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnGhost: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: BORDER, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  btnGhostText: { fontSize: 14, fontWeight: '800', color: MUTED },
  btnPrimary: { flex: 1.4, height: 50, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  btnPrimaryText: { fontSize: 14, fontWeight: '900', color: '#fff' },

  /* edit banner */
  editBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: WHITE, borderRadius: 16, padding: 14, marginBottom: 16, ...SHADOW },
  editParty: { fontSize: 16, fontWeight: '900', color: TEXT },
  editSub: { fontSize: 12, color: MUTED, marginTop: 2 },

  /* unit select */
  unitSelect: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, height: 48 },
  unitSelectText: { fontSize: 14, fontWeight: '900' },

  /* row card */
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: WHITE, borderRadius: 14, padding: 10, marginBottom: 10, ...SHADOW },
  rowNum: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#EEF1F6', alignItems: 'center', justifyContent: 'center' },
  rowNumText: { fontSize: 12, fontWeight: '800', color: MUTED },
  rowInputWrap: { flex: 1, position: 'relative' },
  rowFieldLabel: { position: 'absolute', top: -7, left: 8, fontSize: 9, fontWeight: '800', color: '#94A3B8', backgroundColor: WHITE, paddingHorizontal: 3, zIndex: 1 },
  rowInput: { borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, height: 42, textAlign: 'center', fontSize: 15, fontWeight: '700', color: TEXT, backgroundColor: '#fff', padding: 0 },
  rowAreaChip: { minWidth: 62, alignItems: 'center', backgroundColor: ORANGE_LT, borderRadius: 10, paddingVertical: 5, paddingHorizontal: 6 },
  rowAreaText: { fontSize: 13.5, fontWeight: '900', color: ORANGE },
  rowAreaUnit: { fontSize: 9, color: '#B45309', marginTop: -1 },

  /* dashed add/copy */
  dashBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: ORANGE, borderStyle: 'dashed', backgroundColor: ORANGE_LT },
  dashBtnText: { fontSize: 13, fontWeight: '800', color: ORANGE },

  /* sticky footer */
  stickyFooter: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: WHITE, paddingHorizontal: 18, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: BORDER,
    shadowColor: '#0F1729', shadowOpacity: 0.1, shadowOffset: { width: 0, height: -4 }, shadowRadius: 12, elevation: 12,
  },
  footerLabel: { fontSize: 11, fontWeight: '700', color: MUTED },
  footerTotal: { fontSize: 22, fontWeight: '900', color: ORANGE, marginTop: 1 },
  footerUnit: { fontSize: 13, fontWeight: '700', color: MUTED },
  footerSave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: ORANGE, borderRadius: 14, paddingHorizontal: 26, height: 50 },
  footerSaveText: { fontSize: 15, fontWeight: '900', color: '#fff' },

  /* view rows */
  viewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: WHITE, borderRadius: 12, padding: 12, marginBottom: 8, ...SHADOW },
  viewDim: { flex: 1, fontSize: 15, fontWeight: '700', color: TEXT },
  viewX: { color: MUTED, fontWeight: '400' },
  viewTotalCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: NAVY, borderRadius: 16, padding: 16, marginTop: 8 },
  viewTotalValue: { fontSize: 22, fontWeight: '900', color: '#fff' },

  /* calendar + picker */
  calCard: { backgroundColor: WHITE, borderRadius: 18, padding: 16 },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  calNavBtn: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  calTitle: { fontSize: 16, fontWeight: '800', color: TEXT },
  calWeekRow: { flexDirection: 'row', marginBottom: 4 },
  calWeekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: MUTED },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  calDay: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  calDayToday: { borderWidth: 1.5, borderColor: ORANGE },
  calDaySelected: { backgroundColor: ORANGE },
  calDayText: { fontSize: 14, color: TEXT, fontWeight: '600' },
  calFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  calTodayLink: { fontSize: 14, fontWeight: '800', color: ORANGE },
  calCloseLink: { fontSize: 14, fontWeight: '700', color: MUTED },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 12, borderRadius: 10 },
  pickerText: { fontSize: 15, color: TEXT },
});
