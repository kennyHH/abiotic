import {
  Activity,
  AlertTriangle,
  Beaker,
  Check,
  CheckCircle2,
  HeartPulse,
  Plus,
} from 'lucide-react';
import type { RecipeDatabase } from '../types/recipes';
import type { CraftMatchResult } from '../lib/matcher';
import { formatStatValue } from '../lib/format';
import { ItemImage, type ImageFallbackKind } from './ItemImage';

interface RecipeTableProps {
  results: CraftMatchResult[];
  db: RecipeDatabase;
  hasPantryItems: boolean;
  quantityMode?: boolean;
  onSelectRecipe: (result: CraftMatchResult) => void;
  onTogglePantryItem: (itemId: string, requiredQty?: number) => void;
}

export function RecipeTable({
  results,
  db,
  hasPantryItems,
  quantityMode = false,
  onSelectRecipe,
  onTogglePantryItem,
}: RecipeTableProps) {
  return (
    <div className="space-y-1.5">
      <p
        className="text-xs md:hidden"
        style={{ color: 'var(--text-muted)' }}
      >
        Swipe horizontally to compare all stats
      </p>
      <div
        className="overflow-x-auto rounded-md border"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr
              className="border-b text-xs font-semibold"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-muted)',
              }}
            >
              <th
                scope="col"
                className="sticky left-0 z-10 border-r px-3.5 py-2.5 font-semibold"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)',
                  boxShadow: 'var(--shadow-sticky-col)',
                }}
              >
                Recipe
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Station
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Ingredients
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Hunger
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Thirst
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Rad
              </th>
              <th scope="col" className="px-3.5 py-2.5 font-semibold">
                Buffs / Effect
              </th>
            </tr>
          </thead>
          <tbody>
            {results.map((res, idx) => {
              const r = res.recipe;
              const fallbackKind: ImageFallbackKind =
                r.category === 'soup'
                  ? 'soup'
                  : r.category === 'chemistry'
                    ? 'chemistry'
                    : 'food';
              const isHazard =
                r.subcategory === 'unsafe-soup' ||
                r.id === 'chem-unstable-flask';
              return (
                <tr
                  key={r.id}
                  onClick={() => onSelectRecipe(res)}
                  className="row-hover cursor-pointer border-b transition-colors last:border-b-0"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <td
                    className="sticky-table-cell sticky left-0 z-10 border-r px-3.5 py-3 transition-colors"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      boxShadow: 'var(--shadow-sticky-col)',
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <ItemImage
                        src={r.image}
                        fallbackKind={fallbackKind}
                        loading={idx < 15 ? 'eager' : 'lazy'}
                        width={28}
                        height={28}
                        className="h-7 w-7 shrink-0 rounded object-contain"
                      />
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectRecipe(res);
                          }}
                          className="text-left text-sm font-semibold hover:underline"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {r.name}
                        </button>
                        {hasPantryItems && res.status === 'craftable' && (
                          <div
                            className="inline-flex items-center gap-1 text-xs font-medium"
                            style={{
                              color:
                                res.craftMethod === 'via-distillation'
                                  ? 'var(--accent-chem)'
                                  : 'var(--accent-ready)',
                            }}
                          >
                            {res.craftMethod === 'via-distillation' ? (
                              <>
                                <Beaker className="h-3 w-3" aria-hidden="true" /> Via Distillation
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Ready
                              </>
                            )}
                          </div>
                        )}
                        {hasPantryItems && res.status === 'almost' && (
                          <div
                            className="font-readout text-xs font-medium"
                            style={{ color: 'var(--accent-food)' }}
                          >
                            Missing {res.missingDistinctCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td
                    className="whitespace-nowrap px-3 py-3"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {r.workstation}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {res.ingredientStatuses.map((ing, idx) => {
                        const item = db.items[ing.itemId];
                        const name = item?.name || ing.itemId;
                        const have =
                          ing.haveDirect + ing.fulfilledViaDistillation;
                        const isOwned = ing.status === 'owned';
                        const isDistill = ing.status === 'distillable';
                        const isPartial = ing.status === 'partial';
                        const pillTitle = isOwned
                          ? `Click to remove ${name}`
                          : isPartial
                            ? `Have ${have}/${ing.required} ${name} — click to set to ${ing.required}`
                            : isDistill
                              ? `Distillable ${name} (x${ing.required})`
                              : `Click to add ${name}${quantityMode && ing.required > 1 ? ` (×${ing.required})` : ''}`;
                        return (
                          <button
                            key={`${ing.itemId}-${idx}`}
                            type="button"
                            aria-pressed={isOwned}
                            onClick={(e) => {
                              e.stopPropagation();
                              onTogglePantryItem(ing.itemId, ing.required);
                            }}
                            title={pillTitle}
                            className="surface-hover inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs transition-colors"
                            style={{
                              backgroundColor:
                                hasPantryItems && isOwned
                                  ? 'var(--accent-ready-bg)'
                                  : hasPantryItems && isPartial
                                    ? 'var(--accent-food-bg)'
                                    : hasPantryItems && isDistill
                                      ? 'var(--accent-chem-bg)'
                                      : 'var(--bg-ground)',
                              borderColor:
                                hasPantryItems && isOwned
                                  ? 'var(--accent-ready-border)'
                                  : hasPantryItems && isPartial
                                    ? 'var(--accent-food-border)'
                                    : hasPantryItems && isDistill
                                      ? 'var(--accent-chem-border)'
                                      : 'var(--border-subtle)',
                              color:
                                hasPantryItems && isPartial
                                  ? 'var(--accent-food)'
                                  : 'var(--text-primary)',
                            }}
                          >
                            {hasPantryItems && isOwned ? (
                              <Check
                                className="h-3 w-3 shrink-0"
                                aria-hidden="true"
                                style={{ color: 'var(--accent-ready)' }}
                              />
                            ) : hasPantryItems && isDistill ? (
                              <Beaker
                                className="h-3 w-3 shrink-0"
                                aria-hidden="true"
                                style={{ color: 'var(--accent-chem)' }}
                              />
                            ) : (
                              <Plus
                                className="h-3 w-3 shrink-0"
                                aria-hidden="true"
                                style={{
                                  color:
                                    hasPantryItems && isPartial
                                      ? 'var(--accent-food)'
                                      : 'var(--text-muted)',
                                }}
                              />
                            )}
                            <span>{name}</span>
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
                      })}
                    </div>
                  </td>
                  <td
                    className="font-readout whitespace-nowrap px-3 py-3 text-right font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {r.stats.hunger !== undefined
                      ? formatStatValue(r.stats.hunger)
                      : '—'}
                  </td>
                  <td
                    className="font-readout whitespace-nowrap px-3 py-3 text-right font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {r.stats.thirst !== undefined
                      ? formatStatValue(r.stats.thirst)
                      : '—'}
                  </td>
                  <td
                    className="font-readout whitespace-nowrap px-3 py-3 text-right font-medium"
                    style={{
                      color:
                        (r.stats.radiation ?? 0) > 0
                          ? 'var(--accent-hazard)'
                          : 'var(--text-muted)',
                    }}
                  >
                    {r.stats.radiation !== undefined
                      ? formatStatValue(r.stats.radiation)
                      : '—'}
                  </td>
                  <td className="max-w-xs px-3.5 py-3">
                    {r.stats.buffs && r.stats.buffs.length > 0 ? (
                      <div className="space-y-1">
                        {r.stats.buffs.map((buff) => {
                          const detail = buff.effect || buff.description;
                          const buffColor = buff.isNegative
                            ? 'var(--accent-hazard)'
                            : r.category === 'chemistry'
                              ? 'var(--accent-chem)'
                              : 'var(--accent-food)';
                          return (
                            <div
                              key={buff.name}
                              className="flex items-start gap-1.5 break-words leading-snug"
                            >
                              {buff.isNegative ? (
                                <AlertTriangle
                                  className="mt-0.5 h-3 w-3 shrink-0"
                                  aria-hidden="true"
                                  style={{ color: buffColor }}
                                />
                              ) : r.category === 'chemistry' ? (
                                <Activity
                                  className="mt-0.5 h-3 w-3 shrink-0"
                                  aria-hidden="true"
                                  style={{ color: buffColor }}
                                />
                              ) : (
                                <HeartPulse
                                  className="mt-0.5 h-3 w-3 shrink-0"
                                  aria-hidden="true"
                                  style={{ color: buffColor }}
                                />
                              )}
                              <div>
                                <span
                                  className="font-semibold"
                                  style={{ color: buffColor }}
                                >
                                  {buff.name}
                                </span>
                                {detail && (
                                  <span style={{ color: 'var(--text-secondary)' }}>
                                    {' '}
                                    — {detail}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <>
                        {isHazard && (
                          <span
                            className="mr-1.5 inline-flex items-center gap-1 font-semibold"
                            style={{ color: 'var(--accent-hazard)' }}
                          >
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          </span>
                        )}
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {r.stats.effectSummary || '—'}
                        </span>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
