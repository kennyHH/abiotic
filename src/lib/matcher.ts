import type {
  Recipe,
  RecipeCategory,
  RecipeDatabase,
  RecipeSubcategory,
} from '../types/recipes';

export interface MatcherOptions {
  pantry: Record<string, number>;
  quantityMode: boolean;
  includeDistillationChain: boolean;
}

export interface DistillationStep {
  rawItemId: string;
  rawQtyNeeded: number;
  producesPerUnit: number;
}

export interface IngredientMatchStatus {
  itemId: string;
  required: number;
  slot?: 1 | 2 | 3;
  haveDirect: number;
  fulfilledViaDistillation: number;
  missingQty: number;
  status: 'owned' | 'partial' | 'distillable' | 'missing';
  distillationSteps: DistillationStep[];
}

export interface CraftMatchResult {
  recipe: Recipe;
  status: 'craftable' | 'almost' | 'unmatched';
  craftMethod: 'direct' | 'via-distillation' | 'incomplete';
  missingDistinctCount: number;
  ingredientStatuses: IngredientMatchStatus[];
  matchRatio: number;
}

export interface PantryDistillationSummary {
  directQty: number;
  fromRawQty: number;
  rawSources: {
    rawItemId: string;
    yieldPerItem: number;
    ownedQty: number;
  }[];
}

export interface RecipeFilterOptions {
  category: 'all' | RecipeCategory;
  workstation: string;
  subcategory: 'all' | RecipeSubcategory;
  hideUnsafeSoups: boolean;
  onlyBuffed?: boolean;
  featuredDefault?: boolean;
  search: string;
  sortBy: 'best-match' | 'hunger-desc' | 'thirst-desc' | 'level-asc' | 'name-asc';
}

const distillersCache = new WeakMap<
  RecipeDatabase,
  Map<string, { rawItemId: string; amount: number }[]>
>();

function getDistillersByTarget(
  db: RecipeDatabase
): Map<string, { rawItemId: string; amount: number }[]> {
  const cached = distillersCache.get(db);
  if (cached) return cached;

  const distillersByTarget = new Map<
    string,
    { rawItemId: string; amount: number }[]
  >();
  for (const item of Object.values(db.items)) {
    if (!item.distillsInto) continue;
    for (const y of item.distillsInto) {
      const list = distillersByTarget.get(y.distillationId) ?? [];
      list.push({ rawItemId: item.id, amount: y.amount });
      distillersByTarget.set(y.distillationId, list);
    }
  }
  for (const list of distillersByTarget.values()) {
    list.sort((a, b) => b.amount - a.amount);
  }
  distillersCache.set(db, distillersByTarget);
  return distillersByTarget;
}

export function evaluateRecipes(
  db: RecipeDatabase,
  options: MatcherOptions
): CraftMatchResult[] {
  const { pantry, quantityMode, includeDistillationChain } = options;
  const distillersByTarget = getDistillersByTarget(db);

  return db.recipes.map((recipe) => {
    // Per-recipe working inventory so no item is double-counted across multiple slots
    const remainingPool: Record<string, number> = {};
    for (const [id, qty] of Object.entries(pantry)) {
      if (qty > 0) remainingPool[id] = qty;
    }

    let usedDistillation = false;
    let missingDistinctCount = 0;
    let satisfiedScore = 0;

    const ingredientStatuses: IngredientMatchStatus[] = recipe.ingredients.map(
      (ing) => {
        const required = quantityMode ? ing.quantity : 1;
        const poolHave = remainingPool[ing.itemId] ?? 0;

        let haveDirect = 0;
        if (poolHave > 0) {
          if (quantityMode) {
            haveDirect = Math.min(poolHave, required);
            remainingPool[ing.itemId] = poolHave - haveDirect;
          } else {
            haveDirect = required;
          }
        }

        let remainingDeficit = Math.max(0, required - haveDirect);
        let fulfilledViaDistillation = 0;
        const distillationSteps: DistillationStep[] = [];

        const ingItem = db.items[ing.itemId];
        if (
          remainingDeficit > 0 &&
          includeDistillationChain &&
          ingItem?.kind === 'distillation'
        ) {
          const candidates = distillersByTarget.get(ing.itemId) ?? [];
          for (const cand of candidates) {
            const availRaw = remainingPool[cand.rawItemId] ?? 0;
            if (availRaw <= 0) continue;

            if (!quantityMode) {
              // In Checklist mode, record all matching owned raw sources
              distillationSteps.push({
                rawItemId: cand.rawItemId,
                rawQtyNeeded: Math.ceil(ing.quantity / cand.amount),
                producesPerUnit: cand.amount,
              });
              fulfilledViaDistillation = required - haveDirect;
              remainingDeficit = 0;
            } else {
              const rawNeeded = Math.min(
                availRaw,
                Math.ceil(remainingDeficit / cand.amount)
              );
              if (rawNeeded > 0) {
                remainingPool[cand.rawItemId] = availRaw - rawNeeded;
                const produced = rawNeeded * cand.amount;
                const applied = Math.min(remainingDeficit, produced);
                fulfilledViaDistillation += applied;
                remainingDeficit -= applied;
                distillationSteps.push({
                  rawItemId: cand.rawItemId,
                  rawQtyNeeded: rawNeeded,
                  producesPerUnit: cand.amount,
                });
                if (remainingDeficit <= 0) break;
              }
            }
          }
          if (fulfilledViaDistillation > 0) {
            usedDistillation = true;
          }
        }

        const missingQty = Math.max(0, remainingDeficit);
        let ingStatus: IngredientMatchStatus['status'] = 'missing';
        if (missingQty === 0) {
          ingStatus =
            fulfilledViaDistillation > 0 && haveDirect < required
              ? 'distillable'
              : 'owned';
          satisfiedScore += 1;
        } else {
          ingStatus =
            haveDirect + fulfilledViaDistillation > 0 ? 'partial' : 'missing';
          missingDistinctCount += 1;
          satisfiedScore += (haveDirect + fulfilledViaDistillation) / required;
        }

        return {
          itemId: ing.itemId,
          required: ing.quantity,
          slot: ing.slot,
          haveDirect,
          fulfilledViaDistillation,
          missingQty,
          status: ingStatus,
          distillationSteps,
        };
      }
    );

    const totalIngs = recipe.ingredients.length;
    const matchRatio = totalIngs > 0 ? satisfiedScore / totalIngs : 0;

    let status: CraftMatchResult['status'] = 'unmatched';
    let craftMethod: CraftMatchResult['craftMethod'] = 'incomplete';

    if (totalIngs > 0 && missingDistinctCount === 0) {
      status = 'craftable';
      craftMethod = usedDistillation ? 'via-distillation' : 'direct';
    } else if (
      satisfiedScore > 0 &&
      (missingDistinctCount === 1 || missingDistinctCount === 2)
    ) {
      status = 'almost';
    }

    return {
      recipe,
      status,
      craftMethod,
      missingDistinctCount,
      ingredientStatuses,
      matchRatio,
    };
  });
}

