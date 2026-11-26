import { useCallback, useEffect, useRef, useState } from 'react';

export type ThemeMode = 'dark' | 'light';

export interface CustomAcquireItem {
  id: string;
  name: string;
  qty: number;
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
  acquire: Record<string, number>;
  customAcquire: CustomAcquireItem[];
  quantityMode: boolean;
  includeDistillationChain: boolean;
  hideUnsafeSoups: boolean;
  tipDismissed: boolean;
  theme: ThemeMode;
}

export const PANTRY_STORAGE_KEY = 'abiotic-compendium-state-v1';
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const DEFAULT_STATE: PersistedState = {
  pantry: {},
  acquire: {},
  customAcquire: [],
  quantityMode: false,
  includeDistillationChain: true,
  hideUnsafeSoups: true,
  tipDismissed: false,
  theme: 'dark',
};

function clampQty(qty: number): number {
  if (!Number.isFinite(qty)) return 1;
  return Math.min(999, Math.max(1, Math.floor(qty)));
}

function sanitizeItemMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const clean: Record<string, number> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!key || FORBIDDEN_KEYS.has(key)) continue;
    const num = typeof val === 'number' ? val : Number(val);
    if (!Number.isFinite(num) || num <= 0) continue;
    clean[key] = clampQty(num);
  }
  return clean;
}

function sanitizeCustomAcquire(raw: unknown): CustomAcquireItem[] {
  if (!Array.isArray(raw)) return [];
  const clean: CustomAcquireItem[] = [];
  const seenIds = new Set<string>();
  for (const entry of raw) {
    if (clean.length >= 200) break;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') {
      continue;
    }
    const id = candidate.id.trim();
    if (!id || id.length > 64 || FORBIDDEN_KEYS.has(id) || seenIds.has(id)) {
      continue;
    }
    const name = candidate.name.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!name) continue;
    const num =
      typeof candidate.qty === 'number' ? candidate.qty : Number(candidate.qty);
    if (!Number.isFinite(num) || num <= 0) continue;
    seenIds.add(id);
    clean.push({
      id,
      name,
      qty: clampQty(num),
    });
  }
  return clean;
}

