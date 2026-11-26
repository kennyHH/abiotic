import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpDown,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import type { RecipeSubcategory } from '../types/recipes';
import type { ActiveTab } from './TopBar';
import type { RecipeFilterOptions } from '../lib/matcher';
import { CustomSelect, type SelectOption } from './UiControls';

interface FilterBarProps {
  activeTab: ActiveTab;
  workstation: string;
  onWorkstationChange: (ws: string) => void;
  availableWorkstations: string[];
  subcategory: 'all' | RecipeSubcategory;
  onSubcategoryChange: (sub: 'all' | RecipeSubcategory) => void;
  hideUnsafeSoups: boolean;
  onHideUnsafeSoupsChange: (val: boolean) => void;
  onlyBuffed: boolean;
  onOnlyBuffedChange: (val: boolean) => void;
  hasPantryItems?: boolean;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  sortBy: RecipeFilterOptions['sortBy'];
  onSortByChange: (val: RecipeFilterOptions['sortBy']) => void;
  totalMatching: number;
  hiddenUnsafeCount?: number;
}

export function FilterBar({
  activeTab,
  workstation,
  onWorkstationChange,
  availableWorkstations,
  subcategory,
  onSubcategoryChange,
  hideUnsafeSoups,
  onHideUnsafeSoupsChange,
  onlyBuffed,
  onOnlyBuffedChange,
  hasPantryItems = false,
  hasActiveFilters = false,
  onResetFilters,
  sortBy,
  onSortByChange,
  totalMatching,
  hiddenUnsafeCount = 0,
}: FilterBarProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const subChips: { id: 'all' | RecipeSubcategory; label: string }[] =
    activeTab === 'chemistry'
      ? [
          { id: 'all', label: 'All Concoctions' },
          { id: 'tincture', label: 'Tinctures' },
          { id: 'flask', label: 'Flasks' },
          { id: 'coating', label: 'Coatings' },
        ]
      : activeTab === 'food'
        ? [
            { id: 'all', label: 'All Food' },
            { id: 'frying', label: 'Frying Pan' },
            { id: 'chefs-counter', label: "Chef's Counter" },
            { id: 'baking', label: 'Baking / Oven' },
          ]
        : [];

  const stationOptions = useMemo<SelectOption<string>[]>(
    () => [
      { value: 'all', label: 'All Stations' },
      ...availableWorkstations.map((ws) => ({ value: ws, label: ws })),
    ],
    [availableWorkstations]
  );

  const defaultSortLabel = hasPantryItems
    ? 'Sort: Best Match'
    : activeTab === 'all'
      ? 'Sort: Featured'
      : 'Sort: Default (A → Z)';

  const sortOptions = useMemo<SelectOption<RecipeFilterOptions['sortBy']>[]>(
    () => [
      { value: 'best-match', label: defaultSortLabel },
      { value: 'hunger-desc', label: 'Sort: Hunger (High → Low)' },
      { value: 'thirst-desc', label: 'Sort: Thirst (High → Low)' },
      { value: 'level-asc', label: 'Sort: Cooking Level' },
      { value: 'name-asc', label: 'Sort: Name (A → Z)' },
    ],
    [defaultSortLabel]
  );

  const activeFilterCount =
    (workstation !== 'all' ? 1 : 0) +
    (subcategory !== 'all' ? 1 : 0) +
    (onlyBuffed ? 1 : 0) +
    (!hideUnsafeSoups && (activeTab === 'all' || activeTab === 'soup') ? 1 : 0);

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 sm:gap-3"
      style={{
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Mobile Filters Toggle Button */}
      <button
        type="button"
        aria-expanded={mobileFiltersOpen}
        onClick={() => setMobileFiltersOpen((prev) => !prev)}
        className="surface-hover touch-chip pressable order-1 flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[13px] font-medium sm:hidden"
        style={{
          backgroundColor:
            activeFilterCount > 0 || mobileFiltersOpen
              ? 'var(--control-active-bg)'
              : 'var(--bg-well)',
          borderColor:
            activeFilterCount > 0 || mobileFiltersOpen
              ? 'var(--control-active-border)'
              : 'var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Filters</span>
        {activeFilterCount > 0 && (
          <span
            className="font-readout rounded px-1.5 py-0.5 text-xs font-semibold"
            style={{
              backgroundColor: 'var(--accent-food-bg)',
              color: 'var(--accent-food)',
            }}
          >
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Filter Controls (Always visible on sm+, expandable tray on mobile) */}
      <div
        className={`${
          mobileFiltersOpen ? 'flex' : 'hidden sm:flex'
        } order-3 w-full flex-wrap items-center gap-2 sm:order-1 sm:w-auto`}
      >
        {subChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {subChips.map((chip) => {
              const active = subcategory === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSubcategoryChange(chip.id)}
                  className="surface-hover touch-chip pressable rounded border px-2.5 py-1.5 text-[13px] font-medium transition-colors"
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
                  {chip.label}
                </button>
              );
            })}
          </div>
        )}

        {activeTab === 'all' && availableWorkstations.length > 1 && (
          <CustomSelect
            value={workstation}
            options={stationOptions}
            onChange={onWorkstationChange}
            ariaLabel="Filter by workstation"
            active={workstation !== 'all'}
          />
        )}

        <button
          type="button"
          aria-pressed={onlyBuffed}
          onClick={() => onOnlyBuffedChange(!onlyBuffed)}
          className="surface-hover touch-chip pressable flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[13px] font-medium transition-colors"
          style={{
            backgroundColor: onlyBuffed
              ? 'var(--accent-food-bg)'
              : 'transparent',
            borderColor: onlyBuffed
              ? 'var(--accent-food-border)'
              : 'var(--border-subtle)',
            color: onlyBuffed ? 'var(--accent-food)' : 'var(--text-secondary)',
          }}
        >
          <Activity
            className="h-3.5 w-3.5"
            aria-hidden="true"
            style={{
              color: onlyBuffed ? 'var(--accent-food)' : 'var(--text-muted)',
            }}
          />
          <span>Has Buff</span>
        </button>

        {(activeTab === 'all' || activeTab === 'soup') && (
          <button
            type="button"
            aria-pressed={hideUnsafeSoups}
            onClick={() => onHideUnsafeSoupsChange(!hideUnsafeSoups)}
            className="surface-hover touch-chip pressable flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[13px] font-medium transition-colors"
            style={{
              backgroundColor: hideUnsafeSoups
                ? 'var(--accent-ready-bg)'
                : 'var(--accent-hazard-bg)',
              borderColor: hideUnsafeSoups
                ? 'var(--accent-ready-border)'
                : 'var(--accent-hazard-border)',
              color: hideUnsafeSoups
                ? 'var(--accent-ready)'
                : 'var(--accent-hazard)',
            }}
          >
            {hideUnsafeSoups ? (
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>{hideUnsafeSoups ? 'Unsafe soups: Hidden' : 'Unsafe soups: Shown'}</span>
          </button>
        )}

        {hasActiveFilters && onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="surface-hover touch-chip pressable inline-flex items-center gap-1 rounded border px-2.5 py-1.5 text-[13px] font-medium transition-colors"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text-primary)',
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Count + Custom Sort Trigger */}
      <div className="order-2 flex items-center gap-2 sm:gap-3">
        <span
          aria-live="polite"
          className="font-readout whitespace-nowrap text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          {totalMatching} {totalMatching === 1 ? 'recipe' : 'recipes'}
          {hideUnsafeSoups && hiddenUnsafeCount > 0 && (
            <span className="hidden md:inline">
              {' '}
              ({hiddenUnsafeCount} unsafe hidden)
            </span>
          )}
        </span>

        <CustomSelect
          value={sortBy}
          options={sortOptions}
          onChange={onSortByChange}
          ariaLabel="Sort recipes"
          icon={<ArrowUpDown className="h-3.5 w-3.5" />}
          active={sortBy !== 'best-match'}
          align="right"
        />
      </div>
    </div>
  );
}
