import type { RecipeDatabase } from '../types/recipes';

export interface CustomAcquireItem {
  id: string;
  name: string;
  qty: number;
}

export const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
export const PORTABLE_FORMAT_ID = 'abiotic-compendium-backup' as const;
export const PORTABLE_SCHEMA_VERSION = 1 as const;
export const SHARE_CODE_PREFIX = 'ABF1:';
export const MAX_IMPORT_BYTES = 250_000;

export interface PortableData {
  pantry: Record<string, number>;
  favorites: string[];
  acquire: Record<string, number>;
  customAcquire: CustomAcquireItem[];
}

export interface PortablePayload extends PortableData {
  format: typeof PORTABLE_FORMAT_ID;
  version: typeof PORTABLE_SCHEMA_VERSION;
  exportedAt: string;
}

export interface PortableImportStats {
  pantryCount: number;
  favoriteCount: number;
  acquireCount: number;
  ignoredItems: number;
  ignoredRecipes: number;
}

export type ParsePortableResult =
  | {
      ok: true;
      data: PortableData;
      stats: PortableImportStats;
    }
  | {
      ok: false;
      error: string;
    };

export function clampQty(qty: number): number {
  if (!Number.isFinite(qty)) return 1;
  return Math.min(999, Math.max(1, Math.floor(qty)));
}

export function sanitizeItemMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const clean: Record<string, number> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!key || FORBIDDEN_KEYS.has(key)) continue;
    const num = typeof val === 'number' ? val : Number(val);
    if (!Number.isFinite(num) || num <= 0) continue;
    clean[key] = clampQty(num);
  }
  return clean;
}

export function sanitizeCustomAcquire(raw: unknown): CustomAcquireItem[] {
  if (!Array.isArray(raw)) return [];
  const clean: CustomAcquireItem[] = [];
  const seenIds = new Set<string>();
  for (const entry of raw) {
    if (clean.length >= 200) break;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') {
      continue;
    }
    const id = candidate.id.trim();
    if (!id || id.length > 64 || FORBIDDEN_KEYS.has(id) || seenIds.has(id)) {
      continue;
    }
    const name = candidate.name.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!name) continue;
    const num =
      typeof candidate.qty === 'number' ? candidate.qty : Number(candidate.qty);
    if (!Number.isFinite(num) || num <= 0) continue;
    seenIds.add(id);
    clean.push({
      id,
      name,
      qty: clampQty(num),
    });
  }
  return clean;
}

