// src/services/stoneService.js
//
// "My Sheets" persistence for the Stone Calculation tool.
// Stored locally on the device (AsyncStorage) so it works fully offline.
//
// A sheet:
// {
//   id, product, name, party, date,
//   inputUnit, outputUnit,
//   rows: [{ length, width }],
//   total, createdAt, updatedAt,
// }
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@wholesaler_stone_sheets';

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function readAll() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function writeAll(list) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export const stoneService = {
  /** All sheets, newest first. */
  async list() {
    const list = await readAll();
    return list.sort(
      (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0),
    );
  },

  /** One sheet by id. */
  async get(id) {
    const list = await readAll();
    return list.find(s => s.id === id) || null;
  },

  /** Create a new sheet. */
  async create(data) {
    const now = new Date().toISOString();
    const sheet = { id: uid(), createdAt: now, updatedAt: now, ...data };
    const list = await readAll();
    list.push(sheet);
    await writeAll(list);
    return sheet;
  },

  /** Update an existing sheet. */
  async update(id, data) {
    const list = await readAll();
    const i = list.findIndex(s => s.id === id);
    if (i === -1) return null;
    list[i] = { ...list[i], ...data, updatedAt: new Date().toISOString() };
    await writeAll(list);
    return list[i];
  },

  /** Delete a sheet. */
  async remove(id) {
    const list = await readAll();
    await writeAll(list.filter(s => s.id !== id));
    return true;
  },
};
