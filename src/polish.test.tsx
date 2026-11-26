import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { RecipeCard } from './components/RecipeCard';
import { PANTRY_STORAGE_KEY } from './hooks/usePantry';
import rawDb from './data/recipes.json';
import type { CraftMatchResult } from './lib/matcher';
import type { RecipeDatabase } from './types/recipes';

const db = rawDb as unknown as RecipeDatabase;

function installMockStorage() {
  const store: Record<string, string> = {};
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
}

describe('polish accessibility and domain clarity tests', () => {
  beforeEach(() => {
    installMockStorage();
  });

  it('supports keyboard-accessible RecipeTable rows and interactive ingredient toggling', async () => {
    render(<App />);
    const globalSearch = screen.getByLabelText(
      'Search recipes, ingredients, or buffs'
    );
    fireEvent.change(globalSearch, { target: { value: 'Bland Pea Soup' } });
    fireEvent.click(screen.getByRole('button', { name: 'Table' }));

    const recipeBtn = await screen.findByRole(
      'button',
      { name: 'Bland Pea Soup' },
      { timeout: 5000 }
    );
    expect(recipeBtn).toBeTruthy();

    // Clicking an ingredient button inside the table toggles it in Pantry
    const peasBtns = screen.getAllByRole('button', { name: /Canned Peas/i });
    fireEvent.click(peasBtns[0]);
    expect(screen.getByText('In Pantry (1)')).toBeTruthy();

    // Clicking the recipe button (re-queried after table re-grouping) opens the detail drawer
    fireEvent.click(screen.getByRole('button', { name: 'Bland Pea Soup' }));
    expect(await screen.findByRole('dialog', {}, { timeout: 5000 })).toBeTruthy();
  }, 15000);

  it('restores focus to opener when RecipeDetailDrawer closes via Escape', async () => {
    render(<App />);
    const titleBtn = screen.getByRole('button', { name: 'Bland Pea Soup' });
    titleBtn.focus();
    fireEvent.click(titleBtn);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(document.activeElement).toBe(titleBtn);
  }, 15000);

  it('navigates TopBar tabs with ArrowRight and updates aria-pressed on mode toggles', () => {
    render(<App />);
    const allTab = screen.getByRole('tab', { name: /All Recipes/i });
    allTab.focus();
    fireEvent.keyDown(allTab, { key: 'ArrowRight' });

    const soupTab = screen.getByRole('tab', { name: /Soups/i });
    expect(soupTab.getAttribute('aria-selected')).toBe('true');

    const checklistBtn = screen.getByRole('button', { name: 'Checklist' });
    const quantitiesBtn = screen.getByRole('button', { name: 'Quantities' });
    expect(checklistBtn.getAttribute('aria-pressed')).toBe('true');
    expect(quantitiesBtn.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(quantitiesBtn);
    expect(quantitiesBtn.getAttribute('aria-pressed')).toBe('true');
    expect(checklistBtn.getAttribute('aria-pressed')).toBe('false');
  }, 15000);

  it('shows Used in Chemistry recipes on DistillationGuide and opens drawer on click', async () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole('tab', { name: /Distillation Guide/i })
    );

    const speedyLinks = await screen.findAllByRole(
      'button',
      { name: 'Speedy Tincture' },
      { timeout: 5000 }
    );
    expect(speedyLinks.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(speedyLinks[0]);

    const dialog = await screen.findByRole('dialog', {}, { timeout: 5000 });
    expect(dialog).toBeTruthy();
    expect(screen.getByText(/Chemistry Bench Flasks/i)).toBeTruthy();
  }, 15000);

  it('renders formatted survival stats in telemetry readout strip alongside accessible labels', () => {
    const sampleResult: CraftMatchResult = {
      recipe: {
        id: 'test-telemetry-soup',
        name: 'Test Telemetry Soup',
        category: 'soup',
        subcategory: 'beneficial-soup',
        workstation: 'Cooking Pot',
        image: 'images/items/bland-pea-soup.png',
        wikiUrl: 'https://example.com',
        ingredients: [{ itemId: 'canned-peas', quantity: 1 }],
        stats: {
          hunger: 15,
          thirst: 35,
          fatigue: -10,
          radiation: 5,
          servings: 4,
        },
      },
      status: 'unmatched',
      craftMethod: 'incomplete',
      missingDistinctCount: 1,
      ingredientStatuses: [
        {
          itemId: 'canned-peas',
          required: 1,
          haveDirect: 0,
          fulfilledViaDistillation: 0,
          missingQty: 1,
          status: 'missing',
          distillationSteps: [],
        },
      ],
      matchRatio: 0,
    };

    const { container } = render(
      <RecipeCard
        result={sampleResult}
        db={db}
        hasPantryItems={false}
        quantityMode={false}
        onSelectRecipe={vi.fn()}
        onTogglePantryItem={vi.fn()}
      />
    );

    const strip = container.querySelector('.telemetry-strip');
    expect(strip).toBeTruthy();
    expect(screen.getByText('+15')).toBeTruthy();
    expect(screen.getByText('Hunger')).toBeTruthy();
    expect(screen.getByText('+35')).toBeTruthy();
    expect(screen.getByText('Thirst')).toBeTruthy();
    expect(screen.getByText('-10')).toBeTruthy();
    expect(screen.getByText('Fatigue')).toBeTruthy();
    expect(screen.getByText('+5')).toBeTruthy();
    expect(screen.getByText('Radiation')).toBeTruthy();
    expect(screen.getByText('4×')).toBeTruthy();
    expect(screen.getByText('Portions')).toBeTruthy();
  });

  it('tops up partial ingredient pill to required quantity in Quantities mode instead of deleting the stack', async () => {
    window.localStorage.setItem(
      PANTRY_STORAGE_KEY,
      JSON.stringify({
        pantry: { honey: 1 },
        quantityMode: true,
      })
    );

    render(<App />);

    const globalSearch = screen.getByLabelText(
      'Search recipes, ingredients, or buffs'
    );
    fireEvent.change(globalSearch, { target: { value: 'Crunchy Crystal' } });

    const recipeBtn = await screen.findByRole(
      'button',
      { name: 'Crunchy Crystal' },
      { timeout: 5000 }
    );
    const card = recipeBtn.closest('article');
    expect(card).toBeTruthy();

    const honeyPill = within(card!).getByRole('button', { name: /Honey/i });
    expect(honeyPill.getAttribute('aria-pressed')).toBe('false');
    expect(within(honeyPill).getByText('1/3')).toBeTruthy();

    fireEvent.click(honeyPill);

    await waitFor(() => {
      const updatedCard = screen
        .getByRole('button', { name: 'Crunchy Crystal' })
        .closest('article')!;
      const updatedHoneyPill = within(updatedCard).getByRole('button', {
        name: /Honey/i,
      });
      expect(updatedHoneyPill.getAttribute('aria-pressed')).toBe('true');
      expect(within(updatedHoneyPill).getByText('x3')).toBeTruthy();
    });

    const persisted = JSON.parse(
      window.localStorage.getItem(PANTRY_STORAGE_KEY) || '{}'
    ) as { pantry?: Record<string, number> };
    expect(persisted.pantry?.honey).toBe(3);
  }, 15000);

  it('toggles Unsafe soups between Hidden and Shown and Reset restores Hidden', () => {
    render(<App />);

    const hiddenBtn = screen.getByRole('button', {
      name: /Unsafe soups: Hidden/i,
    });
    expect(hiddenBtn.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(hiddenBtn);

    const shownBtn = screen.getByRole('button', {
      name: /Unsafe soups: Shown/i,
    });
    expect(shownBtn.getAttribute('aria-pressed')).toBe('false');

    const resetBtn = screen.getByRole('button', { name: 'Reset' });
    fireEvent.click(resetBtn);

    const restoredBtn = screen.getByRole('button', {
      name: /Unsafe soups: Hidden/i,
    });
    expect(restoredBtn.getAttribute('aria-pressed')).toBe('true');
  }, 15000);

  it('collapses large raw source walls in DistillationGuide and expands all sources on click', async () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole('tab', { name: /Distillation Guide/i })
    );

    const alienHeading = await screen.findByRole(
      'heading',
      { name: 'Alien Distillation' },
      { timeout: 5000 }
    );
    const alienSection = alienHeading.closest('section');
    expect(alienSection).toBeTruthy();

    // 1 Add Reagent button + 6 collapsed raw source buttons = 7 unpressed toggle buttons
    expect(
      within(alienSection!).getAllByRole('button', { pressed: false }).length
    ).toBe(7);

    const showAllBtn = within(alienSection!).getByRole('button', {
      name: /Show all \d+ sources/i,
    });
    expect(showAllBtn.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(showAllBtn);

    const showFewerBtn = within(alienSection!).getByRole('button', {
      name: 'Show fewer',
    });
    expect(showFewerBtn.getAttribute('aria-expanded')).toBe('true');

    const expandedPressedButtons = within(alienSection!).getAllByRole('button', {
      pressed: false,
    });
    expect(expandedPressedButtons.length).toBeGreaterThan(7);
  }, 15000);
});
