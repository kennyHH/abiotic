import {
  lazy,
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Backpack,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Hammer,
  Info,
  LayoutGrid,
  Table2,
  X,
} from 'lucide-react';
import rawDb from './data/recipes.json';
import type { RecipeDatabase, RecipeSubcategory } from './types/recipes';
import {
  evaluateRecipes,
  filterAndSortMatches,
  getAvailableDistillationsFromPantry,
  type CraftMatchResult,
  type RecipeFilterOptions,
} from './lib/matcher';
import { usePantry } from './hooks/usePantry';
import { useDialogA11y } from './hooks/useDialogA11y';
import { TopBar, type ActiveTab, type ViewMode } from './components/TopBar';
import { PantryPanel, type SidebarView } from './components/PantryPanel';
import { FilterBar } from './components/FilterBar';
import { RecipeCard } from './components/RecipeCard';

const RecipeTable = lazy(() =>
  import('./components/RecipeTable').then((m) => ({ default: m.RecipeTable }))
);
const RecipeDetailDrawer = lazy(() =>
  import('./components/RecipeDetailDrawer').then((m) => ({
    default: m.RecipeDetailDrawer,
  }))
);
const DistillationGuide = lazy(() =>
  import('./components/DistillationGuide').then((m) => ({
    default: m.DistillationGuide,
  }))
);

const db = rawDb as RecipeDatabase;