export function getAvailableDistillationsFromPantry(
  db: RecipeDatabase,
  pantry: Record<string, number>,
  quantityMode: boolean
): Record<string, PantryDistillationSummary> {
  const result: Record<string, PantryDistillationSummary> = {};

  for (const distId of db.distillationIds) {
    result[distId] = {
      directQty: pantry[distId] ?? 0,
      fromRawQty: 0,
      rawSources: [],
    };
  }

  for (const [itemId, qty] of Object.entries(pantry)) {
    if (qty <= 0) continue;
    const item = db.items[itemId];
    if (!item?.distillsInto) continue;
    for (const y of item.distillsInto) {
      if (!result[y.distillationId]) {
        result[y.distillationId] = {
          directQty: pantry[y.distillationId] ?? 0,
          fromRawQty: 0,
          rawSources: [],
        };
      }
      const entry = result[y.distillationId];
      entry.fromRawQty += quantityMode ? qty * y.amount : y.amount;
      entry.rawSources.push({
        rawItemId: itemId,
        yieldPerItem: y.amount,
        ownedQty: qty,
      });
    }
  }

  return result;
}

export function filterAndSortMatches(
  results: CraftMatchResult[],
  db: RecipeDatabase,
  filters: RecipeFilterOptions
): CraftMatchResult[] {
  const q = filters.search.trim().toLowerCase();

  const filtered = results.filter((res) => {
    const r = res.recipe;
    if (filters.category !== 'all' && r.category !== filters.category) {
      return false;
    }
    if (
      filters.workstation !== 'all' &&
      r.workstation !== filters.workstation
    ) {
      return false;
    }
    if (
      filters.subcategory !== 'all' &&
      r.subcategory !== filters.subcategory
    ) {
      return false;
    }
    if (filters.hideUnsafeSoups && r.subcategory === 'unsafe-soup') {
      return false;
    }
    if (
      filters.onlyBuffed &&
      !(r.stats.buffs ?? []).some((b) => !b.isNegative)
    ) {
      return false;
    }
    if (q) {
      const haystacks = [
        r.name,
        r.workstation,
        r.stats.effectSummary || '',
        r.notes || '',
        ...(r.stats.buffs || []).map(
          (b) => `${b.name} ${b.effect || ''} ${b.description || ''}`
        ),
        ...r.ingredients.map((i) => db.items[i.itemId]?.name || i.itemId),
      ];
      const hit = haystacks.some((h) => h.toLowerCase().includes(q));
      if (!hit) return false;
    }
    return true;
  });

  const statusRank: Record<CraftMatchResult['status'], number> = {
    craftable: 0,
    almost: 1,
    unmatched: 2,
  };
  const methodRank: Record<CraftMatchResult['craftMethod'], number> = {
    direct: 0,
    'via-distillation': 1,
    incomplete: 2,
  };

  const sorted = [...filtered].sort((a, b) => {
    if (filters.sortBy === 'best-match') {
      const sr = statusRank[a.status] - statusRank[b.status];
      if (sr !== 0) return sr;
      const mr = methodRank[a.craftMethod] - methodRank[b.craftMethod];
      if (mr !== 0) return mr;
      if (a.missingDistinctCount !== b.missingDistinctCount) {
        return a.missingDistinctCount - b.missingDistinctCount;
      }
      if (b.matchRatio !== a.matchRatio) return b.matchRatio - a.matchRatio;
      return a.recipe.name.localeCompare(b.recipe.name);
    }
    if (filters.sortBy === 'hunger-desc') {
      const diff = (b.recipe.stats.hunger ?? -999) - (a.recipe.stats.hunger ?? -999);
      return diff !== 0 ? diff : a.recipe.name.localeCompare(b.recipe.name);
    }
    if (filters.sortBy === 'thirst-desc') {
      const diff = (b.recipe.stats.thirst ?? -999) - (a.recipe.stats.thirst ?? -999);
      return diff !== 0 ? diff : a.recipe.name.localeCompare(b.recipe.name);
    }
    if (filters.sortBy === 'level-asc') {
      const diff = (a.recipe.stats.cookingLevel ?? 0) - (b.recipe.stats.cookingLevel ?? 0);
      return diff !== 0 ? diff : a.recipe.name.localeCompare(b.recipe.name);
    }
    return a.recipe.name.localeCompare(b.recipe.name);
  });

  if (
    filters.featuredDefault &&
    filters.sortBy === 'best-match' &&
    filters.category === 'all' &&
    !q &&
    filters.workstation === 'all' &&
    filters.subcategory === 'all'
  ) {
    return interleaveFeaturedMatches(sorted);
  }

  return sorted;
}

