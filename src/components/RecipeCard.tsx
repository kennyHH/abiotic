import { memo, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Beaker,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Droplets,
  HeartPulse,
  Layers,
  Plus,
  Radiation,
  Star,
  Utensils,
  Zap,
} from 'lucide-react';
import type { RecipeDatabase } from '../types/recipes';
import type { CraftMatchResult, IngredientMatchStatus } from '../lib/matcher';
import {
  formatRecipeNotes,
  formatSignedStat,
  formatStatValue,
} from '../lib/format';
import { ItemImage, type ImageFallbackKind } from './ItemImage';

interface RecipeCardProps {
  result: CraftMatchResult;
  db: RecipeDatabase;
  hasPantryItems: boolean;
  quantityMode: boolean;
  acquire?: Record<string, number>;
  isFavorite?: boolean;
  eager?: boolean;
  onSelectRecipe: (result: CraftMatchResult) => void;
  onToggleAcquireItem: (itemId: string, defaultQty?: number) => void;
  onToggleFavorite?: (recipeId: string) => void;
}

function areRecipeCardPropsEqual(
  prev: RecipeCardProps,
  next: RecipeCardProps
): boolean {
  if (
    prev.hasPantryItems !== next.hasPantryItems ||
    prev.quantityMode !== next.quantityMode ||
    Boolean(prev.isFavorite) !== Boolean(next.isFavorite) ||
    Boolean(prev.eager) !== Boolean(next.eager) ||
    prev.db !== next.db ||
    prev.onSelectRecipe !== next.onSelectRecipe ||
    prev.onToggleAcquireItem !== next.onToggleAcquireItem ||
    prev.onToggleFavorite !== next.onToggleFavorite
  ) {
    return false;
  }
  const a = prev.result;
  const b = next.result;
  if (
    a.recipe !== b.recipe ||
    a.status !== b.status ||
    a.craftMethod !== b.craftMethod ||
    a.missingDistinctCount !== b.missingDistinctCount ||
    a.ingredientStatuses.length !== b.ingredientStatuses.length
  ) {
    return false;
  }
  for (let i = 0; i < a.ingredientStatuses.length; i++) {
    const ia = a.ingredientStatuses[i];
    const ib = b.ingredientStatuses[i];
    if (
      ia.itemId !== ib.itemId ||
      ia.required !== ib.required ||
      ia.status !== ib.status ||
      ia.haveDirect !== ib.haveDirect ||
      ia.fulfilledViaDistillation !== ib.fulfilledViaDistillation ||
      ia.missingQty !== ib.missingQty ||
      ia.distillationSteps.length !== ib.distillationSteps.length ||
      ia.distillationSteps[0]?.rawItemId !== ib.distillationSteps[0]?.rawItemId ||
      (prev.acquire?.[ia.itemId] ?? 0) !== (next.acquire?.[ib.itemId] ?? 0)
    ) {
      return false;
    }
  }
  return true;
}

