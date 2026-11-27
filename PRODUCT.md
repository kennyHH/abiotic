# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

*Abiotic Factor* players (solo and co-op groups) looking up recipes and planning crafting mid-session on a second monitor or alt-tabbed beside the game.

## Product Purpose

Provide a fast, visual recipe compendium and interactive "What Can I Craft?" pantry matcher for *Abiotic Factor*'s Soups, Food/Cooking/Baking, and two-stage Chemistry systems so players can turn loose inventory items into meals and concoctions without tabbing through scattered wiki tables.

## Positioning

Combines locally cached official wiki icons and stats with two-stage Chemistry resolution (raw items → Distillation Bench → 3-slot Chemistry Bench recipes) and "Craftable Now" plus "Almost Craftable (missing 1–2 items)" matching in both Checklist and Exact Quantity modes.

## Operating Context

Used alongside a live survival game session (second monitor or rapid alt-tabbing); players scan stats (Hunger, Thirst, Radiation, Portions, Buffs), check off items in their base fridge/backpack, inspect 3-slot Chemistry ratios, and occasionally run `npm run sync-data` to refresh after game patches.

## Capabilities and Constraints

- Strictly focused on Soups, Food (Frying Pan, Chef's Counter, Baking/Oven), and Chemistry (Distillation Bench + Chemistry Bench).
- Static web app synced from `https://abioticfactor.wiki.gg/api.php` with locally bundled JSON (`src/data/recipes.json`) and cached icons (`public/images/items/`).
- Zero backend and zero user accounts or login; pantry selections and preferences persist locally via `localStorage`.

## Evidence on Hand

- Live-synced dataset at `src/data/recipes.json`: 172 recipes (49 soups, 91 food/baking/Chef's Counter, 32 chemistry concoctions), 16 distillations, and 525 items.
- 525 locally cached PNG icons under `public/images/items/` plus 5 category SVG fallbacks under `public/images/fallbacks/`.
- No user analytics, community accounts, or external API dependencies at runtime.

## Product Principles

1. **Fast mid-session lookup:** Finding what you can craft from current items takes seconds, not deep navigation.
2. **Complete culinary & chemistry truth:** Reflect real game mechanics including Cooking skill tiers, Unsafe Soup warnings, and two-stage Distillation → Chemistry Bench chains.
3. **Zero-friction offline reliability:** Local data and icons ensure instant loads with no broken wiki hotlinks or login gates.
4. **Scannable precision over ornament:** Numbers, ingredient availability, and 3-slot ratios must be readable at a glance between alt-tabs.
