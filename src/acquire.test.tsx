import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { PANTRY_STORAGE_KEY } from './hooks/usePantry';

function installMockStorage(initial?: Record<string, string>) {
  const store: Record<string, string> = { ...(initial || {}) };
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    },
  });
  return store;
}

function getSidebar() {
  return screen.getByRole('complementary', {
    name: 'My Inventory and Pantry',
  });
}

function getSidebarViewButton(label: RegExp) {
  const group = within(getSidebar()).getByRole('group', {
    name: 'Sidebar panel view',
  });
  return within(group).getByRole('button', { name: label });
}

describe('To Acquire list workflow', () => {
  beforeEach(() => {
    installMockStorage();
  });

  it('switches to To Acquire, adds catalog items, buffers quantity edits, and persists to localStorage', () => {
    const store = installMockStorage();
    render(<App />);

    const sidebar = getSidebar();
    const acquireSwitcher = getSidebarViewButton(/To Acquire/i);
    fireEvent.click(acquireSwitcher);
    expect(acquireSwitcher.getAttribute('aria-pressed')).toBe('true');
    expect(within(sidebar).getByText('To Acquire (0)')).toBeTruthy();

    const acquireInput = within(sidebar).getByLabelText(
      'Filter or add items to acquire'
    );
    fireEvent.change(acquireInput, { target: { value: 'Salt' } });
    fireEvent.click(
      within(sidebar).getByRole('button', { name: 'Add Salt to acquire list' })
    );

    expect(within(sidebar).getByText('To Acquire (1)')).toBeTruthy();

    fireEvent.click(
      within(sidebar).getAllByRole('button', {
        name: 'Increase Salt to acquire',
      })[0]
    );
    const qtyInput = within(sidebar).getByLabelText(
      'Quantity of Salt to acquire'
    ) as HTMLInputElement;
    expect(qtyInput.value).toBe('2');

    // Backspacing to empty does not delete the item; blur clamps back to 1
    fireEvent.focus(qtyInput);
    fireEvent.change(qtyInput, { target: { value: '' } });
    expect(within(sidebar).getByText('To Acquire (1)')).toBeTruthy();
    fireEvent.blur(qtyInput);
    expect(qtyInput.value).toBe('1');

    // Typing a new number commits on blur and persists
    fireEvent.focus(qtyInput);
    fireEvent.change(qtyInput, { target: { value: '5' } });
    fireEvent.blur(qtyInput);
    expect(qtyInput.value).toBe('5');

    const persisted = JSON.parse(store[PANTRY_STORAGE_KEY] || '{}') as {
      acquire?: Record<string, number>;
    };
    expect(persisted.acquire?.salt).toBe(5);
  }, 30000);

  it('adds custom non-catalog items, deduplicates case-insensitively on Enter, and supports Undo when marked acquired', () => {
    render(<App />);

    const sidebar = getSidebar();
    fireEvent.click(getSidebarViewButton(/To Acquire/i));
    const acquireInput = within(sidebar).getByLabelText(
      'Filter or add items to acquire'
    );

    fireEvent.change(acquireInput, { target: { value: 'Power Cell' } });
    fireEvent.click(
      within(sidebar).getByRole('button', {
        name: /Add .*Power Cell.* as custom item/i,
      })
    );

    expect(within(sidebar).getByText('To Acquire (1)')).toBeTruthy();
    expect(within(sidebar).getByText('Custom item')).toBeTruthy();
    const qtyInput = within(sidebar).getByLabelText(
      'Quantity of Power Cell to acquire'
    ) as HTMLInputElement;
    expect(qtyInput.value).toBe('1');

    // Entering same name with different casing increments quantity instead of duplicating
    fireEvent.change(acquireInput, { target: { value: '  power   cell ' } });
    fireEvent.keyDown(acquireInput, { key: 'Enter' });

    expect(within(sidebar).getByText('To Acquire (1)')).toBeTruthy();
    expect(
      (
        within(sidebar).getByLabelText(
          'Quantity of Power Cell to acquire'
        ) as HTMLInputElement
      ).value
    ).toBe('2');

    fireEvent.click(
      within(sidebar).getByRole('button', { name: 'Mark Power Cell acquired' })
    );
    expect(within(sidebar).getByText('To Acquire (0)')).toBeTruthy();
    expect(
      within(sidebar).getByText(/Marked Power Cell \(×2\) acquired\./i)
    ).toBeTruthy();

    fireEvent.click(within(sidebar).getByRole('button', { name: 'Undo' }));
    expect(within(sidebar).getByText('To Acquire (1)')).toBeTruthy();
    expect(
      (
        within(sidebar).getByLabelText(
          'Quantity of Power Cell to acquire'
        ) as HTMLInputElement
      ).value
    ).toBe('2');
  }, 30000);

  it('moves acquired catalog items with their quantity into Pantry, updates Craftable Now, and supports Undo', () => {
    render(<App />);
    const sidebar = getSidebar();
    fireEvent.click(getSidebarViewButton(/To Acquire/i));

    const acquireInput = within(sidebar).getByLabelText(
      'Filter or add items to acquire'
    );
    fireEvent.change(acquireInput, { target: { value: 'Canned Peas' } });
    fireEvent.click(
      within(sidebar).getByRole('button', {
        name: 'Add Canned Peas to acquire list',
      })
    );
    fireEvent.click(
      within(sidebar).getAllByRole('button', {
        name: 'Increase Canned Peas to acquire',
      })[0]
    );

    fireEvent.change(acquireInput, { target: { value: 'Salt' } });
    fireEvent.click(
      within(sidebar).getByRole('button', { name: 'Add Salt to acquire list' })
    );

    fireEvent.click(
      within(sidebar).getByRole('button', {
        name: 'Mark Canned Peas acquired and move to pantry',
      })
    );
    fireEvent.click(
      within(sidebar).getByRole('button', {
        name: 'Mark Salt acquired and move to pantry',
      })
    );

    expect(within(sidebar).getByText('To Acquire (0)')).toBeTruthy();
    expect(screen.getByText('Craftable Now')).toBeTruthy();
    expect(screen.getByText('Bland Pea Soup')).toBeTruthy();
    expect(
      within(sidebar).getByText(/Moved Salt \(×1\) to Pantry\./i)
    ).toBeTruthy();

    // Undoing Salt moves it back to To Acquire and removes it from Pantry
    fireEvent.click(within(sidebar).getByRole('button', { name: 'Undo' }));
    expect(within(sidebar).getByText('To Acquire (1)')).toBeTruthy();

    // Switch to Pantry to confirm Canned Peas preserved ×2
    fireEvent.click(getSidebarViewButton(/Pantry/i));
    expect(within(sidebar).getByText('In Pantry (1)')).toBeTruthy();
    fireEvent.click(
      within(sidebar).getByRole('button', { name: 'Quantities' })
    );
    expect(
      (
        within(sidebar).getByLabelText(
          'Quantity of Canned Peas'
        ) as HTMLInputElement
      ).value
    ).toBe('2');
  }, 30000);

  it('requires confirmation before Clear list when 5 or more items are queued and supports Undo', () => {
    installMockStorage({
      [PANTRY_STORAGE_KEY]: JSON.stringify({
        acquire: {
          salt: 1,
          potato: 2,
          honey: 3,
          tomato: 1,
        },
        customAcquire: [{ id: 'custom-1', name: 'Reinforced Hose', qty: 2 }],
      }),
    });
    render(<App />);

    const sidebar = getSidebar();
    fireEvent.click(getSidebarViewButton(/To Acquire/i));
    expect(within(sidebar).getByText('To Acquire (5)')).toBeTruthy();

    fireEvent.click(
      within(sidebar).getByRole('button', { name: /Clear list/i })
    );
    expect(within(sidebar).getByText('To Acquire (5)')).toBeTruthy();

    fireEvent.click(
      within(sidebar).getByRole('button', { name: /Confirm clear/i })
    );
    expect(within(sidebar).getByText('To Acquire (0)')).toBeTruthy();
    expect(
      within(sidebar).getByText(/Cleared 5 items from To Acquire\./i)
    ).toBeTruthy();

    fireEvent.click(within(sidebar).getByRole('button', { name: 'Undo' }));
    expect(within(sidebar).getByText('To Acquire (5)')).toBeTruthy();
  }, 30000);

  it('sanitizes corrupted or out-of-range localStorage acquire and customAcquire state', () => {
    installMockStorage({
      [PANTRY_STORAGE_KEY]: JSON.stringify({
        acquire: {
          salt: 4500,
          tomato: -2,
          bad: 'NaN',
          __proto__: 7,
        },
        customAcquire: [
          { id: 'c1', name: '  Sensor   Module ', qty: 1200 },
          { id: 'c1', name: 'Duplicate ID Should Drop', qty: 2 },
          { id: 'c2', name: '   ', qty: 3 },
          { id: '__proto__', name: 'Forbidden ID', qty: 2 },
          { id: 'c3', name: 'Zero Qty', qty: 0 },
        ],
      }),
    });

    render(<App />);
    const sidebar = getSidebar();
    fireEvent.click(getSidebarViewButton(/To Acquire/i));

    expect(within(sidebar).getByText('To Acquire (2)')).toBeTruthy();
    expect(
      (
        within(sidebar).getByLabelText(
          'Quantity of Salt to acquire'
        ) as HTMLInputElement
      ).value
    ).toBe('999');
    expect(
      (
        within(sidebar).getByLabelText(
          'Quantity of Sensor Module to acquire'
        ) as HTMLInputElement
      ).value
    ).toBe('999');
    expect(within(sidebar).queryByText('Duplicate ID Should Drop')).toBeNull();
    expect(within(sidebar).queryByText('Forbidden ID')).toBeNull();
  }, 30000);

  it('adds missing ingredients from RecipeDetailDrawer in both Checklist and Quantities modes', async () => {
    installMockStorage({
      [PANTRY_STORAGE_KEY]: JSON.stringify({
        pantry: { honey: 1 },
        quantityMode: false,
      }),
    });

    const { unmount } = render(<App />);

    const recipeSearch = screen.getByLabelText(
      'Search recipes, ingredients, or buffs'
    );
    fireEvent.change(recipeSearch, { target: { value: 'Crunchy Crystal' } });

    const recipeBtn = await screen.findByRole(
      'button',
      { name: 'Crunchy Crystal' },
      { timeout: 5000 }
    );
    fireEvent.click(recipeBtn);

    const dialog = await screen.findByRole('dialog');
    // Checklist mode: Honey is satisfied, remaining missing uses full recipe count
    const addMissingBtn = within(dialog).getByRole('button', {
      name: /Add missing to Acquire/i,
    });
    fireEvent.click(addMissingBtn);
    expect(within(dialog).getByText('Missing on Acquire list')).toBeTruthy();

    // Toggle Honey individually in Checklist mode -> uses full required quantity (×3)
    const addHoneyAcquireBtn = within(dialog).getByRole('button', {
      name: 'Add Honey to acquire list',
    });
    fireEvent.click(addHoneyAcquireBtn);
    expect(within(dialog).getByText('Acquire (×3)')).toBeTruthy();

    unmount();

    // Quantities mode: Honey 1/3 in Pantry -> Add missing queues only the remaining deficit (2)
    installMockStorage({
      [PANTRY_STORAGE_KEY]: JSON.stringify({
        pantry: { honey: 1 },
        quantityMode: true,
      }),
    });
    render(<App />);

    fireEvent.change(
      screen.getByLabelText('Search recipes, ingredients, or buffs'),
      { target: { value: 'Crunchy Crystal' } }
    );
    fireEvent.click(
      await screen.findByRole(
        'button',
        { name: 'Crunchy Crystal' },
        { timeout: 5000 }
      )
    );

    const qtyDialog = await screen.findByRole('dialog');
    fireEvent.click(
      within(qtyDialog).getByRole('button', {
        name: /Add missing to Acquire/i,
      })
    );

    expect(within(qtyDialog).getByText('Missing on Acquire list')).toBeTruthy();
    const removeHoneyAcquireBtn = within(qtyDialog).getByRole('button', {
      name: 'Remove Honey from acquire list',
    });
    expect(removeHoneyAcquireBtn.getAttribute('aria-pressed')).toBe('true');
    expect(within(removeHoneyAcquireBtn).getByText('Acquire (×2)')).toBeTruthy();

    // Clicking again removes Honey from Acquire list
    fireEvent.click(removeHoneyAcquireBtn);
    expect(
      within(qtyDialog).getByRole('button', {
        name: 'Add Honey to acquire list',
      })
    ).toBeTruthy();
  }, 30000);

  it('expands collapsed desktop sidebar directly into To Acquire and switches back to Pantry on P key', async () => {
    render(<App />);

    const header = screen.getByRole('banner');
    fireEvent.click(
      within(getSidebar()).getByRole('button', {
        name: 'Collapse pantry sidebar',
      })
    );

    const expandAcquireBtn = within(header).getByRole('button', {
      name: /Open to acquire sidebar/i,
    });
    fireEvent.click(expandAcquireBtn);

    const sidebar = getSidebar();
    const acquireSwitcher = getSidebarViewButton(/To Acquire/i);
    expect(acquireSwitcher.getAttribute('aria-pressed')).toBe('true');

    const acquireInput = within(sidebar).getByLabelText(
      'Filter or add items to acquire'
    ) as HTMLInputElement;
    Object.defineProperty(acquireInput, 'offsetParent', {
      configurable: true,
      value: document.body,
    });

    fireEvent.keyDown(window, { key: 'p' });

    await waitFor(() => {
      const pantrySwitcher = getSidebarViewButton(/Pantry/i);
      expect(pantrySwitcher.getAttribute('aria-pressed')).toBe('true');
      const pantryInput = within(sidebar).getByLabelText(
        'Filter inventory items'
      ) as HTMLInputElement;
      expect(document.activeElement).toBe(pantryInput);
    });
  }, 30000);
});