function loadInitialState(): PersistedState {
  try {
    const raw = window.localStorage?.getItem?.(PANTRY_STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_STATE;
    return {
      pantry: sanitizeItemMap(parsed.pantry),
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

  const undoTimerRef = useRef<number | null>(null);
  const removedItemTimerRef = useRef<number | null>(null);
  const acquireUndoTimerRef = useRef<number | null>(null);
  const acquiredItemTimerRef = useRef<number | null>(null);
  const lastClearedAcquireRef = useRef(lastClearedAcquire);
  lastClearedAcquireRef.current = lastClearedAcquire;
  const lastAcquiredItemRef = useRef(lastAcquiredItem);
  lastAcquiredItemRef.current = lastAcquiredItem;
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

  useEffect(() => {
    return () => {
      clearUndoTimer();
      clearRemovedItemTimer();
      clearAcquireUndoTimer();
      clearAcquiredItemTimer();
    };
  }, [
    clearUndoTimer,
    clearRemovedItemTimer,
    clearAcquireUndoTimer,
    clearAcquiredItemTimer,
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

  const toggleItem = useCallback(
    (id: string) => {
      dismissUndo();
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
    [dismissUndo, clearRemovedItemTimer, dismissRemovedItem]
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
    [dismissUndo, clearRemovedItemTimer, dismissRemovedItem]
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
      const clamped = Math.min(999, Math.max(1, Math.floor(qty)));
      setState((prev) => {
        const nextPantry = { ...prev.pantry };
        nextPantry[id] = Math.max(nextPantry[id] ?? 0, clamped);
        return { ...prev, pantry: nextPantry };
      });
    },
    [dismissUndo, dismissRemovedItem]
  );

  const setItemQuantity = useCallback(
    (id: string, qty: number) => {
      dismissUndo();
      dismissRemovedItem();
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
    [dismissUndo, dismissRemovedItem]
  );

  const incrementItem = useCallback(
    (id: string) => {
      dismissUndo();
      dismissRemovedItem();
      setState((prev) => ({
        ...prev,
        pantry: {
          ...prev.pantry,
          [id]: Math.min(999, (prev.pantry[id] ?? 0) + 1),
        },
      }));
    },
    [dismissUndo, dismissRemovedItem]
  );

  const decrementItem = useCallback(
    (id: string) => {
      dismissUndo();
      dismissRemovedItem();
      setState((prev) => {
        const cur = prev.pantry[id] ?? 0;
        const nextPantry = { ...prev.pantry };
        if (cur <= 1) {
          delete nextPantry[id];
        } else {
          nextPantry[id] = cur - 1;
        }
        return { ...prev, pantry: nextPantry };
      });
    },
    [dismissUndo, dismissRemovedItem]
  );

  const clearPantry = useCallback(() => {
    dismissRemovedItem();
    setState((prev) => {
      const entries = Object.entries(prev.pantry).filter(([, q]) => q > 0);
      if (entries.length === 0) return prev;
      const snapshot = { ...prev.pantry };
      clearUndoTimer();
      setLastClearedPantry(snapshot);
      undoTimerRef.current = window.setTimeout(() => {
        setLastClearedPantry(null);
        undoTimerRef.current = null;
      }, 12000);
      return { ...prev, pantry: {} };
    });
  }, [clearUndoTimer, dismissRemovedItem]);

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
    (id: string, defaultQty = 1) => {
      dismissClearAcquireUndo();
      dismissAcquiredItem();
      const qty = clampQty(defaultQty);
      setState((prev) => {
        const nextAcquire = { ...prev.acquire };
        if ((nextAcquire[id] ?? 0) > 0) {
          delete nextAcquire[id];
        } else {
          nextAcquire[id] = qty;
        }
        return { ...prev, acquire: nextAcquire };
      });
    },
    [dismissClearAcquireUndo, dismissAcquiredItem]
  );

  const addAcquireItem = useCallback(
    (id: string, qty = 1) => {
      dismissClearAcquireUndo();
      dismissAcquiredItem();
      const clamped = clampQty(qty);
      setState((prev) => ({
        ...prev,
        acquire: {
          ...prev.acquire,
          [id]: Math.max(prev.acquire[id] ?? 0, clamped),
        },
      }));
    },
    [dismissClearAcquireUndo, dismissAcquiredItem]
  );

  const addMissingToAcquire = useCallback(
    (items: { id: string; qty: number }[]) => {
      if (items.length === 0) return;
      dismissClearAcquireUndo();
      dismissAcquiredItem();
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
    [dismissClearAcquireUndo, dismissAcquiredItem]
  );

  const setAcquireQuantity = useCallback(
    (id: string, qty: number) => {
      dismissClearAcquireUndo();
      dismissAcquiredItem();
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
    [dismissClearAcquireUndo, dismissAcquiredItem]
  );

  const incrementAcquireItem = useCallback(
    (id: string) => {
      dismissClearAcquireUndo();
      dismissAcquiredItem();
      setState((prev) => ({
        ...prev,
        acquire: {
          ...prev.acquire,
          [id]: Math.min(999, (prev.acquire[id] ?? 0) + 1),
        },
      }));
    },
    [dismissClearAcquireUndo, dismissAcquiredItem]
  );

  const decrementAcquireItem = useCallback(
    (id: string) => {
      dismissClearAcquireUndo();
      dismissAcquiredItem();
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
    [dismissClearAcquireUndo, dismissAcquiredItem]
  );

  const removeAcquireItem = useCallback(
    (id: string) => {
      dismissClearAcquireUndo();
      dismissAcquiredItem();
      setState((prev) => {
        if (!(id in prev.acquire)) return prev;
        const nextAcquire = { ...prev.acquire };
        delete nextAcquire[id];
        return { ...prev, acquire: nextAcquire };
      });
    },
    [dismissClearAcquireUndo, dismissAcquiredItem]
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
    [dismissClearAcquireUndo, dismissAcquiredItem]
  );

  const setCustomAcquireQuantity = useCallback(
    (id: string, qty: number) => {
      dismissClearAcquireUndo();
      dismissAcquiredItem();
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
    [dismissClearAcquireUndo, dismissAcquiredItem]
  );

  const incrementCustomAcquireItem = useCallback(
    (id: string) => {
      dismissClearAcquireUndo();
      dismissAcquiredItem();
      setState((prev) => ({
        ...prev,
        customAcquire: prev.customAcquire.map((it) =>
          it.id === id ? { ...it, qty: Math.min(999, it.qty + 1) } : it
        ),
      }));
    },
    [dismissClearAcquireUndo, dismissAcquiredItem]
  );

  const decrementCustomAcquireItem = useCallback(
    (id: string) => {
      dismissClearAcquireUndo();
      dismissAcquiredItem();
      setState((prev) => ({
        ...prev,
        customAcquire: prev.customAcquire.flatMap((it) => {
          if (it.id !== id) return [it];
          if (it.qty <= 1) return [];
          return [{ ...it, qty: it.qty - 1 }];
        }),
      }));
    },
    [dismissClearAcquireUndo, dismissAcquiredItem]
  );

  const removeCustomAcquireItem = useCallback(
    (id: string) => {
      dismissClearAcquireUndo();
      dismissAcquiredItem();
      setState((prev) => ({
        ...prev,
        customAcquire: prev.customAcquire.filter((it) => it.id !== id),
      }));
    },
    [dismissClearAcquireUndo, dismissAcquiredItem]
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
    ]
  );

  const markCustomItemAcquired = useCallback(
    (id: string) => {
      const item = stateRef.current.customAcquire.find((it) => it.id === id);
      if (!item) return;

      dismissClearAcquireUndo();
      clearAcquiredItemTimer();

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
    [dismissClearAcquireUndo, clearAcquiredItemTimer]
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
  }, [dismissAcquiredItem, clearAcquireUndoTimer]);

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
    acquire: state.acquire,
    customAcquire: state.customAcquire,
    quantityMode: state.quantityMode,
    includeDistillationChain: state.includeDistillationChain,
    hideUnsafeSoups: state.hideUnsafeSoups,
    tipDismissed: state.tipDismissed,
    theme: state.theme,
    selectedCount,
    acquireCount,
    lastClearedCount,
    lastRemovedItem,
    lastClearedAcquireCount,
    lastAcquiredItem,
    toggleItem,
    fulfillOrToggleItem,
    addItem,
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
  };
}
