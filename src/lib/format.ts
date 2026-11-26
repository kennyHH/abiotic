import type { Recipe } from '../types/recipes';

/**
 * Format numeric survival stats cleanly for compact scanning on cards and tables
 * (rounds noisy 3-decimal floats like 25.875 to at most 1 decimal place).
 */
export function formatStatValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

/**
 * Format signed stat values with a leading '+' for positive amounts.
 */
export function formatSignedStat(value: number): string {
  const formatted = formatStatValue(value);
  const rounded = Number(formatted);
  return rounded > 0 ? `+${formatted}` : formatted;
}

/**
 * Normalize raw wiki recipe notes so truncated fragments read cleanly in UI copy.
 */
export function formatRecipeNotes(recipe: Recipe): string | undefined {
  if (recipe.id === 'soup-bad-soup') {
    return 'Any incompatible combination of edible ingredients (excluding toxic or killer contaminants).';
  }
  if (recipe.id === 'soup-toxic-soup') {
    return 'Produced when boiling any toxic contaminant listed below in a Cooking Pot.';
  }
  if (recipe.id === 'soup-killer-soup') {
    return 'Produced when boiling any lethal or inedible item listed below in a Cooking Pot.';
  }
  if (recipe.notes && /^functions like a consumable\b/i.test(recipe.notes)) {
    return `${recipe.name} ${recipe.notes}`;
  }
  return recipe.notes;
}
