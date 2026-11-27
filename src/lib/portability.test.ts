import { describe, expect, it } from 'vitest';
import rawDb from '../data/recipes.json';
import type { RecipeDatabase } from '../types/recipes';
import {
  buildExportJson,
  encodeShareCode,
  MAX_IMPORT_BYTES,
  mergePortableData,
  parsePortableData,
  PORTABLE_FORMAT_ID,
  PORTABLE_SCHEMA_VERSION,
  SHARE_CODE_PREFIX,
  type PortableData,
} from './portability';

const db = rawDb as unknown as RecipeDatabase;

describe('portability codec', () => {
  it('round-trips JSON backups including pantry, favorites, acquire, and customAcquire', () => {
    const sample: PortableData = {
      pantry: { salt: 3, potato: 12 },
      favorites: ['soup-bland-pea-soup', 'chem-speedy-tincture'],
      acquire: { honey: 2 },
      customAcquire: [
        { id: 'c1', name: 'Reinforced Hose — Sector 2', qty: 4 },
      ],
    };

    const json = buildExportJson(sample);
    const parsedJson = JSON.parse(json) as Record<string, unknown>;
    expect(parsedJson.format).toBe(PORTABLE_FORMAT_ID);
    expect(parsedJson.version).toBe(PORTABLE_SCHEMA_VERSION);

    const result = parsePortableData(json, db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toEqual(sample);
    expect(result.stats).toEqual({
      pantryCount: 2,
      favoriteCount: 2,
      acquireCount: 2,
      ignoredItems: 0,
      ignoredRecipes: 0,
    });
  });

  it('round-trips compact ABF1 share codes including Unicode custom items', () => {
    const sample: PortableData = {
      pantry: { 'canned-peas': 2, salt: 1 },
      favorites: ['soup-bland-pea-soup'],
      acquire: {},
      customAcquire: [{ id: 'c-uni', name: 'Café Mug ☕', qty: 2 }],
    };

    const code = encodeShareCode(sample);
    expect(code.startsWith(SHARE_CODE_PREFIX)).toBe(true);

    const result = parsePortableData(`  ${code}  `, db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.pantry).toEqual(sample.pantry);
    expect(result.data.favorites).toEqual(sample.favorites);
    expect(result.data.acquire).toEqual({});
    expect(result.data.customAcquire).toHaveLength(1);
    expect(result.data.customAcquire[0].name).toBe('Café Mug ☕');
    expect(result.data.customAcquire[0].qty).toBe(2);
  });

  it('rejects malformed, oversized, and unrecognized payloads', () => {
    expect(parsePortableData('   ', db).ok).toBe(false);
    expect(parsePortableData('not-json-or-code', db).ok).toBe(false);
    expect(parsePortableData('ABF1:!!!invalid!!!', db).ok).toBe(false);
    expect(
      parsePortableData(
        JSON.stringify({ format: 'other-app', version: 1, pantry: { salt: 1 } }),
        db
      ).ok
    ).toBe(false);
    expect(
      parsePortableData(
        JSON.stringify({
          format: PORTABLE_FORMAT_ID,
          version: 99,
          pantry: { salt: 1 },
        }),
        db
      ).ok
    ).toBe(false);
    expect(
      parsePortableData('x'.repeat(MAX_IMPORT_BYTES + 10), db).ok
    ).toBe(false);
  });

  it('sanitizes quantities, strips prototype keys, and reports unknown item/recipe IDs', () => {
    const rawJson = JSON.stringify({
      format: PORTABLE_FORMAT_ID,
      version: PORTABLE_SCHEMA_VERSION,
      pantry: {
        salt: 5000,
        potato: -3,
        'unknown-item-xyz': 4,
      },
      favorites: ['soup-bland-pea-soup', 'missing-recipe-id', '__proto__'],
      acquire: {
        honey: '2',
        'another-unknown-item': 1,
      },
      customAcquire: [],
    });

    const result = parsePortableData(rawJson, db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.pantry).toEqual({ salt: 999 });
    expect(result.data.favorites).toEqual(['soup-bland-pea-soup']);
    expect(result.data.acquire).toEqual({ honey: 2 });
    expect(result.stats.ignoredItems).toBe(2);
    expect(result.stats.ignoredRecipes).toBe(1);
  });

  it('merges data using Math.max on overlapping quantities and preserving unique favourites', () => {
    const current: PortableData = {
      pantry: { salt: 5, potato: 2 },
      favorites: ['soup-bland-pea-soup', 'chem-speedy-tincture'],
      acquire: { honey: 3 },
      customAcquire: [{ id: 'c1', name: 'Power Cell', qty: 1 }],
    };
    const incoming: PortableData = {
      pantry: { salt: 2, tomato: 4 },
      favorites: ['chem-speedy-tincture', 'food-baked-apple-pie'],
      acquire: { honey: 6, 'canned-peas': 1 },
      customAcquire: [
        { id: 'c-other', name: 'power   cell', qty: 4 },
        { id: 'c2', name: 'Stapler', qty: 2 },
      ],
    };

    const merged = mergePortableData(current, incoming);
    expect(merged.pantry).toEqual({ salt: 5, potato: 2, tomato: 4 });
    expect(merged.favorites).toEqual([
      'soup-bland-pea-soup',
      'chem-speedy-tincture',
      'food-baked-apple-pie',
    ]);
    expect(merged.acquire).toEqual({ honey: 6, 'canned-peas': 1 });
    expect(merged.customAcquire).toEqual([
      { id: 'c1', name: 'Power Cell', qty: 4 },
      { id: 'c2', name: 'Stapler', qty: 2 },
    ]);
  });
});
