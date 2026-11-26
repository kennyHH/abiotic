import { describe, expect, it } from 'vitest';
import type { RecipeDatabase } from '../types/recipes';
import {
  evaluateRecipes,
  filterAndSortMatches,
  getAvailableDistillationsFromPantry,
} from './matcher';

const mockDb: RecipeDatabase = {
  syncedAt: '2026-11-24T00:00:00Z',
  source: 'https://abioticfactor.wiki.gg',
  distillationIds: [
    'vigorous-distillation',
    'fizzy-distillation',
    'void-distillation',
  ],
  items: {
    'super-tomato': {
      id: 'super-tomato',
      name: 'Super Tomato',
      image: 'images/items/super-tomato.png',
      wikiUrl: 'https://abioticfactor.wiki.gg/wiki/Super_Tomato',
      kind: 'raw',
      categoryTag: 'produce',
    },
    salt: {
      id: 'salt',
      name: 'Salt',
      image: 'images/items/salt.png',
      wikiUrl: 'https://abioticfactor.wiki.gg/wiki/Salt',
      kind: 'raw',
      categoryTag: 'packaged',
    },
    'raw-pest': {
      id: 'raw-pest',
      name: 'Raw Pest',
      image: 'images/items/raw-pest.png',
      wikiUrl: 'https://abioticfactor.wiki.gg/wiki/Raw_Pest',
      kind: 'raw',
      categoryTag: 'meat',
    },
    'raw-pest-rump': {
      id: 'raw-pest-rump',
      name: 'Raw Pest Rump',
      image: 'images/items/raw-pest-rump.png',
      wikiUrl: 'https://abioticfactor.wiki.gg/wiki/Raw_Pest_Rump',
      kind: 'raw',
      categoryTag: 'meat',
    },
    potato: {
      id: 'potato',
      name: 'Potato',
      image: 'images/items/potato.png',
      wikiUrl: 'https://abioticfactor.wiki.gg/wiki/Potato',
      kind: 'raw',
      categoryTag: 'produce',
      distillsInto: [{ distillationId: 'vigorous-distillation', amount: 3 }],
    },
    doznuts: {
      id: 'doznuts',
      name: 'Doznuts',
      image: 'images/items/doznuts.png',
      wikiUrl: 'https://abioticfactor.wiki.gg/wiki/Doznuts',
      kind: 'raw',
      categoryTag: 'packaged',
      distillsInto: [{ distillationId: 'fizzy-distillation', amount: 3 }],
    },
    anomaly: {
      id: 'anomaly',
      name: 'Anomaly',
      image: 'images/items/anomaly.png',
      wikiUrl: 'https://abioticfactor.wiki.gg/wiki/Anomaly',
      kind: 'raw',
      categoryTag: 'lab',
      distillsInto: [
        { distillationId: 'vigorous-distillation', amount: 2 },
        { distillationId: 'void-distillation', amount: 2 },
      ],
    },
    'vigorous-distillation': {
      id: 'vigorous-distillation',
      name: 'Vigorous Distillation',
      image: 'images/items/vigorous-distillation.png',
      wikiUrl: 'https://abioticfactor.wiki.gg/wiki/Vigorous_Distillation',
      kind: 'distillation',
      categoryTag: 'distillation',
    },
    'fizzy-distillation': {
      id: 'fizzy-distillation',
      name: 'Fizzy Distillation',
      image: 'images/items/fizzy-distillation.png',
      wikiUrl: 'https://abioticfactor.wiki.gg/wiki/Fizzy_Distillation',
      kind: 'distillation',
      categoryTag: 'distillation',
    },
    'void-distillation': {
      id: 'void-distillation',
      name: 'Void Distillation',
      image: 'images/items/void-distillation.png',
      wikiUrl: 'https://abioticfactor.wiki.gg/wiki/Void_Distillation',
      kind: 'distillation',
      categoryTag: 'distillation',
    },
  },
  recipes: [
    {
      id: 'soup-simple-tomato-soup',
      name: 'Simple Tomato Soup',
      category: 'soup',
      subcategory: 'beneficial-soup',
      workstation: 'Cooking Pot',
      image: 'images/items/simple-tomato-soup.png',
      wikiUrl: 'https://abioticfactor.wiki.gg/wiki/Simple_Tomato_Soup',
      ingredients: [
        { itemId: 'super-tomato', quantity: 1 },
        { itemId: 'salt', quantity: 1 },
      ],
      stats: {
        hunger: 15,
        thirst: 35,
        cookingLevel: 3,
        buffs: [
          {
            name: 'Souper Satisfied',
            effect: '20% slower hunger and thirst drain rate',
            description: 'You have recently had some delicious soup!',
            isNegative: false,
          },
        ],
      },
    },
    {
      id: 'soup-pest-goulash',
      name: 'Pest Goulash',
      category: 'soup',
      subcategory: 'beneficial-soup',
      workstation: 'Cooking Pot',
      image: 'images/items/pest-goulash.png',
      wikiUrl: 'https://abioticfactor.wiki.gg/wiki/Pest_Goulash',
      ingredients: [
        { itemId: 'raw-pest', quantity: 1 },
        { itemId: 'raw-pest-rump', quantity: 1 },
        { itemId: 'salt', quantity: 1 },
      ],
      stats: { hunger: 14, thirst: 16, cookingLevel: 3 },
    },
    {
      id: 'soup-bad-soup',
      name: 'Bad Soup',
      category: 'soup',
      subcategory: 'unsafe-soup',
      workstation: 'Cooking Pot',
      image: 'images/items/bad-soup.png',
      wikiUrl: 'https://abioticfactor.wiki.gg/wiki/Bad_Soup',
      ingredients: [{ itemId: 'raw-pest', quantity: 1 }],
      stats: {
        hunger: 15,
        thirst: 16,
        buffs: [{ name: 'Borborygmus', isNegative: true }],
      },
    },
    {
      id: 'chem-speedy-tincture',
      name: 'Speedy Tincture',
      category: 'chemistry',
      subcategory: 'tincture',
      workstation: 'Chemistry Bench',
      image: 'images/items/speedy-tincture.png',
      wikiUrl: 'https://abioticfactor.wiki.gg/wiki/Speedy_Tincture',
      ingredients: [
        { itemId: 'vigorous-distillation', quantity: 2, slot: 1 },
        { itemId: 'fizzy-distillation', quantity: 2, slot: 2 },
        { itemId: 'void-distillation', quantity: 1, slot: 3 },
      ],
      stats: {
        duration: '0:15 mix',
        effectSummary: 'Increases movement speed by 50% for 1 minute.',
      },
    },
  ],
};