export function sanitizeFavorites(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const clean: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (clean.length >= 500) break;
    if (typeof entry !== 'string') continue;
    const id = entry.trim();
    if (!id || id.length > 100 || FORBIDDEN_KEYS.has(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    clean.push(id);
  }
  return clean;
}

function sanitizePortableData(data: PortableData): PortableData {
  return {
    pantry: sanitizeItemMap(data.pantry),
    favorites: sanitizeFavorites(data.favorites),
    acquire: sanitizeItemMap(data.acquire),
    customAcquire: sanitizeCustomAcquire(data.customAcquire),
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(encoded: string): Uint8Array {
  const standard = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (standard.length % 4)) % 4;
  const padded = standard + '='.repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function buildExportJson(data: PortableData): string {
  const clean = sanitizePortableData(data);
  const payload: PortablePayload = {
    format: PORTABLE_FORMAT_ID,
    version: PORTABLE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    ...clean,
  };
  return JSON.stringify(payload, null, 2);
}

export function encodeShareCode(data: PortableData): string {
  const clean = sanitizePortableData(data);
  const compact: {
    v: number;
    p?: Record<string, number>;
    f?: string[];
    a?: Record<string, number>;
    c?: [string, number][];
  } = { v: PORTABLE_SCHEMA_VERSION };

  if (Object.keys(clean.pantry).length > 0) {
    compact.p = clean.pantry;
  }
  if (clean.favorites.length > 0) {
    compact.f = clean.favorites;
  }
  if (Object.keys(clean.acquire).length > 0) {
    compact.a = clean.acquire;
  }
  if (clean.customAcquire.length > 0) {
    compact.c = clean.customAcquire.map((it) => [it.name, it.qty]);
  }

  const bytes = new TextEncoder().encode(JSON.stringify(compact));
  return `${SHARE_CODE_PREFIX}${toBase64Url(bytes)}`;
}

function filterKnownItems(
  map: Record<string, number>,
  db: RecipeDatabase
): { valid: Record<string, number>; ignoredCount: number } {
  const valid: Record<string, number> = {};
  let ignoredCount = 0;
  for (const [id, qty] of Object.entries(map)) {
    if (Object.prototype.hasOwnProperty.call(db.items, id)) {
      valid[id] = qty;
    } else {
      ignoredCount += 1;
    }
  }
  return { valid, ignoredCount };
}

export function parsePortableData(
  rawInput: string,
  db: RecipeDatabase
): ParsePortableResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: 'Paste an ABF1 share code or upload a .json backup file.',
    };
  }

  if (new TextEncoder().encode(trimmed).length > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      error: 'Import data exceeds the 250 KB size limit.',
    };
  }

  let rawPantry: unknown;
  let rawFavorites: unknown;
  let rawAcquire: unknown;
  let rawCustomAcquire: unknown;

  if (trimmed.startsWith(SHARE_CODE_PREFIX)) {
    const body = trimmed.slice(SHARE_CODE_PREFIX.length).replace(/\s+/g, '');
    if (!body || !/^[A-Za-z0-9_-]+$/.test(body)) {
      return {
        ok: false,
        error: 'Share code is malformed or truncated.',
      };
    }
    let decodedText = '';
    try {
      const bytes = fromBase64Url(body);
      decodedText = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return {
        ok: false,
        error: 'Could not decode share code. Make sure the full ABF1 code was copied.',
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(decodedText);
    } catch {
      return {
        ok: false,
        error: 'Share code payload is not valid JSON.',
      };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Share code payload has an invalid structure.' };
    }
    const obj = parsed as Record<string, unknown>;
    if (obj.v !== PORTABLE_SCHEMA_VERSION) {
      return {
        ok: false,
        error: `Unsupported share code version (${String(obj.v ?? 'unknown')}).`,
      };
    }

    rawPantry = obj.p;
    rawFavorites = obj.f;
    rawAcquire = obj.a;

    if (Array.isArray(obj.c)) {
      const customList: CustomAcquireItem[] = [];
      const seenNames = new Set<string>();
      for (let i = 0; i < obj.c.length && customList.length < 200; i++) {
        const pair = obj.c[i];
        if (!Array.isArray(pair) || pair.length < 2) continue;
        const rawName = pair[0];
        const rawQty = pair[1];
        if (typeof rawName !== 'string') continue;
        const cleanName = rawName.trim().replace(/\s+/g, ' ').slice(0, 80);
        if (!cleanName) continue;
        const lower = cleanName.toLowerCase();
        if (seenNames.has(lower)) continue;
        const num = typeof rawQty === 'number' ? rawQty : Number(rawQty);
        if (!Number.isFinite(num) || num <= 0) continue;
        seenNames.add(lower);
        customList.push({
          id: `custom-import-${i}-${Date.now().toString(36)}`,
          name: cleanName,
          qty: clampQty(num),
        });
      }
      rawCustomAcquire = customList;
    }
  } else {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return {
        ok: false,
        error: 'Invalid format. Expected an ABF1 share code or valid JSON backup.',
      };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Backup JSON must be an object.' };
    }
    const obj = parsed as Record<string, unknown>;

    if (obj.format !== undefined && obj.format !== PORTABLE_FORMAT_ID) {
      return {
        ok: false,
        error: `Unrecognized backup format "${String(obj.format)}".`,
      };
    }
    if (obj.version !== undefined && obj.version !== PORTABLE_SCHEMA_VERSION) {
      return {
        ok: false,
        error: `Unsupported backup version (${String(obj.version)}).`,
      };
    }

    const hasAnyKnownKey =
      'pantry' in obj ||
      'favorites' in obj ||
      'acquire' in obj ||
      'customAcquire' in obj;
    if (!hasAnyKnownKey) {
      return {
        ok: false,
        error: 'Backup JSON does not contain pantry, favorites, or acquire data.',
      };
    }

    rawPantry = obj.pantry;
    rawFavorites = obj.favorites;
    rawAcquire = obj.acquire;
    rawCustomAcquire = obj.customAcquire;
  }

  const sanitizedPantry = sanitizeItemMap(rawPantry);
  const sanitizedAcquire = sanitizeItemMap(rawAcquire);
  const sanitizedFavorites = sanitizeFavorites(rawFavorites);
  const sanitizedCustom = sanitizeCustomAcquire(rawCustomAcquire);

  const pantryFiltered = filterKnownItems(sanitizedPantry, db);
  const acquireFiltered = filterKnownItems(sanitizedAcquire, db);

  const validRecipeIds = new Set(db.recipes.map((r) => r.id));
  const validFavorites: string[] = [];
  let ignoredRecipes = 0;
  for (const id of sanitizedFavorites) {
    if (validRecipeIds.has(id)) {
      validFavorites.push(id);
    } else {
      ignoredRecipes += 1;
    }
  }

  const data: PortableData = {
    pantry: pantryFiltered.valid,
    favorites: validFavorites,
    acquire: acquireFiltered.valid,
    customAcquire: sanitizedCustom,
  };

  return {
    ok: true,
    data,
    stats: {
      pantryCount: Object.keys(data.pantry).length,
      favoriteCount: data.favorites.length,
      acquireCount: Object.keys(data.acquire).length + data.customAcquire.length,
      ignoredItems: pantryFiltered.ignoredCount + acquireFiltered.ignoredCount,
      ignoredRecipes,
    },
  };
}

