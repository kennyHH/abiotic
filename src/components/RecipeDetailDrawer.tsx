import { useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Beaker,
  Check,
  CheckCircle2,
  ClipboardList,
  ClipboardPlus,
  ExternalLink,
  HeartPulse,
  Minus,
  Plus,
  Star,
  X,
} from 'lucide-react';
import type { Item, RecipeDatabase } from '../types/recipes';
import type { CraftMatchResult } from '../lib/matcher';
import {
  formatRecipeNotes,
  formatSignedStat,
  formatStatValue,
} from '../lib/format';
import { ItemImage, type ImageFallbackKind } from './ItemImage';
import { useDialogA11y } from '../hooks/useDialogA11y';

interface RecipeDetailDrawerProps {
  result: CraftMatchResult | null;
  db: RecipeDatabase;
  pantry: Record<string, number>;
  acquire?: Record<string, number>;
  quantityMode?: boolean;
  isFavorite?: boolean;
  onClose: () => void;
  onTogglePantryItem: (itemId: string, requiredQty?: number) => void;
  onToggleAcquireItem?: (itemId: string, defaultQty?: number) => void;
  onAddMissingToAcquire?: (items: { id: string; qty: number }[]) => void;
  onIncrementItem?: (id: string) => void;
  onDecrementItem?: (id: string) => void;
  onSetQuantity?: (id: string, qty: number) => void;
  onToggleFavorite?: (recipeId: string) => void;
}

