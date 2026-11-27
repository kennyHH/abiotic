import { useMemo, useState } from 'react';
import { Beaker, Check, FlaskConical, Plus } from 'lucide-react';
import type { Item, Recipe, RecipeDatabase } from '../types/recipes';
import type { PantryDistillationSummary } from '../lib/matcher';
import { ItemImage } from './ItemImage';

interface DistillationGuideProps {
  db: RecipeDatabase;
  pantry: Record<string, number>;
  distillationSummary: Record<string, PantryDistillationSummary>;
  search: string;
  onTogglePantryItem: (itemId: string, requiredQty?: number) => void;
  onSelectRecipeId?: (recipeId: string) => void;
  onClearSearch?: () => void;
}

export function DistillationGuide({
  db,
  pantry,
  distillationSummary,
  search,
  onTogglePantryItem,
  onSelectRecipeId,
  onClearSearch,
}: DistillationGuideProps) {
  const [expandedSources, setExpandedSources] = useState<
    Record<string, boolean>
  >({});

  const distillationGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sourcesMap = new Map<string, { item: Item; amount: number }[]>();
    const usedInMap = new Map<string, Recipe[]>();

    for (const distId of db.distillationIds) {
      sourcesMap.set(distId, []);
      usedInMap.set(distId, []);
    }

    for (const item of Object.values(db.items)) {
      for (const y of item.distillsInto || []) {
        const arr = sourcesMap.get(y.distillationId) ?? [];
        arr.push({ item, amount: y.amount });
        sourcesMap.set(y.distillationId, arr);
      }
    }

    for (const recipe of db.recipes) {
      if (recipe.category !== 'chemistry') continue;
      for (const ing of recipe.ingredients) {
        const arr = usedInMap.get(ing.itemId);
        if (arr && !arr.some((r) => r.id === recipe.id)) {
          arr.push(recipe);
        }
      }
    }

    return [...sourcesMap.entries()]
      .map(([distId, sources]) => {
        const distItem = db.items[distId];
        const usedIn = (usedInMap.get(distId) ?? []).sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        sources.sort(
          (a, b) =>
            b.amount - a.amount || a.item.name.localeCompare(b.item.name)
        );
        return { distId, distItem, sources, usedIn };
      })
      .filter((entry) => {
        if (!entry.distItem) return false;
        if (entry.sources.length === 0 && entry.usedIn.length === 0) return false;
        if (!q) return true;
        if (entry.distItem.name.toLowerCase().includes(q)) return true;
        if (entry.sources.some((s) => s.item.name.toLowerCase().includes(q))) {
          return true;
        }
        return entry.usedIn.some((r) => r.name.toLowerCase().includes(q));
      });
  }, [db, search]);

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-l-[3px] px-4 py-3"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          borderLeftColor: 'var(--accent-chem)',
        }}
      >
        <div>
          <h2
            className="text-lg font-semibold tracking-[-0.02em]"
            style={{ color: 'var(--text-primary)' }}
          >
            Stage 1: Distillation Bench Conversion Reference
          </h2>
          <p
            className="text-pretty mt-1 max-w-[68ch] text-sm leading-relaxed"
            style={{ color: 'var(--text-muted)' }}
          >
            Feed raw organic, food, or anomaly items into a Distillation Bench to
            extract reagents for Chemistry Bench recipes. Click any item to
            toggle it in your Pantry, or click a Chemistry recipe to inspect its
            3-slot mix.
          </p>
        </div>
        <span
          className="font-readout rounded border px-2.5 py-1 text-xs font-semibold"
          style={{
            backgroundColor: 'var(--accent-chem-bg)',
            borderColor: 'var(--accent-chem-border)',
            color: 'var(--accent-chem)',
          }}
        >
          {distillationGroups.length} Distillations
        </span>
      </div>

      {distillationGroups.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 rounded-md border py-12 text-center"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No distillations or raw sources match &ldquo;{search}&rdquo;.
          </p>
          {onClearSearch && (
            <button
              type="button"
              onClick={onClearSearch}
              className="rounded border px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {distillationGroups.map(({ distId, distItem, sources, usedIn }, idx) => {
            if (!distItem) return null;
            const eager = idx < 6;
            const summary = distillationSummary[distId];
            const unlocked =
              (summary?.directQty ?? 0) > 0 || (summary?.fromRawQty ?? 0) > 0;
            const directInPantry = (pantry[distId] ?? 0) > 0;
            const hasSearch = search.trim().length > 0;
            const isExpanded = Boolean(expandedSources[distId]);
            const isCollapsed = sources.length > 6 && !hasSearch && !isExpanded;
            const visibleSources = isCollapsed
              ? [
                  ...sources.filter((s) => (pantry[s.item.id] ?? 0) > 0),
                  ...sources.filter((s) => (pantry[s.item.id] ?? 0) <= 0),
                ].slice(0, 6)
              : sources;

            return (
              <section
                key={distId}
                className="card-hover flex overflow-hidden rounded-md border transition-colors"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: unlocked
                    ? 'var(--accent-chem-border)'
                    : 'var(--border-subtle)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div
                  aria-hidden="true"
                  className="w-[3px] shrink-0"
                  style={{
                    backgroundColor: unlocked
                      ? 'var(--accent-chem)'
                      : 'var(--border-strong)',
                  }}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="specimen-bay flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded p-1">
                      <ItemImage
                        src={distItem.image}
                        alt={distItem.name}
                        fallbackKind="distillation"
                        loading={eager ? 'eager' : 'lazy'}
                        width={40}
                        height={40}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div>
                      <h3
                        className="text-[15px] font-semibold leading-snug"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {distItem.name}
                      </h3>
                      <p
                        className="font-readout text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {sources.length} raw sources / {usedIn.length} mixes
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-pressed={directInPantry}
                    onClick={() => onTogglePantryItem(distId)}
                    className="surface-hover touch-chip pressable flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: directInPantry
                        ? 'var(--accent-ready-bg)'
                        : unlocked
                          ? 'var(--accent-chem-bg)'
                          : 'var(--bg-ground)',
                      borderColor: directInPantry
                        ? 'var(--accent-ready-border)'
                        : unlocked
                          ? 'var(--accent-chem-border)'
                          : 'var(--border-subtle)',
                      color: directInPantry
                        ? 'var(--accent-ready)'
                        : unlocked
                          ? 'var(--accent-chem)'
                          : 'var(--text-secondary)',
                    }}
                  >
                    {directInPantry ? (
                      <>
                        <Check className="h-3.5 w-3.5" aria-hidden="true" /> Owned
                      </>
                    ) : unlocked ? (
                      <>
                        <Beaker className="h-3.5 w-3.5" aria-hidden="true" /> Distillable
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add Reagent
                      </>
                    )}
                  </button>
                </div>

                {/* Raw item sources */}
                <div className="flex flex-wrap gap-1.5">
                  {visibleSources.map(({ item: raw, amount }) => {
                    const owned = (pantry[raw.id] ?? 0) > 0;
                    return (
                      <button
                        key={raw.id}
                        type="button"
                        aria-pressed={owned}
                        onClick={() => onTogglePantryItem(raw.id)}
                        className="surface-hover touch-chip pressable flex items-center gap-1.5 rounded border px-2 py-1 text-[13px] transition-colors"
                        style={{
                          backgroundColor: owned
                            ? 'var(--accent-ready-bg)'
                            : 'var(--bg-ground)',
                          borderColor: owned
                            ? 'var(--accent-ready-border)'
                            : 'var(--border-subtle)',
                          color: owned
                            ? 'var(--accent-ready)'
                            : 'var(--text-primary)',
                        }}
                      >
                        <ItemImage
                          src={raw.image}
                          fallbackKind="ingredient"
                          loading={eager ? 'eager' : 'lazy'}
                          width={16}
                          height={16}
                          className="h-4 w-4 shrink-0 object-contain"
                        />
                        <span>{raw.name}</span>
                        <span
                          className="font-readout rounded px-1 py-0.5 text-xs font-semibold"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            color: 'var(--accent-chem)',
                          }}
                        >
                          x{amount}
                        </span>
                        {owned ? (
                          <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                        ) : (
                          <Plus
                            className="h-3 w-3 shrink-0 opacity-60"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                  {sources.length > 6 && !hasSearch && (
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() =>
                        setExpandedSources((prev) => ({
                          ...prev,
                          [distId]: !prev[distId],
                        }))
                      }
                      className="surface-hover touch-chip pressable rounded border px-2.5 py-1 text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {isExpanded
                        ? 'Show fewer'
                        : `Show all ${sources.length} sources`}
                    </button>
                  )}
                </div>

                {/* Forward links: Chemistry recipes consuming this distillation */}
                {usedIn.length > 0 && (
                  <div
                    className="mt-auto border-t pt-3"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <div
                      className="mb-1.5 flex items-center gap-1 text-xs font-medium"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <FlaskConical
                        className="h-3 w-3"
                        aria-hidden="true"
                        style={{ color: 'var(--accent-chem)' }}
                      />
                      <span>Used in ({usedIn.length}):</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {usedIn.map((recipe) => (
                        <button
                          key={recipe.id}
                          type="button"
                          onClick={() => onSelectRecipeId?.(recipe.id)}
                          className="surface-hover touch-chip pressable inline-flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors"
                          style={{
                            backgroundColor: 'var(--bg-ground)',
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <ItemImage
                            src={recipe.image}
                            fallbackKind="chemistry"
                            className="h-3.5 w-3.5 shrink-0 object-contain"
                          />
                          <span>{recipe.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