export const RecipeCard = memo(function RecipeCard({
  result,
  db,
  hasPantryItems,
  quantityMode,
  acquire,
  isFavorite = false,
  eager = false,
  onSelectRecipe,
  onToggleAcquireItem,
  onToggleFavorite,
}: RecipeCardProps) {
  const { recipe, status, craftMethod, missingDistinctCount, ingredientStatuses } =
    result;
  const isChem = recipe.category === 'chemistry';
  const isUnsafe = recipe.subcategory === 'unsafe-soup';
  const isUnstableFlask = recipe.id === 'chem-unstable-flask';
  const isHazard = isUnsafe || isUnstableFlask;
  const recipeFallback: ImageFallbackKind =
    recipe.category === 'soup'
      ? 'soup'
      : recipe.category === 'chemistry'
        ? 'chemistry'
        : 'food';

  const cardBorder =
    hasPantryItems && status === 'craftable'
      ? craftMethod === 'via-distillation'
        ? 'var(--accent-chem-border)'
        : 'var(--accent-ready-border)'
      : isHazard
        ? 'var(--accent-hazard-border)'
        : 'var(--border-subtle)';

  const railColor =
    hasPantryItems && status === 'craftable' && craftMethod !== 'via-distillation'
      ? 'var(--accent-ready)'
      : isChem || (hasPantryItems && status === 'craftable' && craftMethod === 'via-distillation')
        ? 'var(--accent-chem)'
        : 'var(--accent-food)';

  const orderedFoodIngredients = useMemo(() => {
    if (!hasPantryItems || isChem) return ingredientStatuses;
    const rank: Record<IngredientMatchStatus['status'], number> = {
      missing: 0,
      partial: 1,
      distillable: 2,
      owned: 3,
    };
    return [...ingredientStatuses].sort((a, b) => rank[a.status] - rank[b.status]);
  }, [hasPantryItems, isChem, ingredientStatuses]);

  const chemSlots = useMemo(() => {
    if (!isChem) return [];
    const slots: Array<(typeof ingredientStatuses)[number] | null> = [
      null,
      null,
      null,
    ];
    ingredientStatuses.forEach((ing, idx) => {
      const targetIdx = (ing.slot ?? idx + 1) - 1;
      if (targetIdx >= 0 && targetIdx < 3 && !slots[targetIdx]) {
        slots[targetIdx] = ing;
      } else {
        const emptyIdx = slots.findIndex((s) => s === null);
        if (emptyIdx !== -1) slots[emptyIdx] = ing;
      }
    });
    return slots;
  }, [isChem, ingredientStatuses]);

  const hasSurvivalStats =
    recipe.stats.hunger !== undefined ||
    (recipe.stats.thirst !== undefined && recipe.stats.thirst !== 0) ||
    (recipe.stats.fatigue !== undefined && recipe.stats.fatigue !== 0) ||
    (recipe.stats.radiation !== undefined && recipe.stats.radiation > 0) ||
    (recipe.stats.servings !== undefined && recipe.stats.servings > 1);

  return (
    <article
      className={`${eager ? '' : 'cv-card '}card-hover group relative flex overflow-hidden rounded-md border`}
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: cardBorder,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div
        aria-hidden="true"
        className={`w-[3px] shrink-0${isHazard ? ' hazard-spine' : ''}`}
        style={isHazard ? undefined : { backgroundColor: railColor }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
      {/* Top Row: Specimen Bay + Name + Readiness Badge */}
      <div className="flex items-start gap-3">
        <div className="specimen-bay flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded p-0.5">
          <ItemImage
            src={recipe.image}
            alt={recipe.name}
            fallbackKind={recipeFallback}
            loading={eager ? 'eager' : 'lazy'}
            fetchPriority={eager ? 'high' : undefined}
            width={48}
            height={48}
            className="h-full w-full object-contain"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 text-[15px] font-semibold leading-snug tracking-[-0.015em]">
              <button
                type="button"
                title={recipe.name}
                onClick={() => onSelectRecipe(result)}
                className="line-clamp-2 max-w-full text-left group-hover:underline after:absolute after:inset-0 after:content-['']"
                style={{ color: 'var(--text-primary)' }}
              >
                {recipe.name}
              </button>
            </h3>

            <div className="flex shrink-0 items-center gap-1.5">
              {hasPantryItems && status === 'craftable' && (
                <span
                  title={
                    craftMethod === 'via-distillation'
                      ? 'Craftable by distilling raw items in your Pantry'
                      : undefined
                  }
                  className="flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold"
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
                  className="font-readout shrink-0 rounded border px-2 py-0.5 text-xs font-semibold"
                  style={{
                    backgroundColor: 'var(--accent-food-bg)',
                    borderColor: 'var(--accent-food-border)',
                    color: 'var(--accent-food)',
                  }}
                >
                  Missing {missingDistinctCount}
                </span>
              )}

              {onToggleFavorite && (
                <button
                  type="button"
                  aria-pressed={isFavorite}
                  aria-label={
                    isFavorite
                      ? `Remove ${recipe.name} from favourites`
                      : `Add ${recipe.name} to favourites`
                  }
                  title={
                    isFavorite ? 'Remove from favourites' : 'Add to favourites'
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(recipe.id);
                  }}
                  className="surface-hover touch-target pressable pointer-events-auto relative z-10 inline-flex items-center justify-center rounded border transition-colors"
                  style={{
                    backgroundColor: isFavorite
                      ? 'var(--accent-food-bg)'
                      : 'var(--bg-well)',
                    borderColor: isFavorite
                      ? 'var(--accent-food-border)'
                      : 'var(--border-subtle)',
                    color: isFavorite
                      ? 'var(--accent-food)'
                      : 'var(--text-muted)',
                  }}
                >
                  <Star
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                    fill={isFavorite ? 'currentColor' : 'none'}
                  />
                </button>
              )}
            </div>
          </div>

          {/* Quiet metadata line */}
          <div
            className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
              {recipe.workstation}
            </span>

            {isChem && (
              <span
                className="font-medium capitalize"
                style={{ color: 'var(--accent-chem)' }}
              >
                {recipe.subcategory}
              </span>
            )}

            {recipe.stats.cookingLevel !== undefined && (
              <span
                className="font-readout"
                title={`Requires Cooking Level ${recipe.stats.cookingLevel}+`}
              >
                Lv {recipe.stats.cookingLevel}+
              </span>
            )}

            {recipe.stats.duration && (
              <span className="font-readout inline-flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {recipe.stats.duration}
              </span>
            )}

            {isHazard && (
              <span
                className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-semibold"
                style={{
                  backgroundColor: 'var(--accent-hazard-bg)',
                  borderColor: 'var(--accent-hazard-border)',
                  color: 'var(--accent-hazard)',
                }}
              >
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {isUnstableFlask ? 'Unstable' : 'Unsafe'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats Telemetry Strip */}
      {hasSurvivalStats && (
        <div className="telemetry-strip flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded px-2.5 py-1.5">
          {recipe.stats.hunger !== undefined && (
            <span
              className="inline-flex items-center gap-1.5 whitespace-nowrap"
              title="Hunger Fill"
            >
              <Utensils
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
                style={{ color: 'var(--accent-food)' }}
              />
              <span className="inline-flex items-baseline gap-1">
                <span
                  className="font-readout text-[15px] font-bold leading-none"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {formatSignedStat(recipe.stats.hunger)}
                </span>
                <span
                  className="text-xs font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Hunger
                </span>
              </span>
            </span>
          )}

          {recipe.stats.thirst !== undefined && recipe.stats.thirst !== 0 && (
            <span
              className="inline-flex items-center gap-1.5 whitespace-nowrap"
              title="Thirst Fill"
            >
              <Droplets
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
                style={{ color: 'var(--accent-chem)' }}
              />
              <span className="inline-flex items-baseline gap-1">
                <span
                  className="font-readout text-[15px] font-bold leading-none"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {formatSignedStat(recipe.stats.thirst)}
                </span>
                <span
                  className="text-xs font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Thirst
                </span>
              </span>
            </span>
          )}

          {recipe.stats.fatigue !== undefined && recipe.stats.fatigue !== 0 && (
            <span
              className="inline-flex items-center gap-1.5 whitespace-nowrap"
              title="Fatigue effect"
            >
              <Zap
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
                style={{ color: 'var(--accent-food)' }}
              />
              <span className="inline-flex items-baseline gap-1">
                <span
                  className="font-readout text-[15px] font-bold leading-none"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {formatSignedStat(recipe.stats.fatigue)}
                </span>
                <span
                  className="text-xs font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Fatigue
                </span>
              </span>
            </span>
          )}

          {recipe.stats.radiation !== undefined && recipe.stats.radiation > 0 && (
            <span
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded px-1.5 py-0.5"
              style={{
                backgroundColor: 'var(--accent-hazard-bg)',
                color: 'var(--accent-hazard)',
              }}
              title="Radiation when ingested"
            >
              <Radiation className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="inline-flex items-baseline gap-1">
                <span className="font-readout text-[15px] font-bold leading-none">
                  +{formatStatValue(recipe.stats.radiation)}
                </span>
                <span className="text-xs font-medium">Radiation</span>
              </span>
            </span>
          )}

          {recipe.stats.servings !== undefined && recipe.stats.servings > 1 && (
            <span
              className="inline-flex items-center gap-1.5 whitespace-nowrap"
              title="Portions / Yield"
            >
              <Layers
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
                style={{ color: 'var(--text-muted)' }}
              />
              <span className="inline-flex items-baseline gap-1">
                <span
                  className="font-readout text-[15px] font-bold leading-none"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {recipe.stats.servings}×
                </span>
                <span
                  className="text-xs font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {isChem ? 'Yield' : 'Portions'}
                </span>
              </span>
            </span>
          )}
        </div>
      )}

      {/* Special Buffs / Status Effects Callout */}
      {recipe.stats.buffs && recipe.stats.buffs.length > 0 && (
        <div className="space-y-1.5">
          {recipe.stats.buffs.map((buff) => {
            const detail = buff.effect || buff.description;
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
                className="flex items-start gap-2 rounded border-l-[3px] px-3 py-2 text-[13px]"
                style={{
                  backgroundColor: toneBg,
                  borderLeftColor: toneAccent,
                }}
              >
                {buff.isNegative ? (
                  <AlertTriangle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                    style={{ color: toneAccent }}
                  />
                ) : isChem ? (
                  <Activity
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                    style={{ color: toneAccent }}
                  />
                ) : (
                  <HeartPulse
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                    style={{ color: toneAccent }}
                  />
                )}
                <p className="text-pretty line-clamp-3 min-w-0 flex-1 leading-snug break-words">
                  <span className="font-semibold" style={{ color: toneAccent }}>
                    {buff.name}
                  </span>
                  {detail && (
                    <span style={{ color: 'var(--text-primary)' }}>
                      {' '}
                      — {detail}
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Chemistry Description / Effect Summary */}
      {isChem &&
        recipe.stats.effectSummary &&
        !(recipe.stats.buffs && recipe.stats.buffs.length > 0) && (
          <p
            className="text-pretty line-clamp-2 text-[13px] leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {recipe.stats.effectSummary}
          </p>
        )}

      {/* Ingredients Footer: 3-Chamber Chemistry Rack OR Interactive Food Pills */}
      <div
        className="pointer-events-none mt-auto border-t pt-2.5"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        {isChem ? (
          <div className="grid grid-cols-3 gap-1.5">
            {chemSlots.map((ing, idx) => {
              if (!ing) {
                return (
                  <div
                    key={`empty-slot-${idx}`}
                    className="flex flex-col items-center justify-center gap-1 rounded border border-dashed p-1.5 text-center"
                    style={{
                      backgroundColor: 'var(--bg-well)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <span className="font-readout text-xs font-semibold">
                      S{idx + 1}
                    </span>
                    <span className="text-xs">Empty</span>
                  </div>
                );
              }

              const item = db.items[ing.itemId];
              const isOwned = ing.status === 'owned';
              const isDistill = ing.status === 'distillable';
              const isPartial = ing.status === 'partial';
              const have = ing.haveDirect + ing.fulfilledViaDistillation;
              const acquireQty = acquire?.[ing.itemId] ?? 0;
              const inAcquire = acquireQty > 0;
              const defaultAcquireQty =
                quantityMode && (ing.status === 'missing' || isPartial)
                  ? Math.max(1, ing.missingQty)
                  : Math.max(1, ing.required);
              const pantryHighlighted =
                hasPantryItems && (isOwned || isDistill || isPartial);
              const slotHighlighted = pantryHighlighted || inAcquire;
              const borderColor =
                hasPantryItems && isOwned
                  ? 'var(--accent-ready-border)'
                  : hasPantryItems && isDistill
                    ? 'var(--accent-chem-border)'
                    : inAcquire || (hasPantryItems && isPartial)
                      ? 'var(--accent-food-border)'
                      : 'var(--border-subtle)';
              const bgColor =
                hasPantryItems && isOwned
                  ? 'var(--accent-ready-bg)'
                  : hasPantryItems && isDistill
                    ? 'var(--accent-chem-bg)'
                    : inAcquire || (hasPantryItems && isPartial)
                      ? 'var(--accent-food-bg)'
                      : 'var(--bg-well)';
              const statusAccent =
                hasPantryItems && isOwned
                  ? 'var(--accent-ready)'
                  : hasPantryItems && isDistill
                    ? 'var(--accent-chem)'
                    : inAcquire || (hasPantryItems && isPartial)
                      ? 'var(--accent-food)'
                      : 'var(--text-primary)';
              const bottomBarColor = slotHighlighted
                ? statusAccent
                : 'transparent';

              const itemName = item?.name || ing.itemId;
              const shortName = itemName.replace(/\s+Distillation$/i, '');
              const slotTitle = inAcquire
                ? `On To Acquire list (×${acquireQty}) — click to remove`
                : hasPantryItems && isPartial
                  ? `Have ${have}/${ing.required} ${itemName} — click to add ${defaultAcquireQty} to To Acquire`
                  : `Click to add ${itemName}${defaultAcquireQty > 1 ? ` (×${defaultAcquireQty})` : ''} to To Acquire`;

              return (
                <button
                  key={`${ing.itemId}-${idx}`}
                  type="button"
                  aria-pressed={inAcquire}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleAcquireItem(ing.itemId, defaultAcquireQty);
                  }}
                  title={slotTitle}
                  className="surface-hover pressable pointer-events-auto relative z-10 flex flex-col items-center gap-1 overflow-hidden rounded border px-1.5 pt-1.5 pb-2 text-center"
                  style={{
                    backgroundColor: bgColor,
                    borderColor,
                    boxShadow: slotHighlighted ? undefined : 'var(--inset-well)',
                  }}
                >
                  <div className="font-readout flex w-full items-center justify-between text-xs font-semibold">
                    <span style={{ color: 'var(--text-muted)' }}>
                      S{ing.slot ?? idx + 1}
                    </span>
                    <span
                      className="inline-flex items-center gap-0.5"
                      style={{ color: statusAccent }}
                    >
                      {hasPantryItems && isOwned ? (
                        <>
                          <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                          {inAcquire && (
                            <ClipboardList
                              className="h-3 w-3 shrink-0"
                              aria-hidden="true"
                              style={{ color: 'var(--accent-food)' }}
                            />
                          )}
                        </>
                      ) : hasPantryItems && isDistill ? (
                        <>
                          <Beaker className="h-3 w-3 shrink-0" aria-hidden="true" />
                          {inAcquire && (
                            <ClipboardList
                              className="h-3 w-3 shrink-0"
                              aria-hidden="true"
                              style={{ color: 'var(--accent-food)' }}
                            />
                          )}
                        </>
                      ) : inAcquire ? (
                        <ClipboardList
                          className="h-3 w-3 shrink-0"
                          aria-hidden="true"
                        />
                      ) : (
                        <Plus className="h-3 w-3 shrink-0" aria-hidden="true" />
                      )}
                      {hasPantryItems && isPartial
                        ? `${have}/${ing.required}`
                        : `x${ing.required}`}
                    </span>
                  </div>
                  {item?.image && (
                    <ItemImage
                      src={item.image}
                      fallbackKind={
                        item.kind === 'distillation'
                          ? 'distillation'
                          : 'ingredient'
                      }
                      loading={eager ? 'eager' : 'lazy'}
                      width={24}
                      height={24}
                      className="h-6 w-6 object-contain"
                    />
                  )}
                  <span
                    className="w-full truncate text-xs font-medium"
                    title={itemName}
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {shortName}
                  </span>
                  {isDistill && ing.distillationSteps[0] && (
                    <span
                      className="w-full truncate text-xs"
                      title={`Distill ${db.items[ing.distillationSteps[0].rawItemId]?.name || ing.distillationSteps[0].rawItemId}`}
                      style={{ color: 'var(--accent-chem)' }}
                    >
                      ← {db.items[ing.distillationSteps[0].rawItemId]?.name}
                    </span>
                  )}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5"
                    style={{ backgroundColor: bottomBarColor }}
                  />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {orderedFoodIngredients.length === 0 ? (
              <span className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                {formatRecipeNotes(recipe) || 'Variable / any ingredients'}
              </span>
            ) : (
              orderedFoodIngredients.slice(0, 6).map((ing, idx) => {
                const item = db.items[ing.itemId];
                const itemName = item?.name || ing.itemId;
                const isOwned = ing.status === 'owned';
                const isDistill = ing.status === 'distillable';
                const isPartial = ing.status === 'partial';
                const have = ing.haveDirect + ing.fulfilledViaDistillation;
                const acquireQty = acquire?.[ing.itemId] ?? 0;
                const inAcquire = acquireQty > 0;
                const defaultAcquireQty =
                  quantityMode && (ing.status === 'missing' || isPartial)
                    ? Math.max(1, ing.missingQty)
                    : Math.max(1, ing.required);
                const highlighted =
                  inAcquire ||
                  (hasPantryItems && (isOwned || isDistill || isPartial));
                const bgColor =
                  hasPantryItems && isOwned
                    ? 'var(--accent-ready-bg)'
                    : hasPantryItems && isDistill
                      ? 'var(--accent-chem-bg)'
                      : inAcquire || (hasPantryItems && isPartial)
                        ? 'var(--accent-food-bg)'
                        : 'var(--bg-well)';
                const borderColor =
                  hasPantryItems && isOwned
                    ? 'var(--accent-ready-border)'
                    : hasPantryItems && isDistill
                      ? 'var(--accent-chem-border)'
                      : inAcquire || (hasPantryItems && isPartial)
                        ? 'var(--accent-food-border)'
                        : 'var(--border-subtle)';
                const textColor =
                  hasPantryItems && isOwned
                    ? 'var(--accent-ready)'
                    : hasPantryItems && isDistill
                      ? 'var(--accent-chem)'
                      : inAcquire || (hasPantryItems && isPartial)
                        ? 'var(--accent-food)'
                        : 'var(--text-secondary)';
                const pillTitle = inAcquire
                  ? `On To Acquire list (×${acquireQty}) — click to remove`
                  : hasPantryItems && isPartial
                    ? `Have ${have}/${ing.required} ${itemName} — click to add ${defaultAcquireQty} to To Acquire`
                    : `Click to add ${itemName}${defaultAcquireQty > 1 ? ` (×${defaultAcquireQty})` : ''} to To Acquire`;

                return (
                  <button
                    key={`${ing.itemId}-${idx}`}
                    type="button"
                    aria-pressed={inAcquire}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleAcquireItem(ing.itemId, defaultAcquireQty);
                    }}
                    title={pillTitle}
                    className="surface-hover touch-chip pressable pointer-events-auto relative z-10 flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium"
                    style={{
                      backgroundColor: bgColor,
                      borderColor,
                      boxShadow: highlighted ? undefined : 'var(--inset-well)',
                      color: textColor,
                    }}
                  >
                    {hasPantryItems && isOwned ? (
                      <>
                        <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {inAcquire && (
                          <ClipboardList
                            className="h-3 w-3 shrink-0"
                            aria-hidden="true"
                            style={{ color: 'var(--accent-food)' }}
                          />
                        )}
                      </>
                    ) : hasPantryItems && isDistill ? (
                      <>
                        <Beaker className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {inAcquire && (
                          <ClipboardList
                            className="h-3 w-3 shrink-0"
                            aria-hidden="true"
                            style={{ color: 'var(--accent-food)' }}
                          />
                        )}
                      </>
                    ) : inAcquire ? (
                      <ClipboardList
                        className="h-3 w-3 shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <Plus className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
                    )}
                    {item?.image && (
                      <ItemImage
                        src={item.image}
                        fallbackKind="ingredient"
                        loading={eager ? 'eager' : 'lazy'}
                        width={18}
                        height={18}
                        className="h-[18px] w-[18px] shrink-0 object-contain"
                      />
                    )}
                    <span className="max-w-[180px] truncate">{itemName}</span>
                    {hasPantryItems && isPartial ? (
                      <span className="font-readout font-semibold">
                        {have}/{ing.required}
                      </span>
                    ) : (
                      (ing.required > 1 || quantityMode) && (
                        <span className="font-readout font-semibold">
                          x{ing.required}
                        </span>
                      )
                    )}
                  </button>
                );
              })
            )}
            {orderedFoodIngredients.length > 6 && (
              <span
                className="rounded px-1.5 py-1 text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                +{orderedFoodIngredients.length - 6} more
              </span>
            )}
          </div>
        )}
      </div>
      </div>
    </article>
  );
}, areRecipeCardPropsEqual);
