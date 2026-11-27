import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clampQty,
  FORBIDDEN_KEYS,
  mergePortableData,
  sanitizeCustomAcquire,
  sanitizeFavorites,
  sanitizeItemMap,
  type CustomAcquireItem,
  type PortableData,
} from '../lib/portability';

export type { CustomAcquireItem } from '../lib/portability';
export type ThemeMode = 'dark' | 'light';

export interface ImportSummary {
  mode: 'replace' | 'merge';
  pantryCount: number;
  favoriteCount: number;
  acquireCount: number;
}

export type LastAcquiredItem =
  | {
      isCustom: false;
      id: string;
      qty: number;
      prevPantryQty: number;
    }
  | {
      isCustom: true;
      item: CustomAcquireItem;
    };

interface PersistedState {
  pantry: Record<string, number>;
  favorites: string[];
  acquire: Record<string, number>;
  customAcquire: CustomAcquireItem[];
  quantityMode: boolean;
  includeDistillationChain: boolean;
  hideUnsafeSoups: boolean;
  tipDismissed: boolean;
  theme: ThemeMode;
}

export const PANTRY_STORAGE_KEY = 'abiotic-compendium-state-v1';

const DEFAULT_STATE: PersistedState = {
  pantry: {},
  favorites: [],
  acquire: {},
  customAcquire: [],
  quantityMode: false,
  includeDistillationChain: true,
  hideUnsafeSoups: true,
  tipDismissed: false,
  theme: 'dark',
};

