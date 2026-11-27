import { beforeEach, describe, expect, it } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import App from './App';
import { PANTRY_STORAGE_KEY } from './hooks/usePantry';
import {
  buildExportJson,
  encodeShareCode,
  MAX_IMPORT_BYTES,
  SHARE_CODE_PREFIX,
} from './lib/portability';

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

describe('Pantry workspace, Favourites, and Export/Import workflows', () => {
  beforeEach(() => {
    installMockStorage();
  });

  it('toggles favourites from card without opening drawer, table, and detail drawer, and filters via Favourites tab & chip', async () => {
    const store = installMockStorage();
    render(<App />);

    // Card star toggle must not open RecipeDetailDrawer
    const favBtn = screen.getByRole('button', {
      name: 'Add Bland Pea Soup to favourites',
    });
    fireEvent.click(favBtn);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen
        .getByRole('button', { name: 'Remove Bland Pea Soup from favourites' })
        .getAttribute('aria-pressed')
    ).toBe('true');

    // Persisted in localStorage
    const saved = JSON.parse(store[PANTRY_STORAGE_KEY] || '{}') as {
      favorites?: string[];
    };
    expect(saved.favorites).toContain('soup-bland-pea-soup');

    // FilterBar Favourites chip filters main catalog and resets via Reset
    const filterFavBtn = screen.getByRole('button', {
      name: /Favourites\s*1/i,
    });
    fireEvent.click(filterFavBtn);
    expect(screen.getByText('Bland Pea Soup')).toBeTruthy();
    expect(screen.queryByText('Baked Apple Pie')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByText('Baked Apple Pie')).toBeTruthy();

    // Open RecipeDetailDrawer and toggle another recipe as favourite
    fireEvent.click(screen.getByRole('button', { name: 'Baked Apple Pie' }));
    const dialog = await screen.findByRole('dialog', {}, { timeout: 5000 });
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Add Baked Apple Pie to favourites',
      })
    );
    expect(
      within(dialog)
        .getByRole('button', {
          name: 'Remove Baked Apple Pie from favourites',
        })
        .getAttribute('aria-pressed')
    ).toBe('true');
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    // Switch to Table view (filtered for fast jsdom query) and verify star toggle works without opening drawer
    const globalSearch = screen.getByLabelText(
      'Search recipes, ingredients, or buffs'
    );
    fireEvent.change(globalSearch, { target: { value: 'Baked Apple Pie' } });
    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    const tableUnfavBtn = await screen.findByRole(
      'button',
      { name: 'Remove Baked Apple Pie from favourites' },
      { timeout: 5000 }
    );
    fireEvent.click(tableUnfavBtn);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.change(globalSearch, { target: { value: '' } });

    // Switch to Favourites tab
    const favTab = screen.getByRole('tab', { name: /Favourites/i });
    fireEvent.click(favTab);
    expect(favTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Bland Pea Soup')).toBeTruthy();

    // Unstar last favourite to verify empty state
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Remove Bland Pea Soup from favourites',
      })
    );
    expect(screen.getByText('No favourite recipes yet')).toBeTruthy();
  }, 30000);

  it('manages inventory in the dedicated full-width Pantry tab, syncs with sidebar, and supports category clear + Undo', async () => {
    render(<App />);

    const pantryTab = screen.getByRole('tab', { name: /^Pantry/i });
    fireEvent.click(pantryTab);

    expect(
      await screen.findByText('Pantry Inventory Manager', {}, { timeout: 5000 })
    ).toBeTruthy();

    // Desktop sidebar and top-bar recipe search hide while Pantry tab is active
    const aside = document.querySelector('aside[aria-label="My Inventory and Pantry"]');
    expect(aside?.className).toContain('hidden');
    expect(
      screen.queryByLabelText('Search recipes, ingredients, or buffs')
    ).toBeNull();

    const main = screen.getByRole('main');
    // Enable Quantities mode in workspace
    fireEvent.click(within(main).getByRole('button', { name: 'Quantities' }));

    // Search for Canned Peas and add + adjust +5
    const pantrySearch = within(main).getByLabelText('Search pantry inventory');
    fireEvent.change(pantrySearch, { target: { value: 'Canned Peas' } });
    fireEvent.click(
      within(main).getByRole('button', { name: 'Add Canned Peas to pantry' })
    );
    fireEvent.click(
      within(main).getByRole('button', { name: 'Add 5 Canned Peas' })
    );

    const qtyInput = within(main).getByLabelText(
      'Quantity of Canned Peas'
    ) as HTMLInputElement;
    expect(qtyInput.value).toBe('6');

    // Add Salt (Packaged) so we can verify Clear Produce only clears Produce
    fireEvent.change(pantrySearch, { target: { value: 'Salt' } });
    fireEvent.click(
      within(main).getByRole('button', { name: 'Add Salt to pantry' })
    );

    // Clear search and test Owned Only + category clear + Undo
    fireEvent.change(pantrySearch, { target: { value: '' } });
    fireEvent.click(within(main).getByRole('button', { name: /Owned Only/i }));
    expect(await within(main).findByText('Canned Peas')).toBeTruthy();
    expect(within(main).getByText('Salt')).toBeTruthy();

    fireEvent.click(
      await within(main).findByRole('button', { name: 'Clear Produce' })
    );
    expect(within(main).getByText(/Cleared 1 item from Pantry\./i)).toBeTruthy();
    expect(within(main).queryByText('Canned Peas')).toBeNull();
    expect(within(main).getByText('Salt')).toBeTruthy();
    fireEvent.click(within(main).getByRole('button', { name: 'Undo' }));
    expect(within(main).getByText('Canned Peas')).toBeTruthy();
    expect(within(main).getByText('Salt')).toBeTruthy();

    // Switching back to All Recipes restores desktop sidebar and preserves both items in Pantry
    fireEvent.click(screen.getByRole('tab', { name: /All Recipes/i }));
    expect(aside?.className).not.toBe('hidden');
    const sidebar = screen.getByRole('complementary', {
      name: 'My Inventory and Pantry',
    });
    expect(within(sidebar).getByText('In Pantry (2)')).toBeTruthy();
  }, 30000);

  it('exports share code / JSON and imports with Merge, Replace, error handling, and Undo', async () => {
    installMockStorage({
      [PANTRY_STORAGE_KEY]: JSON.stringify({
        pantry: { salt: 2 },
        favorites: ['soup-bland-pea-soup'],
      }),
    });
    render(<App />);

    // Open Export / Import modal from TopBar
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Export or import pantry and favourites',
      })
    );

    const dialog = await screen.findByRole('dialog', {}, { timeout: 5000 });
    expect(
      within(dialog).getByText('Export & Import Data')
    ).toBeTruthy();

    // Share code starts with ABF1:
    const shareCodeBox = within(dialog).getByLabelText(
      'Portable share code'
    ) as HTMLTextAreaElement;
    expect(shareCodeBox.value.startsWith(SHARE_CODE_PREFIX)).toBe(true);

    // Switch to Import tab
    fireEvent.click(within(dialog).getByRole('button', { name: 'Import' }));
    const importTextarea = within(dialog).getByLabelText(
      'Paste ABF1 share code or JSON backup'
    );

    // Invalid input shows alert
    fireEvent.change(importTextarea, { target: { value: 'ABF1:bad-data' } });
    expect(within(dialog).getByRole('alert')).toBeTruthy();

    // Valid JSON backup in Merge mode
    const backupJson = buildExportJson({
      pantry: { salt: 5, 'canned-peas': 1 },
      favorites: ['chem-speedy-tincture'],
      acquire: { honey: 2 },
      customAcquire: [],
    });
    fireEvent.change(importTextarea, { target: { value: backupJson } });

    expect(
      within(dialog).getByText(/Backup validated — ready to import/i)
    ).toBeTruthy();
    expect(
      within(dialog).getByText(/2 pantry · 1 favourites · 1 acquire/i)
    ).toBeTruthy();

    fireEvent.click(
      within(dialog).getByRole('button', { name: /Apply Merge Import/i })
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    // Import banner appears and Bland Pea Soup + Canned Peas + Salt make Bland Pea Soup craftable
    expect(
      screen.getByText(/Imported \(merge\): 2 pantry, 1 favourites, 1 acquire\./i)
    ).toBeTruthy();
    expect(screen.getByText('Craftable Now')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Favourites/i }).textContent).toContain('2');

    // Undo restores previous state (1 pantry item, 1 favourite)
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(
      screen.getByRole('complementary', { name: 'My Inventory and Pantry' })
        .textContent
    ).toContain('In Pantry (1)');
    expect(screen.getByRole('tab', { name: /Favourites/i }).textContent).toContain('1');

    // Re-open and test .json file upload + Replace mode
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Export or import pantry and favourites',
      })
    );
    const dialog2 = await screen.findByRole('dialog', {}, { timeout: 5000 });
    fireEvent.click(within(dialog2).getByRole('button', { name: 'Import' }));

    const fileInput = within(dialog2).getByLabelText(
      'Upload JSON backup file'
    ) as HTMLInputElement;
    const replaceJson = buildExportJson({
      pantry: { tomato: 1 },
      favorites: ['chem-speedy-tincture'],
      acquire: {},
      customAcquire: [],
    });
    const file = new File([replaceJson], 'backup.json', {
      type: 'application/json',
    });
    Object.defineProperty(file, 'text', {
      configurable: true,
      value: async () => replaceJson,
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        within(dialog2).getByText(/1 pantry · 1 favourites · 0 acquire/i)
      ).toBeTruthy();
    });

    fireEvent.click(
      within(dialog2).getByRole('button', { name: 'Replace current' })
    );
    fireEvent.click(
      within(dialog2).getByRole('button', { name: /Apply Replace Import/i })
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(
      screen.getByText(/Imported \(replace\): 1 pantry, 1 favourites, 0 acquire\./i)
    ).toBeTruthy();
    expect(
      screen.getByRole('tab', { name: /Favourites/i }).textContent
    ).toContain('1');

    // Making an edit after import dismisses the stale import Undo banner
    fireEvent.click(
      screen.getByRole('button', { name: 'Add Salt to pantry' })
    );
    expect(screen.queryByText(/Imported \(replace\):/i)).toBeNull();

    // Re-open and verify ABF1 share code import + oversized file clears stale valid preview
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Export or import pantry and favourites',
      })
    );
    const dialog3 = await screen.findByRole('dialog', {}, { timeout: 5000 });
    fireEvent.click(within(dialog3).getByRole('button', { name: 'Import' }));
    const importTextarea3 = within(dialog3).getByLabelText(
      'Paste ABF1 share code or JSON backup'
    );
    const abfCode = encodeShareCode({
      pantry: { potato: 3 },
      favorites: ['soup-bland-pea-soup'],
      acquire: {},
      customAcquire: [],
    });
    fireEvent.change(importTextarea3, { target: { value: abfCode } });
    expect(
      within(dialog3).getByText(/Backup validated — ready to import/i)
    ).toBeTruthy();

    // Uploading an oversized file must show error and hide Apply Import
    const fileInput3 = within(dialog3).getByLabelText(
      'Upload JSON backup file'
    ) as HTMLInputElement;
    const oversizedFile = new File(['x'.repeat(MAX_IMPORT_BYTES + 100)], 'huge.json', {
      type: 'application/json',
    });
    fireEvent.change(fileInput3, { target: { files: [oversizedFile] } });
    expect(within(dialog3).getByRole('alert').textContent).toContain('250 KB');
    expect(
      within(dialog3).queryByRole('button', { name: /Apply .* Import/i })
    ).toBeNull();

    // Re-pasting the ABF1 share code allows applying import cleanly
    fireEvent.change(importTextarea3, { target: { value: abfCode } });
    fireEvent.click(
      within(dialog3).getByRole('button', { name: /Apply .* Import/i })
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByText(/Imported \(/i)).toBeTruthy();
  }, 30000);

  it('handles Favourites tab collapse toggle, Favourites chip unsafe count, and unsafe-soup favourite recovery', async () => {
    installMockStorage({
      [PANTRY_STORAGE_KEY]: JSON.stringify({
        pantry: { honey: 1 },
        favorites: ['soup-bland-pea-soup'],
      }),
    });
    const { unmount } = render(<App />);

    // Filtering All Recipes by Favourites chip must not report unfavourited unsafe soups as hidden
    fireEvent.click(screen.getByRole('button', { name: /Favourites\s*1/i }));
    expect(screen.queryByText(/unsafe hidden/i)).toBeNull();

    // On Favourites tab with no craftable/almost favourites, Other Matching Recipes starts expanded and can collapse
    fireEvent.click(screen.getByRole('tab', { name: /Favourites/i }));
    const otherToggle = screen.getByRole('button', {
      name: /Other Matching Recipes \(1\)/i,
    });
    expect(otherToggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Bland Pea Soup')).toBeTruthy();

    fireEvent.click(otherToggle);
    expect(otherToggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Bland Pea Soup')).toBeNull();

    unmount();

    // Starring only an unsafe soup while unsafe soups are hidden still offers Show unsafe soups recovery
    installMockStorage({
      [PANTRY_STORAGE_KEY]: JSON.stringify({
        pantry: {},
        favorites: ['soup-bad-soup'],
        hideUnsafeSoups: true,
      }),
    });
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Favourites/i }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Show unsafe soups' })
    );
    expect(await screen.findByText('Bad Soup')).toBeTruthy();
  }, 30000);
});
