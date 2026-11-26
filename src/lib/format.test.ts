import { describe, expect, it } from 'vitest';
import type { Recipe } from '../types/recipes';
import { formatRecipeNotes, formatSignedStat, formatStatValue } from './format';

function makeRecipe(overrides: Partial<Recipe>): Recipe {
  return {
    id: 'test-recipe',
    name: 'Test Recipe',
    category: 'food',
    subcategory: 'other-food',
    workstation: 'Oven',
    image: '',
    wikiUrl: '',
    ingredients: [],
    stats: {},
    ...overrides,
  };
}

describe('stat formatting helpers', () => {
  it('rounds multi-decimal floats to at most 1 decimal place', () => {
    expect(formatStatValue(25.875)).toBe('25.9');
    expect(formatStatValue(26.26)).toBe('26.3');
    expect(formatStatValue(23)).toBe('23');
    expect(formatStatValue(32.5)).toBe('32.5');
    expect(formatStatValue(-5)).toBe('-5');
    expect(formatStatValue(-0.01)).toBe('0');
  });

  it('prefixes positive values with + in signed readouts', () => {
    expect(formatSignedStat(25.875)).toBe('+25.9');
    expect(formatSignedStat(0)).toBe('0');
    expect(formatSignedStat(-5)).toBe('-5');
  });
});

describe('formatRecipeNotes', () => {
  it('rewrites unsafe soup notes into clear standalone descriptions', () => {
    expect(formatRecipeNotes(makeRecipe({ id: 'soup-bad-soup', notes: 'raw' }))).toBe(
      'Any incompatible combination of edible ingredients (excluding toxic or killer contaminants).'
    );
    expect(formatRecipeNotes(makeRecipe({ id: 'soup-toxic-soup', notes: 'raw' }))).toBe(
      'Produced when boiling any toxic contaminant listed below in a Cooking Pot.'
    );
    expect(formatRecipeNotes(makeRecipe({ id: 'soup-killer-soup', notes: 'raw' }))).toBe(
      'Produced when boiling any lethal or inedible item listed below in a Cooking Pot.'
    );
  });

  it('prepends recipe name to fragmented "functions like a consumable" notes', () => {
    expect(
      formatRecipeNotes(
        makeRecipe({
          id: 'chem-mugnade',
          name: 'Coffee Mugnade',
          notes: 'functions like a consumable item when thrown.',
        })
      )
    ).toBe('Coffee Mugnade functions like a consumable item when thrown.');

    expect(
      formatRecipeNotes(
        makeRecipe({
          id: 'chem-tonic',
          name: 'Tonic',
          notes: 'Functions like a consumable with 3 charges.',
        })
      )
    ).toBe('Tonic Functions like a consumable with 3 charges.');
  });

  it('returns standard notes or undefined untouched', () => {
    expect(
      formatRecipeNotes(makeRecipe({ notes: 'Cook until golden brown.' }))
    ).toBe('Cook until golden brown.');
    expect(formatRecipeNotes(makeRecipe({ notes: undefined }))).toBeUndefined();
  });
});