export function RecipeDetailDrawer({
  result,
  db,
  pantry,
  acquire = {},
  quantityMode = false,
  isFavorite = false,
  onClose,
  onTogglePantryItem,
  onToggleAcquireItem,
  onAddMissingToAcquire,
  onIncrementItem,
  onDecrementItem,
  onSetQuantity,
  onToggleFavorite,
}: RecipeDetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const [expandedDistillers, setExpandedDistillers] = useState<
    Record<string, boolean>
  >({});
  useDialogA11y(Boolean(result), drawerRef, onClose);

  const rawDistillersByDistId = useMemo(() => {
    const map = new Map<string, { item: Item; amount: number }[]>();
    for (const item of Object.values(db.items)) {
      for (const y of item.distillsInto || []) {
        const list = map.get(y.distillationId) ?? [];
        list.push({ item, amount: y.amount });
        map.set(y.distillationId, list);
      }
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) => b.amount - a.amount || a.item.name.localeCompare(b.item.name)
      );
    }
    return map;
  }, [db.items]);

  const missingAcquireEntries = useMemo(() => {
    if (!result) return [];
    const byId = new Map<string, number>();
    for (const ing of result.ingredientStatuses) {
      if (ing.status !== 'missing' && ing.status !== 'partial') continue;
      const neededQty = quantityMode
        ? Math.max(1, ing.missingQty)
        : Math.max(1, ing.required);
      byId.set(ing.itemId, (byId.get(ing.itemId) ?? 0) + neededQty);
    }
    return [...byId.entries()].map(([id, qty]) => ({ id, qty }));
  }, [result, quantityMode]);

  const unaddedMissingCount = useMemo(
    () =>
      missingAcquireEntries.filter(
        ({ id, qty }) => (acquire[id] ?? 0) < qty
      ).length,
    [missingAcquireEntries, acquire]
  );

  if (!result) return null;

  const { recipe, status, craftMethod, missingDistinctCount, ingredientStatuses } =
    result;
  const isChem = recipe.category === 'chemistry';
  const isHazard =
    recipe.subcategory === 'unsafe-soup' ||
    recipe.id === 'chem-unstable-flask';
  const hasPantryItems = Object.values(pantry).some((q) => q > 0);
  const topRailColor = isChem
    ? 'var(--accent-chem)'
    : 'var(--accent-food)';
  const formattedNotes = formatRecipeNotes(recipe);
  const recipeFallback: ImageFallbackKind =
    recipe.category === 'soup'
      ? 'soup'
      : recipe.category === 'chemistry'
        ? 'chemistry'
        : 'food';

  const statItems: { label: string; value: string; accent?: string }[] = [];
  if (recipe.stats.hunger !== undefined) {
    statItems.push({
      label: 'Hunger Fill',
      value: formatSignedStat(recipe.stats.hunger),
      accent: 'var(--accent-food)',
    });
  }
  if (recipe.stats.thirst !== undefined) {
    statItems.push({
      label: 'Thirst Fill',
      value: formatSignedStat(recipe.stats.thirst),
      accent: 'var(--accent-chem)',
    });
  }
  if (recipe.stats.radiation !== undefined) {
    statItems.push({
      label: 'Radiation',
      value:
        recipe.stats.radiation > 0
          ? `+${formatStatValue(recipe.stats.radiation)}`
          : formatStatValue(recipe.stats.radiation),
      accent:
        recipe.stats.radiation > 0 ? 'var(--accent-hazard)' : undefined,
    });
  }
  if (recipe.stats.fatigue !== undefined && recipe.stats.fatigue !== 0) {
    statItems.push({
      label: 'Fatigue',
      value: formatSignedStat(recipe.stats.fatigue),
      accent: 'var(--accent-food)',
    });
  }
  if (recipe.stats.servings !== undefined) {
    statItems.push({
      label: isChem ? 'Batch Yield' : 'Portions',
      value: `${recipe.stats.servings}x`,
    });
  }
  if (recipe.stats.cookingLevel !== undefined) {
    statItems.push({
      label: 'Cooking Level',
      value: `Level ${recipe.stats.cookingLevel}+`,
    });
  }
  if (recipe.stats.duration) {
    statItems.push({ label: 'Cook / Mix Time', value: recipe.stats.duration });
  }
  if (recipe.stats.weight !== undefined) {
    statItems.push({ label: 'Weight', value: `${recipe.stats.weight}` });
  }
  if (recipe.stats.decay) {
    statItems.push({ label: 'Decay Limit', value: recipe.stats.decay });
  }

  return (
    <div
      className="scrim-enter fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-[3px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipe-drawer-title"
    >
      <div
        ref={drawerRef}
        tabIndex={-1}
        className="drawer-enter flex h-full w-full max-w-lg flex-col overflow-hidden border-l"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          boxShadow: 'var(--shadow-drawer)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Category / Hazard Accent Bar */}
        <div
          aria-hidden="true"
          className={`h-[3px] w-full shrink-0${isHazard ? ' hazard-rail' : ''}`}
          style={isHazard ? undefined : { backgroundColor: topRailColor }}
        />

        {/* Header */}
        <div
          className="flex items-start justify-between gap-3 border-b px-5 py-4"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3.5">
            <div className="specimen-bay flex h-16 w-16 shrink-0 items-center justify-center rounded p-1">
              <ItemImage
                src={recipe.image}
                alt={recipe.name}
                fallbackKind={recipeFallback}
                loading="eager"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <h2
                id="recipe-drawer-title"
                className="min-w-0 break-words text-lg font-bold leading-snug tracking-[-0.015em] sm:text-xl"
                style={{ color: 'var(--text-primary)' }}
              >
                {recipe.name}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                <span
                  className="rounded border px-2 py-0.5 font-medium"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {recipe.workstation}
                </span>
                <span
                  className="rounded px-2 py-0.5 capitalize"
                  style={{
                    backgroundColor: 'var(--bg-ground)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {recipe.subcategory.replace(/-/g, ' ')}
                </span>
                {hasPantryItems && status === 'craftable' && (
                  <span
                    className="inline-flex items-center gap-1 rounded border px-2 py-0.5 font-semibold"
                    style={{
                      backgroundColor:
                        craftMethod === 'via-distillation'
                          ? 'var(--accent-chem-bg)'
                          : 'var(--accent-ready-bg)',
                      borderColor:
                        craftMethod === 'via-distillation'
                          ? 'var(--accent-chem-border)'
                          : 'var(--accent-ready-border)',
                      color:
                        craftMethod === 'via-distillation'
                          ? 'var(--accent-chem)'
                          : 'var(--accent-ready)',
                    }}
                  >
                    {craftMethod === 'via-distillation' ? (
                      <>
                        <Beaker className="h-3 w-3" aria-hidden="true" />
                        Via Distill
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        Ready
                      </>
                    )}
                  </span>
                )}
                {hasPantryItems && status === 'almost' && (
                  <span
                    className="font-readout inline-flex items-center rounded border px-2 py-0.5 font-semibold"
                    style={{
                      backgroundColor: 'var(--accent-food-bg)',
                      borderColor: 'var(--accent-food-border)',
                      color: 'var(--accent-food)',
                    }}
                  >
                    Missing {missingDistinctCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {onToggleFavorite && (
              <button
                type="button"
                aria-pressed={isFavorite}
                aria-label={
                  isFavorite
                    ? `Remove ${recipe.name} from favourites`
                    : `Add ${recipe.name} to favourites`
                }
                onClick={() => onToggleFavorite(recipe.id)}
                className="surface-hover touch-chip pressable inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: isFavorite
                    ? 'var(--accent-food-bg)'
                    : 'var(--bg-elevated)',
                  borderColor: isFavorite
                    ? 'var(--accent-food-border)'
                    : 'var(--border-subtle)',
                  color: isFavorite
                    ? 'var(--accent-food)'
                    : 'var(--text-secondary)',
                }}
              >
                <Star
                  className="h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                  fill={isFavorite ? 'currentColor' : 'none'}
                />
                <span className="hidden sm:inline">
                  {isFavorite ? 'Favourited' : 'Favourite'}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close recipe details"
              className="surface-hover touch-target rounded border p-1.5 transition-colors"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {(recipe.subcategory === 'unsafe-soup' ||
            recipe.id === 'chem-unstable-flask') && (
            <div
              className="flex items-start gap-2.5 rounded border border-l-[3px] px-3.5 py-2.5 text-xs"
              style={{
                backgroundColor: 'var(--accent-hazard-bg)',
                borderColor: 'var(--accent-hazard-border)',
                borderLeftColor: 'var(--accent-hazard)',
                color: 'var(--accent-hazard)',
              }}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <span className="font-semibold">
                  {recipe.id === 'chem-unstable-flask'
                    ? 'Failed Concoction Warning: '
                    : 'Unsafe Soup Warning: '}
                </span>
                <span style={{ color: 'var(--text-primary)' }}>
                  {recipe.id === 'chem-unstable-flask'
                    ? 'Produced when mixing incompatible distillations or Noxious Sludge; triggers unpredictable hazardous effects.'
                    : 'Inflicts negative debuffs when consumed. Keep "Unsafe soups: Hidden" enabled unless intentionally experimenting.'}
                </span>
              </div>
            </div>
          )}

          {formattedNotes && (
            <p
              className="text-pretty break-words text-sm leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {formattedNotes}
            </p>
          )}

          {/* Stats Grid */}
          {statItems.length > 0 && (
            <section>
              <h3
                className="mb-2.5 border-b pb-1.5 text-[13px] font-semibold"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                Stats
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {statItems.map((st) => (
                  <div
                    key={st.label}
                    className="relative overflow-hidden rounded border px-3 py-2"
                    style={{
                      backgroundColor: 'var(--bg-ground)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    {st.accent && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
                        style={{ backgroundColor: st.accent }}
                      />
                    )}
                    <div
                      className="text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {st.label}
                    </div>
                    <div
                      className="font-readout mt-0.5 text-[15px] font-semibold"
                      style={{ color: st.accent || 'var(--text-primary)' }}
                    >
                      {st.value}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Buffs / Debuffs */}
          {recipe.stats.buffs && recipe.stats.buffs.length > 0 && (
            <section>
              <h3
                className="mb-2.5 border-b pb-1.5 text-[13px] font-semibold"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                Status Effects
              </h3>
              <div className="space-y-2">
                {recipe.stats.buffs.map((buff) => {
                  const toneAccent = buff.isNegative
                    ? 'var(--accent-hazard)'
                    : isChem
                      ? 'var(--accent-chem)'
                      : 'var(--accent-food)';
                  const toneBg = buff.isNegative
                    ? 'var(--accent-hazard-bg)'
                    : isChem
                      ? 'var(--accent-chem-bg)'
                      : 'var(--accent-food-bg)';
                  return (
                  <div
                    key={buff.name}
                    className="flex items-start gap-2.5 rounded border-l-[3px] px-3 py-2.5"
                    style={{
                      backgroundColor: toneBg,
                      borderLeftColor: toneAccent,
                    }}
                  >
                    {buff.isNegative ? (
                      <AlertTriangle
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ color: toneAccent }}
                      />
                    ) : isChem ? (
                      <Activity
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ color: toneAccent }}
                      />
                    ) : (
                      <HeartPulse
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ color: toneAccent }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className="text-sm font-semibold"
                          style={{ color: toneAccent }}
                        >
                          {buff.name}
                        </span>
                        {buff.isNegative && (
                          <span
                            className="rounded px-1.5 py-0.5 text-xs font-semibold"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--accent-hazard)',
                            }}
                          >
                            Debuff
                          </span>
                        )}
                      </div>
                      {buff.effect && (
                        <p
                          className="text-pretty mt-0.5 break-words text-[13px] font-medium"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {buff.effect}
                        </p>
                      )}
                      {buff.description && buff.description !== buff.effect && (
                        <p
                          className="text-pretty mt-0.5 break-words text-[13px] leading-relaxed"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {buff.description}
                        </p>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Ingredients & Distillation Bench Helper */}
          <section>
            <div
              className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b pb-1.5"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <h3
                className="text-[13px] font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                {isChem
                  ? 'Chemistry Bench Flasks (3 Slots)'
                  : 'Required Ingredients'}
              </h3>
              {onAddMissingToAcquire &&
                missingAcquireEntries.length > 0 &&
                (unaddedMissingCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => onAddMissingToAcquire(missingAcquireEntries)}
                    className="surface-hover touch-chip pressable inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: 'var(--accent-food-bg)',
                      borderColor: 'var(--accent-food-border)',
                      color: 'var(--accent-food)',
                    }}
                  >
                    <ClipboardPlus
                      className="h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>Add missing to Acquire ({unaddedMissingCount})</span>
                  </button>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium"
                    style={{
                      backgroundColor: 'var(--accent-food-bg)',
                      borderColor: 'var(--accent-food-border)',
                      color: 'var(--accent-food)',
                    }}
                  >
                    <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Missing on Acquire list</span>
                  </span>
                ))}
            </div>
            {isChem && (
              <p
                className="text-pretty mb-2.5 text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                Load each reagent into its matching Chemistry Bench slot in the
                ratio shown.
              </p>
            )}

            {ingredientStatuses.length === 0 ? (
              <p
                className="rounded-lg border px-3 py-2.5 text-xs"
                style={{
                  backgroundColor: 'var(--bg-ground)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                {formattedNotes || 'No fixed ingredient list.'}
              </p>
            ) : (
              <div className="space-y-2.5">
                {ingredientStatuses.map((ing, idx) => {
                  const item = db.items[ing.itemId];
                  const itemName = item?.name || ing.itemId;
                  const ownedQty = pantry[ing.itemId] ?? 0;
                  const acquireQty = acquire[ing.itemId] ?? 0;
                  const inAcquire = acquireQty > 0;
                  const defaultAcquireQty =
                    ing.status === 'missing' || ing.status === 'partial'
                      ? quantityMode
                        ? Math.max(1, ing.missingQty)
                        : Math.max(1, ing.required)
                      : Math.max(1, ing.required);
                  const have = ing.haveDirect + ing.fulfilledViaDistillation;
                  const isPartial =
                    (ing.status as string) === 'partial' ||
                    (have > 0 &&
                      have < ing.required &&
                      ing.status !== 'owned' &&
                      ing.status !== 'distillable');
                  const isSatisfied =
                    ing.status === 'owned' &&
                    (!quantityMode || ownedQty >= ing.required);
                  const showPartialChip =
                    !isSatisfied &&
                    ((quantityMode && ownedQty > 0 && ownedQty < ing.required) ||
                      (isPartial && ownedQty > 0));
                  const distillers =
                    item?.kind === 'distillation'
                      ? rawDistillersByDistId.get(ing.itemId) || []
                      : [];
                  const isDistillersExpanded = Boolean(
                    expandedDistillers[ing.itemId]
                  );
                  const visibleDistillers =
                    distillers.length > 6 && !isDistillersExpanded
                      ? [
                          ...distillers.filter(
                            (d) => (pantry[d.item.id] ?? 0) > 0
                          ),
                          ...distillers.filter(
                            (d) => (pantry[d.item.id] ?? 0) <= 0
                          ),
                        ].slice(0, 6)
                      : distillers;

                  return (
                    <div
                      key={`${ing.itemId}-${idx}`}
                      className="rounded border p-3"
                      style={{
                        backgroundColor: 'var(--bg-ground)',
                        borderColor:
                          ing.status === 'owned'
                            ? 'var(--accent-ready-border)'
                            : ing.status === 'distillable'
                              ? 'var(--accent-chem-border)'
                              : isPartial
                                ? 'var(--accent-food-border)'
                                : 'var(--border-subtle)',
                        borderLeftWidth:
                          ing.status === 'owned' ||
                          ing.status === 'distillable' ||
                          isPartial
                            ? '3px'
                            : undefined,
                        borderLeftColor:
                          ing.status === 'owned'
                            ? 'var(--accent-ready)'
                            : ing.status === 'distillable'
                              ? 'var(--accent-chem)'
                              : isPartial
                                ? 'var(--accent-food)'
                                : undefined,
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          {item?.image && (
                            <ItemImage
                              src={item.image}
                              fallbackKind={
                                item.kind === 'distillation'
                                  ? 'distillation'
                                  : 'ingredient'
                              }
                              loading="eager"
                              className="h-7 w-7 shrink-0 object-contain"
                            />
                          )}
                          <div>
                            <div
                              className="text-sm font-semibold"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {ing.slot ? `Slot ${ing.slot}: ` : ''}
                              {itemName}
                            </div>
                            <div
                              className="font-readout text-xs"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              Required: x{ing.required}
                              {isPartial && (
                                <span
                                  className="ml-2 font-medium"
                                  style={{ color: 'var(--accent-food)' }}
                                >
                                  · Have {have} / {ing.required} (short{' '}
                                  {ing.missingQty})
                                </span>
                              )}
                              {ing.status === 'distillable' &&
                                ing.distillationSteps.length > 0 && (
                                  <span
                                    className="ml-2"
                                    style={{ color: 'var(--accent-chem)' }}
                                  >
                                    · Covered via{' '}
                                    {ing.distillationSteps
                                      .map(
                                        (s) =>
                                          `${s.rawQtyNeeded}x ${db.items[s.rawItemId]?.name || s.rawItemId}`
                                      )
                                      .join(' + ')}
                                  </span>
                                )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap shrink-0 items-center gap-1.5">
                          {quantityMode &&
                          ownedQty > 0 &&
                          onIncrementItem &&
                          onDecrementItem ? (
                            <div className="flex shrink-0 items-center gap-1.5">
                              {ownedQty < ing.required && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSetQuantity
                                      ? onSetQuantity(ing.itemId, ing.required)
                                      : onTogglePantryItem(
                                          ing.itemId,
                                          ing.required
                                        )
                                  }
                                  className="surface-hover touch-chip pressable rounded-md border px-2 py-1 text-xs font-medium transition-colors"
                                  style={{
                                    backgroundColor: 'var(--accent-food-bg)',
                                    borderColor: 'var(--accent-food-border)',
                                    color: 'var(--accent-food)',
                                  }}
                                >
                                  Set ×{ing.required}
                                </button>
                              )}
                              <div
                                className="flex items-center rounded-md border"
                                style={{
                                  backgroundColor: 'var(--bg-surface)',
                                  borderColor:
                                    ownedQty >= ing.required
                                      ? 'var(--accent-ready-border)'
                                      : 'var(--accent-food-border)',
                                }}
                              >
                                <button
                                  type="button"
                                  aria-label={`Decrease ${itemName} quantity`}
                                  onClick={() => onDecrementItem(ing.itemId)}
                                  className="surface-hover touch-target pressable flex items-center justify-center rounded-l-md transition-colors"
                                  style={{ color: 'var(--text-secondary)' }}
                                >
                                  <Minus
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                </button>
                                <span
                                  className="font-readout min-w-[2ch] px-1.5 text-center text-xs font-semibold"
                                  style={{
                                    color:
                                      ownedQty >= ing.required
                                        ? 'var(--accent-ready)'
                                        : 'var(--accent-food)',
                                  }}
                                >
                                  {ownedQty}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Increase ${itemName} quantity`}
                                  onClick={() => onIncrementItem(ing.itemId)}
                                  className="surface-hover touch-target pressable flex items-center justify-center rounded-r-md transition-colors"
                                  style={{ color: 'var(--text-secondary)' }}
                                >
                                  <Plus
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              aria-pressed={ing.status === 'owned'}
                              onClick={() =>
                                onTogglePantryItem(ing.itemId, ing.required)
                              }
                              className="surface-hover touch-chip pressable flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
                              style={{
                                backgroundColor: isSatisfied
                                  ? 'var(--accent-ready-bg)'
                                  : showPartialChip
                                    ? 'var(--accent-food-bg)'
                                    : 'var(--bg-surface)',
                                borderColor: isSatisfied
                                  ? 'var(--accent-ready)'
                                  : showPartialChip
                                    ? 'var(--accent-food-border)'
                                    : 'var(--border-subtle)',
                                color: isSatisfied
                                  ? 'var(--accent-ready)'
                                  : showPartialChip
                                    ? 'var(--accent-food)'
                                    : 'var(--text-secondary)',
                              }}
                            >
                              {isSatisfied ? (
                                <>
                                  <Check
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                  />{' '}
                                  In Pantry
                                </>
                              ) : showPartialChip ? (
                                <span>
                                  Have {ownedQty}/{ing.required} · Set ×
                                  {ing.required}
                                </span>
                              ) : (
                                <>
                                  <Plus
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                  />{' '}
                                  {quantityMode
                                    ? `Add ×${ing.required}`
                                    : 'Add'}
                                </>
                              )}
                            </button>
                          )}

                          {onToggleAcquireItem && (
                            <button
                              type="button"
                              aria-pressed={inAcquire}
                              aria-label={
                                inAcquire
                                  ? `Remove ${itemName} from acquire list`
                                  : `Add ${itemName} to acquire list`
                              }
                              onClick={() =>
                                onToggleAcquireItem(
                                  ing.itemId,
                                  defaultAcquireQty
                                )
                              }
                              className="surface-hover touch-chip pressable flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
                              style={{
                                backgroundColor: inAcquire
                                  ? 'var(--accent-food-bg)'
                                  : 'var(--bg-surface)',
                                borderColor: inAcquire
                                  ? 'var(--accent-food-border)'
                                  : 'var(--border-subtle)',
                                color: inAcquire
                                  ? 'var(--accent-food)'
                                  : 'var(--text-secondary)',
                              }}
                            >
                              {inAcquire ? (
                                <>
                                  <Check
                                    className="h-3 w-3 shrink-0"
                                    aria-hidden="true"
                                  />
                                  <span>Acquire (×{acquireQty})</span>
                                </>
                              ) : (
                                <>
                                  <ClipboardList
                                    className="h-3 w-3 shrink-0"
                                    aria-hidden="true"
                                  />
                                  <span>Acquire</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {distillers.length > 0 && (
                        <div
                          className="mt-2.5 border-t pt-2"
                          style={{ borderColor: 'var(--border-subtle)' }}
                        >
                          <div
                            className="mb-1.5 flex items-center gap-1 text-xs font-medium"
                            style={{ color: 'var(--accent-chem)' }}
                          >
                            <Beaker className="h-3 w-3" aria-hidden="true" />
                            Distillation Bench sources ({distillers.length}{' '}
                            items):
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {visibleDistillers.map(({ item: raw, amount }) => {
                              const rawOwned = (pantry[raw.id] ?? 0) > 0;
                              return (
                                <button
                                  key={raw.id}
                                  type="button"
                                  aria-pressed={rawOwned}
                                  onClick={() => onTogglePantryItem(raw.id)}
                                  className="surface-hover touch-chip pressable inline-flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors"
                                  style={{
                                    backgroundColor: rawOwned
                                      ? 'var(--accent-chem-bg)'
                                      : 'var(--bg-surface)',
                                    borderColor: rawOwned
                                      ? 'var(--accent-chem)'
                                      : 'var(--border-subtle)',
                                    color: rawOwned
                                      ? 'var(--accent-chem)'
                                      : 'var(--text-secondary)',
                                  }}
                                >
                                  <ItemImage
                                    src={raw.image}
                                    fallbackKind="ingredient"
                                    loading="eager"
                                    className="h-3.5 w-3.5 object-contain"
                                  />
                                  <span>{raw.name}</span>
                                  <span className="font-readout font-semibold">
                                    +{amount}
                                  </span>
                                  {rawOwned && (
                                    <Check
                                      className="h-3 w-3 shrink-0"
                                      aria-hidden="true"
                                    />
                                  )}
                                </button>
                              );
                            })}
                            {distillers.length > 6 && (
                              <button
                                type="button"
                                aria-expanded={isDistillersExpanded}
                                onClick={() =>
                                  setExpandedDistillers((prev) => ({
                                    ...prev,
                                    [ing.itemId]: !prev[ing.itemId],
                                  }))
                                }
                                className="surface-hover touch-chip pressable inline-flex items-center rounded border px-2 py-1 text-xs font-medium transition-colors"
                                style={{
                                  backgroundColor: 'var(--bg-elevated)',
                                  borderColor: 'var(--border-subtle)',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                {isDistillersExpanded
                                  ? 'Show fewer'
                                  : `Show all ${distillers.length} sources`}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Footer Wiki Link */}
        <div
          className="flex items-center justify-between border-t px-5 py-3"
          style={{
            backgroundColor: 'var(--bg-ground)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Official source: abioticfactor.wiki.gg
          </span>
          <a
            href={recipe.wikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="surface-hover inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text-primary)',
            }}
          >
            <span>Open Wiki Page</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