export function mergePortableData(
  current: PortableData,
  incoming: PortableData
): PortableData {
  const pantry: Record<string, number> = { ...current.pantry };
  for (const [id, qty] of Object.entries(incoming.pantry)) {
    if (FORBIDDEN_KEYS.has(id)) continue;
    pantry[id] = clampQty(Math.max(pantry[id] ?? 0, qty));
  }

  const acquire: Record<string, number> = { ...current.acquire };
  for (const [id, qty] of Object.entries(incoming.acquire)) {
    if (FORBIDDEN_KEYS.has(id)) continue;
    acquire[id] = clampQty(Math.max(acquire[id] ?? 0, qty));
  }

  const favorites = [...current.favorites];
  const favSet = new Set(favorites);
  for (const id of incoming.favorites) {
    if (favorites.length >= 500) break;
    if (!favSet.has(id)) {
      favSet.add(id);
      favorites.push(id);
    }
  }

  const customAcquire: CustomAcquireItem[] = current.customAcquire.map((it) => ({
    ...it,
    name: it.name.trim().replace(/\s+/g, ' ').slice(0, 80),
  }));
  const seenIds = new Set(customAcquire.map((it) => it.id));
  const byLowerName = new Map<string, number>();
  customAcquire.forEach((it, idx) => {
    byLowerName.set(it.name.toLowerCase(), idx);
  });

  for (let i = 0; i < incoming.customAcquire.length; i++) {
    const inc = incoming.customAcquire[i];
    const cleanName = inc.name.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!cleanName) continue;
    const lower = cleanName.toLowerCase();
    const existingIdx = byLowerName.get(lower);
    if (existingIdx !== undefined) {
      customAcquire[existingIdx] = {
        ...customAcquire[existingIdx],
        qty: clampQty(Math.max(customAcquire[existingIdx].qty, inc.qty)),
      };
      continue;
    }
    if (customAcquire.length >= 200) break;
    let nextId = inc.id;
    if (!nextId || FORBIDDEN_KEYS.has(nextId) || seenIds.has(nextId)) {
      nextId = `custom-merge-${i}-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
    }
    seenIds.add(nextId);
    byLowerName.set(lower, customAcquire.length);
    customAcquire.push({
      id: nextId,
      name: cleanName,
      qty: clampQty(inc.qty),
    });
  }

  return {
    pantry,
    favorites,
    acquire,
    customAcquire,
  };
}

export function downloadJsonFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
