import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

describe('Abiotic Factor Compendium UI', () => {
  beforeEach(() => {
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
  });

  it('renders category tabs and recipe catalog', () => {
    render(<App />);
    expect(screen.getByText('Abiotic Factor Recipe Compendium')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /All Recipes/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Soups/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Food & Baking/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Chemistry/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Distillation Guide/i })).toBeTruthy();
    expect(screen.getByText('Bland Pea Soup')).toBeTruthy();
  }, 15000);

  it('updates Craftable Now and Almost Craftable when adding items to Pantry', () => {
    render(<App />);
    const searchInput = screen.getByLabelText('Filter inventory items');
    fireEvent.change(searchInput, { target: { value: 'Canned Peas' } });
    fireEvent.click(screen.getByLabelText('Add Canned Peas to pantry'));

    fireEvent.change(searchInput, { target: { value: 'Salt' } });
    fireEvent.click(screen.getByLabelText('Add Salt to pantry'));

    expect(screen.getByText('Craftable Now')).toBeTruthy();
    expect(screen.getByText(/Almost Craftable/i)).toBeTruthy();
    expect(screen.getByText('Bland Pea Soup')).toBeTruthy();
  }, 15000);

  it('switches to Chemistry and Distillation Guide views', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Chemistry/i }));
    expect(screen.getByText('Speedy Tincture')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Distillation Guide/i }));
    expect(
      await screen.findByText(
        'Stage 1: Distillation Bench Conversion Reference',
        {},
        { timeout: 5000 }
      )
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Vigorous Distillation' })
    ).toBeTruthy();
  }, 15000);
});