function loadInitialState(): PersistedState {
  try {
    const raw = window.localStorage?.getItem?.(PANTRY_STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_STATE;
    return {
      pantry: sanitizeItemMap(parsed.pantry),
      favorites: sanitizeFavorites(parsed.favorites),
      acquire: sanitizeItemMap(parsed.acquire),
      customAcquire: sanitizeCustomAcquire(parsed.customAcquire),
      quantityMode: Boolean(parsed.quantityMode),
      includeDistillationChain:
        parsed.includeDistillationChain !== undefined
          ? Boolean(parsed.includeDistillationChain)
          : true,
      hideUnsafeSoups:
        parsed.hideUnsafeSoups !== undefined
          ? Boolean(parsed.hideUnsafeSoups)
          : true,
      tipDismissed: Boolean(parsed.tipDismissed),
      theme: parsed.theme === 'light' ? 'light' : 'dark',
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function usePantry() {
  const [state, setState] = useState<PersistedState>(loadInitialState);
  const [lastClearedPantry, setLastClearedPantry] = useState<Record<
    string,
    number
  > | null>(null);
  const [lastRemovedItem, setLastRemovedItem] = useState<{
    id: string;
    qty: number;
  } | null>(null);
  const [lastClearedAcquire, setLastClearedAcquire] = useState<{
    acquire: Record<string, number>;
    customAcquire: CustomAcquireItem[];
  } | null>(null);
  const [lastAcquiredItem, setLastAcquiredItem] =
    useState<LastAcquiredItem | null>(null);
  const [lastImportSummary, setLastImportSummary] =
    useState<ImportSummary | null>(null);

  const undoTimerRef = useRef<number | null>(null);
  const removedItemTimerRef = useRef<number | null>(null);
  const acquireUndoTimerRef = useRef<number | null>(null);
  const acquiredItemTimerRef = useRef<number | null>(null);
  const importUndoTimerRef = useRef<number | null>(null);
  const lastClearedAcquireRef = useRef(lastClearedAcquire);
  lastClearedAcquireRef.current = lastClearedAcquire;
  const lastAcquiredItemRef = useRef(lastAcquiredItem);
  lastAcquiredItemRef.current = lastAcquiredItem;
  const lastPreImportSnapshotRef = useRef<PortableData | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);

  const clearRemovedItemTimer = useCallback(() => {
    if (removedItemTimerRef.current !== null) {
      window.clearTimeout(removedItemTimerRef.current);
      removedItemTimerRef.current = null;
    }
  }, []);

  const clearAcquireUndoTimer = useCallback(() => {
    if (acquireUndoTimerRef.current !== null) {
      window.clearTimeout(acquireUndoTimerRef.current);
      acquireUndoTimerRef.current = null;
    }
  }, []);

  const clearAcquiredItemTimer = useCallback(() => {
    if (acquiredItemTimerRef.current !== null) {
      window.clearTimeout(acquiredItemTimerRef.current);
      acquiredItemTimerRef.current = null;
    }
  }, []);

  const clearImportUndoTimer = useCallback(() => {
    if (importUndoTimerRef.current !== null) {
      window.clearTimeout(importUndoTimerRef.current);
      importUndoTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearUndoTimer();
      clearRemovedItemTimer();
      clearAcquireUndoTimer();
      clearAcquiredItemTimer();
      clearImportUndoTimer();
    };
  }, [
    clearUndoTimer,
    clearRemovedItemTimer,
    clearAcquireUndoTimer,
    clearAcquiredItemTimer,
    clearImportUndoTimer,
  ]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
    try {
      window.localStorage?.setItem?.(
        PANTRY_STORAGE_KEY,
        JSON.stringify(state)
      );
    } catch {
      // ignore storage quota errors
    }
  }, [state]);

  const dismissUndo = useCallback(() => {
    clearUndoTimer();
    setLastClearedPantry(null);
  }, [clearUndoTimer]);

  const dismissRemovedItem = useCallback(() => {
    clearRemovedItemTimer();
    setLastRemovedItem(null);
  }, [clearRemovedItemTimer]);

  const dismissClearAcquireUndo = useCallback(() => {
    clearAcquireUndoTimer();
    lastClearedAcquireRef.current = null;
    setLastClearedAcquire(null);
  }, [clearAcquireUndoTimer]);

  const dismissAcquiredItem = useCallback(() => {
    clearAcquiredItemTimer();
    lastAcquiredItemRef.current = null;
    setLastAcquiredItem(null);
  }, [clearAcquiredItemTimer]);

  const dismissImportUndo = useCallback(() => {
    clearImportUndoTimer();
    lastPreImportSnapshotRef.current = null;
    setLastImportSummary(null);
  }, [clearImportUndoTimer]);

  const toggleItem = useCallback(
    (id: string) => {
      dismissUndo();
      dismissImportUndo();
      const curState = stateRef.current;
      const curQty = curState.pantry[id] ?? 0;
      if (curQty > 0 && (curState.quantityMode || curQty > 1)) {
        clearRemovedItemTimer();
        setLastRemovedItem({ id, qty: curQty });
        removedItemTimerRef.current = window.setTimeout(() => {
          setLastRemovedItem(null);
          removedItemTimerRef.current = null;
        }, 6000);
      } else {
        dismissRemovedItem();
      }
      setState((prev) => {
        const nextPantry = { ...prev.pantry };
        if ((nextPantry[id] ?? 0) > 0) {
          delete nextPantry[id];
        } else {
          nextPantry[id] = 1;
        }
        return { ...prev, pantry: nextPantry };
      });
    },
    [dismissUndo, dismissImportUndo, clearRemovedItemTimer, dismissRemovedItem]
  );

  const fulfillOrToggleItem = useCallback(
    (
      id: string,
      requiredQty?: number
    ): {
      action: 'added' | 'topped-up' | 'removed';
      prevQty: number;
      nextQty: number;
    } => {
      dismissUndo();
      dismissImportUndo();
      const curState = stateRef.current;
      const curQty = curState.pantry[id] ?? 0;

      if (!curState.quantityMode) {
        if (curQty > 1) {
          clearRemovedItemTimer();
          setLastRemovedItem({ id, qty: curQty });
          removedItemTimerRef.current = window.setTimeout(() => {
            setLastRemovedItem(null);
            removedItemTimerRef.current = null;
          }, 6000);
        } else {
          dismissRemovedItem();
        }
        setState((prev) => {
          const nextPantry = { ...prev.pantry };
          if ((nextPantry[id] ?? 0) > 0) {
            delete nextPantry[id];
          } else {
            nextPantry[id] = 1;
          }
          return { ...prev, pantry: nextPantry };
        });
        return {
          action: curQty > 0 ? 'removed' : 'added',
          prevQty: curQty,
          nextQty: curQty > 0 ? 0 : 1,
        };
      }

      const rawReq =
        requiredQty !== undefined && Number.isFinite(requiredQty)
          ? requiredQty
          : 1;
      const req = Math.min(999, Math.max(1, Math.floor(rawReq)));

      if (curQty < req) {
        dismissRemovedItem();
        setState((prev) => ({
          ...prev,
          pantry: {
            ...prev.pantry,
            [id]: req,
          },
        }));
        return {
          action: curQty > 0 ? 'topped-up' : 'added',
          prevQty: curQty,
          nextQty: req,
        };
      }

      clearRemovedItemTimer();
      setLastRemovedItem({ id, qty: curQty });
      removedItemTimerRef.current = window.setTimeout(() => {
        setLastRemovedItem(null);
        removedItemTimerRef.current = null;
      }, 10000);
      setState((prev) => {
        const nextPantry = { ...prev.pantry };
        delete nextPantry[id];
        return { ...prev, pantry: nextPantry };
      });
      return {
        action: 'removed',
        prevQty: curQty,
        nextQty: 0,
      };
    },
    [dismissUndo, dismissImportUndo, clearRemovedItemTimer, dismissRemovedItem]
  );

  const undoRemovedItem = useCallback(() => {
    clearRemovedItemTimer();
    setLastRemovedItem((removed) => {
      if (removed && removed.qty > 0) {
        setState((prev) => ({
          ...prev,
          pantry: {
            ...prev.pantry,
            [removed.id]: Math.max(prev.pantry[removed.id] ?? 0, removed.qty),
          },
        }));
      }
      return null;
    });
  }, [clearRemovedItemTimer]);

  const addItem = useCallback(
    (id: string, qty = 1) => {
      dismissUndo();
      dismissRemovedItem();
      dismissImportUndo();
      const clamped = Math.min(999, Math.max(1, Math.floor(qty)));
      setState((prev) => {
        const nextPantry = { ...prev.pantry };
        nextPantry[id] = Math.max(nextPantry[id] ?? 0, clamped);
        return { ...prev, pantry: nextPantry };
      });
    },
    [dismissUndo, dismissRemovedItem, dismissImportUndo]
  );

  const setItemQuantity = useCallback(
    (id: string, qty: number) => {
      dismissUndo();
      dismissRemovedItem();
      dismissImportUndo();
      setState((prev) => {
        const nextPantry = { ...prev.pantry };
        if (!Number.isFinite(qty) || qty <= 0) {
          delete nextPantry[id];
        } else {
          nextPantry[id] = Math.min(999, Math.max(1, Math.floor(qty)));
        }
        return { ...prev, pantry: nextPantry };
      });
    },
    [dismissUndo, dismissRemovedItem, dismissImportUndo]
  );

  const adjustItemQuantity = useCallback(
    (id: string, delta: number) => {
      if (!Number.isFinite(delta) || delta === 0) return;
      dismissUndo();
      dismissRemovedItem();
      dismissImportUndo();
      setState((prev) => {
        const cur = prev.pantry[id] ?? 0;
        const nextQty = cur + Math.trunc(delta);
        const nextPantry = { ...prev.pantry };
        if (nextQty <= 0) {
          delete nextPantry[id];
        } else {
          nextPantry[id] = clampQty(nextQty);
        }
        return { ...prev, pantry: nextPantry };
      });
    },
    [dismissUndo, dismissRemovedItem, dismissImportUndo]
  );

  const incrementItem = useCallback(
    (id: string) => adjustItemQuantity(id, 1),
    [adjustItemQuantity]
  );

  const decrementItem = useCallback(
    (id: string) => adjustItemQuantity(id, -1),
    [adjustItemQuantity]
  );

  const clearPantry = useCallback(() => {
    dismissRemovedItem();
    const cur = stateRef.current;
    const entries = Object.entries(cur.pantry).filter(([, q]) => q > 0);
    if (entries.length === 0) return;
    dismissImportUndo();
    const snapshot = { ...cur.pantry };
    clearUndoTimer();
    setLastClearedPantry(snapshot);
    undoTimerRef.current = window.setTimeout(() => {
      setLastClearedPantry(null);
      undoTimerRef.current = null;
    }, 12000);
    setState((prev) => ({ ...prev, pantry: {} }));
  }, [clearUndoTimer, dismissRemovedItem, dismissImportUndo]);

  const clearPantrySubset = useCallback(
    (itemIds: string[]) => {
      if (itemIds.length === 0) return;
      dismissRemovedItem();
      const cur = stateRef.current;
      const subsetSnapshot: Record<string, number> = {};
      for (const id of itemIds) {
        const qty = cur.pantry[id] ?? 0;
        if (qty > 0) {
          subsetSnapshot[id] = qty;
        }
      }
      const removedKeys = Object.keys(subsetSnapshot);
      if (removedKeys.length === 0) return;
      dismissImportUndo();

      clearUndoTimer();
      setLastClearedPantry(subsetSnapshot);
      undoTimerRef.current = window.setTimeout(() => {
        setLastClearedPantry(null);
        undoTimerRef.current = null;
      }, 12000);

      setState((prev) => {
        const nextPantry = { ...prev.pantry };
        for (const id of removedKeys) {
          delete nextPantry[id];
        }
        return { ...prev, pantry: nextPantry };
      });
    },
    [clearUndoTimer, dismissRemovedItem, dismissImportUndo]
  );

  const undoClearPantry = useCallback(() => {
    clearUndoTimer();
    setLastClearedPantry((snapshot) => {
      if (snapshot && Object.keys(snapshot).length > 0) {
        setState((prev) => ({
          ...prev,
          pantry: { ...snapshot, ...prev.pantry },
        }));
      }
      return null;
    });
  }, [clearUndoTimer]);

  const toggleFavorite = useCallback(
    (recipeId: string) => {
      const cleanId = recipeId.trim();
      if (!cleanId || FORBIDDEN_KEYS.has(cleanId)) return;
      dismissImportUndo();
      setState((prev) => {
        const exists = prev.favorites.includes(cleanId);
        const nextFavorites = exists
          ? prev.favorites.filter((id) => id !== cleanId)
          : prev.favorites.length >= 500
            ? prev.favorites
            : [...prev.favorites, cleanId];
        return {
          ...prev,
          favorites: nextFavorites,
        };
      });
    },
    [dismissImportUndo]
  );

  const importPortableData = useCallback(
    (incoming: PortableData, mode: 'replace' | 'merge') => {
      const cur = stateRef.current;
      const snapshot: PortableData = {
        pantry: { ...cur.pantry },
        favorites: [...cur.favorites],
        acquire: { ...cur.acquire },
        customAcquire: cur.customAcquire.map((it) => ({ ...it })),
      };

      dismissUndo();
      dismissRemovedItem();
      dismissClearAcquireUndo();
      dismissAcquiredItem();
      clearImportUndoTimer();

      lastPreImportSnapshotRef.current = snapshot;
      setLastImportSummary({
        mode,
        pantryCount: Object.keys(incoming.pantry).length,
        favoriteCount: incoming.favorites.length,
        acquireCount:
          Object.keys(incoming.acquire).length + incoming.customAcquire.length,
      });

      importUndoTimerRef.current = window.setTimeout(() => {
        lastPreImportSnapshotRef.current = null;
        setLastImportSummary(null);
        importUndoTimerRef.current = null;
      }, 15000);

      setState((prev) => {
        const nextPortable: PortableData =
          mode === 'replace'
            ? {
                pantry: { ...incoming.pantry },
                favorites: [...incoming.favorites],
                acquire: { ...incoming.acquire },
                customAcquire: incoming.customAcquire.map((it) => ({ ...it })),
              }
            : mergePortableData(
                {
                  pantry: prev.pantry,
                  favorites: prev.favorites,
                  acquire: prev.acquire,
                  customAcquire: prev.customAcquire,
                },
                incoming
              );
        return {
          ...prev,
          ...nextPortable,
        };
      });
    },
    [
      dismissUndo,
      dismissRemovedItem,
      dismissClearAcquireUndo,
      dismissAcquiredItem,
      clearImportUndoTimer,
    ]
  );

  const undoImport = useCallback(() => {
    const snapshot = lastPreImportSnapshotRef.current;
    clearImportUndoTimer();
    lastPreImportSnapshotRef.current = null;
    setLastImportSummary(null);
    if (!snapshot) return;

    setState((prev) => ({
      ...prev,
      pantry: { ...snapshot.pantry },
      favorites: [...snapshot.favorites],
      acquire: { ...snapshot.acquire },
      customAcquire: snapshot.customAcquire.map((it) => ({ ...it })),
    }));
  }, [clearImportUndoTimer]);

  const setQuantityMode = useCallback((quantityMode: boolean) => {
    setState((prev) => ({ ...prev, quantityMode }));
  }, []);

  const setIncludeDistillationChain = useCallback(
    (includeDistillationChain: boolean) => {
      setState((prev) => ({ ...prev, includeDistillationChain }));
    },
    []
  );

  const setHideUnsafeSoups = useCallback((hideUnsafeSoups: boolean) => {
    setState((prev) => ({ ...prev, hideUnsafeSoups }));
  }, []);

  const dismissTip = useCallback(() => {
    setState((prev) => ({ ...prev, tipDismissed: true }));
  }, []);

  const toggleTheme = useCallback(() => {
    setState((prev) => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark',
    }));
  }, []);

  const toggleAcquireItem = useCallback(
    (
      id: string,
      defaultQty = 1
    ): { action: 'added' | 'removed'; qty: number } => {
      dismissClearAcquireUndo();
      dismissAcquiredItem();
      dismissImportUndo();
      const qty = clampQty(defaultQty);
      const curQty = stateRef.current.acquire[id] ?? 0;
      const action = curQty > 0 ? 'removed' : 'added';
      setState((prev) => {
        const nextAcquire = { ...prev.acquire };
        if ((nextAcquire[id] ?? 0) > 0) {
          delete nextAcquire[id];
        } else {
          nextAcquire[id] = qty;
        }
        return { ...prev, acquire: nextAcquire };
      });
      return { action, qty: action === 'added' ? qty : curQty };
    },
    [dismissClearAcquireUndo, dismissAcquiredItem, dismissImportUndo]
  );

  const addAcquireItem = useCallback(
    (id: string, qty = 1) => {
      dismissClearAcquireUndo();
      dismissAcquiredItem();
      dismissImportUndo();
      const clamped = clampQty(qty);
      setState((prev) => ({
        ...prev,
        acquire: {
          ...prev.acquire,
          [id]: Math.max(prev.acquire[id] ?? 0, clamped),
        },
      }));
    },
    [dismissClearAcquireUndo, dismissAcquiredItem, dismissImportUndo]
  );

  const addMissingToAcquire = useCallback(
    (items: { id: string; qty: number }[]) => {
      if (items.length === 0) return;
      dismissClearAcquireUndo();
      dismissAcquiredItem();
      dismissImportUndo();
      setState((prev) => {
        const nextAcquire = { ...prev.acquire };
        for (const entry of items) {
          if (!entry.id || FORBIDDEN_KEYS.has(entry.id)) continue;
          const clamped = clampQty(entry.qty);
          nextAcquire[entry.id] = Math.max(nextAcquire[entry.id] ?? 0, clamped);
        }
        return { ...prev, acquire: nextAcquire };
      });
    },
    [dismissClearAcquireUndo, dismissAcquiredItem, dismissImportUndo]
  );

  const setAcquireQuantity = useCallback(
    (id: string, qty: number) => {
      dismissClearAcquireUndo();
      dismissAcquiredItem();
      dismissImportUndo();
      setState((prev) => {
        const nextAcquire = { ...prev.acquire };
        if (!Number.isFinite(qty) || qty <= 0) {
          delete nextAcquire[id];
        } else {
          nextAcquire[id] = clampQty(qty);
        }
        return { ...prev, acquire: nextAcquire };
      });
    },
    [dismissClearAcquireUndo, dismissAcquiredItem, dismissImportUndo]
  );

  const incrementAcquireItem = useCallback(
    (id: string) => {
      dismissClearAcquireUndo();
      dismissAcquiredItem();
      dismissImportUndo();
      setState((prev) => ({
        ...prev,
        acquire: {
          ...prev.acquire,
          [id]: Math.min(999, (prev.acquire[id] ?? 0) + 1),
        },
      }));
    },
    [dismissClearAcquireUndo, dismissAcquiredItem, dismissImportUndo]
  );

  const decrementAcquireItem = useCallback(
    (id: string) => {
      dismissClearAcquireUndo();
      dismissAcquiredItem();
      dismissImportUndo();
      setState((prev) => {
        const cur = prev.acquire[id] ?? 0;
        const nextAcquire = { ...prev.acquire };
        if (cur <= 1) {
          delete nextAcquire[id];
        } else {
          nextAcquire[id] = cur - 1;
        }
        return { ...prev, acquire: nextAcquire };
      });
    },
    [dismissClearAcquireUndo, dismissAcquiredItem, dismissImportUndo]
  );

  const removeAcquireItem = useCallback(
    (id: string) => {
      dismissClearAcquireUndo();
      dismissAcquiredItem();
      dismissImportUndo();
      setState((prev) => {
        if (!(id in prev.acquire)) return prev;
        const nextAcquire = { ...prev.acquire };
        delete nextAcquire[id];
        return { ...prev, acquire: nextAcquire };
      });
    },
    [dismissClearAcquireUndo, dismissAcquiredItem, dismissImportUndo]
  );

  const addCustomAcquireItem = useCallback(
    (name: string, qty = 1): CustomAcquireItem | null => {
      const cleanName = name.trim().replace(/\s+/g, ' ').slice(0, 80);
      if (!cleanName) return null;
      const clamped = clampQty(qty);
      dismissClearAcquireUndo();
      dismissAcquiredItem();

      const curList = stateRef.current.customAcquire;
      const existing = curList.find(
        (it) => it.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (existing) {
        dismissImportUndo();
        const nextQty = Math.min(999, existing.qty + clamped);
        const updatedItem: CustomAcquireItem = { ...existing, qty: nextQty };
        setState((prev) => ({
          ...prev,
          customAcquire: prev.customAcquire.map((it) =>
            it.id === existing.id
              ? { ...it, qty: Math.min(999, it.qty + clamped) }
              : it
          ),
        }));
        return updatedItem;
      }

      if (curList.length >= 200) return null;
      dismissImportUndo();
      const newItem: CustomAcquireItem = {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: cleanName,
        qty: clamped,
      };
      setState((prev) => {
        if (prev.customAcquire.length >= 200) return prev;
        return {
          ...prev,
          customAcquire: [...prev.customAcquire, newItem],
        };
      });
      return newItem;
    },
    [dismissClearAcquireUndo, dismissAcquiredItem, dismissImportUndo]
  );

  const setCustomAcquireQuantity = useCallback(
    (id: string, qty: number) => {
      dismissClearAcquireUndo();
      dismissAcquiredItem();
      dismissImportUndo();
      setState((prev) => ({
        ...prev,
        customAcquire:
          !Number.isFinite(qty) || qty <= 0
            ? prev.customAcquire.filter((it) => it.id !== id)
            : prev.customAcquire.map((it) =>
                it.id === id ? { ...it, qty: clampQty(qty) } : it
              ),
      }));
    },
    [dismissClearAcquireUndo, dismissAcquiredItem, dismissImportUndo]
  );

  const incrementCustomAcquireItem = useCallback(
    (id: string) => {
      dismissClearAcquireUndo();
      dismissAcquiredItem();
      dismissImportUndo();
      setState((prev) => ({
        ...prev,
        customAcquire: prev.customAcquire.map((it) =>
          it.id === id ? { ...it, qty: Math.min(999, it.qty + 1) } : it
        ),
      }));
    },
    [dismissClearAcquireUndo, dismissAcquiredItem, dismissImportUndo]
  );

  const decrementCustomAcquireItem = useCallback(
    (id: string) => {
      dismissClearAcquireUndo();
      dismissAcquiredItem();
      dismissImportUndo();
      setState((prev) => ({
        ...prev,
        customAcquire: prev.customAcquire.flatMap((it) => {
          if (it.id !== id) return [it];
          if (it.qty <= 1) return [];
          return [{ ...it, qty: it.qty - 1 }];
        }),
      }));
    },
    [dismissClearAcquireUndo, dismissAcquiredItem, dismissImportUndo]
  );

  const removeCustomAcquireItem = useCallback(
    (id: string) => {
      dismissClearAcquireUndo();
      dismissAcquiredItem();
      dismissImportUndo();
      setState((prev) => ({
        ...prev,
        customAcquire: prev.customAcquire.filter((it) => it.id !== id),
      }));
    },
    [dismissClearAcquireUndo, dismissAcquiredItem, dismissImportUndo]
  );

  const markItemAcquired = useCallback(
    (id: string) => {
      const cur = stateRef.current;
      const acqQty = cur.acquire[id] ?? 0;
      if (acqQty <= 0) return;
      const prevPantryQty = cur.pantry[id] ?? 0;

      dismissClearAcquireUndo();
      clearAcquiredItemTimer();
      dismissUndo();
      dismissRemovedItem();
      dismissImportUndo();

      const snapshot: LastAcquiredItem = {
        isCustom: false,
        id,
        qty: acqQty,
        prevPantryQty,
      };
      lastAcquiredItemRef.current = snapshot;
      setLastAcquiredItem(snapshot);
      acquiredItemTimerRef.current = window.setTimeout(() => {
        lastAcquiredItemRef.current = null;
        setLastAcquiredItem(null);
        acquiredItemTimerRef.current = null;
      }, 10000);

      setState((prev) => {
        const curAcq = prev.acquire[id] ?? 0;
        if (curAcq <= 0) return prev;
        const nextAcquire = { ...prev.acquire };
        delete nextAcquire[id];
        return {
          ...prev,
          acquire: nextAcquire,
          pantry: {
            ...prev.pantry,
            [id]: Math.min(999, (prev.pantry[id] ?? 0) + curAcq),
          },
        };
      });
    },
    [
      dismissClearAcquireUndo,
      clearAcquiredItemTimer,
      dismissUndo,
      dismissRemovedItem,
      dismissImportUndo,
    ]
  );

  const markCustomItemAcquired = useCallback(
    (id: string) => {
      const item = stateRef.current.customAcquire.find((it) => it.id === id);
      if (!item) return;

      dismissClearAcquireUndo();
      clearAcquiredItemTimer();
      dismissImportUndo();

      const snapshot: LastAcquiredItem = {
        isCustom: true,
        item: { ...item },
      };
      lastAcquiredItemRef.current = snapshot;
      setLastAcquiredItem(snapshot);
      acquiredItemTimerRef.current = window.setTimeout(() => {
        lastAcquiredItemRef.current = null;
        setLastAcquiredItem(null);
        acquiredItemTimerRef.current = null;
      }, 10000);

      setState((prev) => ({
        ...prev,
        customAcquire: prev.customAcquire.filter((it) => it.id !== id),
      }));
    },
    [dismissClearAcquireUndo, clearAcquiredItemTimer, dismissImportUndo]
  );

  const undoAcquiredItem = useCallback(() => {
    const acquired = lastAcquiredItemRef.current;
    clearAcquiredItemTimer();
    lastAcquiredItemRef.current = null;
    setLastAcquiredItem(null);
    if (!acquired) return;

    if (!acquired.isCustom) {
      setState((prev) => {
        const nextPantry = { ...prev.pantry };
        if (acquired.prevPantryQty <= 0) {
          delete nextPantry[acquired.id];
        } else {
          nextPantry[acquired.id] = acquired.prevPantryQty;
        }
        return {
          ...prev,
          pantry: nextPantry,
          acquire: {
            ...prev.acquire,
            [acquired.id]: acquired.qty,
          },
        };
      });
      return;
    }

    setState((prev) => {
      if (prev.customAcquire.some((it) => it.id === acquired.item.id)) {
        return prev;
      }
      return {
        ...prev,
        customAcquire: [...prev.customAcquire, acquired.item],
      };
    });
  }, [clearAcquiredItemTimer]);

  const clearAcquireList = useCallback(() => {
    const cur = stateRef.current;
    const acqEntries = Object.entries(cur.acquire).filter(([, q]) => q > 0);
    if (acqEntries.length === 0 && cur.customAcquire.length === 0) return;

    dismissAcquiredItem();
    dismissImportUndo();
    const snapshot = {
      acquire: { ...cur.acquire },
      customAcquire: cur.customAcquire.map((it) => ({ ...it })),
    };
    clearAcquireUndoTimer();
    lastClearedAcquireRef.current = snapshot;
    setLastClearedAcquire(snapshot);
    acquireUndoTimerRef.current = window.setTimeout(() => {
      lastClearedAcquireRef.current = null;
      setLastClearedAcquire(null);
      acquireUndoTimerRef.current = null;
    }, 12000);

    setState((prev) => ({ ...prev, acquire: {}, customAcquire: [] }));
  }, [dismissAcquiredItem, dismissImportUndo, clearAcquireUndoTimer]);

  const undoClearAcquireList = useCallback(() => {
    const snapshot = lastClearedAcquireRef.current;
    clearAcquireUndoTimer();
    lastClearedAcquireRef.current = null;
    setLastClearedAcquire(null);
    if (!snapshot) return;

    setState((prev) => {
      const snapshotIds = new Set(snapshot.customAcquire.map((it) => it.id));
      return {
        ...prev,
        acquire: { ...snapshot.acquire, ...prev.acquire },
        customAcquire: [
          ...snapshot.customAcquire,
          ...prev.customAcquire.filter((it) => !snapshotIds.has(it.id)),
        ],
      };
    });
  }, [clearAcquireUndoTimer]);

  const selectedCount = Object.values(state.pantry).filter((q) => q > 0).length;
  const favoriteCount = state.favorites.length;
  const acquireCount =
    Object.values(state.acquire).filter((q) => q > 0).length +
    state.customAcquire.length;
  const lastClearedCount = lastClearedPantry
    ? Object.values(lastClearedPantry).filter((q) => q > 0).length
    : 0;
  const lastClearedAcquireCount = lastClearedAcquire
    ? Object.values(lastClearedAcquire.acquire).filter((q) => q > 0).length +
      lastClearedAcquire.customAcquire.length
    : 0;

  return {
    pantry: state.pantry,
    favorites: state.favorites,
    acquire: state.acquire,
    customAcquire: state.customAcquire,
    quantityMode: state.quantityMode,
    includeDistillationChain: state.includeDistillationChain,
    hideUnsafeSoups: state.hideUnsafeSoups,
    tipDismissed: state.tipDismissed,
    theme: state.theme,
    selectedCount,
    favoriteCount,
    acquireCount,
    lastClearedCount,
    lastRemovedItem,
    lastClearedAcquireCount,
    lastAcquiredItem,
    lastImportSummary,
    toggleItem,
    fulfillOrToggleItem,
    addItem,
    setItemQuantity,
    incrementItem,
    decrementItem,
    adjustItemQuantity,
    clearPantry,
    clearPantrySubset,
    undoClearPantry,
    dismissUndo,
    undoRemovedItem,
    dismissRemovedItem,
    toggleFavorite,
    importPortableData,
    undoImport,
    dismissImportUndo,
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
  };
}
