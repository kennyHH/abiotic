import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ItemImage } from './components/ItemImage';
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

describe('hardening regression tests', () => {
  beforeEach(() => {
    installMockStorage();
  });

  it('supports Clear all with Undo recovery in PantryPanel', () => {
    render(<App />);
    const searchInput = screen.getByLabelText('Filter inventory items');
    fireEvent.change(searchInput, { target: { value: 'Salt' } });
    fireEvent.click(screen.getByLabelText('Add Salt to pantry'));

    expect(screen.getByText('In Pantry (1)')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Clear all/i }));
    expect(screen.queryByText('In Pantry (1)')).toBeNull();
    expect(screen.getByText(/Cleared 1 item from Pantry/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('In Pantry (1)')).toBeTruthy();
  }, 15000);

  it('buffers quantity input edits so backspacing never deletes the item', () => {
    render(<App />);
    const searchInput = screen.getByLabelText('Filter inventory items');
    fireEvent.change(searchInput, { target: { value: 'Salt' } });
    fireEvent.click(screen.getByLabelText('Add Salt to pantry'));

    fireEvent.click(screen.getByRole('button', { name: 'Quantities' }));
    const qtyInput = screen.getByLabelText(
      'Quantity of Salt'
    ) as HTMLInputElement;

    fireEvent.focus(qtyInput);
    fireEvent.change(qtyInput, { target: { value: '' } });
    // Item must still be present in Pantry while editing empty draft
    expect(screen.getByText('In Pantry (1)')).toBeTruthy();

    // Typing 12 and blurring commits 12
    fireEvent.change(qtyInput, { target: { value: '12' } });
    fireEvent.blur(qtyInput);
    expect(qtyInput.value).toBe('12');

    // Blurring when empty clamps back to 1 instead of deleting
    fireEvent.focus(qtyInput);
    fireEvent.change(qtyInput, { target: { value: '' } });
    fireEvent.blur(qtyInput);
    expect(qtyInput.value).toBe('1');
    expect(screen.getByText('In Pantry (1)')).toBeTruthy();
  }, 15000);

  it('recovers from empty search results via Reset search & filters button', () => {
    render(<App />);
    const globalSearch = screen.getByLabelText(
      'Search recipes, ingredients, or buffs'
    );
    fireEvent.change(globalSearch, {
      target: { value: 'zzzz-nonexistent-recipe-999' },
    });

    expect(
      screen.getByText(/No recipes match your current search and filter settings/i)
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: /Reset search & filters/i })
    );
    expect(screen.getByText('Bland Pea Soup')).toBeTruthy();
  }, 15000);

  it('sanitizes corrupted or out-of-range localStorage pantry state', () => {
    installMockStorage({
      [PANTRY_STORAGE_KEY]: JSON.stringify({
        pantry: {
          salt: 5000,
          'super-tomato': -3,
          bad: 'NaN',
          __proto__: 99,
        },
        quantityMode: true,
        theme: 'invalid-theme',
      }),
    });

    render(<App />);
    expect(screen.getByText('In Pantry (1)')).toBeTruthy();
    const qtyInput = screen.getByLabelText(
      'Quantity of Salt'
    ) as HTMLInputElement;
    expect(qtyInput.value).toBe('999');
  }, 15000);

  it('swaps ItemImage to its fallback SVG on error without looping', () => {
    render(
      <ItemImage
        src="images/items/missing-test.png"
        alt="Missing Test"
        fallbackKind="soup"
      />
    );
    const img = screen.getByAltText('Missing Test') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('images/items/missing-test.png');

    fireEvent.error(img);
    expect(img.getAttribute('src')).toBe('images/fallbacks/soup.svg');

    // A second error on the fallback itself stays on the fallback safely
    fireEvent.error(img);
    expect(img.getAttribute('src')).toBe('images/fallbacks/soup.svg');
  });

  it('displays visible buff mechanical effects on cards, table, and drawer, and supports buff effect search', async () => {
    render(<App />);

    // Card shows Slice of Home and its mechanical effect directly
    expect(screen.getByText('Slice of Home')).toBeTruthy();
    expect(screen.getByText(/— \+1 health per second/i)).toBeTruthy();

    // Open Baked Apple Pie drawer and verify both effect and flavor description render
    fireEvent.click(screen.getByRole('button', { name: 'Baked Apple Pie' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(screen.getAllByText(/\+1 health per second/i).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/A familiar flavor reminds you of home/i)
    ).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    // Search by mechanical buff effect finds Balanced Stew
    const globalSearch = screen.getByLabelText(
      'Search recipes, ingredients, or buffs'
    );
    fireEvent.change(globalSearch, {
      target: { value: 'Crafting and Construction XP' },
    });
    expect(screen.getByText('Balanced Stew')).toBeTruthy();

    // Table view also displays buff names and mechanical effects
    fireEvent.change(globalSearch, { target: { value: 'Baked Apple Pie' } });
    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    expect(await screen.findByText('Slice of Home')).toBeTruthy();
    expect(screen.getByText(/— \+1 health per second/i)).toBeTruthy();
  }, 15000);

  it('renders friendly recovery UI in ErrorBoundary without exposing raw error as primary text', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Bomb(): never {
      throw new Error('Internal stack token XYZ');
    }

    try {
      render(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>
      );

      expect(
        screen.getByText(
          /hit an unexpected rendering error\. Reloading the page or resetting your saved Pantry/i
        )
      ).toBeTruthy();
      expect(screen.getByText('Technical details')).toBeTruthy();
      expect(screen.getByText('Internal stack token XYZ')).toBeTruthy();
      expect(
        screen.getByRole('button', { name: /Reload Page/i })
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: /Reset Saved Pantry & Reload/i })
      ).toBeTruthy();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('hides unsafe-soup-only ammo in Pantry, supports single-button aria-pressed toggle, Has Buff filter, Reset, and dismissible tip', () => {
    render(<App />);

    // .308 Ammo is hidden while Hide unsafe soups is active
    expect(screen.queryByText('.308 Ammo')).toBeNull();

    // Salt uses a single accessible toggle button with aria-pressed
    const saltBtn = screen.getByRole('button', { name: 'Add Salt to pantry' });
    expect(saltBtn.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(saltBtn);
    expect(
      screen
        .getByRole('button', { name: 'Remove Salt from pantry' })
        .getAttribute('aria-pressed')
    ).toBe('true');

    // Clear pantry so empty-pantry tip is visible again and dismiss it
    fireEvent.click(screen.getByRole('button', { name: /Clear all/i }));
    const dismissTipBtn = screen.getByRole('button', {
      name: 'Dismiss pantry tip',
    });
    fireEvent.click(dismissTipBtn);
    expect(
      screen.queryByRole('button', { name: 'Dismiss pantry tip' })
    ).toBeNull();

    // Has Buff toggle hides unbuffed Antecheese Toastie and keeps Baked Apple Pie; Reset restores it
    expect(screen.getByText('Antecheese Toastie')).toBeTruthy();
    const hasBuffBtn = screen.getByRole('button', { name: /Has Buff/i });
    fireEvent.click(hasBuffBtn);
    expect(hasBuffBtn.getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText('Antecheese Toastie')).toBeNull();
    expect(screen.getByText('Baked Apple Pie')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByText('Antecheese Toastie')).toBeTruthy();
  }, 15000);

  it('clarifies sort label when Pantry is empty vs populated, opens custom listbox, and removes product jargon', () => {
    render(<App />);

    expect(screen.queryByText(/products/i)).toBeNull();
    expect(screen.queryByPlaceholderText(/products/i)).toBeNull();

    const sortBtn = screen.getByRole('button', { name: 'Sort recipes' });
    expect(sortBtn.textContent).toContain('Sort: Featured');

    fireEvent.click(sortBtn);
    const hungerOption = screen.getByRole('option', {
      name: 'Sort: Hunger (High → Low)',
    });
    fireEvent.click(hungerOption);
    expect(sortBtn.textContent).toContain('Sort: Hunger (High → Low)');

    fireEvent.click(screen.getByRole('button', { name: 'Add Salt to pantry' }));
    const bestMatchOption = screen.getByRole('button', {
      name: 'Sort recipes',
    });
    fireEvent.click(bestMatchOption);
    fireEvent.click(screen.getByRole('option', { name: 'Sort: Best Match' }));
    expect(bestMatchOption.textContent).toContain('Sort: Best Match');
  }, 15000);

  it('uses custom switch & button controls, supports P pantry shortcut, and supports Undo when removing counted items', () => {
    render(<App />);

    // Auto-distill uses an accessible switch role and Hide unsafe soups uses a pressed button
    const autoDistillSwitch = screen.getByRole('switch', {
      name: 'Auto-distill raw items',
    });
    expect(autoDistillSwitch.getAttribute('aria-checked')).toBe('true');

    const unsafeBtn = screen.getByRole('button', {
      name: /Unsafe soups: Hidden/i,
    });
    expect(unsafeBtn.getAttribute('aria-pressed')).toBe('true');

    // Global P key focuses the Pantry inventory filter input when desktop visible
    const pantrySearch = screen.getByLabelText(
      'Filter inventory items'
    ) as HTMLInputElement;
    // Simulate offsetParent presence in jsdom
    Object.defineProperty(pantrySearch, 'offsetParent', {
      configurable: true,
      value: document.body,
    });
    fireEvent.keyDown(window, { key: 'p' });
    expect(document.activeElement).toBe(pantrySearch);

    // Removing a counted item in Quantities mode offers single-item Undo
    fireEvent.click(screen.getByRole('button', { name: 'Add Salt to pantry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quantities' }));
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Increase Salt' })[0]
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Salt from pantry' })
    );
    expect(screen.getByText(/Removed Salt \(×2\)/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('In Pantry (1)')).toBeTruthy();
  }, 15000);

  it('eager-loads above-the-fold recipe icons with explicit dimensions and lazy-loads below-the-fold icons', () => {
    render(<App />);

    const cardHeadings = screen.getAllByRole('heading', { level: 3 });
    const firstImg = screen.getByAltText(
      cardHeadings[0].textContent || ''
    ) as HTMLImageElement;
    expect(firstImg.getAttribute('loading')).toBe('eager');
    expect(firstImg.getAttribute('width')).toBe('48');
    expect(firstImg.getAttribute('height')).toBe('48');

    const lastImg = screen.getByAltText(
      cardHeadings[cardHeadings.length - 1].textContent || ''
    ) as HTMLImageElement;
    expect(lastImg.getAttribute('loading')).toBe('lazy');
  }, 15000);

  it('keeps 1-2 ingredient zero-overlap recipes out of Almost Craftable when adding 1 pantry item', () => {
    render(<App />);
    const searchInput = screen.getByLabelText('Filter inventory items');
    fireEvent.change(searchInput, { target: { value: 'Salt' } });
    fireEvent.click(screen.getByLabelText('Add Salt to pantry'));

    expect(screen.getByText('Simple Tomato Soup')).toBeTruthy();
    expect(screen.queryByText('Crunchy Crystal')).toBeNull();
  }, 15000);

  it('queues missing deficit to To Acquire when clicking a partial ingredient pill in Quantities mode', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Quantities' }));

    const pantrySearch = screen.getByLabelText('Filter inventory items');
    fireEvent.change(pantrySearch, { target: { value: 'Honey' } });
    fireEvent.click(screen.getByLabelText('Add Honey to pantry'));

    const qtyInput = screen.getByLabelText(
      'Quantity of Honey'
    ) as HTMLInputElement;
    expect(qtyInput.value).toBe('1');

    const recipeSearch = screen.getByLabelText(
      'Search recipes, ingredients, or buffs'
    );
    fireEvent.change(recipeSearch, { target: { value: 'Crunchy Crystal' } });

    const partialPill = screen.getByTitle(
      'Have 1/3 Honey — click to add 2 to To Acquire'
    );
    fireEvent.click(partialPill);

    expect(qtyInput.value).toBe('1');
    expect(screen.getByText('In Pantry (1)')).toBeTruthy();
    expect(
      screen.getByTitle('On To Acquire list (×2) — click to remove')
    ).toBeTruthy();
  }, 15000);

  it('requires confirmation before Clear all when 5 or more items are in Pantry and supports Undo', () => {
    installMockStorage({
      [PANTRY_STORAGE_KEY]: JSON.stringify({
        pantry: {
          salt: 1,
          potato: 1,
          honey: 1,
          tomato: 1,
          'super-tomato': 1,
        },
      }),
    });
    render(<App />);
    expect(screen.getByText('In Pantry (5)')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Clear all/i }));
    expect(screen.getByText('In Pantry (5)')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Confirm clear/i }));
    expect(screen.queryByText('In Pantry (5)')).toBeNull();
    expect(screen.getByText(/Cleared 5 items from Pantry/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('In Pantry (5)')).toBeTruthy();
  }, 15000);
});
