import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import rawDb from './recipes.json';
import type { RecipeDatabase } from '../types/recipes';

const db = rawDb as RecipeDatabase;
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

describe('synced recipes.json integrity', () => {
  it('contains populated soup, food, chemistry recipes and distillations', () => {
    const soups = db.recipes.filter((r) => r.category === 'soup');
    const foods = db.recipes.filter((r) => r.category === 'food');
    const chems = db.recipes.filter((r) => r.category === 'chemistry');

    expect(soups.length).toBeGreaterThan(20);
    expect(foods.length).toBeGreaterThan(20);
    expect(chems.length).toBeGreaterThan(20);
    expect(db.distillationIds.length).toBeGreaterThanOrEqual(15);

    const rawDistillers = Object.values(db.items).filter(
      (i) => (i.distillsInto?.length ?? 0) > 0
    );
    expect(rawDistillers.length).toBeGreaterThan(20);

    for (const distId of db.distillationIds) {
      expect(db.items[distId], `Missing distillation item ${distId}`).toBeDefined();
      const hasRawSource = rawDistillers.some((raw) =>
        raw.distillsInto?.some((y) => y.distillationId === distId)
      );
      expect(hasRawSource, `Distillation ${distId} has no raw sources`).toBe(true);
    }
  });

  it('has valid item references for all recipe ingredients', () => {
    for (const recipe of db.recipes) {
      for (const ing of recipe.ingredients) {
        expect(db.items[ing.itemId], `Missing item ${ing.itemId} in ${recipe.id}`).toBeDefined();
      }
    }
  });

  it('has an existing local image file on disk for every recipe and item', () => {
    for (const recipe of db.recipes) {
      const full = path.join(PUBLIC_DIR, recipe.image);
      expect(fs.existsSync(full), `Missing recipe image: ${recipe.image}`).toBe(true);
    }
    for (const item of Object.values(db.items)) {
      const full = path.join(PUBLIC_DIR, item.image);
      expect(fs.existsSync(full), `Missing item image: ${item.image}`).toBe(true);
    }
  });

  it('populates effect or description on every recipe buff without duplicates', () => {
    const buffedRecipes = db.recipes.filter((r) => (r.stats.buffs?.length ?? 0) > 0);
    expect(buffedRecipes.length).toBeGreaterThan(50);

    for (const recipe of buffedRecipes) {
      const seen = new Set<string>();
      for (const buff of recipe.stats.buffs ?? []) {
        expect(
          Boolean(buff.effect || buff.description),
          `Missing effect/description on "${buff.name}" in ${recipe.id}`
        ).toBe(true);
        const norm = buff.name.replace(/\s*\((?:Buff|Debuff)\)\s*$/i, '').toLowerCase();
        expect(seen.has(norm), `Duplicate buff "${buff.name}" in ${recipe.id}`).toBe(false);
        seen.add(norm);
      }
    }

    const killerSoup = db.recipes.find((r) => r.id === 'soup-killer-soup');
    expect(killerSoup?.stats.buffs?.length).toBe(1);
    expect(killerSoup?.stats.buffs?.[0].name).toBe('Death');
    expect(killerSoup?.stats.buffs?.[0].isNegative).toBe(true);
  });

  it('classifies debuffs and positive buffs accurately', () => {
    const expectedNegative = new Set([
      'Sick',
      'Borborygmus',
      'Stinky',
      'Death',
      'Corrosive Flask',
      'Impending Doom',
    ]);
    const expectedPositive = new Set([
      'Slice of Home',
      'Big Brain',
      'Brain Freeze',
      'Sedentary Lifestyle',
      'Gourd Body',
    ]);

    for (const recipe of db.recipes) {
      for (const buff of recipe.stats.buffs ?? []) {
        if (expectedNegative.has(buff.name)) {
          expect(buff.isNegative, `${buff.name} in ${recipe.id} should be negative`).toBe(true);
        }
        if (expectedPositive.has(buff.name)) {
          expect(buff.isNegative, `${buff.name} in ${recipe.id} should be positive`).toBe(false);
        }
      }
    }
  });
});
