import {
  memo,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowLeftRight,
  ArrowUpDown,
  Backpack,
  Beaker,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Hammer,
  Layers,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { Item, RecipeDatabase } from '../types/recipes';
import {
  getPantryCatalog,
  type PantryCatalogEntry,
  type PantryDistillationSummary,
} from '../lib/matcher';
import { ItemImage } from './ItemImage';
import {
  CustomSelect,
  InfoPopover,
  QuantityInput,
  ToggleSwitch,
  type SelectOption,
} from './UiControls';

type WorkspaceCategory = 'all' | Item['categoryTag'];
type WorkspaceSort = 'most-used' | 'owned-first' | 'name-asc' | 'qty-desc';

const CATEGORY_META: {
  id: Item['categoryTag'];
  label: string;
}[] = [
  { id: 'produce', label: 'Produce' },
  { id: 'meat', label: 'Meat & Fish' },
  { id: 'packaged', label: 'Packaged' },
  { id: 'distillation', label: 'Distillations' },
  { id: 'lab', label: 'Lab' },
  { id: 'other', label: 'Other' },
];

const CATEGORY_LABELS: Record<Item['categoryTag'], string> = {
  produce: 'Produce',
  meat: 'Meat & Fish',
  packaged: 'Packaged',
  distillation: 'Distillation',
  lab: 'Lab',
  other: 'Other',
};

interface PantryWorkspaceCardProps {
  entry: PantryCatalogEntry;
  qty: number;
  acquireQty: number;
  quantityMode: boolean;
  eager: boolean;
  onToggleItem: (id: string) => void;
  onIncrementItem: (id: string) => void;
  onDecrementItem: (id: string) => void;
  onSetQuantity: (id: string, qty: number) => void;
  onAdjustQuantity: (id: string, delta: number) => void;
  onMarkItemAcquired: (id: string) => void;
}

const PantryWorkspaceCard = memo(function PantryWorkspaceCard({
  entry,
  qty,
  acquireQty,
  quantityMode,
  eager,
  onToggleItem,
  onIncrementItem,
  onDecrementItem,
  onSetQuantity,
  onAdjustQuantity,
  onMarkItemAcquired,
}: PantryWorkspaceCardProps) {
  const { item, distillHint, safeUsageCount } = entry;
  const isOwned = qty > 0;

  return (
    <div
      className={`${eager ? '' : 'cv-row '}flex flex-col justify-between gap-2.5 rounded-md border p-3 transition-colors`}
      style={{
        backgroundColor: isOwned
          ? 'var(--accent-ready-bg)'
          : 'var(--bg-surface)',
        borderColor: isOwned
          ? 'var(--accent-ready-border)'
          : 'var(--border-subtle)',
        borderLeftWidth: isOwned ? '3px' : undefined,
        borderLeftColor: isOwned ? 'var(--accent-ready)' : undefined,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-start gap-2.5">
        <div className="specimen-bay flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded p-0.5">
          <ItemImage
            src={item.image}
            fallbackKind={
              item.kind === 'distillation' ? 'distillation' : 'ingredient'
            }
            loading={eager ? 'eager' : 'lazy'}
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div
              className="truncate text-sm font-semibold"
              title={item.name}
              style={{ color: 'var(--text-primary)' }}
            >
              {item.name}
            </div>
            <button
              type="button"
              aria-pressed={isOwned}
              aria-label={
                isOwned
                  ? `Remove ${item.name} from pantry`
                  : `Add ${item.name} to pantry`
              }
              onClick={() => onToggleItem(item.id)}
              className="surface-hover touch-chip pressable inline-flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold transition-colors"
              style={{
                backgroundColor: isOwned
                  ? 'var(--accent-ready)'
                  : 'var(--bg-well)',
                borderColor: isOwned
                  ? 'transparent'
                  : 'var(--border-subtle)',
                color: isOwned
                  ? 'var(--text-on-ready)'
                  : 'var(--text-secondary)',
              }}
            >
              {isOwned ? (
                <>
                  <Check className="h-3 w-3 stroke-[2.5]" aria-hidden="true" />
                  <span>Owned</span>
                </>
              ) : (
                <>
                  <Plus className="h-3 w-3" aria-hidden="true" />
                  <span>Add</span>
                </>
              )}
            </button>
          </div>
          <div
            className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>{CATEGORY_LABELS[item.categoryTag]}</span>
            {safeUsageCount > 0 && (
              <span className="font-readout">
                Used in {safeUsageCount}{' '}
                {safeUsageCount === 1 ? 'recipe' : 'recipes'}
              </span>
            )}
          </div>
          {distillHint && (
            <div
              className="mt-0.5 truncate text-xs"
              title={`Distills into ${distillHint}`}
              style={{ color: 'var(--accent-chem)' }}
            >
              Distills: {distillHint}
            </div>
          )}
        </div>
      </div>

      {(acquireQty > 0 || (isOwned && quantityMode)) && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-t pt-2"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          {acquireQty > 0 ? (
            <button
              type="button"
              onClick={() => onMarkItemAcquired(item.id)}
              title="Mark acquired and move quantity to Pantry"
              className="surface-hover touch-chip pressable inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: 'var(--accent-food-bg)',
                borderColor: 'var(--accent-food-border)',
                color: 'var(--accent-food)',
              }}
            >
              <ClipboardList className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Acquire ×{acquireQty} · Got it</span>
            </button>
          ) : (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Stock count
            </span>
          )}

          {isOwned && quantityMode && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onDecrementItem(item.id)}
                aria-label={`Decrease ${item.name}`}
                className="touch-target inline-flex items-center justify-center rounded border"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                <Minus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <QuantityInput
                value={qty}
                itemName={item.name}
                onCommit={(nextQty) => onSetQuantity(item.id, nextQty)}
              />
              <button
                type="button"
                onClick={() => onIncrementItem(item.id)}
                aria-label={`Increase ${item.name}`}
                className="touch-target inline-flex items-center justify-center rounded border"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onAdjustQuantity(item.id, 5)}
                aria-label={`Add 5 ${item.name}`}
                className="font-readout touch-target inline-flex items-center justify-center rounded border px-1.5 text-xs font-semibold"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--accent-ready)',
                }}
              >
                +5
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

