import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Backpack,
  Beaker,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Minus,
  Package,
  PanelLeftClose,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import type { Item, RecipeDatabase } from '../types/recipes';
import type { PantryDistillationSummary } from '../lib/matcher';
import type { CustomAcquireItem, LastAcquiredItem } from '../hooks/usePantry';
import { ItemImage } from './ItemImage';
import { InfoPopover, ToggleSwitch } from './UiControls';

export type SidebarView = 'pantry' | 'acquire';

interface QuantityInputProps {
  value: number;
  itemName: string;
  ariaLabel?: string;
  onCommit: (nextQty: number) => void;
}

function QuantityInput({
  value,
  itemName,
  ariaLabel,
  onCommit,
}: QuantityInputProps) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDraft(String(value));
    }
  }, [value, editing]);

  const commitDraft = () => {
    setEditing(false);
    const parsed = parseInt(draft.replace(/[^0-9]/g, ''), 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setDraft('1');
      onCommit(1);
      return;
    }
    const clamped = Math.min(999, parsed);
    setDraft(String(clamped));
    onCommit(clamped);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={editing ? draft : String(value)}
      onFocus={() => {
        setEditing(true);
        setDraft(String(value));
      }}
      onChange={(e) => {
        const digitsOnly = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
        setDraft(digitsOnly);
      }}
      onBlur={commitDraft}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          setEditing(false);
          setDraft(String(value));
          e.currentTarget.blur();
        }
      }}
      aria-label={ariaLabel || `Quantity of ${itemName}`}
      className="tabular-nums no-spinners w-11 rounded border bg-transparent px-1 py-0.5 text-center text-base sm:text-[13px]"
      style={{ borderColor: 'var(--border-subtle)' }}
    />
  );
}

interface PantryPanelProps {
  db: RecipeDatabase;
  pantry: Record<string, number>;
  acquire: Record<string, number>;
  customAcquire: CustomAcquireItem[];
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
  quantityMode: boolean;
  includeDistillationChain: boolean;
  hideUnsafeSoups?: boolean;
  distillationSummary: Record<string, PantryDistillationSummary>;
  lastClearedCount: number;
  lastRemovedItem?: { id: string; qty: number } | null;
  lastClearedAcquireCount: number;
  lastAcquiredItem?: LastAcquiredItem | null;
  isMobileDrawer?: boolean;
  onToggleItem: (id: string) => void;
  onIncrementItem: (id: string) => void;
  onDecrementItem: (id: string) => void;
  onSetQuantity: (id: string, qty: number) => void;
  onClearPantry: () => void;
  onUndoClearPantry: () => void;
  onDismissUndo: () => void;
  onUndoRemovedItem?: () => void;
  onDismissRemovedItem?: () => void;
  onToggleAcquireItem: (id: string, defaultQty?: number) => void;
  onAddAcquireItem: (id: string, qty?: number) => void;
  onIncrementAcquireItem: (id: string) => void;
  onDecrementAcquireItem: (id: string) => void;
  onSetAcquireQuantity: (id: string, qty: number) => void;
  onRemoveAcquireItem: (id: string) => void;
  onMarkItemAcquired: (id: string) => void;
  onAddCustomAcquireItem: (name: string, qty?: number) => CustomAcquireItem | null;
  onIncrementCustomAcquireItem: (id: string) => void;
  onDecrementCustomAcquireItem: (id: string) => void;
  onSetCustomAcquireQuantity: (id: string, qty: number) => void;
  onRemoveCustomAcquireItem: (id: string) => void;
  onMarkCustomItemAcquired: (id: string) => void;
  onClearAcquireList: () => void;
  onUndoClearAcquireList: () => void;
  onDismissClearAcquireUndo: () => void;
  onUndoAcquiredItem: () => void;
  onDismissAcquiredItem: () => void;
  onSetQuantityMode: (val: boolean) => void;
  onSetIncludeDistillationChain: (val: boolean) => void;
  onCloseMobile?: () => void;
  onRequestOpenMobilePantry?: () => void;
  onCollapseDesktop?: () => void;
}

type GroupFilter = 'all' | 'food' | 'distillation' | 'lab';

interface SelectableItemEntry {
  item: Item;
  distillHint: string;
  searchText: string;
  isSafeRecipeItem: boolean;
}

interface PantryPickerRowProps {
  item: Item;
  distillHint: string;
  qty: number;
  quantityMode: boolean;
  eager?: boolean;
  onToggleItem: (id: string) => void;
  onIncrementItem: (id: string) => void;
  onDecrementItem: (id: string) => void;
}