function sortFeaturedBucket(
  list: CraftMatchResult[],
  cat: RecipeCategory
): CraftMatchResult[] {
  const chemOrder: Record<string, number> = {
    tincture: 0,
    flask: 1,
    coating: 2,
  };
  return [...list].sort((a, b) => {
    const ra = a.recipe;
    const rb = b.recipe;
    const aPos = (ra.stats.buffs ?? []).some((x) => !x.isNegative) ? 1 : 0;
    const bPos = (rb.stats.buffs ?? []).some((x) => !x.isNegative) ? 1 : 0;

    if (cat === 'soup') {
      const aDistinct = (ra.stats.buffs ?? []).some(
        (x) => !x.isNegative && x.name !== 'Souper Satisfied'
      )
        ? 1
        : 0;
      const bDistinct = (rb.stats.buffs ?? []).some(
        (x) => !x.isNegative && x.name !== 'Souper Satisfied'
      )
        ? 1
        : 0;
      if (bPos !== aPos) return bPos - aPos;
      if (bDistinct !== aDistinct) return bDistinct - aDistinct;
      const scoreA = (ra.stats.hunger ?? 0) + (ra.stats.thirst ?? 0);
      const scoreB = (rb.stats.hunger ?? 0) + (rb.stats.thirst ?? 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return ra.name.localeCompare(rb.name);
    }

    if (cat === 'food') {
      if (bPos !== aPos) return bPos - aPos;
      const scoreA = (ra.stats.hunger ?? 0) + (ra.stats.thirst ?? 0);
      const scoreB = (rb.stats.hunger ?? 0) + (rb.stats.thirst ?? 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return ra.name.localeCompare(rb.name);
    }

    const subDiff =
      (chemOrder[ra.subcategory] ?? 9) - (chemOrder[rb.subcategory] ?? 9);
    if (subDiff !== 0) return subDiff;
    if (bPos !== aPos) return bPos - aPos;
    return ra.name.localeCompare(rb.name);
  });
}

export function interleaveFeaturedMatches(
  sorted: CraftMatchResult[]
): CraftMatchResult[] {
  const isHazard = (r: Recipe) =>
    r.subcategory === 'unsafe-soup' || r.id === 'chem-unstable-flask';
  const soups = sortFeaturedBucket(
    sorted.filter((m) => m.recipe.category === 'soup' && !isHazard(m.recipe)),
    'soup'
  );
  const foods = sortFeaturedBucket(
    sorted.filter((m) => m.recipe.category === 'food' && !isHazard(m.recipe)),
    'food'
  );
  const chems = sortFeaturedBucket(
    sorted.filter(
      (m) => m.recipe.category === 'chemistry' && !isHazard(m.recipe)
    ),
    'chemistry'
  );
  const hazards = sorted.filter((m) => isHazard(m.recipe));

  const out: CraftMatchResult[] = [];
  const maxLen = Math.max(soups.length, foods.length, chems.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < soups.length) out.push(soups[i]);
    if (i < foods.length) out.push(foods[i]);
    if (i < chems.length) out.push(chems[i]);
  }
  return out.concat(hazards);
}
