# Abiotic Factor — Recipe & Chemistry Compendium

A fast, offline-friendly web application cataloging all **Soups**, **Food (Frying Pan, Chef's Counter, Baking/Oven)**, and **Chemistry (Distillation Bench + Chemistry Bench: Tinctures, Flasks, Coatings)** recipes for *Abiotic Factor*, synced from [abioticfactor.wiki.gg](https://abioticfactor.wiki.gg).

## Features
- **Interactive Pantry ("What Can I Craft?"):** Select items you have in **Checklist Mode** or **Quantity Mode** to immediately see **Craftable Now** and **Almost Craftable (missing 1–2 items)** recipes, persisted in `localStorage`.
- **Two-Stage Chemistry Matching:** Automatically maps raw organic/food/anomaly items in your Pantry through the **Distillation Bench** into 3-slot **Chemistry Bench** recipes (without double-counting raw items in Quantity Mode).
- **Full Recipe Compendium & Distillation Guide:** Browse all recipes with locally cached official icons, Hunger/Thirst/Radiation/Portion stats, Buff & Debuff effects, Card & sortable Table views, and a dedicated **Distillation Guide**.
- **Second-Monitor Dark Mode + Light Mode:** Low-glare Cascade dark palette by default, with a one-click Light theme switch.

## Commands

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev

# Refresh recipe data and item icons from abioticfactor.wiki.gg
npm run sync-data

# Type-check, run tests, and build production static bundle
npm run typecheck
npm test
npm run build
```