const PantryPickerRow = memo(function PantryPickerRow({
  item,
  distillHint,
  qty,
  quantityMode,
  eager = false,
  onToggleItem,
  onIncrementItem,
  onDecrementItem,
}: PantryPickerRowProps) {
  const isSelected = qty > 0;
  const toggleLabel = isSelected
    ? `Remove ${item.name} from pantry`
    : `Add ${item.name} to pantry`;

  if (isSelected && quantityMode) {
    return (
      <div
        className={`${eager ? '' : 'cv-row '}surface-hover flex items-center justify-between gap-2.5 rounded border border-l-2 px-2.5 py-2 transition-colors`}
        style={{
          backgroundColor: 'var(--accent-ready-bg)',
          borderColor: 'var(--accent-ready-border)',
          borderLeftColor: 'var(--accent-ready)',
        }}
      >
        <button
          type="button"
          aria-pressed={true}
          aria-label={toggleLabel}
          onClick={() => onToggleItem(item.id)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <ItemImage
            src={item.image}
            fallbackKind={
              item.kind === 'distillation' ? 'distillation' : 'ingredient'
            }
            loading={eager ? 'eager' : 'lazy'}
            width={24}
            height={24}
            className="h-6 w-6 shrink-0 overflow-hidden rounded object-contain"
          />
          <div className="min-w-0 flex-1">
            <div
              className="truncate text-sm font-medium"
              title={item.name}
              style={{ color: 'var(--text-primary)' }}
            >
              {item.name}
            </div>
            {distillHint && (
              <div
                className="truncate text-xs"
                style={{ color: 'var(--accent-chem)' }}
              >
                Distills: {distillHint}
              </div>
            )}
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1">
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
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span
            className="tabular-nums w-6 text-center text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {qty}
          </span>
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
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      aria-label={toggleLabel}
      onClick={() => onToggleItem(item.id)}
      className={`${eager ? '' : 'cv-row '}surface-hover touch-chip flex w-full items-center justify-between gap-2.5 rounded border px-2.5 py-2 text-left transition-colors${isSelected ? ' border-l-2' : ''}`}
      style={{
        backgroundColor: isSelected ? 'var(--accent-ready-bg)' : 'transparent',
        borderColor: isSelected ? 'var(--accent-ready-border)' : 'transparent',
        borderLeftColor: isSelected ? 'var(--accent-ready)' : undefined,
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <ItemImage
          src={item.image}
          fallbackKind={
            item.kind === 'distillation' ? 'distillation' : 'ingredient'
          }
          loading={eager ? 'eager' : 'lazy'}
          width={24}
          height={24}
          className="h-6 w-6 shrink-0 overflow-hidden rounded object-contain"
        />
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-sm font-medium"
            title={item.name}
            style={{ color: 'var(--text-primary)' }}
          >
            {item.name}
          </div>
          {distillHint && (
            <div
              className="truncate text-xs"
              style={{ color: 'var(--accent-chem)' }}
            >
              Distills: {distillHint}
            </div>
          )}
        </div>
      </div>

      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors"
        style={{
          backgroundColor: isSelected ? 'var(--accent-ready)' : 'transparent',
          color: isSelected ? 'var(--text-on-ready)' : 'var(--text-muted)',
        }}
      >
        {isSelected ? (
          <Check className="h-3.5 w-3.5 stroke-[2.5]" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
      </span>
    </button>
  );
});

interface AcquirePickerRowProps {
  item: Item;
  distillHint: string;
  qty: number;
  eager?: boolean;
  onToggleAcquireItem: (id: string) => void;
  onIncrementAcquireItem: (id: string) => void;
  onDecrementAcquireItem: (id: string) => void;
}

const AcquirePickerRow = memo(function AcquirePickerRow({
  item,
  distillHint,
  qty,
  eager = false,
  onToggleAcquireItem,
  onIncrementAcquireItem,
  onDecrementAcquireItem,
}: AcquirePickerRowProps) {
  const isQueued = qty > 0;
  const toggleLabel = isQueued
    ? `Remove ${item.name} from acquire list`
    : `Add ${item.name} to acquire list`;

  if (isQueued) {
    return (
      <div
        className={`${eager ? '' : 'cv-row '}surface-hover flex items-center justify-between gap-2.5 rounded border border-l-2 px-2.5 py-2 transition-colors`}
        style={{
          backgroundColor: 'var(--accent-food-bg)',
          borderColor: 'var(--accent-food-border)',
          borderLeftColor: 'var(--accent-food)',
        }}
      >
        <button
          type="button"
          aria-pressed={true}
          aria-label={toggleLabel}
          onClick={() => onToggleAcquireItem(item.id)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <ItemImage
            src={item.image}
            fallbackKind={
              item.kind === 'distillation' ? 'distillation' : 'ingredient'
            }
            loading={eager ? 'eager' : 'lazy'}
            width={24}
            height={24}
            className="h-6 w-6 shrink-0 overflow-hidden rounded object-contain"
          />
          <div className="min-w-0 flex-1">
            <div
              className="truncate text-sm font-medium"
              title={item.name}
              style={{ color: 'var(--text-primary)' }}
            >
              {item.name}
            </div>
            {distillHint && (
              <div
                className="truncate text-xs"
                style={{ color: 'var(--accent-chem)' }}
              >
                Distills: {distillHint}
              </div>
            )}
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onDecrementAcquireItem(item.id)}
            aria-label={`Decrease ${item.name} to acquire`}
            className="touch-target inline-flex items-center justify-center rounded border"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <span
            className="tabular-nums w-6 text-center text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {qty}
          </span>
          <button
            type="button"
            onClick={() => onIncrementAcquireItem(item.id)}
            aria-label={`Increase ${item.name} to acquire`}
            className="touch-target inline-flex items-center justify-center rounded border"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={false}
      aria-label={toggleLabel}
      onClick={() => onToggleAcquireItem(item.id)}
      className={`${eager ? '' : 'cv-row '}surface-hover touch-chip flex w-full items-center justify-between gap-2.5 rounded px-2.5 py-2 text-left transition-colors`}
      style={{ backgroundColor: 'transparent' }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <ItemImage
          src={item.image}
          fallbackKind={
            item.kind === 'distillation' ? 'distillation' : 'ingredient'
          }
          loading={eager ? 'eager' : 'lazy'}
          width={24}
          height={24}
          className="h-6 w-6 shrink-0 overflow-hidden rounded object-contain"
        />
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-sm font-medium"
            title={item.name}
            style={{ color: 'var(--text-primary)' }}
          >
            {item.name}
          </div>
          {distillHint && (
            <div
              className="truncate text-xs"
              style={{ color: 'var(--accent-chem)' }}
            >
              Distills: {distillHint}
            </div>
          )}
        </div>
      </div>

      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        <Plus className="h-4 w-4" />
      </span>
    </button>
  );
});

function matchesPickerFilter(
  entry: SelectableItemEntry,
  group: GroupFilter,
  queryLower: string,
  hideUnsafeSoups: boolean,
  preservedUnsafeSet: Set<string> | null
): boolean {
  const { item, searchText, isSafeRecipeItem } = entry;
  if (hideUnsafeSoups && !isSafeRecipeItem && !preservedUnsafeSet?.has(item.id)) {
    return false;
  }
  if (group !== 'all') {
    if (group === 'food') {
      if (
        item.categoryTag !== 'produce' &&
        item.categoryTag !== 'meat' &&
        item.categoryTag !== 'packaged'
      ) {
        return false;
      }
    } else if (group === 'lab') {
      if (item.categoryTag !== 'lab' && item.categoryTag !== 'other') {
        return false;
      }
    } else if (item.categoryTag !== group) {
      return false;
    }
  }
  if (queryLower && !searchText.includes(queryLower)) {
    return false;
  }
  return true;
}

export function PantryPanel({
  db,
  pantry,
  acquire,
  customAcquire,
  activeView,
  onViewChange,
  quantityMode,
  includeDistillationChain,
  hideUnsafeSoups = true,
  distillationSummary,
  lastClearedCount,
  lastRemovedItem = null,
  lastClearedAcquireCount,
  lastAcquiredItem = null,
  isMobileDrawer = false,
  onToggleItem,
  onIncrementItem,
  onDecrementItem,
  onSetQuantity,
  onClearPantry,
  onUndoClearPantry,
  onDismissUndo,
  onUndoRemovedItem,
  onDismissRemovedItem,
  onToggleAcquireItem,
  onAddAcquireItem,
  onIncrementAcquireItem,
  onDecrementAcquireItem,
  onSetAcquireQuantity,
  onRemoveAcquireItem,
  onMarkItemAcquired,
  onAddCustomAcquireItem,
  onIncrementCustomAcquireItem,
  onDecrementCustomAcquireItem,
  onSetCustomAcquireQuantity,
  onRemoveCustomAcquireItem,
  onMarkCustomItemAcquired,
  onClearAcquireList,
  onUndoClearAcquireList,
  onDismissClearAcquireUndo,
  onUndoAcquiredItem,
  onDismissAcquiredItem,
  onSetQuantityMode,
  onSetIncludeDistillationChain,
  onCloseMobile,
  onRequestOpenMobilePantry,
  onCollapseDesktop,
}: PantryPanelProps) {
  const [itemSearch, setItemSearch] = useState('');
  const deferredSearch = useDeferredValue(itemSearch);
  const [group, setGroup] = useState<GroupFilter>('all');
  const [inPantryExpanded, setInPantryExpanded] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);

  const [acquireSearch, setAcquireSearch] = useState('');
  const deferredAcquireSearch = useDeferredValue(acquireSearch);
  const [acquireGroup, setAcquireGroup] = useState<GroupFilter>('all');
  const [acquireExpanded, setAcquireExpanded] = useState(true);
  const [confirmClearAcquire, setConfirmClearAcquire] = useState(false);

  const filterInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isMobileDrawer) return;
    filterInputRef.current?.focus();
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        filterInputRef.current?.focus();
      });
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
  }, [isMobileDrawer, activeView]);

  useEffect(() => {
    if (isMobileDrawer) return;
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
      if (!filterInputRef.current || filterInputRef.current.offsetParent === null) {
        if (onRequestOpenMobilePantry) {
          e.preventDefault();
          onRequestOpenMobilePantry();
        }
        return;
      }
      e.preventDefault();
      if (activeView !== 'pantry') {
        onViewChange('pantry');
        window.requestAnimationFrame(() => {
          filterInputRef.current?.focus();
        });
        return;
      }
      filterInputRef.current.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileDrawer, activeView, onViewChange, onRequestOpenMobilePantry]);

  const selectableItems = useMemo<SelectableItemEntry[]>(() => {
    const usedIds = new Set<string>();
    const safeIds = new Set<string>();
    const safeUsageCount = new Map<string, number>();

    for (const r of db.recipes) {
      const isUnsafe = r.subcategory === 'unsafe-soup';
      const seenInRecipe = new Set<string>();
      for (const ing of r.ingredients) {
        usedIds.add(ing.itemId);
        if (!isUnsafe) {
          safeIds.add(ing.itemId);
          if (!seenInRecipe.has(ing.itemId)) {
            seenInRecipe.add(ing.itemId);
            safeUsageCount.set(
              ing.itemId,
              (safeUsageCount.get(ing.itemId) ?? 0) + 1
            );
          }
        }
      }
    }
    for (const item of Object.values(db.items)) {
      if ((item.distillsInto?.length ?? 0) > 0) {
        usedIds.add(item.id);
        safeIds.add(item.id);
      }
    }
    return [...usedIds]
      .map((id) => db.items[id])
      .filter((it): it is Item => Boolean(it))
      .sort(
        (a, b) =>
          (safeUsageCount.get(b.id) ?? 0) - (safeUsageCount.get(a.id) ?? 0) ||
          a.name.localeCompare(b.name)
      )
      .map((item) => {
        const distillHint =
          item.distillsInto && item.distillsInto.length > 0
            ? item.distillsInto
                .map(
                  (d) =>
                    `${db.items[d.distillationId]?.name.replace(' Distillation', '') || d.distillationId} x${d.amount}`
                )
                .join(', ')
            : '';
        const distFullNames = (item.distillsInto || [])
          .map((d) => db.items[d.distillationId]?.name || '')
          .join(' ');
        return {
          item,
          distillHint,
          searchText: `${item.name} ${distFullNames}`.toLowerCase(),
          isSafeRecipeItem: safeIds.has(item.id),
        };
      });
  }, [db]);

  const distillHintById = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of selectableItems) {
      if (entry.distillHint) {
        map.set(entry.item.id, entry.distillHint);
      }
    }
    return map;
  }, [selectableItems]);

  const selectedItems = useMemo(() => {
    return Object.entries(pantry)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ item: db.items[id], qty }))
      .filter((x): x is { item: Item; qty: number } => Boolean(x.item))
      .sort((a, b) => a.item.name.localeCompare(b.item.name));
  }, [db.items, pantry]);

  const queuedCatalogItems = useMemo(() => {
    return Object.entries(acquire)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({
        item: db.items[id],
        qty,
        distillHint: distillHintById.get(id) ?? '',
      }))
      .filter(
        (x): x is { item: Item; qty: number; distillHint: string } =>
          Boolean(x.item)
      )
      .sort((a, b) => a.item.name.localeCompare(b.item.name));
  }, [db.items, acquire, distillHintById]);

  const totalAcquireCount = queuedCatalogItems.length + customAcquire.length;

  useEffect(() => {
    if (selectedItems.length < 5 && confirmClear) {
      setConfirmClear(false);
    }
  }, [selectedItems.length, confirmClear]);

  useEffect(() => {
    if (totalAcquireCount < 5 && confirmClearAcquire) {
      setConfirmClearAcquire(false);
    }
  }, [totalAcquireCount, confirmClearAcquire]);

  const unlockedDistillationCount = useMemo(() => {
    return Object.values(distillationSummary).filter(
      (s) => s.directQty > 0 || s.fromRawQty > 0
    ).length;
  }, [distillationSummary]);

  const ownedUnsafeKey = useMemo(() => {
    if (!hideUnsafeSoups) return '';
    return selectableItems
      .filter((e) => !e.isSafeRecipeItem && (pantry[e.item.id] ?? 0) > 0)
      .map((e) => e.item.id)
      .join(',');
  }, [selectableItems, hideUnsafeSoups, pantry]);

  const queuedUnsafeKey = useMemo(() => {
    if (!hideUnsafeSoups) return '';
    return selectableItems
      .filter((e) => !e.isSafeRecipeItem && (acquire[e.item.id] ?? 0) > 0)
      .map((e) => e.item.id)
      .join(',');
  }, [selectableItems, hideUnsafeSoups, acquire]);

  const filteredPickerItems = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const ownedUnsafeSet = ownedUnsafeKey
      ? new Set(ownedUnsafeKey.split(','))
      : null;
    return selectableItems.filter((entry) =>
      matchesPickerFilter(entry, group, q, hideUnsafeSoups, ownedUnsafeSet)
    );
  }, [group, deferredSearch, selectableItems, hideUnsafeSoups, ownedUnsafeKey]);

  const filteredAcquirePickerItems = useMemo(() => {
    const q = deferredAcquireSearch.trim().toLowerCase();
    const queuedUnsafeSet = queuedUnsafeKey
      ? new Set(queuedUnsafeKey.split(','))
      : null;
    return selectableItems.filter((entry) =>
      matchesPickerFilter(
        entry,
        acquireGroup,
        q,
        hideUnsafeSoups,
        queuedUnsafeSet
      )
    );
  }, [
    acquireGroup,
    deferredAcquireSearch,
    selectableItems,
    hideUnsafeSoups,
    queuedUnsafeKey,
  ]);

  const trimmedAcquireSearch = acquireSearch.trim().replace(/\s+/g, ' ');
  const exactAcquireCatalogMatch = useMemo(() => {
    if (!trimmedAcquireSearch) return null;
    const lower = trimmedAcquireSearch.toLowerCase();
    const queuedUnsafeSet = queuedUnsafeKey
      ? new Set(queuedUnsafeKey.split(','))
      : null;
    return (
      selectableItems.find(
        (entry) =>
          (!hideUnsafeSoups ||
            entry.isSafeRecipeItem ||
            Boolean(queuedUnsafeSet?.has(entry.item.id))) &&
          entry.item.name.toLowerCase() === lower
      ) ?? null
    );
  }, [trimmedAcquireSearch, selectableItems, hideUnsafeSoups, queuedUnsafeKey]);

  const groupChips: { id: GroupFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'food', label: 'Food & Produce' },
    { id: 'distillation', label: 'Distillations' },
    { id: 'lab', label: 'Lab / Raw' },
  ];

  const handleAcquireSearchSubmit = () => {
    if (!trimmedAcquireSearch) return;
    if (exactAcquireCatalogMatch) {
      const id = exactAcquireCatalogMatch.item.id;
      if ((acquire[id] ?? 0) > 0) {
        onIncrementAcquireItem(id);
      } else {
        onAddAcquireItem(id, 1);
      }
    } else {
      onAddCustomAcquireItem(trimmedAcquireSearch, 1);
    }
    setAcquireSearch('');
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div
        className="flex shrink-0 flex-col gap-2 border-b px-3.5 py-2.5"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2
              className="text-base font-semibold tracking-[-0.015em]"
              style={{ color: 'var(--text-primary)' }}
            >
              My Inventory &amp; Pantry
            </h2>
            <p
              className="text-pretty text-xs leading-snug"
              style={{ color: 'var(--text-muted)' }}
            >
              {activeView === 'pantry'
                ? 'Check items in your fridge or backpack to match recipes.'
                : 'Track ingredients and gear to scavenge, then move them to Pantry.'}
            </p>
          </div>
          {onCollapseDesktop && !isMobileDrawer && (
            <button
              type="button"
              onClick={onCollapseDesktop}
              aria-label="Collapse pantry sidebar"
              title="Collapse pantry sidebar"
              className="surface-hover touch-target hidden shrink-0 items-center justify-center rounded border p-1.5 transition-colors min-[860px]:inline-flex"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close pantry drawer"
              className="surface-hover touch-target rounded border p-1.5 transition-colors min-[860px]:hidden"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Pantry / To Acquire Switcher */}
        <div
          role="group"
          aria-label="Sidebar panel view"
          className="grid grid-cols-2 gap-1 rounded-md border p-0.5"
          style={{
            backgroundColor: 'var(--bg-well)',
            borderColor: 'var(--border-subtle)',
            boxShadow: 'var(--inset-well)',
          }}
        >
          <button
            type="button"
            aria-pressed={activeView === 'pantry'}
            onClick={() => onViewChange('pantry')}
            className="touch-chip flex items-center justify-center gap-1.5 rounded border px-2 py-1 text-[13px] font-medium transition-colors"
            style={{
              backgroundColor:
                activeView === 'pantry'
                  ? 'var(--control-active-bg)'
                  : 'transparent',
              borderColor:
                activeView === 'pantry'
                  ? 'var(--control-active-border)'
                  : 'transparent',
              boxShadow:
                activeView === 'pantry' ? 'var(--specular-top)' : undefined,
              color:
                activeView === 'pantry'
                  ? 'var(--text-primary)'
                  : 'var(--text-muted)',
            }}
          >
            <Backpack className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Pantry</span>
            {selectedItems.length > 0 && (
              <span
                className="font-readout rounded px-1.5 py-0.5 text-xs font-semibold leading-none"
                style={{
                  backgroundColor: 'var(--accent-ready-bg)',
                  color: 'var(--accent-ready)',
                }}
              >
                {selectedItems.length}
              </span>
            )}
          </button>

          <button
            type="button"
            aria-pressed={activeView === 'acquire'}
            onClick={() => onViewChange('acquire')}
            className="touch-chip flex items-center justify-center gap-1.5 rounded border px-2 py-1 text-[13px] font-medium transition-colors"
            style={{
              backgroundColor:
                activeView === 'acquire'
                  ? 'var(--control-active-bg)'
                  : 'transparent',
              borderColor:
                activeView === 'acquire'
                  ? 'var(--control-active-border)'
                  : 'transparent',
              boxShadow:
                activeView === 'acquire' ? 'var(--specular-top)' : undefined,
              color:
                activeView === 'acquire'
                  ? 'var(--text-primary)'
                  : 'var(--text-muted)',
            }}
          >
            <ClipboardList className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>To Acquire</span>
            {totalAcquireCount > 0 && (
              <span
                className="font-readout rounded px-1.5 py-0.5 text-xs font-semibold leading-none"
                style={{
                  backgroundColor: 'var(--accent-food-bg)',
                  color: 'var(--accent-food)',
                }}
              >
                {totalAcquireCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeView === 'pantry' ? (
        <>
          {/* Mode Toggles */}
          <div
            className="flex shrink-0 flex-col gap-1.5 border-b px-3.5 py-2"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <span
              className="text-[13px] font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              Matching mode
            </span>
            <InfoPopover
              ariaLabel="Matching mode help"
              align="left"
              triggerClassName="p-1"
            >
              <div className="space-y-1.5">
                <p>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    Checklist
                  </strong>{' '}
                  matches any owned item regardless of recipe quantity.
                </p>
                <p>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    Quantities
                  </strong>{' '}
                  checks exact recipe counts without double-counting shared raw
                  items.
                </p>
              </div>
            </InfoPopover>
          </div>
          <div
            className="flex rounded-md border p-0.5"
            style={{
              backgroundColor: 'var(--bg-well)',
              borderColor: 'var(--border-subtle)',
              boxShadow: 'var(--inset-well)',
            }}
            role="group"
            aria-label="Inventory matching mode"
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

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Beaker
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: 'var(--accent-chem)' }}
            />
            <span
              className="text-[13px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Auto-distill raw items
            </span>
            <InfoPopover
              ariaLabel="Auto-distill help"
              align="left"
              triggerClassName="p-1"
            >
              <p>
                Automatically counts distillable raw items in your Pantry
                toward Chemistry Bench reagent requirements.
              </p>
            </InfoPopover>
          </div>
          <ToggleSwitch
            checked={includeDistillationChain}
            onChange={onSetIncludeDistillationChain}
            ariaLabel="Auto-distill raw items"
            accentColor="var(--accent-chem)"
          />
        </div>

        {includeDistillationChain && unlockedDistillationCount > 0 && (
          <div
            className="flex items-center justify-between rounded-md border px-2.5 py-1 text-xs"
            style={{
              backgroundColor: 'var(--accent-chem-bg)',
              borderColor: 'var(--accent-chem-border)',
              color: 'var(--accent-chem)',
            }}
          >
            <span>Distillations unlocked</span>
            <span className="font-readout font-semibold">
              {unlockedDistillationCount} / {db.distillationIds.length}
            </span>
          </div>
        )}
      </div>

      {/* Undo Single Item Removal Banner (Quantities mode) */}
      {lastRemovedItem && lastClearedCount === 0 && (
        <div
          role="status"
          aria-live="polite"
          className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2 text-xs"
          style={{
            backgroundColor: 'var(--accent-food-bg)',
            borderColor: 'var(--accent-food-border)',
            color: 'var(--text-primary)',
          }}
        >
          <span className="tabular-nums truncate">
            Removed {db.items[lastRemovedItem.id]?.name || lastRemovedItem.id} (×
            {lastRemovedItem.qty}).
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
              <RotateCcw className="h-3 w-3" />
              Undo
            </button>
            <button
              type="button"
              onClick={onDismissRemovedItem}
              aria-label="Dismiss undo notice"
              className="touch-target inline-flex items-center justify-center rounded hover:opacity-80"
              style={{ color: 'var(--text-secondary)' }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Undo Clear Banner */}
      {lastClearedCount > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2 text-xs"
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
              className="surface-hover inline-flex items-center gap-1 rounded border px-2 py-0.5 font-semibold transition-colors"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            >
              <RotateCcw className="h-3 w-3" />
              Undo
            </button>
            <button
              type="button"
              onClick={onDismissUndo}
              aria-label="Dismiss undo notice"
              className="touch-target inline-flex items-center justify-center rounded hover:opacity-80"
              style={{ color: 'var(--text-secondary)' }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Selected Pantry Summary */}
      {selectedItems.length > 0 && (
        <div
          className="shrink-0 border-b px-4 py-2.5"
          style={{
            backgroundColor: 'var(--bg-ground)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              aria-expanded={inPantryExpanded}
              onClick={() => setInPantryExpanded((prev) => !prev)}
              className="flex items-center gap-1.5 text-[13px] font-semibold"
              style={{ color: 'var(--text-secondary)' }}
            >
              <span>In Pantry ({selectedItems.length})</span>
              {inPantryExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
            {confirmClear && selectedItems.length >= 5 ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmClear(false);
                    onClearPantry();
                  }}
                  className="rounded border px-2 py-0.5 text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: 'var(--accent-hazard-bg)',
                    borderColor: 'var(--accent-hazard-border)',
                    color: 'var(--accent-hazard)',
                  }}
                >
                  Confirm clear ({selectedItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="rounded border px-1.5 py-0.5 text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
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
                  if (selectedItems.length >= 5) {
                    setConfirmClear(true);
                  } else {
                    onClearPantry();
                  }
                }}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[13px] transition-colors hover:opacity-80"
                style={{ color: 'var(--accent-hazard)' }}
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
                Clear all
              </button>
            )}
          </div>
          {inPantryExpanded && (
            <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1">
            {selectedItems.map(({ item, qty }) => (
              <div
                key={item.id}
                className="flex items-center gap-1.5 rounded border border-l-2 px-2 py-1 text-[13px]"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-strong)',
                  borderLeftColor: 'var(--accent-ready)',
                  color: 'var(--text-primary)',
                }}
              >
                <ItemImage
                  src={item.image}
                  fallbackKind={
                    item.kind === 'distillation' ? 'distillation' : 'ingredient'
                  }
                  loading="eager"
                  width={16}
                  height={16}
                  className="h-4 w-4 shrink-0 object-contain"
                />
                <span
                  className="max-w-[115px] truncate"
                  title={item.name}
                >
                  {item.name}
                </span>
                {quantityMode && (
                  <div className="flex items-center gap-1 pl-0.5">
                    <button
                      type="button"
                      onClick={() => onDecrementItem(item.id)}
                      aria-label={`Decrease ${item.name}`}
                      className="touch-target inline-flex items-center justify-center rounded hover:opacity-75"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Minus className="h-3.5 w-3.5" />
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
                      className="touch-target inline-flex items-center justify-center rounded hover:opacity-75"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onToggleItem(item.id)}
                  aria-label={`Remove ${item.name}`}
                  className="touch-target inline-flex items-center justify-center rounded hover:opacity-75"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            </div>
          )}
        </div>
      )}

      {/* Ingredient Picker Filter */}
      <div className="flex shrink-0 flex-col gap-2 px-3.5 pt-2.5 pb-2">
        <div className="relative">
          <Plus
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            ref={filterInputRef}
            type="search"
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            placeholder="+ Quick-add to Pantry..."
            aria-label="Filter inventory items"
            className="w-full rounded border py-1.5 pl-8 pr-8 text-base sm:text-[13px]"
            style={{
              backgroundColor: 'var(--bg-well)',
              borderColor: 'var(--border-subtle)',
              boxShadow: 'var(--inset-well)',
              color: 'var(--text-primary)',
            }}
          />
          {!itemSearch && !isMobileDrawer ? (
            <kbd
              aria-hidden="true"
              className="font-code pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border px-1.5 py-0.5 text-xs font-medium min-[860px]:inline-flex"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-muted)',
              }}
            >
              P
            </kbd>
          ) : (
            itemSearch && (
              <button
                type="button"
                onClick={() => setItemSearch('')}
                aria-label="Clear inventory filter"
                className="touch-target absolute right-1 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded hover:opacity-80"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {groupChips.map((chip) => {
            const active = group === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={active}
                onClick={() => setGroup(chip.id)}
                className="touch-chip pressable shrink-0 rounded border px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors"
                style={{
                  backgroundColor: active
                    ? 'var(--control-active-bg)'
                    : 'transparent',
                  borderColor: active
                    ? 'var(--control-active-border)'
                    : 'transparent',
                  boxShadow: active ? 'var(--specular-top)' : undefined,
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Ingredient List */}
      <div className="safe-bottom min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {filteredPickerItems.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              No matching ingredients found.
            </p>
            <button
              type="button"
              onClick={() => {
                setItemSearch('');
                setGroup('all');
              }}
              className="surface-hover rounded border px-2.5 py-1 text-xs font-medium transition-colors"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            >
              Reset inventory filter
            </button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredPickerItems.map(({ item, distillHint }, idx) => (
              <PantryPickerRow
                key={item.id}
                item={item}
                distillHint={distillHint}
                qty={pantry[item.id] ?? 0}
                quantityMode={quantityMode}
                eager={idx < 16}
                onToggleItem={onToggleItem}
                onIncrementItem={onIncrementItem}
                onDecrementItem={onDecrementItem}
              />
            ))}
          </div>
        )}
      </div>
        </>
      ) : (
        <>
          {/* Undo Single Acquired Item Banner */}
          {lastAcquiredItem && lastClearedAcquireCount === 0 && (
            <div
              role="status"
              aria-live="polite"
              className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2 text-xs"
              style={{
                backgroundColor: 'var(--accent-food-bg)',
                borderColor: 'var(--accent-food-border)',
                color: 'var(--text-primary)',
              }}
            >
              <span className="tabular-nums truncate">
                {lastAcquiredItem.isCustom
                  ? `Marked ${lastAcquiredItem.item.name}${lastAcquiredItem.item.qty > 1 ? ` (×${lastAcquiredItem.item.qty})` : ''} acquired.`
                  : `Moved ${db.items[lastAcquiredItem.id]?.name || lastAcquiredItem.id} (×${lastAcquiredItem.qty}) to Pantry.`}
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={onUndoAcquiredItem}
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
                  onClick={onDismissAcquiredItem}
                  aria-label="Dismiss acquired undo notice"
                  className="touch-target inline-flex items-center justify-center rounded hover:opacity-80"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {/* Undo Clear Acquire List Banner */}
          {lastClearedAcquireCount > 0 && (
            <div
              role="status"
              aria-live="polite"
              className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2 text-xs"
              style={{
                backgroundColor: 'var(--accent-food-bg)',
                borderColor: 'var(--accent-food-border)',
                color: 'var(--text-primary)',
              }}
            >
              <span className="tabular-nums">
                Cleared {lastClearedAcquireCount}{' '}
                {lastClearedAcquireCount === 1 ? 'item' : 'items'} from To Acquire.
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={onUndoClearAcquireList}
                  className="surface-hover inline-flex items-center gap-1 rounded border px-2 py-0.5 font-semibold transition-colors"
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
                  onClick={onDismissClearAcquireUndo}
                  aria-label="Dismiss acquire clear undo notice"
                  className="touch-target inline-flex items-center justify-center rounded hover:opacity-80"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {/* Active To Acquire List */}
          <div
            className="shrink-0 border-b px-3.5 py-2.5"
            style={{
              backgroundColor: 'var(--bg-ground)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-expanded={acquireExpanded}
                onClick={() => setAcquireExpanded((prev) => !prev)}
                className="flex items-center gap-1.5 text-[13px] font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span>To Acquire ({totalAcquireCount})</span>
                {totalAcquireCount > 0 &&
                  (acquireExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  ))}
              </button>

              {totalAcquireCount > 0 &&
                (confirmClearAcquire && totalAcquireCount >= 5 ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmClearAcquire(false);
                        onClearAcquireList();
                      }}
                      className="rounded border px-2 py-0.5 text-xs font-semibold transition-colors"
                      style={{
                        backgroundColor: 'var(--accent-hazard-bg)',
                        borderColor: 'var(--accent-hazard-border)',
                        color: 'var(--accent-hazard)',
                      }}
                    >
                      Confirm clear ({totalAcquireCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearAcquire(false)}
                      className="rounded border px-1.5 py-0.5 text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
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
                      if (totalAcquireCount >= 5) {
                        setConfirmClearAcquire(true);
                      } else {
                        onClearAcquireList();
                      }
                    }}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[13px] transition-colors hover:opacity-80"
                    style={{ color: 'var(--accent-hazard)' }}
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                    Clear list
                  </button>
                ))}
            </div>

            {totalAcquireCount === 0 ? (
              <div
                className="mt-2 rounded-lg px-3 py-2.5 text-xs leading-relaxed"
                style={{
                  backgroundColor: 'var(--bg-well)',
                  boxShadow: 'var(--inset-well)',
                  color: 'var(--text-muted)',
                }}
              >
                No items queued yet. Pick ingredients below, type any custom item
                name, or add missing items from a recipe.
              </div>
            ) : (
              acquireExpanded && (
                <div className="mt-2 max-h-60 space-y-1.5 overflow-y-auto pr-1">
                  {queuedCatalogItems.map(({ item, qty, distillHint }) => {
                    const pantryQty = pantry[item.id] ?? 0;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded border border-l-2 px-2.5 py-1.5"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-subtle)',
                          borderLeftColor: 'var(--accent-food)',
                        }}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <ItemImage
                            src={item.image}
                            fallbackKind={
                              item.kind === 'distillation'
                                ? 'distillation'
                                : 'ingredient'
                            }
                            loading="eager"
                            width={24}
                            height={24}
                            className="h-6 w-6 shrink-0 rounded object-contain"
                          />
                          <div className="min-w-0 flex-1">
                            <div
                              className="truncate text-[13px] font-medium"
                              title={item.name}
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {item.name}
                            </div>
                            {pantryQty > 0 ? (
                              <div
                                className="font-readout truncate text-xs"
                                style={{ color: 'var(--accent-ready)' }}
                              >
                                In Pantry: ×{pantryQty}
                              </div>
                            ) : (
                              distillHint && (
                                <div
                                  className="truncate text-xs"
                                  style={{ color: 'var(--accent-chem)' }}
                                >
                                  Distills: {distillHint}
                                </div>
                              )
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onDecrementAcquireItem(item.id)}
                            aria-label={`Decrease ${item.name} to acquire`}
                            className="touch-target inline-flex items-center justify-center rounded border hover:opacity-80"
                            style={{
                              backgroundColor: 'var(--bg-well)',
                              borderColor: 'var(--border-subtle)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <QuantityInput
                            value={qty}
                            itemName={item.name}
                            ariaLabel={`Quantity of ${item.name} to acquire`}
                            onCommit={(nextQty) =>
                              onSetAcquireQuantity(item.id, nextQty)
                            }
                          />
                          <button
                            type="button"
                            onClick={() => onIncrementAcquireItem(item.id)}
                            aria-label={`Increase ${item.name} to acquire`}
                            className="touch-target inline-flex items-center justify-center rounded border hover:opacity-80"
                            style={{
                              backgroundColor: 'var(--bg-well)',
                              borderColor: 'var(--border-subtle)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onMarkItemAcquired(item.id)}
                            title="Got it — move to Pantry"
                            aria-label={`Mark ${item.name} acquired and move to pantry`}
                            className="touch-target pressable inline-flex items-center justify-center rounded border transition-colors"
                            style={{
                              backgroundColor: 'var(--accent-ready-bg)',
                              borderColor: 'var(--accent-ready-border)',
                              color: 'var(--accent-ready)',
                            }}
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveAcquireItem(item.id)}
                            aria-label={`Remove ${item.name} from acquire list`}
                            className="touch-target inline-flex items-center justify-center rounded hover:opacity-75"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {customAcquire.map((custom) => (
                    <div
                      key={custom.id}
                      className="flex items-center justify-between gap-2 rounded border border-l-2 px-2.5 py-1.5"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-subtle)',
                        borderLeftColor: 'var(--accent-food)',
                      }}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
                          style={{
                            backgroundColor: 'var(--bg-well)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          <Package className="h-3.5 w-3.5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div
                            className="truncate text-[13px] font-medium"
                            title={custom.name}
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {custom.name}
                          </div>
                          <div
                            className="text-xs"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Custom item
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            onDecrementCustomAcquireItem(custom.id)
                          }
                          aria-label={`Decrease ${custom.name} to acquire`}
                          className="touch-target inline-flex items-center justify-center rounded border hover:opacity-80"
                          style={{
                            backgroundColor: 'var(--bg-well)',
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <QuantityInput
                          value={custom.qty}
                          itemName={custom.name}
                          ariaLabel={`Quantity of ${custom.name} to acquire`}
                          onCommit={(nextQty) =>
                            onSetCustomAcquireQuantity(custom.id, nextQty)
                          }
                        />
                        <button
                          type="button"
                          onClick={() =>
                            onIncrementCustomAcquireItem(custom.id)
                          }
                          aria-label={`Increase ${custom.name} to acquire`}
                          className="touch-target inline-flex items-center justify-center rounded border hover:opacity-80"
                          style={{
                            backgroundColor: 'var(--bg-well)',
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onMarkCustomItemAcquired(custom.id)}
                          title="Mark acquired"
                          aria-label={`Mark ${custom.name} acquired`}
                          className="touch-target pressable inline-flex items-center justify-center rounded border transition-colors"
                          style={{
                            backgroundColor: 'var(--accent-ready-bg)',
                            borderColor: 'var(--accent-ready-border)',
                            color: 'var(--accent-ready)',
                          }}
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveCustomAcquireItem(custom.id)}
                          aria-label={`Remove ${custom.name} from acquire list`}
                          className="touch-target inline-flex items-center justify-center rounded hover:opacity-75"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Quick-Add & Catalog Picker for To Acquire */}
          <div className="flex shrink-0 flex-col gap-2 px-3.5 pt-2.5 pb-2">
            <div className="relative">
              <Plus
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                ref={filterInputRef}
                type="search"
                value={acquireSearch}
                onChange={(e) => setAcquireSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && trimmedAcquireSearch) {
                    e.preventDefault();
                    handleAcquireSearchSubmit();
                  }
                }}
                placeholder="+ Add ingredient or custom item..."
                aria-label="Filter or add items to acquire"
                className="w-full rounded border py-1.5 pl-8 pr-8 text-base sm:text-[13px]"
                style={{
                  backgroundColor: 'var(--bg-well)',
                  borderColor: 'var(--border-subtle)',
                  boxShadow: 'var(--inset-well)',
                  color: 'var(--text-primary)',
                }}
              />
              {acquireSearch && (
                <button
                  type="button"
                  onClick={() => setAcquireSearch('')}
                  aria-label="Clear acquire filter"
                  className="touch-target absolute right-1 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded hover:opacity-80"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {trimmedAcquireSearch.length > 0 && !exactAcquireCatalogMatch && (
              <button
                type="button"
                onClick={() => {
                  onAddCustomAcquireItem(trimmedAcquireSearch, 1);
                  setAcquireSearch('');
                }}
                className="surface-hover touch-chip pressable flex w-full items-center justify-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: 'var(--accent-food-bg)',
                  borderColor: 'var(--accent-food-border)',
                  color: 'var(--accent-food)',
                }}
              >
                <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  Add &ldquo;{trimmedAcquireSearch}&rdquo; as custom item
                </span>
              </button>
            )}

            <div className="flex flex-wrap gap-1">
              {groupChips.map((chip) => {
                const active = acquireGroup === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setAcquireGroup(chip.id)}
                    className="touch-chip pressable shrink-0 rounded border px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors"
                    style={{
                      backgroundColor: active
                        ? 'var(--control-active-bg)'
                        : 'transparent',
                      borderColor: active
                        ? 'var(--control-active-border)'
                        : 'transparent',
                      boxShadow: active ? 'var(--specular-top)' : undefined,
                      color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="safe-bottom min-h-0 flex-1 overflow-y-auto px-3 pb-4">
            {filteredAcquirePickerItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {trimmedAcquireSearch.length > 0
                    ? 'No matching catalog ingredients found. Use the button above or press Enter to add it as a custom item.'
                    : 'No matching catalog ingredients found.'}
                </p>
                {trimmedAcquireSearch.length === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAcquireSearch('');
                      setAcquireGroup('all');
                    }}
                    className="surface-hover rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      borderColor: 'var(--border-strong)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    Reset acquire filter
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredAcquirePickerItems.map(({ item, distillHint }, idx) => (
                  <AcquirePickerRow
                    key={item.id}
                    item={item}
                    distillHint={distillHint}
                    qty={acquire[item.id] ?? 0}
                    eager={idx < 16}
                    onToggleAcquireItem={onToggleAcquireItem}
                    onIncrementAcquireItem={onIncrementAcquireItem}
                    onDecrementAcquireItem={onDecrementAcquireItem}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
