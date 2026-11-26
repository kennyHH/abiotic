export type RecipeCategory = 'soup' | 'food' | 'chemistry';

export type RecipeSubcategory =
  | 'beneficial-soup'
  | 'unsafe-soup'
  | 'frying'
  | 'chefs-counter'
  | 'baking'
  | 'other-food'
  | 'tincture'
  | 'flask'
  | 'coating';

export interface DistillationYield {
  distillationId: string;
  amount: number;
}

export interface Item {
  id: string;
  name: string;
  image: string;
  wikiUrl: string;
  kind: 'raw' | 'intermediate' | 'distillation' | 'output';
  categoryTag: 'produce' | 'meat' | 'packaged' | 'distillation' | 'lab' | 'other';
  distillsInto?: DistillationYield[];
}

export interface RecipeIngredient {
  itemId: string;
  quantity: number;
  slot?: 1 | 2 | 3;
}

export interface BuffEffect {
  name: string;
  effect?: string;
  description?: string;
  isNegative?: boolean;
}

export interface RecipeStats {
  hunger?: number;
  thirst?: number;
  radiation?: number;
  fatigue?: number;
  decay?: string;
  servings?: number;
  cookingLevel?: number;
  weight?: number;
  duration?: string;
  effectSummary?: string;
  buffs?: BuffEffect[];
}

export interface Recipe {
  id: string;
  name: string;
  category: RecipeCategory;
  subcategory: RecipeSubcategory;
  workstation: string;
  image: string;
  wikiUrl: string;
  ingredients: RecipeIngredient[];
  stats: RecipeStats;
  notes?: string;
}

export interface RecipeDatabase {
  syncedAt: string;
  source: string;
  items: Record<string, Item>;
  distillationIds: string[];
  recipes: Recipe[];
}