describe('matcher engine', () => {
  it('matches craftable and almost-craftable soups in checklist mode', () => {
    const results = evaluateRecipes(mockDb, {
      pantry: { 'super-tomato': 1, salt: 1 },
      quantityMode: false,
      includeDistillationChain: true,
    });

    const tomato = results.find((r) => r.recipe.id === 'soup-simple-tomato-soup');
    const goulash = results.find((r) => r.recipe.id === 'soup-pest-goulash');
    const speedy = results.find((r) => r.recipe.id === 'chem-speedy-tincture');

    expect(tomato?.status).toBe('craftable');
    expect(tomato?.craftMethod).toBe('direct');
    expect(goulash?.status).toBe('almost');
    expect(goulash?.missingDistinctCount).toBe(2);
    expect(speedy?.status).toBe('unmatched');
    expect(speedy?.missingDistinctCount).toBe(3);
  });

  it('supports two-stage Chemistry matching from raw items via Distillation Bench', () => {
    const results = evaluateRecipes(mockDb, {
      pantry: { potato: 1, doznuts: 1, 'void-distillation': 1 },
      quantityMode: false,
      includeDistillationChain: true,
    });

    const speedy = results.find((r) => r.recipe.id === 'chem-speedy-tincture');
    expect(speedy?.status).toBe('craftable');
    expect(speedy?.craftMethod).toBe('via-distillation');
    expect(speedy?.ingredientStatuses[0].status).toBe('distillable');
    expect(speedy?.ingredientStatuses[0].distillationSteps[0].rawItemId).toBe('potato');
    expect(speedy?.ingredientStatuses[2].status).toBe('owned');
  });

  it('enforces exact quantities and avoids double-counting raw items in quantity mode', () => {
    // Speedy Tincture needs Vigorous x2, Fizzy x2, Void x1.
    // 1x Anomaly gives 2 Vigorous OR 2 Void, not both at the same time!
    const insufficient = evaluateRecipes(mockDb, {
      pantry: { anomaly: 1, doznuts: 1 },
      quantityMode: true,
      includeDistillationChain: true,
    });
    const speedyFail = insufficient.find((r) => r.recipe.id === 'chem-speedy-tincture');
    expect(speedyFail?.status).toBe('almost');
    expect(speedyFail?.missingDistinctCount).toBe(1); // Void Distillation missing because Anomaly was consumed for Vigorous

    // With 2x Anomaly and 1x Doznuts (produces 3 Fizzy >= 2 needed), all 3 slots are satisfied!
    const sufficient = evaluateRecipes(mockDb, {
      pantry: { anomaly: 2, doznuts: 1 },
      quantityMode: true,
      includeDistillationChain: true,
    });
    const speedyOk = sufficient.find((r) => r.recipe.id === 'chem-speedy-tincture');
    expect(speedyOk?.status).toBe('craftable');
    expect(speedyOk?.craftMethod).toBe('via-distillation');
  });

  it('computes available distillations from raw pantry items', () => {
    const summary = getAvailableDistillationsFromPantry(
      mockDb,
      { potato: 2, 'void-distillation': 1 },
      true
    );
    expect(summary['vigorous-distillation'].fromRawQty).toBe(6);
    expect(summary['void-distillation'].directQty).toBe(1);
  });

  it('filters unsafe soups and sorts by best match or stats', () => {
    const evaluated = evaluateRecipes(mockDb, {
      pantry: { 'raw-pest': 1 },
      quantityMode: false,
      includeDistillationChain: true,
    });

    const withoutUnsafe = filterAndSortMatches(evaluated, mockDb, {
      category: 'all',
      workstation: 'all',
      subcategory: 'all',
      hideUnsafeSoups: true,
      search: '',
      sortBy: 'best-match',
    });
    expect(withoutUnsafe.some((r) => r.recipe.id === 'soup-bad-soup')).toBe(false);

    const byThirst = filterAndSortMatches(evaluated, mockDb, {
      category: 'soup',
      workstation: 'all',
      subcategory: 'all',
      hideUnsafeSoups: true,
      search: '',
      sortBy: 'thirst-desc',
    });
    expect(byThirst[0].recipe.id).toBe('soup-simple-tomato-soup');
  });

  it('matches recipes when searching by mechanical buff effect keywords', () => {
    const evaluated = evaluateRecipes(mockDb, {
      pantry: {},
      quantityMode: false,
      includeDistillationChain: true,
    });

    const matches = filterAndSortMatches(evaluated, mockDb, {
      category: 'all',
      workstation: 'all',
      subcategory: 'all',
      hideUnsafeSoups: true,
      search: 'slower hunger and thirst drain',
      sortBy: 'best-match',
    });

    expect(matches.map((m) => m.recipe.id)).toEqual(['soup-simple-tomato-soup']);
  });

  it('filters to positively buffed recipes only when onlyBuffed is enabled', () => {
    const evaluated = evaluateRecipes(mockDb, {
      pantry: {},
      quantityMode: false,
      includeDistillationChain: true,
    });

    const buffed = filterAndSortMatches(evaluated, mockDb, {
      category: 'all',
      workstation: 'all',
      subcategory: 'all',
      hideUnsafeSoups: false,
      onlyBuffed: true,
      search: '',
      sortBy: 'best-match',
    });

    expect(buffed.map((m) => m.recipe.id)).toEqual(['soup-simple-tomato-soup']);
  });

  it('interleaves soup, food, and chemistry when featuredDefault is enabled', () => {
    const evaluated = evaluateRecipes(mockDb, {
      pantry: {},
      quantityMode: false,
      includeDistillationChain: true,
    });

    const featured = filterAndSortMatches(evaluated, mockDb, {
      category: 'all',
      workstation: 'all',
      subcategory: 'all',
      hideUnsafeSoups: true,
      featuredDefault: true,
      search: '',
      sortBy: 'best-match',
    });

    expect(featured.map((m) => m.recipe.category)).toEqual([
      'soup',
      'chemistry',
      'soup',
    ]);
  });

  it('keeps 1-2 ingredient zero-overlap recipes unmatched instead of almost', () => {
    const results = evaluateRecipes(mockDb, {
      pantry: { salt: 1 },
      quantityMode: false,
      includeDistillationChain: true,
    });

    const badSoup = results.find((r) => r.recipe.id === 'soup-bad-soup');
    const tomatoSoup = results.find(
      (r) => r.recipe.id === 'soup-simple-tomato-soup'
    );
    const goulash = results.find((r) => r.recipe.id === 'soup-pest-goulash');

    // Bad Soup has 1 ingredient (raw-pest) and 0 overlap with salt
    expect(badSoup?.missingDistinctCount).toBe(1);
    expect(badSoup?.status).toBe('unmatched');
    // Simple Tomato Soup uses salt + super-tomato -> 1 overlap, 1 missing -> almost
    expect(tomatoSoup?.status).toBe('almost');
    // Pest Goulash uses raw-pest + raw-pest-rump + salt -> 1 overlap, 2 missing -> almost
    expect(goulash?.status).toBe('almost');

    const withRawPestOnly = evaluateRecipes(mockDb, {
      pantry: { 'raw-pest': 1 },
      quantityMode: false,
      includeDistillationChain: true,
    });
    const tomatoZeroOverlap = withRawPestOnly.find(
      (r) => r.recipe.id === 'soup-simple-tomato-soup'
    );
    // Simple Tomato Soup has 2 ingredients and 0 overlap with raw-pest
    expect(tomatoZeroOverlap?.missingDistinctCount).toBe(2);
    expect(tomatoZeroOverlap?.status).toBe('unmatched');
  });

  it('marks partial quantity ownership as partial and classifies the recipe as almost', () => {
    const results = evaluateRecipes(mockDb, {
      pantry: {
        'vigorous-distillation': 1,
        'fizzy-distillation': 2,
        'void-distillation': 1,
      },
      quantityMode: true,
      includeDistillationChain: true,
    });

    const speedy = results.find((r) => r.recipe.id === 'chem-speedy-tincture');
    expect(speedy?.status).toBe('almost');
    expect(speedy?.missingDistinctCount).toBe(1);
    expect(speedy?.ingredientStatuses[0].status).toBe('partial');
    expect(speedy?.ingredientStatuses[0].haveDirect).toBe(1);
    expect(speedy?.ingredientStatuses[0].missingQty).toBe(1);
    expect(speedy?.ingredientStatuses[1].status).toBe('owned');
    expect(speedy?.ingredientStatuses[2].status).toBe('owned');
  });
});