export default function App() {
  const {
    pantry,
    acquire,
    customAcquire,
    quantityMode,
    includeDistillationChain,
    hideUnsafeSoups,
    tipDismissed,
    theme,
    selectedCount,
    acquireCount,
    lastClearedCount,
    lastRemovedItem,
    lastClearedAcquireCount,
    lastAcquiredItem,
    toggleItem,
    fulfillOrToggleItem,
    setItemQuantity,
    incrementItem,
    decrementItem,
    clearPantry,
    undoClearPantry,
    dismissUndo,
    undoRemovedItem,
    dismissRemovedItem,
    toggleAcquireItem,
    addAcquireItem,
    addMissingToAcquire,
    setAcquireQuantity,
    incrementAcquireItem,
    decrementAcquireItem,
    removeAcquireItem,
    addCustomAcquireItem,
    setCustomAcquireQuantity,
    incrementCustomAcquireItem,
    decrementCustomAcquireItem,
    removeCustomAcquireItem,
    markItemAcquired,
    markCustomItemAcquired,
    undoAcquiredItem,
    dismissAcquiredItem,
    clearAcquireList,
    undoClearAcquireList,
    dismissClearAcquireUndo,
    setQuantityMode,
    setIncludeDistillationChain,
    setHideUnsafeSoups,
    dismissTip,
    toggleTheme,
  } = usePantry();

  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [sidebarView, setSidebarView] = useState<SidebarView>('pantry');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [workstation, setWorkstation] = useState<string>('all');
  const [subcategory, setSubcategory] = useState<'all' | RecipeSubcategory>('all');
  const [onlyBuffed, setOnlyBuffed] = useState(false);
  const [sortBy, setSortBy] = useState<RecipeFilterOptions['sortBy']>('best-match');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [desktopPantryCollapsed, setDesktopPantryCollapsed] = useState(false);
  const [mobilePantryOpen, setMobilePantryOpen] = useState(false);
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);
  const [showOtherWhenPantryActive, setShowOtherWhenPantryActive] =
    useState(false);
  const [mobileToast, setMobileToast] = useState<{
    message: string;
    canUndo: boolean;
  } | null>(null);
  const mobileToastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (mobileToastTimerRef.current !== null) {
        window.clearTimeout(mobileToastTimerRef.current);
      }
    };
  }, []);

  const hasPantryItems = selectedCount > 0;
  const hasActiveFilters =
    search.trim().length > 0 ||
    workstation !== 'all' ||
    subcategory !== 'all' ||
    onlyBuffed ||
    (!hideUnsafeSoups && (activeTab === 'all' || activeTab === 'soup'));

  const handleToggleItemFromWorkspace = useCallback(
    (itemId: string, requiredQty?: number) => {
      const res = fulfillOrToggleItem(itemId, requiredQty);
      if (
        typeof window !== 'undefined' &&
        window.innerWidth < 860 &&
        !mobilePantryOpen
      ) {
        const name = db.items[itemId]?.name || itemId;
        let nextToast: { message: string; canUndo: boolean } | null = null;
        if (res.action === 'added') {
          nextToast = {
            message: `Added ${name}${res.nextQty > 1 ? ` (×${res.nextQty})` : ''} to Pantry`,
            canUndo: false,
          };
        } else if (res.action === 'topped-up') {
          nextToast = {
            message: `Updated ${name} to ×${res.nextQty}`,
            canUndo: false,
          };
        } else if (res.action === 'removed') {
          nextToast = {
            message: `Removed ${name}${res.prevQty > 1 ? ` (×${res.prevQty})` : ''} from Pantry`,
            canUndo: true,
          };
        }
        if (nextToast) {
          setMobileToast(nextToast);
          if (mobileToastTimerRef.current !== null) {
            window.clearTimeout(mobileToastTimerRef.current);
          }
          mobileToastTimerRef.current = window.setTimeout(() => {
            setMobileToast(null);
            mobileToastTimerRef.current = null;
          }, 3500);
        }
      }
    },
    [fulfillOrToggleItem, mobilePantryOpen]
  );

  const handleCloseMobilePantry = useCallback(() => {
    setMobilePantryOpen(false);
  }, []);

  useDialogA11y(mobilePantryOpen, mobileDrawerRef, handleCloseMobilePantry);

  const handleTabChange = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    setWorkstation('all');
    setSubcategory('all');
  }, []);

  const resetFilters = useCallback(() => {
    setSearch('');
    setWorkstation('all');
    setSubcategory('all');
    setOnlyBuffed(false);
    setHideUnsafeSoups(true);
  }, [setHideUnsafeSoups]);

  const handleSelectRecipe = useCallback((result: CraftMatchResult) => {
    setSelectedRecipeId(result.recipe.id);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedRecipeId(null);
  }, []);

  const tabCounts = useMemo<Record<ActiveTab, number>>(
    () => ({
      all: db.recipes.length,
      soup: db.recipes.filter((r) => r.category === 'soup').length,
      food: db.recipes.filter((r) => r.category === 'food').length,
      chemistry: db.recipes.filter((r) => r.category === 'chemistry').length,
      distillations: db.distillationIds.length,
    }),
    []
  );

  const availableWorkstations = useMemo(() => {
    const set = new Set<string>();
    for (const r of db.recipes) {
      if (activeTab === 'all' || r.category === activeTab) {
        set.add(r.workstation);
      }
    }
    return [...set].sort();
  }, [activeTab]);

  const evaluated = useMemo(
    () =>
      evaluateRecipes(db, {
        pantry,
        quantityMode,
        includeDistillationChain,
      }),
    [pantry, quantityMode, includeDistillationChain]
  );

  const distillationSummary = useMemo(
    () => getAvailableDistillationsFromPantry(db, pantry, quantityMode),
    [pantry, quantityMode]
  );

  const filteredMatches = useMemo(() => {
    if (activeTab === 'distillations') return [];
    return filterAndSortMatches(evaluated, db, {
      category: activeTab,
      workstation,
      subcategory,
      hideUnsafeSoups,
      onlyBuffed,
      featuredDefault: !hasPantryItems,
      search: deferredSearch,
      sortBy,
    });
  }, [
    activeTab,
    evaluated,
    workstation,
    subcategory,
    hideUnsafeSoups,
    onlyBuffed,
    hasPantryItems,
    deferredSearch,
    sortBy,
  ]);

  const hiddenUnsafeCount = useMemo(() => {
    if (!hideUnsafeSoups || (activeTab !== 'all' && activeTab !== 'soup')) {
      return 0;
    }
    if (workstation !== 'all' && workstation !== 'Cooking Pot') return 0;
    if (subcategory !== 'all' && subcategory !== 'unsafe-soup') return 0;
    return db.recipes.filter((r) => r.subcategory === 'unsafe-soup').length;
  }, [hideUnsafeSoups, activeTab, workstation, subcategory]);

  const craftableNow = useMemo(
    () => filteredMatches.filter((m) => m.status === 'craftable'),
    [filteredMatches]
  );
  const almostCraftable = useMemo(
    () => filteredMatches.filter((m) => m.status === 'almost'),
    [filteredMatches]
  );
  const otherRecipes = useMemo(
    () => filteredMatches.filter((m) => m.status === 'unmatched'),
    [filteredMatches]
  );

  const selectedResult = useMemo<CraftMatchResult | null>(() => {
    if (!selectedRecipeId) return null;
    return evaluated.find((r) => r.recipe.id === selectedRecipeId) || null;
  }, [evaluated, selectedRecipeId]);

  const renderRecipeCollection = (list: CraftMatchResult[]) => {
    if (viewMode === 'table') {
      return (
        <Suspense
          fallback={
            <div
              className="rounded-xl border py-10 text-center text-xs"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-muted)',
              }}
            >
              Loading table view...
            </div>
          }
        >
          <RecipeTable
            results={list}
            db={db}
            hasPantryItems={hasPantryItems}
            quantityMode={quantityMode}
            onSelectRecipe={handleSelectRecipe}
            onTogglePantryItem={handleToggleItemFromWorkspace}
          />
        </Suspense>
      );
    }
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((res, idx) => (
          <RecipeCard
            key={res.recipe.id}
            result={res}
            db={db}
            hasPantryItems={hasPantryItems}
            quantityMode={quantityMode}
            eager={idx < 12}
            onSelectRecipe={handleSelectRecipe}
            onTogglePantryItem={handleToggleItemFromWorkspace}
          />
        ))}
      </div>
    );
  };

  return (
    <div
      className="flex min-h-screen flex-col min-[860px]:h-screen min-[860px]:overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-ground)',
        color: 'var(--text-primary)',
      }}
    >
      <TopBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        tabCounts={tabCounts}
        search={search}
        onSearchChange={setSearch}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        theme={theme}
        onToggleTheme={toggleTheme}
        syncedAt={db.syncedAt}
        desktopPantryCollapsed={desktopPantryCollapsed}
        onExpandDesktopPantry={() => {
          setSidebarView('pantry');
          setDesktopPantryCollapsed(false);
        }}
        onExpandDesktopAcquire={() => {
          setSidebarView('acquire');
          setDesktopPantryCollapsed(false);
        }}
        selectedPantryCount={selectedCount}
        acquireCount={acquireCount}
      />

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 items-stretch min-[860px]:min-h-0 min-[860px]:overflow-hidden">
        {/* Desktop Persistent Pantry Sidebar */}
        <aside
          aria-label="My Inventory and Pantry"
          className={
            desktopPantryCollapsed
              ? 'hidden'
              : 'hidden w-72 shrink-0 border-r min-[860px]:flex min-[860px]:flex-col min-[860px]:overflow-hidden lg:w-80 xl:w-96'
          }
          style={{
            backgroundColor: 'var(--bg-panel)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <PantryPanel
            db={db}
            pantry={pantry}
            acquire={acquire}
            customAcquire={customAcquire}
            activeView={sidebarView}
            onViewChange={setSidebarView}
            quantityMode={quantityMode}
            includeDistillationChain={includeDistillationChain}
            hideUnsafeSoups={hideUnsafeSoups}
            distillationSummary={distillationSummary}
            lastClearedCount={lastClearedCount}
            lastRemovedItem={lastRemovedItem}
            lastClearedAcquireCount={lastClearedAcquireCount}
            lastAcquiredItem={lastAcquiredItem}
            onToggleItem={toggleItem}
            onIncrementItem={incrementItem}
            onDecrementItem={decrementItem}
            onSetQuantity={setItemQuantity}
            onClearPantry={clearPantry}
            onUndoClearPantry={undoClearPantry}
            onDismissUndo={dismissUndo}
            onUndoRemovedItem={undoRemovedItem}
            onDismissRemovedItem={dismissRemovedItem}
            onToggleAcquireItem={toggleAcquireItem}
            onAddAcquireItem={addAcquireItem}
            onIncrementAcquireItem={incrementAcquireItem}
            onDecrementAcquireItem={decrementAcquireItem}
            onSetAcquireQuantity={setAcquireQuantity}
            onRemoveAcquireItem={removeAcquireItem}
            onMarkItemAcquired={markItemAcquired}
            onAddCustomAcquireItem={addCustomAcquireItem}
            onIncrementCustomAcquireItem={incrementCustomAcquireItem}
            onDecrementCustomAcquireItem={decrementCustomAcquireItem}
            onSetCustomAcquireQuantity={setCustomAcquireQuantity}
            onRemoveCustomAcquireItem={removeCustomAcquireItem}
            onMarkCustomItemAcquired={markCustomItemAcquired}
            onClearAcquireList={clearAcquireList}
            onUndoClearAcquireList={undoClearAcquireList}
            onDismissClearAcquireUndo={dismissClearAcquireUndo}
            onUndoAcquiredItem={undoAcquiredItem}
            onDismissAcquiredItem={dismissAcquiredItem}
            onSetQuantityMode={setQuantityMode}
            onSetIncludeDistillationChain={setIncludeDistillationChain}
            onRequestOpenMobilePantry={() => {
              setSidebarView('pantry');
              if (desktopPantryCollapsed) {
                setDesktopPantryCollapsed(false);
              } else {
                setMobilePantryOpen(true);
              }
            }}
            onCollapseDesktop={() => setDesktopPantryCollapsed(true)}
          />
        </aside>

        {/* Mobile Pantry Drawer */}
        {mobilePantryOpen && (
          <div
            className="scrim-enter fixed inset-0 z-50 flex bg-black/60 backdrop-blur-[3px] min-[860px]:hidden"
            onClick={handleCloseMobilePantry}
            role="dialog"
            aria-modal="true"
            aria-label="My Inventory and Pantry"
          >
            <div
              ref={mobileDrawerRef}
              tabIndex={-1}
              className="drawer-enter-left h-full w-full max-w-sm border-r"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <PantryPanel
                db={db}
                pantry={pantry}
                acquire={acquire}
                customAcquire={customAcquire}
                activeView={sidebarView}
                onViewChange={setSidebarView}
                quantityMode={quantityMode}
                includeDistillationChain={includeDistillationChain}
                hideUnsafeSoups={hideUnsafeSoups}
                distillationSummary={distillationSummary}
                lastClearedCount={lastClearedCount}
                lastRemovedItem={lastRemovedItem}
                lastClearedAcquireCount={lastClearedAcquireCount}
                lastAcquiredItem={lastAcquiredItem}
                isMobileDrawer={true}
                onToggleItem={toggleItem}
                onIncrementItem={incrementItem}
                onDecrementItem={decrementItem}
                onSetQuantity={setItemQuantity}
                onClearPantry={clearPantry}
                onUndoClearPantry={undoClearPantry}
                onDismissUndo={dismissUndo}
                onUndoRemovedItem={undoRemovedItem}
                onDismissRemovedItem={dismissRemovedItem}
                onToggleAcquireItem={toggleAcquireItem}
                onAddAcquireItem={addAcquireItem}
                onIncrementAcquireItem={incrementAcquireItem}
                onDecrementAcquireItem={decrementAcquireItem}
                onSetAcquireQuantity={setAcquireQuantity}
                onRemoveAcquireItem={removeAcquireItem}
                onMarkItemAcquired={markItemAcquired}
                onAddCustomAcquireItem={addCustomAcquireItem}
                onIncrementCustomAcquireItem={incrementCustomAcquireItem}
                onDecrementCustomAcquireItem={decrementCustomAcquireItem}
                onSetCustomAcquireQuantity={setCustomAcquireQuantity}
                onRemoveCustomAcquireItem={removeCustomAcquireItem}
                onMarkCustomItemAcquired={markCustomItemAcquired}
                onClearAcquireList={clearAcquireList}
                onUndoClearAcquireList={undoClearAcquireList}
                onDismissClearAcquireUndo={dismissClearAcquireUndo}
                onUndoAcquiredItem={undoAcquiredItem}
                onDismissAcquiredItem={dismissAcquiredItem}
                onSetQuantityMode={setQuantityMode}
                onSetIncludeDistillationChain={setIncludeDistillationChain}
                onCloseMobile={() => setMobilePantryOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Main Compendium Workspace */}
        <main className="workspace-grid min-w-0 flex-1 px-3.5 pt-3.5 pb-24 sm:px-4 min-[860px]:overflow-y-auto min-[860px]:px-5 min-[860px]:py-5 lg:px-6">
          <div
            id="compendium-tabpanel"
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
            className="space-y-4 min-[860px]:space-y-5"
          >
          {activeTab === 'distillations' ? (
            <Suspense
              fallback={
                <div
                  className="rounded-md border py-12 text-center text-xs"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-muted)',
                  }}
                >
                  Loading Distillation Guide...
                </div>
              }
            >
              <DistillationGuide
                db={db}
                pantry={pantry}
                distillationSummary={distillationSummary}
                search={deferredSearch}
                onTogglePantryItem={handleToggleItemFromWorkspace}
                onSelectRecipeId={setSelectedRecipeId}
                onClearSearch={() => setSearch('')}
              />
            </Suspense>
          ) : (
            <>
              <FilterBar
                activeTab={activeTab}
                workstation={workstation}
                onWorkstationChange={setWorkstation}
                availableWorkstations={availableWorkstations}
                subcategory={subcategory}
                onSubcategoryChange={setSubcategory}
                hideUnsafeSoups={hideUnsafeSoups}
                onHideUnsafeSoupsChange={setHideUnsafeSoups}
                onlyBuffed={onlyBuffed}
                onOnlyBuffedChange={setOnlyBuffed}
                hasPantryItems={hasPantryItems}
                hasActiveFilters={hasActiveFilters}
                onResetFilters={resetFilters}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                totalMatching={filteredMatches.length}
                hiddenUnsafeCount={hiddenUnsafeCount}
              />

              {!hasPantryItems ? (
                <div className="space-y-3.5">
                  <h2 className="sr-only">Recipe catalog</h2>
                  {!tipDismissed && (
                    <div
                      className="flex items-center justify-between gap-2 rounded-md border border-l-[3px] px-3 py-2 text-xs leading-snug sm:text-[13px]"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-subtle)',
                        borderLeftColor: 'var(--accent-chem)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <span className="text-pretty flex items-center gap-2">
                        <Info
                          className="h-3.5 w-3.5 shrink-0"
                          style={{ color: 'var(--accent-chem)' }}
                        />
                        <span>
                          Check items in your Pantry or tap any ingredient pill on a
                          card to see what you can craft right now.
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={dismissTip}
                        aria-label="Dismiss pantry tip"
                        className="touch-target inline-flex shrink-0 items-center justify-center rounded p-1 transition-colors hover:opacity-80"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {filteredMatches.length === 0 ? (
                    <div
                      className="flex flex-col items-center gap-3 rounded-md border py-14 text-center text-sm"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-muted)',
                        boxShadow: 'var(--shadow-card)',
                      }}
                    >
                      <p className="text-pretty max-w-[56ch] leading-relaxed">
                        No recipes match your current search and filter settings.
                      </p>
                      {search.trim().length > 0 && (
                        <p className="text-pretty max-w-[56ch] text-xs">
                          Try searching a dish name, ingredient, or buff effect
                          like &ldquo;XP&rdquo; or &ldquo;stamina&rdquo;.
                        </p>
                      )}
                      <div className="flex flex-wrap justify-center gap-2">
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="rounded border px-3 py-1.5 text-xs font-medium"
                            style={{
                              backgroundColor: 'var(--bg-elevated)',
                              borderColor: 'var(--border-strong)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            Reset search &amp; filters
                          </button>
                        )}
                        {hideUnsafeSoups &&
                          (activeTab === 'all' || activeTab === 'soup') && (
                            <button
                              type="button"
                              onClick={() => setHideUnsafeSoups(false)}
                              className="rounded border px-3 py-1.5 text-xs font-medium"
                              style={{
                                backgroundColor: 'var(--accent-hazard-bg)',
                                borderColor: 'var(--accent-hazard)',
                                color: 'var(--accent-hazard)',
                              }}
                            >
                              Show unsafe soups
                            </button>
                          )}
                      </div>
                    </div>
                  ) : (
                    renderRecipeCollection(filteredMatches)
                  )}
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Craftable Now Section */}
                  <section className="space-y-3">
                    <div
                      className="flex items-center justify-between border-b pb-2"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <h2
                        className="flex items-center gap-2 text-lg font-semibold tracking-[-0.02em]"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <CheckCircle2
                          className="h-5 w-5"
                          style={{ color: 'var(--accent-ready)' }}
                        />
                        <span>Craftable Now</span>
                        <span
                          className="font-readout rounded border px-2 py-0.5 text-xs font-semibold"
                          style={{
                            backgroundColor: 'var(--accent-ready-bg)',
                            borderColor: 'var(--accent-ready-border)',
                            color: 'var(--accent-ready)',
                          }}
                        >
                          {craftableNow.length}
                        </span>
                      </h2>
                    </div>

                    {craftableNow.length === 0 ? (
                      <div
                        className="flex flex-col items-center gap-2 rounded-md border px-4 py-6 text-center text-sm"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <p className="text-pretty max-w-[56ch] leading-relaxed">
                          No complete recipes match your current Pantry items in
                          this view. Check Almost Craftable below or add more
                          ingredients.
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {!includeDistillationChain &&
                            (activeTab === 'all' || activeTab === 'chemistry') &&
                            Object.values(distillationSummary).some(
                              (s) => s.fromRawQty > 0
                            ) && (
                              <button
                                type="button"
                                onClick={() =>
                                  setIncludeDistillationChain(true)
                                }
                                className="rounded border px-2.5 py-1 text-xs font-medium"
                                style={{
                                  backgroundColor: 'var(--accent-chem-bg)',
                                  borderColor: 'var(--accent-chem-border)',
                                  color: 'var(--accent-chem)',
                                }}
                              >
                                Enable Auto-distill
                              </button>
                            )}
                          {hasActiveFilters && (
                            <button
                              type="button"
                              onClick={resetFilters}
                              className="rounded border px-2.5 py-1 text-xs font-medium"
                              style={{
                                backgroundColor: 'var(--bg-elevated)',
                                borderColor: 'var(--border-strong)',
                                color: 'var(--text-primary)',
                              }}
                            >
                              Reset filters
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      renderRecipeCollection(craftableNow)
                    )}
                  </section>

                  {/* Almost Craftable Section */}
                  <section className="space-y-3">
                    <div
                      className="flex items-center justify-between border-b pb-2"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <h2
                        className="flex items-center gap-2 text-lg font-semibold tracking-[-0.02em]"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <Hammer
                          className="h-5 w-5"
                          style={{ color: 'var(--accent-food)' }}
                        />
                        <span>Almost Craftable (Missing 1–2 Items)</span>
                        <span
                          className="font-readout rounded border px-2 py-0.5 text-xs font-semibold"
                          style={{
                            backgroundColor: 'var(--accent-food-bg)',
                            borderColor: 'var(--accent-food-border)',
                            color: 'var(--accent-food)',
                          }}
                        >
                          {almostCraftable.length}
                        </span>
                      </h2>
                    </div>

                    {almostCraftable.length === 0 ? (
                      <div
                        className="flex flex-col items-center gap-2 rounded-md border px-4 py-6 text-center text-sm"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <p className="text-pretty max-w-[56ch] leading-relaxed">
                          No recipes are 1–2 items away under your current
                          filters.
                        </p>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="rounded border px-2.5 py-1 text-xs font-medium"
                            style={{
                              backgroundColor: 'var(--bg-elevated)',
                              borderColor: 'var(--border-strong)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            Reset filters
                          </button>
                        )}
                      </div>
                    ) : (
                      renderRecipeCollection(almostCraftable)
                    )}
                  </section>

                  {/* Remaining Recipes (Collapsible) */}
                  {otherRecipes.length > 0 && (
                    <section className="space-y-3">
                      <button
                        type="button"
                        aria-expanded={showOtherWhenPantryActive}
                        onClick={() =>
                          setShowOtherWhenPantryActive((prev) => !prev)
                        }
                        className="surface-hover flex w-full items-center justify-between rounded-md border px-4 py-2.5 text-left text-sm font-semibold transition-colors"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <span>
                          Other Matching Recipes ({otherRecipes.length})
                        </span>
                        {showOtherWhenPantryActive ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>

                      {showOtherWhenPantryActive &&
                        renderRecipeCollection(otherRecipes)}
                    </section>
                  )}
                </div>
              )}
            </>
          )}
          </div>
        </main>
      </div>

      {/* Mobile/Tablet Floating Pantry Toast */}
      {mobileToast && (
        <div
          role="status"
          aria-live="polite"
          className="popover-enter fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium whitespace-nowrap min-[860px]:hidden"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-strong)',
            boxShadow: 'var(--shadow-popover)',
            color: 'var(--text-primary)',
          }}
        >
          <span>{mobileToast.message}</span>
          {mobileToast.canUndo && (
            <button
              type="button"
              onClick={() => {
                undoRemovedItem();
                setMobileToast(null);
                if (mobileToastTimerRef.current !== null) {
                  window.clearTimeout(mobileToastTimerRef.current);
                  mobileToastTimerRef.current = null;
                }
              }}
              className="rounded-full border px-2 py-0.5 text-xs font-semibold"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-strong)',
                color: 'var(--accent-chem)',
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}

      {/* Thumb-Zone Mobile Dock & Compact Tablet Pantry Pill */}
      <div
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-2 border-t px-3.5 pt-2.5 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-auto sm:rounded-full sm:border sm:px-2.5 sm:py-2 min-[860px]:hidden"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-strong)',
          boxShadow: 'var(--shadow-popover)',
        }}
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setSidebarView('pantry');
              setMobilePantryOpen(true);
            }}
            aria-label="Open mobile pantry drawer"
            className="pressable flex min-h-11 items-center gap-2 rounded border px-3 py-2 text-[13px] font-semibold sm:min-h-10 sm:rounded-full sm:px-3.5 sm:py-1.5"
            style={{
              backgroundColor: hasPantryItems
                ? 'var(--accent-ready-bg)'
                : 'var(--bg-elevated)',
              borderColor: hasPantryItems
                ? 'var(--accent-ready-border)'
                : 'var(--border-strong)',
              color: hasPantryItems
                ? 'var(--accent-ready)'
                : 'var(--text-primary)',
            }}
          >
            <Backpack className="h-4 w-4" aria-hidden="true" />
            <span>My Pantry ({selectedCount})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSidebarView('acquire');
              setMobilePantryOpen(true);
            }}
            aria-label="Open mobile to acquire drawer"
            className="pressable flex min-h-11 items-center gap-1.5 rounded border px-3 py-2 text-[13px] font-semibold sm:min-h-10 sm:rounded-full sm:px-3.5 sm:py-1.5"
            style={{
              backgroundColor:
                acquireCount > 0
                  ? 'var(--accent-food-bg)'
                  : 'var(--bg-elevated)',
              borderColor:
                acquireCount > 0
                  ? 'var(--accent-food-border)'
                  : 'var(--border-strong)',
              color:
                acquireCount > 0 ? 'var(--accent-food)' : 'var(--text-primary)',
            }}
          >
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            <span>
              <span className="sr-only sm:not-sr-only">To </span>Acquire (
              {acquireCount})
            </span>
          </button>
        </div>

        {hasPantryItems && activeTab !== 'distillations' && (
          <div
            className="font-readout truncate px-1 text-xs font-medium sm:pr-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span style={{ color: 'var(--accent-ready)' }}>
              {craftableNow.length} Ready
            </span>
            {' / '}
            <span style={{ color: 'var(--accent-food)' }}>
              {almostCraftable.length} Almost
            </span>
          </div>
        )}

        {activeTab !== 'distillations' && (
          <button
            type="button"
            onClick={() =>
              setViewMode((prev) => (prev === 'cards' ? 'table' : 'cards'))
            }
            aria-label={
              viewMode === 'cards'
                ? 'Switch to table view'
                : 'Switch to card view'
            }
            className="pressable flex min-h-11 shrink-0 items-center gap-1.5 rounded border px-3 py-2 text-[13px] font-medium sm:hidden"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            {viewMode === 'cards' ? (
              <>
                <Table2 className="h-4 w-4" />
                <span>Table</span>
              </>
            ) : (
              <>
                <LayoutGrid className="h-4 w-4" />
                <span>Cards</span>
              </>
            )}
          </button>
        )}
      </div>

      <Suspense fallback={null}>
        {selectedResult && (
          <RecipeDetailDrawer
            result={selectedResult}
            db={db}
            pantry={pantry}
            acquire={acquire}
            quantityMode={quantityMode}
            onClose={handleCloseDrawer}
            onTogglePantryItem={handleToggleItemFromWorkspace}
            onToggleAcquireItem={toggleAcquireItem}
            onAddMissingToAcquire={addMissingToAcquire}
            onIncrementItem={incrementItem}
            onDecrementItem={decrementItem}
            onSetQuantity={setItemQuantity}
          />
        )}
      </Suspense>
    </div>
  );
}
