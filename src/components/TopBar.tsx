import { useEffect, useRef } from 'react';
import {
  Backpack,
  Beaker,
  ClipboardList,
  FlameKindling,
  FlaskConical,
  Info,
  LayoutGrid,
  Moon,
  Search,
  Soup,
  Sun,
  Table2,
  X,
} from 'lucide-react';
import type { RecipeCategory } from '../types/recipes';
import type { ThemeMode } from '../hooks/usePantry';
import { InfoPopover } from './UiControls';

export type ActiveTab = 'all' | RecipeCategory | 'distillations';
export type ViewMode = 'cards' | 'table';

interface TopBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  tabCounts: Record<ActiveTab, number>;
  search: string;
  onSearchChange: (val: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  syncedAt: string;
  desktopPantryCollapsed?: boolean;
  onExpandDesktopPantry?: () => void;
  onExpandDesktopAcquire?: () => void;
  selectedPantryCount?: number;
  acquireCount?: number;
}

function formatSyncedDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}

export function TopBar({
  activeTab,
  onTabChange,
  tabCounts,
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  theme,
  onToggleTheme,
  syncedAt,
  desktopPantryCollapsed = false,
  onExpandDesktopPantry,
  onExpandDesktopAcquire,
  selectedPantryCount = 0,
  acquireCount = 0,
}: TopBarProps) {
  const syncedDate = formatSyncedDate(syncedAt);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
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
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, []);

  const tabs: {
    id: ActiveTab;
    label: string;
    mobileSuffix?: string;
    hideSuffixOnTablet?: boolean;
    icon: typeof Soup;
    accentVar?: string;
  }[] = [
    {
      id: 'all',
      label: 'All',
      mobileSuffix: ' Recipes',
      icon: LayoutGrid,
    },
    {
      id: 'soup',
      label: 'Soups',
      icon: Soup,
      accentVar: 'var(--accent-food)',
    },
    {
      id: 'food',
      label: 'Food',
      mobileSuffix: ' & Baking',
      hideSuffixOnTablet: true,
      icon: FlameKindling,
      accentVar: 'var(--accent-food)',
    },
    {
      id: 'chemistry',
      label: 'Chemistry',
      icon: FlaskConical,
      accentVar: 'var(--accent-chem)',
    },
    {
      id: 'distillations',
      label: 'Distillation',
      mobileSuffix: ' Guide',
      hideSuffixOnTablet: true,
      icon: Beaker,
      accentVar: 'var(--accent-chem)',
    },
  ];

  return (
    <header
      className="contents min-[860px]:block min-[860px]:static min-[860px]:shrink-0 min-[860px]:border-b"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div
        aria-hidden="true"
        className="facility-stripe hidden w-full shrink-0 min-[860px]:block"
      />
      <div className="contents min-[860px]:mx-auto min-[860px]:grid min-[860px]:max-w-[1600px] min-[860px]:grid-cols-[auto_1fr] min-[860px]:items-center min-[860px]:gap-x-3 min-[860px]:gap-y-2.5 min-[860px]:px-5 min-[860px]:pt-3 min-[860px]:pb-0 lg:px-6">
        {/* Brand Row (scrolls naturally on <860px) */}
        <div
          className="flex flex-col min-[860px]:col-start-1 min-[860px]:row-start-1"
          style={{ backgroundColor: 'var(--bg-surface)' }}
        >
          <div
            aria-hidden="true"
            className="facility-stripe w-full shrink-0 min-[860px]:hidden"
          />
          <div className="safe-top flex items-center gap-3 px-3.5 pt-2.5 pb-1.5 sm:px-4 min-[860px]:p-0">
            <div
              aria-hidden="true"
              className="specimen-bay flex h-10 w-10 shrink-0 items-center justify-center rounded"
            >
              <svg
                viewBox="0 0 36 36"
                className="h-7 w-7"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polygon
                  points="18,3.5 30.5,10.75 30.5,25.25 18,32.5 5.5,25.25 5.5,10.75"
                  stroke="var(--accent-chem)"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <polygon
                  points="18,8.5 26.2,13.25 26.2,22.75 18,27.5 9.8,22.75 9.8,13.25"
                  stroke="var(--border-strong)"
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="5.5"
                  stroke="var(--accent-food)"
                  strokeWidth="1.75"
                />
                <path
                  d="M18 3.5V8.5M18 27.5V32.5M5.5 10.75L9.8 13.25M26.2 22.75L30.5 25.25M30.5 10.75L26.2 13.25M9.8 22.75L5.5 25.25"
                  stroke="var(--text-muted)"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
                <circle cx="18" cy="18" r="2.2" fill="var(--accent-chem)" />
              </svg>
            </div>
            <div>
              <h1
                className="text-lg font-bold leading-tight tracking-[-0.025em] sm:text-[21px]"
                style={{ color: 'var(--text-primary)' }}
              >
                Abiotic Factor Recipe Compendium
              </h1>
              <p
                className="hidden text-xs sm:block"
                style={{ color: 'var(--text-muted)' }}
              >
                GATE Cascade Survival &amp; Chemistry
              </p>
            </div>
          </div>
        </div>

        {/* Sticky Search + Navigation Tabs Bar on <860px; unwraps into grid on >=860px */}
        <div
          className="sticky top-0 z-30 flex flex-col gap-2 border-b px-3.5 pt-2 pb-0 sm:px-4 min-[860px]:contents"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex w-full items-center justify-end gap-2 min-[860px]:col-start-2 min-[860px]:row-start-1 min-[860px]:w-auto min-[860px]:min-w-[420px] min-[860px]:max-w-xl min-[860px]:justify-self-end lg:max-w-2xl">
            {desktopPantryCollapsed && onExpandDesktopPantry && (
              <button
                type="button"
                onClick={onExpandDesktopPantry}
                aria-label={`Open pantry sidebar (${selectedPantryCount} items)`}
                className="surface-hover pressable hidden min-[860px]:inline-flex shrink-0 items-center gap-1.5 rounded border px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors"
                style={{
                  backgroundColor:
                    selectedPantryCount > 0
                      ? 'var(--accent-ready-bg)'
                      : 'var(--bg-well)',
                  borderColor:
                    selectedPantryCount > 0
                      ? 'var(--accent-ready-border)'
                      : 'var(--border-subtle)',
                  color:
                    selectedPantryCount > 0
                      ? 'var(--accent-ready)'
                      : 'var(--text-primary)',
                }}
              >
                <Backpack className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="tabular-nums">
                  Pantry ({selectedPantryCount})
                </span>
              </button>
            )}

            {desktopPantryCollapsed && onExpandDesktopAcquire && (
              <button
                type="button"
                onClick={onExpandDesktopAcquire}
                aria-label={`Open to acquire sidebar (${acquireCount} items)`}
                className="surface-hover pressable hidden min-[860px]:inline-flex shrink-0 items-center gap-1.5 rounded border px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors"
                style={{
                  backgroundColor:
                    acquireCount > 0
                      ? 'var(--accent-food-bg)'
                      : 'var(--bg-well)',
                  borderColor:
                    acquireCount > 0
                      ? 'var(--accent-food-border)'
                      : 'var(--border-subtle)',
                  color:
                    acquireCount > 0
                      ? 'var(--accent-food)'
                      : 'var(--text-primary)',
                }}
              >
                <ClipboardList className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="tabular-nums">
                  To Acquire ({acquireCount})
                </span>
              </button>
            )}

            {/* Search input */}
            <div className="relative flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                ref={searchInputRef}
                type="search"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search recipes & buffs..."
                aria-label="Search recipes, ingredients, or buffs"
                className="w-full rounded border py-1.5 pl-9 pr-10 text-base transition-colors sm:text-sm"
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
                  /
                </kbd>
              ) : (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Clear search"
                  className="touch-target absolute right-1 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded hover:opacity-80"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Card / Table toggle */}
            {activeTab !== 'distillations' && (
              <div
                className="hidden items-center rounded-md border p-0.5 sm:flex"
                style={{
                  backgroundColor: 'var(--bg-well)',
                  borderColor: 'var(--border-subtle)',
                  boxShadow: 'var(--inset-well)',
                }}
                role="group"
                aria-label="View mode"
              >
                <button
                  type="button"
                  aria-pressed={viewMode === 'cards'}
                  onClick={() => onViewModeChange('cards')}
                  className="flex items-center gap-1.5 rounded border px-2.5 py-1 text-[13px] font-medium transition-colors"
                  style={{
                    backgroundColor:
                      viewMode === 'cards'
                        ? 'var(--control-active-bg)'
                        : 'transparent',
                    borderColor:
                      viewMode === 'cards'
                        ? 'var(--control-active-border)'
                        : 'transparent',
                    boxShadow:
                      viewMode === 'cards' ? 'var(--specular-top)' : undefined,
                    color:
                      viewMode === 'cards'
                        ? 'var(--text-primary)'
                        : 'var(--text-muted)',
                  }}
                >
                  <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                  Cards
                </button>
                <button
                  type="button"
                  aria-pressed={viewMode === 'table'}
                  onClick={() => onViewModeChange('table')}
                  className="flex items-center gap-1.5 rounded border px-2.5 py-1 text-[13px] font-medium transition-colors"
                  style={{
                    backgroundColor:
                      viewMode === 'table'
                        ? 'var(--control-active-bg)'
                        : 'transparent',
                    borderColor:
                      viewMode === 'table'
                        ? 'var(--control-active-border)'
                        : 'transparent',
                    boxShadow:
                      viewMode === 'table' ? 'var(--specular-top)' : undefined,
                    color:
                      viewMode === 'table'
                        ? 'var(--text-primary)'
                        : 'var(--text-muted)',
                  }}
                >
                  <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Table
                </button>
              </div>
            )}

            {/* About / Shortcuts Popover */}
            <InfoPopover
              ariaLabel="About and keyboard shortcuts"
              align="right"
              triggerClassName="touch-target h-9 w-9 border border-[var(--border-subtle)] bg-[var(--bg-well)]"
              icon={<Info className="h-4 w-4" aria-hidden="true" />}
            >
              <div className="space-y-2.5">
                <div>
                  <div
                    className="font-semibold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    Compendium Legend
                  </div>
                  <p className="mt-1">
                    Synced {syncedDate} from abioticfactor.wiki.gg. Tap any
                    ingredient chip on a card to track Pantry inventory.
                  </p>
                </div>
                <div
                  className="border-t pt-2 space-y-1"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <div>
                    <span
                      className="font-semibold"
                      style={{ color: 'var(--accent-ready)' }}
                    >
                      Ready:
                    </span>{' '}
                    All ingredients owned directly.
                  </div>
                  <div>
                    <span
                      className="font-semibold"
                      style={{ color: 'var(--accent-chem)' }}
                    >
                      Via Distill:
                    </span>{' '}
                    Craftable by distilling owned raw items.
                  </div>
                  <div>
                    <span
                      className="font-semibold"
                      style={{ color: 'var(--accent-food)' }}
                    >
                      Food vs. Chemistry:
                    </span>{' '}
                    Amber marks culinary buffs; cyan marks lab mixes.
                  </div>
                </div>
                <div
                  className="border-t pt-2 flex flex-wrap gap-2"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <span className="inline-flex items-center gap-1">
                    <kbd
                      className="font-code rounded border px-1.5 py-0.5 text-xs"
                      style={{
                        backgroundColor: 'var(--bg-well)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      /
                    </kbd>
                    Search recipes
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <kbd
                      className="font-code rounded border px-1.5 py-0.5 text-xs"
                      style={{
                        backgroundColor: 'var(--bg-well)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      P
                    </kbd>
                    Open / filter pantry
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <kbd
                      className="font-code rounded border px-1.5 py-0.5 text-xs"
                      style={{
                        backgroundColor: 'var(--bg-well)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      Esc
                    </kbd>
                    Close drawer
                  </span>
                </div>
              </div>
            </InfoPopover>

            {/* Theme toggle */}
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={
                theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
              }
              title={
                theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
              }
              className="surface-hover touch-target flex h-9 w-9 shrink-0 items-center justify-center rounded border transition-colors"
              style={{
                backgroundColor: 'var(--bg-well)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="relative min-[860px]:col-span-2 min-[860px]:row-start-2">
            <nav
              className="no-scrollbar flex items-center gap-1 overflow-x-auto pr-6 md:gap-1.5 md:pr-0"
              aria-label="Recipe categories"
              role="tablist"
            >
              {tabs.map((tab, index) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    id={`tab-${tab.id}`}
                    ref={(el) => {
                      tabRefs.current[index] = el;
                    }}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls="compendium-tabpanel"
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => onTabChange(tab.id)}
                    onKeyDown={(e) => {
                      let nextIndex: number | null = null;
                      if (e.key === 'ArrowRight') {
                        nextIndex = (index + 1) % tabs.length;
                      } else if (e.key === 'ArrowLeft') {
                        nextIndex = (index - 1 + tabs.length) % tabs.length;
                      } else if (e.key === 'Home') {
                        nextIndex = 0;
                      } else if (e.key === 'End') {
                        nextIndex = tabs.length - 1;
                      }
                      if (nextIndex !== null) {
                        e.preventDefault();
                        onTabChange(tabs[nextIndex].id);
                        tabRefs.current[nextIndex]?.focus();
                      }
                    }}
                    className="surface-hover touch-chip relative flex shrink-0 items-center gap-1.5 rounded-t border border-b-0 px-2.5 py-2 text-[13px] font-medium transition-colors lg:gap-2 lg:px-3.5 lg:text-sm"
                    style={{
                      backgroundColor: isActive
                        ? 'var(--control-active-bg)'
                        : 'transparent',
                      borderColor: isActive
                        ? 'var(--control-active-border)'
                        : 'transparent',
                      boxShadow: isActive ? 'var(--specular-top)' : undefined,
                      color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                  >
                    <Icon
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0"
                      style={{
                        color: isActive
                          ? tab.accentVar || 'var(--accent-chem)'
                          : undefined,
                      }}
                    />
                    <span className="whitespace-nowrap">
                      {tab.label}
                      {tab.mobileSuffix && (
                        <span
                          className={
                            tab.hideSuffixOnTablet
                              ? 'hidden lg:inline'
                              : 'hidden sm:inline'
                          }
                        >
                          {tab.mobileSuffix}
                        </span>
                      )}
                    </span>
                    <span
                      className="font-readout rounded px-1.5 py-0.5 text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--bg-well)',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                      }}
                    >
                      {tabCounts[tab.id]}
                    </span>
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px]"
                        style={{
                          backgroundColor: tab.accentVar || 'var(--accent-chem)',
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </nav>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-7 md:hidden"
              style={{
                background:
                  'linear-gradient(to right, transparent, var(--bg-surface))',
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