interface PantryWorkspaceProps {
  db: RecipeDatabase;
  pantry: Record<string, number>;
  acquire: Record<string, number>;
  quantityMode: boolean;
  includeDistillationChain: boolean;
  hideUnsafeSoups: boolean;
  distillationSummary: Record<string, PantryDistillationSummary>;
  craftableCount: number;
  almostCount: number;
  lastClearedCount: number;
  lastRemovedItem: { id: string; qty: number } | null;
  onToggleItem: (id: string) => void;
  onIncrementItem: (id: string) => void;
  onDecrementItem: (id: string) => void;
  onSetQuantity: (id: string, qty: number) => void;
  onAdjustQuantity: (id: string, delta: number) => void;
  onClearPantry: () => void;
  onClearPantrySubset: (itemIds: string[]) => void;
  onUndoClearPantry: () => void;
  onDismissUndo: () => void;
  onUndoRemovedItem: () => void;
  onDismissRemovedItem: () => void;
  onMarkItemAcquired: (id: string) => void;
  onSetQuantityMode: (val: boolean) => void;
  onSetIncludeDistillationChain: (val: boolean) => void;
  onNavigateToRecipes: () => void;
  onOpenExportImport: () => void;
}

export function PantryWorkspace({
  db,
  pantry,
  acquire,
  quantityMode,
  includeDistillationChain,
  hideUnsafeSoups,
  distillationSummary,
  craftableCount,
  almostCount,
  lastClearedCount,
  lastRemovedItem,
  onToggleItem,
  onIncrementItem,
  onDecrementItem,
  onSetQuantity,
  onAdjustQuantity,
  onClearPantry,
  onClearPantrySubset,
  onUndoClearPantry,
  onDismissUndo,
  onUndoRemovedItem,
  onDismissRemovedItem,
  onMarkItemAcquired,
  onSetQuantityMode,
  onSetIncludeDistillationChain,
  onNavigateToRecipes,
  onOpenExportImport,
}: PantryWorkspaceProps) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [category, setCategory] = useState<WorkspaceCategory>('all');
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<WorkspaceSort>('most-used');
  const [groupByCategory, setGroupByCategory] = useState(true);
  const [collapsedCategories, setCollapsedCategories] = useState<
    Record<string, boolean>
  >({});
  const [confirmClear, setConfirmClear] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key !== 'p' && e.key !== 'P') ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      ) {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const allEntries = useMemo(() => getPantryCatalog(db), [db]);

  const visibleCatalogEntries = useMemo(() => {
    return allEntries.filter(
      (entry) =>
        !hideUnsafeSoups ||
        entry.isSafeRecipeItem ||
        (pantry[entry.item.id] ?? 0) > 0
    );
  }, [allEntries, hideUnsafeSoups, pantry]);

  const ownedSummary = useMemo(() => {
    let distinct = 0;
    let totalUnits = 0;
    for (const qty of Object.values(pantry)) {
      if (qty > 0) {
        distinct += 1;
        totalUnits += qty;
      }
    }
    return { distinct, totalUnits };
  }, [pantry]);

  useEffect(() => {
    if (ownedSummary.distinct < 5 && confirmClear) {
      setConfirmClear(false);
    }
  }, [ownedSummary.distinct, confirmClear]);

  const unlockedDistillationCount = useMemo(() => {
    return Object.values(distillationSummary).filter(
      (s) => s.directQty > 0 || s.fromRawQty > 0
    ).length;
  }, [distillationSummary]);

  const categoryCounts = useMemo(() => {
    const counts: Record<WorkspaceCategory, number> = {
      all: 0,
      produce: 0,
      meat: 0,
      packaged: 0,
      distillation: 0,
      lab: 0,
      other: 0,
    };
    for (const entry of visibleCatalogEntries) {
      if (ownedOnly && (pantry[entry.item.id] ?? 0) <= 0) continue;
      counts.all += 1;
      counts[entry.item.categoryTag] += 1;
    }
    return counts;
  }, [visibleCatalogEntries, ownedOnly, pantry]);

  const sortOptions = useMemo<SelectOption<WorkspaceSort>[]>(
    () => [
      { value: 'most-used', label: 'Sort: Most Used in Recipes' },
      { value: 'owned-first', label: 'Sort: Owned First' },
      { value: 'name-asc', label: 'Sort: Name (A → Z)' },
      { value: 'qty-desc', label: 'Sort: Quantity (High → Low)' },
    ],
    []
  );

  const filteredEntries = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const filtered = visibleCatalogEntries.filter((entry) => {
      if (ownedOnly && (pantry[entry.item.id] ?? 0) <= 0) return false;
      if (category !== 'all' && entry.item.categoryTag !== category) return false;
      if (
        q &&
        !entry.searchText.includes(q) &&
        !CATEGORY_LABELS[entry.item.categoryTag].toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      const qa = pantry[a.item.id] ?? 0;
      const qb = pantry[b.item.id] ?? 0;
      if (sortBy === 'owned-first') {
        const oa = qa > 0 ? 1 : 0;
        const ob = qb > 0 ? 1 : 0;
        if (ob !== oa) return ob - oa;
        if (qb !== qa) return qb - qa;
        return (
          b.safeUsageCount - a.safeUsageCount ||
          a.item.name.localeCompare(b.item.name)
        );
      }
      if (sortBy === 'qty-desc') {
        if (qb !== qa) return qb - qa;
        return (
          b.safeUsageCount - a.safeUsageCount ||
          a.item.name.localeCompare(b.item.name)
        );
      }
      if (sortBy === 'name-asc') {
        return a.item.name.localeCompare(b.item.name);
      }
      return (
        b.safeUsageCount - a.safeUsageCount ||
        a.item.name.localeCompare(b.item.name)
      );
    });
  }, [visibleCatalogEntries, ownedOnly, pantry, category, deferredSearch, sortBy]);

  const showGrouped =
    groupByCategory && category === 'all' && deferredSearch.trim().length === 0;

  const groupedSections = useMemo(() => {
    if (!showGrouped) return [];
    let runningIndex = 0;
    return CATEGORY_META.map((meta) => {
      const items = filteredEntries.filter(
        (entry) => entry.item.categoryTag === meta.id
      );
      if (items.length === 0) return null;
      const ownedIds = items
        .filter((entry) => (pantry[entry.item.id] ?? 0) > 0)
        .map((entry) => entry.item.id);
      const startIndex = runningIndex;
      if (!collapsedCategories[meta.id]) {
        runningIndex += items.length;
      }
      return {
        ...meta,
        items,
        ownedIds,
        startIndex,
      };
    }).filter((sec): sec is NonNullable<typeof sec> => sec !== null);
  }, [showGrouped, filteredEntries, pantry, collapsedCategories]);

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div
        className="flex flex-wrap items-start justify-between gap-4 rounded-md border border-l-[3px] px-4 py-3.5"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          borderLeftColor: 'var(--accent-ready)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="space-y-2">
          <div>
            <h2
              className="flex items-center gap-2 text-lg font-semibold tracking-[-0.02em]"
              style={{ color: 'var(--text-primary)' }}
            >
              <Backpack
                className="h-5 w-5 shrink-0"
                aria-hidden="true"
                style={{ color: 'var(--accent-ready)' }}
              />
              <span>Pantry Inventory Manager</span>
            </h2>
            <p
              className="text-pretty mt-1 max-w-[68ch] text-sm leading-relaxed"
              style={{ color: 'var(--text-muted)' }}
            >
              Manage all fridge, storage, and backpack items in one place. Every
              change stays synced with the recipe matcher and quick sidebar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className="font-readout inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-semibold"
              style={{
                backgroundColor:
                  ownedSummary.distinct > 0
                    ? 'var(--accent-ready-bg)'
                    : 'var(--bg-well)',
                borderColor:
                  ownedSummary.distinct > 0
                    ? 'var(--accent-ready-border)'
                    : 'var(--border-subtle)',
                color:
                  ownedSummary.distinct > 0
                    ? 'var(--accent-ready)'
                    : 'var(--text-secondary)',
              }}
            >
              <span>{ownedSummary.distinct} Owned</span>
              {quantityMode && ownedSummary.totalUnits > 0 && (
                <span>({ownedSummary.totalUnits} total units)</span>
              )}
            </span>

            {ownedSummary.distinct > 0 && (
              <>
                <button
                  type="button"
                  onClick={onNavigateToRecipes}
                  className="surface-hover font-readout pressable inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: 'var(--accent-ready-bg)',
                    borderColor: 'var(--accent-ready-border)',
                    color: 'var(--accent-ready)',
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{craftableCount} Craftable Now</span>
                </button>

                <button
                  type="button"
                  onClick={onNavigateToRecipes}
                  className="surface-hover font-readout pressable inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: 'var(--accent-food-bg)',
                    borderColor: 'var(--accent-food-border)',
                    color: 'var(--accent-food)',
                  }}
                >
                  <Hammer className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{almostCount} Almost Craftable</span>
                </button>
              </>
            )}

            {includeDistillationChain && unlockedDistillationCount > 0 && (
              <span
                className="font-readout inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: 'var(--accent-chem-bg)',
                  borderColor: 'var(--accent-chem-border)',
                  color: 'var(--accent-chem)',
                }}
              >
                <Beaker className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {unlockedDistillationCount} / {db.distillationIds.length}{' '}
                  Distillations
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenExportImport}
            className="surface-hover touch-chip pressable inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-[13px] font-medium transition-colors"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text-primary)',
            }}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Export / Import</span>
          </button>

          {ownedSummary.distinct > 0 &&
            (confirmClear && ownedSummary.distinct >= 5 ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmClear(false);
                    onClearPantry();
                  }}
                  className="touch-chip rounded border px-2.5 py-1.5 text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: 'var(--accent-hazard-bg)',
                    borderColor: 'var(--accent-hazard-border)',
                    color: 'var(--accent-hazard)',
                  }}
                >
                  Confirm clear ({ownedSummary.distinct})
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="touch-chip rounded border px-2.5 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (ownedSummary.distinct >= 5) {
                    setConfirmClear(true);
                  } else {
                    onClearPantry();
                  }
                }}
                className="surface-hover touch-chip pressable inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-[13px] font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--accent-hazard-bg)',
                  borderColor: 'var(--accent-hazard-border)',
                  color: 'var(--accent-hazard)',
                }}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Clear Pantry</span>
              </button>
            ))}
        </div>
      </div>

      {/* Synced Matching Controls + Undo Banners */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3.5 py-2.5"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className="text-[13px] font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              Matching mode
            </span>
            <div
              className="flex rounded-md border p-0.5"
              style={{
                backgroundColor: 'var(--bg-well)',
                borderColor: 'var(--border-subtle)',
                boxShadow: 'var(--inset-well)',
              }}
              role="group"
              aria-label="Workspace inventory matching mode"
            >
              <button
                type="button"
                aria-pressed={!quantityMode}
                onClick={() => onSetQuantityMode(false)}
                className="rounded border px-2.5 py-1 text-[13px] font-medium transition-colors"
                style={{
                  backgroundColor: !quantityMode
                    ? 'var(--control-active-bg)'
                    : 'transparent',
                  borderColor: !quantityMode
                    ? 'var(--control-active-border)'
                    : 'transparent',
                  boxShadow: !quantityMode ? 'var(--specular-top)' : undefined,
                  color: !quantityMode
                    ? 'var(--text-primary)'
                    : 'var(--text-muted)',
                }}
              >
                Checklist
              </button>
              <button
                type="button"
                aria-pressed={quantityMode}
                onClick={() => onSetQuantityMode(true)}
                className="rounded border px-2.5 py-1 text-[13px] font-medium transition-colors"
                style={{
                  backgroundColor: quantityMode
                    ? 'var(--control-active-bg)'
                    : 'transparent',
                  borderColor: quantityMode
                    ? 'var(--control-active-border)'
                    : 'transparent',
                  boxShadow: quantityMode ? 'var(--specular-top)' : undefined,
                  color: quantityMode
                    ? 'var(--text-primary)'
                    : 'var(--text-muted)',
                }}
              >
                Quantities
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Beaker
              className="h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
              style={{ color: 'var(--accent-chem)' }}
            />
            <span
              className="text-[13px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Auto-distill raw items
            </span>
            <InfoPopover
              ariaLabel="Workspace auto-distill help"
              align="left"
              triggerClassName="p-1"
            >
              <p>
                Automatically counts distillable raw items in your Pantry
                toward Chemistry Bench reagent requirements.
              </p>
            </InfoPopover>
            <ToggleSwitch
              checked={includeDistillationChain}
              onChange={onSetIncludeDistillationChain}
              ariaLabel="Auto-distill raw items"
              accentColor="var(--accent-chem)"
            />
          </div>
        </div>

        <button
          type="button"
          aria-pressed={groupByCategory}
          onClick={() => setGroupByCategory((prev) => !prev)}
          className="surface-hover touch-chip pressable inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition-colors"
          style={{
            backgroundColor: groupByCategory
              ? 'var(--control-active-bg)'
              : 'transparent',
            borderColor: groupByCategory
              ? 'var(--control-active-border)'
              : 'var(--border-subtle)',
            color: groupByCategory
              ? 'var(--text-primary)'
              : 'var(--text-secondary)',
          }}
        >
          <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Group by Category</span>
        </button>
      </div>

      {/* Undo Banners */}
      {lastRemovedItem && lastClearedCount === 0 && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-2 rounded-md border px-4 py-2 text-xs"
          style={{
            backgroundColor: 'var(--accent-food-bg)',
            borderColor: 'var(--accent-food-border)',
            color: 'var(--text-primary)',
          }}
        >
          <span className="tabular-nums">
            Removed {db.items[lastRemovedItem.id]?.name || lastRemovedItem.id}{' '}
            (×{lastRemovedItem.qty}).
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onUndoRemovedItem}
              className="surface-hover pressable inline-flex items-center gap-1 rounded border px-2 py-0.5 font-semibold"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Undo
            </button>
            <button
              type="button"
              onClick={onDismissRemovedItem}
              aria-label="Dismiss removed item undo"
              className="touch-target inline-flex items-center justify-center rounded hover:opacity-80"
              style={{ color: 'var(--text-secondary)' }}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {lastClearedCount > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-2 rounded-md border px-4 py-2 text-xs"
          style={{
            backgroundColor: 'var(--accent-food-bg)',
            borderColor: 'var(--accent-food-border)',
            color: 'var(--text-primary)',
          }}
        >
          <span className="tabular-nums">
            Cleared {lastClearedCount}{' '}
            {lastClearedCount === 1 ? 'item' : 'items'} from Pantry.
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onUndoClearPantry}
              className="surface-hover pressable inline-flex items-center gap-1 rounded border px-2 py-0.5 font-semibold"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Undo
            </button>
            <button
              type="button"
              onClick={onDismissUndo}
              aria-label="Dismiss clear pantry undo"
              className="touch-target inline-flex items-center justify-center rounded hover:opacity-80"
              style={{ color: 'var(--text-secondary)' }}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Search, Category Filter & Sort Toolbar */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items or distillations..."
              aria-label="Search pantry inventory"
              className="w-full rounded border py-1.5 pl-9 pr-10 text-base sm:text-sm"
              style={{
                backgroundColor: 'var(--bg-well)',
                borderColor: 'var(--border-subtle)',
                boxShadow: 'var(--inset-well)',
                color: 'var(--text-primary)',
              }}
            />
            {!search ? (
              <kbd
                aria-hidden="true"
                className="font-code pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border px-1.5 py-0.5 text-xs font-medium sm:inline-flex"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-muted)',
                }}
              >
                P
              </kbd>
            ) : (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear pantry search"
                className="touch-target absolute right-1 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded hover:opacity-80"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="button"
            aria-pressed={ownedOnly}
            onClick={() => setOwnedOnly((prev) => !prev)}
            className="surface-hover touch-chip pressable inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[13px] font-medium transition-colors"
            style={{
              backgroundColor: ownedOnly
                ? 'var(--accent-ready-bg)'
                : 'transparent',
              borderColor: ownedOnly
                ? 'var(--accent-ready-border)'
                : 'var(--border-subtle)',
              color: ownedOnly
                ? 'var(--accent-ready)'
                : 'var(--text-secondary)',
            }}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Owned Only</span>
            <span
              className="font-readout rounded px-1.5 py-0.5 text-xs font-semibold leading-none"
              style={{
                backgroundColor: 'var(--bg-well)',
                color: ownedOnly ? 'var(--accent-ready)' : 'var(--text-muted)',
              }}
            >
              {ownedSummary.distinct}
            </span>
          </button>

          <CustomSelect
            value={sortBy}
            options={sortOptions}
            onChange={setSortBy}
            ariaLabel="Sort pantry items"
            icon={<ArrowUpDown className="h-3.5 w-3.5" />}
            active={sortBy !== 'most-used'}
            align="right"
          />
        </div>

        {/* All 6 Fine-Grained Categories */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-pressed={category === 'all'}
            onClick={() => setCategory('all')}
            className="surface-hover touch-chip pressable inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition-colors"
            style={{
              backgroundColor:
                category === 'all' ? 'var(--control-active-bg)' : 'transparent',
              borderColor:
                category === 'all'
                  ? 'var(--control-active-border)'
                  : 'var(--border-subtle)',
              boxShadow: category === 'all' ? 'var(--specular-top)' : undefined,
              color:
                category === 'all'
                  ? 'var(--text-primary)'
                  : 'var(--text-muted)',
            }}
          >
            <span>All</span>
            <span className="font-readout opacity-80">{categoryCounts.all}</span>
          </button>

          {CATEGORY_META.map((cat) => {
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(cat.id)}
                className="surface-hover touch-chip pressable inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: active
                    ? 'var(--control-active-bg)'
                    : 'transparent',
                  borderColor: active
                    ? 'var(--control-active-border)'
                    : 'var(--border-subtle)',
                  boxShadow: active ? 'var(--specular-top)' : undefined,
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                <span>{cat.label}</span>
                <span className="font-readout opacity-80">
                  {categoryCounts[cat.id]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Item Grid or Empty State */}
      {filteredEntries.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 rounded-md border py-12 text-center text-sm"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-muted)',
          }}
        >
          <p className="text-pretty max-w-[56ch]">
            {ownedOnly && ownedSummary.distinct === 0
              ? 'Your Pantry is currently empty. Turn off Owned Only to browse all ingredients.'
              : 'No items match your current Pantry filters.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setCategory('all');
              setOwnedOnly(false);
            }}
            className="surface-hover rounded border px-3 py-1.5 text-xs font-medium"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text-primary)',
            }}
          >
            Reset pantry filters
          </button>
        </div>
      ) : showGrouped ? (
        <div className="space-y-5">
          {groupedSections.map((sec) => {
            const isCollapsed = Boolean(collapsedCategories[sec.id]);
            return (
              <section key={sec.id} className="space-y-2.5">
                <div
                  className="flex items-center justify-between gap-2 border-b pb-2"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <button
                    type="button"
                    aria-expanded={!isCollapsed}
                    onClick={() =>
                      setCollapsedCategories((prev) => ({
                        ...prev,
                        [sec.id]: !prev[sec.id],
                      }))
                    }
                    className="flex items-center gap-2 text-sm font-semibold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {isCollapsed ? (
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>{sec.label}</span>
                    <span
                      className="font-readout rounded px-1.5 py-0.5 text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--bg-well)',
                        color:
                          sec.ownedIds.length > 0
                            ? 'var(--accent-ready)'
                            : 'var(--text-muted)',
                      }}
                    >
                      {sec.ownedIds.length} / {sec.items.length}
                    </span>
                  </button>

                  {sec.ownedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onClearPantrySubset(sec.ownedIds)}
                      className="surface-hover inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors"
                      style={{ color: 'var(--accent-hazard)' }}
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                      <span>Clear {sec.label}</span>
                    </button>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {sec.items.map((entry, idx) => (
                      <PantryWorkspaceCard
                        key={entry.item.id}
                        entry={entry}
                        qty={pantry[entry.item.id] ?? 0}
                        acquireQty={acquire[entry.item.id] ?? 0}
                        quantityMode={quantityMode}
                        eager={sec.startIndex + idx < 16}
                        onToggleItem={onToggleItem}
                        onIncrementItem={onIncrementItem}
                        onDecrementItem={onDecrementItem}
                        onSetQuantity={onSetQuantity}
                        onAdjustQuantity={onAdjustQuantity}
                        onMarkItemAcquired={onMarkItemAcquired}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredEntries.map((entry, idx) => (
            <PantryWorkspaceCard
              key={entry.item.id}
              entry={entry}
              qty={pantry[entry.item.id] ?? 0}
              acquireQty={acquire[entry.item.id] ?? 0}
              quantityMode={quantityMode}
              eager={idx < 16}
              onToggleItem={onToggleItem}
              onIncrementItem={onIncrementItem}
              onDecrementItem={onDecrementItem}
              onSetQuantity={onSetQuantity}
              onAdjustQuantity={onAdjustQuantity}
              onMarkItemAcquired={onMarkItemAcquired}
            />
          ))}
        </div>
      )}
    </div>
  );
}
