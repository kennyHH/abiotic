import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'src', 'data', 'recipes.json');
const ITEMS_IMG_DIR = path.join(ROOT, 'public', 'images', 'items');
const FALLBACK_IMG_DIR = path.join(ROOT, 'public', 'images', 'fallbacks');

const WIKI_BASE = 'https://abioticfactor.wiki.gg';
const API_URL = `${WIKI_BASE}/api.php`;
const USER_AGENT = 'AbioticFactorRecipeCompendium/1.0 (static data sync)';
const FORCE_IMAGES = process.argv.includes('--force');

const FALLBACK_SVGS = {
  soup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="12" fill="#1F2830"/><path d="M16 32h32v6a14 14 0 0 1-14 14h-4a14 14 0 0 1-14-14v-6Z" stroke="#E5A024" stroke-width="3"/><path d="M24 22c0-3 2-4 2-7M32 22c0-3 2-4 2-7M40 22c0-3 2-4 2-7" stroke="#E5A024" stroke-width="2.5" stroke-linecap="round"/><path d="M12 32h40" stroke="#ECEFE9" stroke-width="3" stroke-linecap="round"/></svg>`,
  food: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="12" fill="#1F2830"/><circle cx="32" cy="32" r="16" stroke="#E5A024" stroke-width="3"/><circle cx="32" cy="32" r="8" stroke="#9AA8B2" stroke-width="2"/></svg>`,
  chemistry: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="12" fill="#1F2830"/><path d="M26 14h12M28 14v11l-9 17a4 4 0 0 0 3.5 6h19a4 4 0 0 0 3.5-6l-9-17V14" stroke="#2BB8A8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 39h20" stroke="#2BB8A8" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  distillation: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="12" fill="#1F2830"/><path d="M27 14h10v10l8 12a12 12 0 1 1-26 0l8-12V14Z" stroke="#2BB8A8" stroke-width="3" stroke-linejoin="round"/><circle cx="32" cy="40" r="4" fill="#2BB8A8"/></svg>`,
  ingredient: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="12" fill="#1F2830"/><rect x="18" y="18" width="28" height="28" rx="6" stroke="#9AA8B2" stroke-width="3"/><path d="M26 32h12M32 26v12" stroke="#9AA8B2" stroke-width="2.5" stroke-linecap="round"/></svg>`,
};

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function wikiUrlFor(title) {
  return `${WIKI_BASE}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

function cleanText(str) {
  return (str || '').replace(/\s+/g, ' ').trim();
}

function normalizeBuffKey(name) {
  return cleanText(name)
    .replace(/\s*\((?:Buff|Debuff)\)\s*$/i, '')
    .toLowerCase();
}

function cleanBuffDisplayName(name) {
  return cleanText(name).replace(/\s*\((?:Buff|Debuff)\)\s*$/i, '').trim();
}

function extractMultilineText($, cell) {
  const clone = $(cell).clone();
  clone.find('br').replaceWith('\n');
  clone.find('p, li, div').each((_, el) => {
    $(el).append('\n');
  });
  return clone
    .text()
    .split(/\n+/)
    .map((line) => cleanText(line))
    .filter(Boolean)
    .join('; ');
}

function isNegativeBuff(rawName, heading, subtype, effect, forceNegative) {
  if (forceNegative) return true;
  if (/\(debuff\)/i.test(rawName)) return true;
  if (/^(disease|injuries)$/i.test(heading)) return true;
  if (/^(disease|injury|smell|debuff)$/i.test(subtype)) return true;
  if (
    /\b(death on expiration|damage vulnerability|vomiting|causes enemies to attack each other)\b/i.test(
      effect || ''
    )
  ) {
    return true;
  }
  return false;
}

function formatBuffSummary(buffs) {
  return (
    buffs
      .map((b) =>
        b.effect
          ? `${b.name}: ${b.effect}`
          : b.description
            ? `${b.name}: ${b.description}`
            : b.name
      )
      .join(' · ') || undefined
  );
}

function parseNumber(text) {
  const cleaned = cleanText(text).replace(/,/g, '');
  const m = cleaned.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : undefined;
}

function normalizeImageUrl(src, srcset) {
  let raw = '';
  if (srcset) {
    const parts = srcset.split(',').map((s) => s.trim().split(/\s+/)[0]).filter(Boolean);
    raw = parts[parts.length - 1] || src || '';
  } else {
    raw = src || '';
  }
  if (!raw) return null;
  if (raw.startsWith('data:')) return null;
  // Convert /images/thumb/a/ab/File.png/48px-File.png?xyz -> /images/thumb/a/ab/File.png/128px-File.png
  // Or original /images/a/ab/File.png
  const cleanUrl = raw.split('?')[0];
  const full = cleanUrl.startsWith('http') ? cleanUrl : `${WIKI_BASE}${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl}`;
  const thumbMatch = full.match(/^(https:\/\/abioticfactor\.wiki\.gg\/images\/thumb\/.+\/)\d+px-([^/]+)$/);
  if (thumbMatch) {
    return `${thumbMatch[1]}128px-${thumbMatch[2]}`;
  }
  return full;
}

async function fetchWithRetry(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (res.ok) return res;
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 600 * attempt));
      continue;
    }
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  throw new Error(`Failed after ${retries} retries: ${url}`);
}

async function apiQuery(params) {
  const qs = new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  const res = await fetchWithRetry(`${API_URL}?${qs.toString()}`);
  const data = await res.json();
  if (data.error) {
    throw new Error(`Wiki API error (${data.error.code}): ${data.error.info}`);
  }
  return data;
}

function guessCategoryTag(name, kind) {
  if (kind === 'distillation') return 'distillation';
  const n = name.toLowerCase();
  if (/(meat|chop|rump|drumstick|pest|peccary|carbuncle|exor|fish|filet|liver|larva|tentacle|sausage|steak|egg|skull|arm|brain|heart|crab|fat)/.test(n)) {
    return 'meat';
  }
  if (/(tomato|potato|wheat|corn|pumpkin|apple|carrot|lettuce|mushroom|tulip|greyeb|pea|honey|berries|shadowberry|garlic|rice|herb|kelp|seaweed|nori)/.test(n)) {
    return 'produce';
  }
  if (/(canned|m\.r\.e|mre|salt|milk|ice cream|doznuts|jowlers|skip|soda|pop|rootbear|fizz|slam|candy|coffee|pasta|dough|cheese|sugar|slushie|puffs|taco|bread)/.test(n)) {
    return 'packaged';
  }
  if (/(acid|glue|scrap|plastic|gel|sludge|feces|bio|anomaly|water|oil|crystal|bone)/.test(n)) {
    return 'lab';
  }
  return 'other';
}

function extractAnchorItems($, cell) {
  const found = [];
  const seen = new Set();
  $(cell)
    .find('a[href^="/wiki/"]')
    .each((_, a) => {
      const $a = $(a);
      const href = $a.attr('href') || '';
      if (href.includes('File:') || href.includes('action=edit') || href.includes('Special:')) return;
      const title = cleanText($a.attr('title') || $a.text());
      if (!title) return;
      const imgEl = $a.find('img').first().length ? $a.find('img').first() : $a.prev('a').find('img').first();
      const imgUrl = imgEl.length ? normalizeImageUrl(imgEl.attr('src'), imgEl.attr('srcset')) : null;
      const key = title.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        found.push({ title, href, imgUrl });
      } else if (imgUrl) {
        const existing = found.find((f) => f.title.toLowerCase() === key);
        if (existing && !existing.imgUrl) existing.imgUrl = imgUrl;
      }
    });
  return found;
}

function extractPrimaryItem($, cell) {
  const items = extractAnchorItems($, cell);
  if (items.length > 0) return items[0];
  const img = $(cell).find('img').first();
  const title = cleanText($(cell).text()) || cleanText(img.attr('alt'));
  if (!title) return null;
  return {
    title,
    href: `/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    imgUrl: img.length ? normalizeImageUrl(img.attr('src'), img.attr('srcset')) : null,
  };
}

function parseTemplateBlocks(wikitext, templateName) {
  const blocks = [];
  const lowerTarget = templateName.toLowerCase();
  let idx = 0;
  while (idx < wikitext.length) {
    const start = wikitext.indexOf('{{', idx);
    if (start === -1) break;
    let depth = 0;
    let end = -1;
    for (let i = start; i < wikitext.length - 1; i++) {
      if (wikitext[i] === '{' && wikitext[i + 1] === '{') {
        depth++;
        i++;
      } else if (wikitext[i] === '}' && wikitext[i + 1] === '}') {
        depth--;
        i++;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end === -1) break;
    const inner = wikitext.slice(start + 2, end - 2).trim();
    const pipeIdx = inner.indexOf('|');
    const name = (pipeIdx === -1 ? inner : inner.slice(0, pipeIdx)).trim().toLowerCase();
    if (name === lowerTarget) {
      const fields = {};
      if (pipeIdx !== -1) {
        const rest = inner.slice(pipeIdx + 1);
        // Split on top-level | (ignoring [[...|...]] and {{...|...}})
        const parts = [];
        let cur = '';
        let bDepth = 0;
        let tDepth = 0;
        for (let i = 0; i < rest.length; i++) {
          if (rest[i] === '[' && rest[i + 1] === '[') { bDepth++; cur += '[['; i++; continue; }
          if (rest[i] === ']' && rest[i + 1] === ']') { bDepth = Math.max(0, bDepth - 1); cur += ']]'; i++; continue; }
          if (rest[i] === '{' && rest[i + 1] === '{') { tDepth++; cur += '{{'; i++; continue; }
          if (rest[i] === '}' && rest[i + 1] === '}') { tDepth = Math.max(0, tDepth - 1); cur += '}}'; i++; continue; }
          if (rest[i] === '|' && bDepth === 0 && tDepth === 0) {
            parts.push(cur);
            cur = '';
          } else {
            cur += rest[i];
          }
        }
        if (cur) parts.push(cur);
        for (const p of parts) {
          const eq = p.indexOf('=');
          if (eq !== -1) {
            const k = p.slice(0, eq).trim();
            const v = p.slice(eq + 1).trim();
            fields[k] = v;
          }
        }
      }
      blocks.push(fields);
    }
    idx = start + 2;
  }
  return blocks;
}

function stripWikiMarkup(str) {
  return cleanText(
    (str || '')
      .replace(/\{\{PAGENAME\}\}/g, '')
      .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1')
      .replace(/''+/g, '')
      .replace(/<[^>]+>/g, ' ')
  );
}

async function fetchRevisionsMap(titles) {
  const unique = [...new Set(titles.filter(Boolean))];
  const result = new Map();
  for (let i = 0; i < unique.length; i += 45) {
    const batch = unique.slice(i, i + 45);
    const data = await apiQuery({
      action: 'query',
      titles: batch.join('|'),
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      redirects: '1',
    });
    const redirects = new Map();
    for (const r of data.query?.redirects || []) {
      redirects.set(r.from, r.to);
    }
    const normalized = new Map();
    for (const n of data.query?.normalized || []) {
      normalized.set(n.from, n.to);
    }
    const pageMap = new Map();
    for (const page of data.query?.pages || []) {
      const content = page.revisions?.[0]?.slots?.main?.content;
      if (content) pageMap.set(page.title, content);
    }
    for (const original of batch) {
      const norm = normalized.get(original) || original;
      const target = redirects.get(norm) || norm;
      if (pageMap.has(target)) {
        result.set(original, { title: target, wikitext: pageMap.get(target) });
      }
    }
  }
  return result;
}

async function resolveWikiImagesByPageTitles(titles) {
  const unique = [...new Set(titles.filter(Boolean))];
  const imgMap = new Map();
  for (let i = 0; i < unique.length; i += 45) {
    const batch = unique.slice(i, i + 45);
    const data = await apiQuery({
      action: 'query',
      titles: batch.join('|'),
      prop: 'pageimages',
      pithumbsize: '128',
      redirects: '1',
    });
    const redirects = new Map();
    for (const r of data.query?.redirects || []) redirects.set(r.from, r.to);
    const normalized = new Map();
    for (const n of data.query?.normalized || []) normalized.set(n.from, n.to);
    const byTitle = new Map();
    for (const page of data.query?.pages || []) {
      if (page.thumbnail?.source) {
        byTitle.set(page.title, page.thumbnail.source);
      }
    }
    for (const orig of batch) {
      const norm = normalized.get(orig) || orig;
      const target = redirects.get(norm) || norm;
      if (byTitle.has(target)) imgMap.set(orig, byTitle.get(target));
    }
  }
  return imgMap;
}

async function resolveWikiFileUrls(filenames) {
  const unique = [...new Set(filenames.filter(Boolean))];
  const urlMap = new Map();
  for (let i = 0; i < unique.length; i += 45) {
    const batch = unique.slice(i, i + 45).map((f) => (f.startsWith('File:') ? f : `File:${f}`));
    const data = await apiQuery({
      action: 'query',
      titles: batch.join('|'),
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: '128',
    });
    for (const page of data.query?.pages || []) {
      const info = page.imageinfo?.[0];
      if (info?.thumburl || info?.url) {
        const cleanTitle = page.title.replace(/^File:/i, '');
        urlMap.set(cleanTitle, info.thumburl || info.url);
      }
    }
  }
  return urlMap;
}

async function runPool(items, concurrency, fn) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item !== undefined) await fn(item);
    }
  });
  await Promise.all(workers);
}

async function main() {
  console.log('Syncing Abiotic Factor recipes from abioticfactor.wiki.gg...');
  await fs.mkdir(ITEMS_IMG_DIR, { recursive: true });
  await fs.mkdir(FALLBACK_IMG_DIR, { recursive: true });
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });

  for (const [name, svg] of Object.entries(FALLBACK_SVGS)) {
    await fs.writeFile(path.join(FALLBACK_IMG_DIR, `${name}.svg`), svg, 'utf8');
  }

  const [cookingRes, chemRes, foodRes, buffsRes] = await Promise.all([
    apiQuery({ action: 'parse', page: 'Cooking', prop: 'text' }),
    apiQuery({ action: 'parse', page: 'Chemistry', prop: 'text' }),
    apiQuery({ action: 'parse', page: 'Food_and_Cooking', prop: 'text' }),
    apiQuery({ action: 'parse', page: 'Buffs_and_Debuffs', prop: 'text' }).catch(() => null),
  ]);

  const itemRegistry = new Map(); // id -> Item + temporary _imgUrl & _wikiTitle
  const recipes = [];
  const distillationIds = [];

  function registerItem(name, opts = {}) {
    const cleanName = cleanText(name);
    const id = slugify(cleanName);
    if (!id) return null;
    const existing = itemRegistry.get(id);
    if (existing) {
      if (opts.imgUrl && !existing._imgUrl) existing._imgUrl = opts.imgUrl;
      if (opts.kind && existing.kind === 'raw' && opts.kind !== 'raw') {
        // Keep more specific kind if upgrading from placeholder
      }
      if (opts.kind === 'distillation') {
        existing.kind = 'distillation';
        existing.categoryTag = 'distillation';
      }
      return existing;
    }
    const kind = opts.kind || 'raw';
    const item = {
      id,
      name: cleanName,
      image: `images/fallbacks/${kind === 'distillation' ? 'distillation' : 'ingredient'}.svg`,
      wikiUrl: wikiUrlFor(cleanName),
      kind,
      categoryTag: opts.categoryTag || guessCategoryTag(cleanName, kind),
      _imgUrl: opts.imgUrl || null,
      _wikiTitle: cleanName,
    };
    itemRegistry.set(id, item);
    return item;
  }

  // 0. Harvest all thumbnails from Food_and_Cooking Cargo tables + Buffs descriptions
  const $food = cheerio.load(foodRes.parse.text);
  const foodStatsByName = new Map();
  $food('table.cargoTable tr').each((_, tr) => {
    const tds = $food(tr).find('td');
    if (tds.length < 2) return;
    const imgEl = tds.eq(0).find('img').first();
    const imgUrl = imgEl.length ? normalizeImageUrl(imgEl.attr('src'), imgEl.attr('srcset')) : null;
    const name = cleanText(tds.eq(1).text());
    if (!name) return;
    const hunger = parseNumber(tds.eq(2).text());
    const thirst = parseNumber(tds.eq(3).text());
    foodStatsByName.set(slugify(name), { name, hunger, thirst, imgUrl });
    registerItem(name, { imgUrl, kind: 'raw' });
  });

  const buffCatalog = new Map();
  if (buffsRes?.parse?.text) {
    const $buffs = cheerio.load(buffsRes.parse.text);
    $buffs('table.cargoTable').each((_, table) => {
      const heading = cleanText(
        $buffs(table)
          .prevAll('h2, h3, .mw-heading')
          .first()
          .text()
          .replace(/\[edit\]/g, '')
      );
      $buffs(table)
        .find('tr')
        .slice(1)
        .each((__, tr) => {
          const tds = $buffs(tr).find('td');
          if (tds.length < 5) return;
          const rawName = cleanText(tds.eq(1).text());
          if (!rawName) return;
          const description = cleanText(tds.eq(2).text()) || undefined;
          const subtype = cleanText(tds.eq(3).text());
          const rawEffect = extractMultilineText($buffs, tds.eq(4));
          const effect = rawEffect && !/^none$/i.test(rawEffect) ? rawEffect : undefined;
          const entry = {
            name: cleanBuffDisplayName(rawName),
            effect,
            description,
            isNegative: isNegativeBuff(rawName, heading, subtype, effect, false),
          };
          for (const key of [rawName.toLowerCase(), normalizeBuffKey(rawName)]) {
            if (!key) continue;
            const prev = buffCatalog.get(key);
            if (!prev || (!prev.effect && entry.effect)) {
              buffCatalog.set(key, entry);
            }
          }
        });
    });
    if (buffCatalog.size === 0) {
      throw new Error(
        'Buffs_and_Debuffs parsed 0 cargoTable rows — wiki table markup may have changed.'
      );
    }
  }

  // 1. Parse Cooking page tables
  const $cook = cheerio.load(cookingRes.parse.text);
  const cookTables = $cook('table.wikitable');
  const rawPrepTitlesToFetch = new Set();

  function buildBuffObject(rawName, forceNegative = false) {
    const cleanName = cleanText(rawName);
    const entry =
      buffCatalog.get(cleanName.toLowerCase()) ||
      buffCatalog.get(normalizeBuffKey(cleanName));
    return {
      name: entry?.name || cleanBuffDisplayName(cleanName),
      ...(entry?.effect ? { effect: entry.effect } : {}),
      ...(entry?.description ? { description: entry.description } : {}),
      isNegative: Boolean(
        forceNegative || entry?.isNegative || /\(debuff\)/i.test(cleanName)
      ),
    };
  }

  function parseBuffsFromCell($, cell, isNegative = false) {
    const rawNames = [];
    const items = extractAnchorItems($, cell);
    if (items.length > 0) {
      for (const b of items) rawNames.push(b.title);
    } else {
      const text = cleanText($(cell).text());
      if (text && text !== '-' && text.toLowerCase() !== 'none') {
        rawNames.push(text);
      }
    }
    const deduped = [];
    const seen = new Set();
    for (const rawName of rawNames) {
      const built = buildBuffObject(rawName, isNegative);
      const key = normalizeBuffKey(built.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      deduped.push(built);
    }
    return deduped;
  }

  cookTables.each((_, table) => {
    const headers = $cook(table)
      .find('tr')
      .first()
      .find('th, td')
      .map((__, c) => cleanText($cook(c).text()).toLowerCase())
      .get();
    const hJoined = headers.join('|');

    // Table 1: Frying (Raw, Cooked, Buffs, Hunger Fill, Thirst Fill, Radiation, Cook Time)
    if (hJoined.startsWith('raw|cooked|buffs|hunger')) {
      $cook(table)
        .find('tr')
        .slice(1)
        .each((__, tr) => {
          const tds = $cook(tr).find('td');
          if (tds.length < 7) return;
          const rawInfo = extractPrimaryItem($cook, tds.eq(0));
          const cookedInfo = extractPrimaryItem($cook, tds.eq(1));
          if (!rawInfo || !cookedInfo) return;

          const rawItem = registerItem(rawInfo.title, { imgUrl: rawInfo.imgUrl, kind: 'raw' });
          const cookedItem = registerItem(cookedInfo.title, { imgUrl: cookedInfo.imgUrl, kind: 'output' });
          const buffs = parseBuffsFromCell($cook, tds.eq(2));
          const hunger = parseNumber(tds.eq(3).text());
          const thirst = parseNumber(tds.eq(4).text());
          const radiation = parseNumber(tds.eq(5).text());
          const cookTime = cleanText(tds.eq(6).text());

          recipes.push({
            id: `food-${slugify(cookedInfo.title)}`,
            name: cookedInfo.title,
            category: 'food',
            subcategory: 'frying',
            workstation: 'Frying Pan',
            image: cookedItem?.image || 'images/fallbacks/food.svg',
            wikiUrl: wikiUrlFor(cookedInfo.title),
            ingredients: rawItem ? [{ itemId: rawItem.id, quantity: 1 }] : [],
            stats: {
              hunger,
              thirst,
              radiation,
              duration: cookTime ? `${cookTime} cook` : undefined,
              buffs: buffs.length ? buffs : undefined,
              effectSummary: formatBuffSummary(buffs),
            },
            _wikiTitle: cookedInfo.title,
          });
        });
    }

    // Table 2: Beneficial Soups (Name, Ingredients, Buffs, Hunger Fill, Thirst Fill, Portions, Cook Time)
    else if (hJoined.startsWith('name|ingredients|buffs|hunger fill|thirst fill|portions')) {
      $cook(table)
        .find('tr')
        .slice(1)
        .each((__, tr) => {
          const tds = $cook(tr).find('td');
          if (tds.length < 7) return;
          const soupInfo = extractPrimaryItem($cook, tds.eq(0));
          if (!soupInfo) return;
          const outItem = registerItem(soupInfo.title, { imgUrl: soupInfo.imgUrl, kind: 'output' });
          const ingInfos = extractAnchorItems($cook, tds.eq(1));
          const ingredients = ingInfos
            .map((ing) => registerItem(ing.title, { imgUrl: ing.imgUrl, kind: 'raw' }))
            .filter(Boolean)
            .map((item) => ({ itemId: item.id, quantity: 1 }));
          const buffs = parseBuffsFromCell($cook, tds.eq(2));
          const hunger = parseNumber(tds.eq(3).text());
          const thirst = parseNumber(tds.eq(4).text());
          const servings = parseNumber(tds.eq(5).text());
          const cookTime = cleanText(tds.eq(6).text());

          recipes.push({
            id: `soup-${slugify(soupInfo.title)}`,
            name: soupInfo.title,
            category: 'soup',
            subcategory: 'beneficial-soup',
            workstation: 'Cooking Pot',
            image: outItem?.image || 'images/fallbacks/soup.svg',
            wikiUrl: wikiUrlFor(soupInfo.title),
            ingredients,
            stats: {
              hunger,
              thirst,
              servings,
              cookingLevel: 3,
              duration: cookTime ? `${cookTime} boil` : undefined,
              buffs: buffs.length ? buffs : undefined,
              effectSummary: formatBuffSummary(buffs),
            },
            _wikiTitle: soupInfo.title,
          });
        });
    }

    // Table 3: Bowl / Pot Dishes (Name, Ingredients, Item Produced, Buff, Hunger Fill, Thirst Fill, Cook Time)
    else if (hJoined.startsWith('name|ingredients|item produced|buff')) {
      $cook(table)
        .find('tr')
        .slice(1)
        .each((__, tr) => {
          const tds = $cook(tr).find('td');
          if (tds.length < 7) return;
          const potInfo = extractPrimaryItem($cook, tds.eq(0));
          const prodInfo = extractPrimaryItem($cook, tds.eq(2));
          const display = prodInfo || potInfo;
          if (!display) return;
          const outItem = registerItem(display.title, {
            imgUrl: prodInfo?.imgUrl || potInfo?.imgUrl,
            kind: 'output',
          });
          const ingInfos = extractAnchorItems($cook, tds.eq(1));
          const ingredients = ingInfos
            .map((ing) => registerItem(ing.title, { imgUrl: ing.imgUrl, kind: 'raw' }))
            .filter(Boolean)
            .map((item) => ({ itemId: item.id, quantity: 1 }));
          const buffs = parseBuffsFromCell($cook, tds.eq(3));
          const hunger = parseNumber(tds.eq(4).text());
          const thirst = parseNumber(tds.eq(5).text());
          const cookTime = cleanText(tds.eq(6).text());

          recipes.push({
            id: `soup-${slugify(display.title)}`,
            name: display.title,
            category: 'soup',
            subcategory: 'beneficial-soup',
            workstation: 'Cooking Pot',
            image: outItem?.image || 'images/fallbacks/soup.svg',
            wikiUrl: wikiUrlFor(display.title),
            ingredients,
            stats: {
              hunger,
              thirst,
              cookingLevel: 3,
              duration: cookTime ? `${cookTime} boil` : undefined,
              buffs: buffs.length ? buffs : undefined,
              effectSummary: formatBuffSummary(buffs),
            },
            notes: potInfo && potInfo.title !== display.title ? `Cooked as ${potInfo.title}` : undefined,
            _wikiTitle: display.title,
          });
        });
    }

    // Table 4: Utility Pot Recipes (Name, Ingredients, Item Produced, Amount, Cook Time)
    else if (hJoined.startsWith('name|ingredients|item produced|amount')) {
      $cook(table)
        .find('tr')
        .slice(1)
        .each((__, tr) => {
          const tds = $cook(tr).find('td');
          if (tds.length < 5) return;
          const potInfo = extractPrimaryItem($cook, tds.eq(0));
          const prodInfo = extractPrimaryItem($cook, tds.eq(2));
          if (!potInfo) return;
          const outName = prodInfo?.title || potInfo.title;
          const outItem = registerItem(outName, { imgUrl: prodInfo?.imgUrl || potInfo.imgUrl, kind: 'output' });
          const ingInfos = extractAnchorItems($cook, tds.eq(1));
          const ingredients = ingInfos
            .map((ing) => registerItem(ing.title, { imgUrl: ing.imgUrl, kind: 'raw' }))
            .filter(Boolean)
            .map((item) => ({ itemId: item.id, quantity: 1 }));
          const amount = parseNumber(tds.eq(3).text());
          const cookTime = cleanText(tds.eq(4).text());

          recipes.push({
            id: `soup-${slugify(potInfo.title)}`,
            name: potInfo.title,
            category: 'soup',
            subcategory: 'beneficial-soup',
            workstation: 'Cooking Pot',
            image: outItem?.image || 'images/fallbacks/soup.svg',
            wikiUrl: wikiUrlFor(potInfo.title),
            ingredients,
            stats: {
              servings: amount,
              cookingLevel: 3,
              duration: cookTime ? `${cookTime} boil` : undefined,
              effectSummary: prodInfo ? `Produces ${amount ?? 1}x ${prodInfo.title}` : undefined,
            },
            notes: prodInfo ? `Produces ${amount ?? 1}x ${prodInfo.title} (utility pot recipe).` : undefined,
            _wikiTitle: potInfo.title,
          });
        });
    }

    // Table 5: Harmful / Unsafe Soups (Name, Possible Ingredients, Debuffs, Hunger Fill, Thirst Fill, Portions, Cook Time)
    else if (hJoined.startsWith('name|possible ingredients|debuffs')) {
      $cook(table)
        .find('tr')
        .slice(1)
        .each((__, tr) => {
          const tds = $cook(tr).find('td');
          if (tds.length < 7) return;
          const soupInfo = extractPrimaryItem($cook, tds.eq(0));
          if (!soupInfo) return;
          const outItem = registerItem(soupInfo.title, { imgUrl: soupInfo.imgUrl, kind: 'output' });
          const ingInfos = extractAnchorItems($cook, tds.eq(1));
          const ingText = cleanText(tds.eq(1).text());
          const ingredients = ingInfos
            .map((ing) => registerItem(ing.title, { imgUrl: ing.imgUrl, kind: 'raw' }))
            .filter(Boolean)
            .map((item) => ({ itemId: item.id, quantity: 1 }));
          const buffs = parseBuffsFromCell($cook, tds.eq(2), true);
          const hunger = parseNumber(tds.eq(3).text());
          const thirst = parseNumber(tds.eq(4).text());
          const servings = parseNumber(tds.eq(5).text());
          const cookTime = cleanText(tds.eq(6).text());

          recipes.push({
            id: `soup-${slugify(soupInfo.title)}`,
            name: soupInfo.title,
            category: 'soup',
            subcategory: 'unsafe-soup',
            workstation: 'Cooking Pot',
            image: outItem?.image || 'images/fallbacks/soup.svg',
            wikiUrl: wikiUrlFor(soupInfo.title),
            ingredients,
            stats: {
              hunger,
              thirst,
              servings,
              cookingLevel: 3,
              duration: cookTime ? `${cookTime} boil` : undefined,
              buffs: buffs.length ? buffs : undefined,
              effectSummary: formatBuffSummary(buffs),
            },
            notes: ingText || undefined,
            _wikiTitle: soupInfo.title,
          });
        });
    }

    // Table 6: Simple Baking (Raw, Cooked, Buff, Hunger Fill, Thirst Fill, Cook Time)
    else if (hJoined.startsWith('raw|cooked|buff|hunger fill|thirst fill|cook time')) {
      $cook(table)
        .find('tr')
        .slice(1)
        .each((__, tr) => {
          const tds = $cook(tr).find('td');
          if (tds.length < 6) return;
          const rawInfo = extractPrimaryItem($cook, tds.eq(0));
          const cookedInfo = extractPrimaryItem($cook, tds.eq(1));
          if (!rawInfo || !cookedInfo) return;
          const rawItem = registerItem(rawInfo.title, { imgUrl: rawInfo.imgUrl, kind: 'intermediate' });
          const cookedItem = registerItem(cookedInfo.title, { imgUrl: cookedInfo.imgUrl, kind: 'output' });
          rawPrepTitlesToFetch.add(rawInfo.title);

          const buffs = parseBuffsFromCell($cook, tds.eq(2));
          const hunger = parseNumber(tds.eq(3).text());
          const thirst = parseNumber(tds.eq(4).text());
          const cookTime = cleanText(tds.eq(5).text());

          recipes.push({
            id: `food-${slugify(cookedInfo.title)}`,
            name: cookedInfo.title,
            category: 'food',
            subcategory: 'baking',
            workstation: 'Convection Oven',
            image: cookedItem?.image || 'images/fallbacks/food.svg',
            wikiUrl: wikiUrlFor(cookedInfo.title),
            ingredients: rawItem ? [{ itemId: rawItem.id, quantity: 1 }] : [],
            stats: {
              hunger,
              thirst,
              cookingLevel: 10,
              duration: cookTime ? `${cookTime} bake` : undefined,
              buffs: buffs.length ? buffs : undefined,
              effectSummary: formatBuffSummary(buffs),
            },
            _wikiTitle: cookedInfo.title,
          });
        });
    }

    // Table 7: Pies & Roasts (Whole (Raw), Whole (Cooked), Piece, Buff, Hunger Fill, Thirst Fill, Portions, Cook Time)
    else if (hJoined.startsWith('whole (raw)|whole (cooked)|piece')) {
      $cook(table)
        .find('tr')
        .slice(1)
        .each((__, tr) => {
          const tds = $cook(tr).find('td');
          if (tds.length < 8) return;
          const rawInfo = extractPrimaryItem($cook, tds.eq(0));
          const cookedInfo = extractPrimaryItem($cook, tds.eq(1));
          const pieceInfo = extractPrimaryItem($cook, tds.eq(2));
          if (!rawInfo || !cookedInfo) return;

          const rawItem = registerItem(rawInfo.title, { imgUrl: rawInfo.imgUrl, kind: 'intermediate' });
          const cookedItem = registerItem(cookedInfo.title, {
            imgUrl: cookedInfo.imgUrl || pieceInfo?.imgUrl,
            kind: 'output',
          });
          rawPrepTitlesToFetch.add(rawInfo.title);

          const buffs = parseBuffsFromCell($cook, tds.eq(3));
          const hunger = parseNumber(tds.eq(4).text());
          const thirst = parseNumber(tds.eq(5).text());
          const servings = parseNumber(tds.eq(6).text());
          const cookTime = cleanText(tds.eq(7).text());

          recipes.push({
            id: `food-${slugify(cookedInfo.title)}`,
            name: cookedInfo.title,
            category: 'food',
            subcategory: 'baking',
            workstation: 'Convection Oven',
            image: cookedItem?.image || 'images/fallbacks/food.svg',
            wikiUrl: wikiUrlFor(cookedInfo.title),
            ingredients: rawItem ? [{ itemId: rawItem.id, quantity: 1 }] : [],
            stats: {
              hunger,
              thirst,
              servings,
              cookingLevel: 10,
              duration: cookTime ? `${cookTime} bake` : undefined,
              buffs: buffs.length ? buffs : undefined,
              effectSummary: formatBuffSummary(buffs),
            },
            notes: pieceInfo ? `Yields ${servings ?? 1}x ${pieceInfo.title}` : undefined,
            _wikiTitle: cookedInfo.title,
          });
        });
    }

    // Table 8: Prepared Food (Name, Ingredients, Buff, Hunger Fill, Thirst Fill, Fatigue Fill, Continence Fill)
    else if (hJoined.startsWith('name|ingredients|buff|hunger fill|thirst fill|fatigue')) {
      $cook(table)
        .find('tr')
        .slice(1)
        .each((__, tr) => {
          const tds = $cook(tr).find('td');
          if (tds.length < 6) return;
          const dishInfo = extractPrimaryItem($cook, tds.eq(0));
          if (!dishInfo) return;
          const outItem = registerItem(dishInfo.title, { imgUrl: dishInfo.imgUrl, kind: 'output' });
          const ingInfos = extractAnchorItems($cook, tds.eq(1));
          const ingredients = ingInfos
            .map((ing) => registerItem(ing.title, { imgUrl: ing.imgUrl, kind: 'raw' }))
            .filter(Boolean)
            .map((item) => ({ itemId: item.id, quantity: 1 }));
          const buffs = parseBuffsFromCell($cook, tds.eq(2));
          const hunger = parseNumber(tds.eq(3).text());
          const thirst = parseNumber(tds.eq(4).text());
          const fatigue = parseNumber(tds.eq(5).text());

          recipes.push({
            id: `food-${slugify(dishInfo.title)}`,
            name: dishInfo.title,
            category: 'food',
            subcategory: 'chefs-counter',
            workstation: "Chef's Counter",
            image: outItem?.image || 'images/fallbacks/food.svg',
            wikiUrl: wikiUrlFor(dishInfo.title),
            ingredients,
            stats: {
              hunger,
              thirst,
              fatigue: fatigue && fatigue !== 0 ? fatigue : undefined,
              buffs: buffs.length ? buffs : undefined,
              effectSummary: formatBuffSummary(buffs),
            },
            _wikiTitle: dishInfo.title,
          });
        });
    }
  });

  // 2. Parse Chemistry page (Distillations + Coatings + Flasks + Tinctures)
  const $chem = cheerio.load(chemRes.parse.text);

  // Distillations table
  $chem('table.wikitable').each((_, table) => {
    const firstHeader = cleanText($chem(table).find('tr').first().text()).toLowerCase();
    if (!firstHeader.includes('distillations')) return;
    $chem(table)
      .find('tr')
      .slice(1)
      .each((__, tr) => {
        const td = $chem(tr).find('td').first();
        if (!td.length) return;
        const slots = td.find('.af-item-slot');
        if (slots.length === 0) return;
        const distInfo = extractPrimaryItem($chem, td);
        if (!distInfo) return;
        const distItem = registerItem(distInfo.title, {
          imgUrl: distInfo.imgUrl,
          kind: 'distillation',
          categoryTag: 'distillation',
        });
        if (!distItem) return;
        if (!distillationIds.includes(distItem.id)) {
          distillationIds.push(distItem.id);
        }

        // Parse each .af-item-slot for raw item + amount produced
        slots.each((___, slot) => {
          const link = $chem(slot).find('a[href^="/wiki/"]').first();
          const rawTitle = cleanText(link.attr('title') || $chem(slot).find('img').attr('alt'));
          if (!rawTitle) return;
          const imgEl = $chem(slot).find('img').first();
          const imgUrl = imgEl.length ? normalizeImageUrl(imgEl.attr('src'), imgEl.attr('srcset')) : null;
          const slotClone = $chem(slot).clone();
          slotClone.find('a, img').remove();
          const amount = parseNumber($chem(slot).text()) || 1;
          const rawItem = registerItem(rawTitle, { imgUrl, kind: 'raw' });
          if (!rawItem) return;
          rawItem.distillsInto = rawItem.distillsInto || [];
          const existingYield = rawItem.distillsInto.find((d) => d.distillationId === distItem.id);
          if (!existingYield) {
            rawItem.distillsInto.push({ distillationId: distItem.id, amount });
          } else {
            existingYield.amount = Math.max(existingYield.amount, amount);
          }
        });
      });
  });

  // Chemistry Concoctions tables (Coatings, Flasks, Tinctures)
  $chem('table').each((_, table) => {
    const headers = $chem(table)
      .find('tr')
      .first()
      .find('th, td')
      .map((__, c) => cleanText($chem(c).text()).toLowerCase())
      .get();
    const first = headers[0] || '';
    if (!['coating', 'flask', 'tincture'].includes(first)) return;
    if (!headers.includes('ingredient 1')) return;

    const subcategory = first;
    $chem(table)
      .find('tr')
      .slice(1)
      .each((__, tr) => {
        const tds = $chem(tr).find('td');
        if (tds.length < 5) return;
        const outInfo = extractPrimaryItem($chem, tds.eq(0));
        if (!outInfo) return;

        // Parse 3 ingredient slots
        const ingredients = [];
        let hasWildcard = false;
        for (let slot = 1; slot <= 3; slot++) {
          const cell = tds.eq(slot);
          const cellText = cleanText(cell.text());
          if (/^any$/i.test(cellText)) {
            hasWildcard = true;
            continue;
          }
          const ingInfo = extractPrimaryItem($chem, cell);
          if (!ingInfo) continue;
          const isDist = /distillation/i.test(ingInfo.title);
          const ingItem = registerItem(ingInfo.title, {
            imgUrl: ingInfo.imgUrl,
            kind: isDist ? 'distillation' : 'raw',
            categoryTag: isDist ? 'distillation' : 'lab',
          });
          if (!ingItem) continue;
          const qtyMatch = cellText.match(/x\s*(\d+)/i);
          const quantity = qtyMatch ? Number(qtyMatch[1]) : 1;
          ingredients.push({ itemId: ingItem.id, quantity, slot });
        }

        if (hasWildcard || ingredients.length === 0) {
          // Include Unstable Flask only once if it has concrete Noxious Sludge note, skip duplicate pure Any+Any+Any row
          if (outInfo.title === 'Unstable Flask' && ingredients.length === 0) return;
        }

        const outItem = registerItem(outInfo.title, {
          imgUrl: outInfo.imgUrl,
          kind: 'output',
          categoryTag: 'lab',
        });
        const mixTime = cleanText(tds.eq(4).text());

        const existingIdx = recipes.findIndex((r) => r.id === `chem-${slugify(outInfo.title)}`);
        if (existingIdx !== -1) return;

        recipes.push({
          id: `chem-${slugify(outInfo.title)}`,
          name: outInfo.title,
          category: 'chemistry',
          subcategory,
          workstation: 'Chemistry Bench',
          image: outItem?.image || 'images/fallbacks/chemistry.svg',
          wikiUrl: wikiUrlFor(outInfo.title),
          ingredients,
          stats: {
            duration: mixTime ? `${mixTime} mix` : undefined,
          },
          notes: hasWildcard ? 'Fallback result when mixing incompatible distillations or Noxious Sludge.' : undefined,
          _wikiTitle: outInfo.title,
        });
      });
  });

  // 3. Batch-fetch wikitext for recipe enrichment + Chef's Counter prep recipes
  const titlesToFetch = new Set([
    ...recipes.map((r) => r._wikiTitle).filter(Boolean),
    ...rawPrepTitlesToFetch,
  ]);
  console.log(`Fetching wikitext for ${titlesToFetch.size} pages for stats, effects, and Chef's Counter recipes...`);
  const revisions = await fetchRevisionsMap([...titlesToFetch]);

  // Extract Chef's Counter prep recipes (Raw Dough, Raw Pumpkin Dough, Raw Pies, etc.)
  for (const rawTitle of rawPrepTitlesToFetch) {
    const rev = revisions.get(rawTitle);
    if (!rev) continue;
    const itemBlocks = parseTemplateBlocks(rev.wikitext, 'item');
    const itemFields = itemBlocks[0] || {};
    const recipeBlocks = parseTemplateBlocks(rev.wikitext, 'itemrecipe');
    for (let bi = 0; bi < recipeBlocks.length; bi++) {
      const rb = recipeBlocks[bi];
      const station = stripWikiMarkup(rb.requiredStation || "Chef's Counter");
      const ingredients = [];
      for (let k = 1; k <= 6; k++) {
        const ingName = stripWikiMarkup(rb[`ingredient${k}Item`]);
        if (!ingName) continue;
        const ingQty = parseNumber(rb[`ingredient${k}Amount`]) || 1;
        const ingItem = registerItem(ingName, { kind: 'raw' });
        if (ingItem) ingredients.push({ itemId: ingItem.id, quantity: ingQty });
      }
      if (ingredients.length === 0) continue;
      const outItem = registerItem(rawTitle, { kind: 'intermediate' });
      const levelMatch = rev.wikitext.match(/level\s+(\d+)\s+\[\[Skills#Cooking/i);
      const resultAmt = parseNumber(rb.resultAmount);
      const id = `food-${slugify(rawTitle)}${bi > 0 ? `-alt-${bi + 1}` : ''}`;
      if (!recipes.some((r) => r.id === id)) {
        recipes.push({
          id,
          name: rawTitle,
          category: 'food',
          subcategory: /oven/i.test(station) ? 'baking' : 'chefs-counter',
          workstation: station || "Chef's Counter",
          image: outItem?.image || 'images/fallbacks/food.svg',
          wikiUrl: wikiUrlFor(rawTitle),
          ingredients,
          stats: {
            hunger: parseNumber(itemFields.consumableHungerFill),
            thirst: parseNumber(itemFields.consumableThirstFill),
            radiation: parseNumber(itemFields.consumableRadiation),
            decay: itemFields.decayLimit ? `${itemFields.decayLimit} decay` : undefined,
            weight: parseNumber(itemFields.weight),
            servings: resultAmt && resultAmt > 1 ? resultAmt : undefined,
            cookingLevel: levelMatch ? Number(levelMatch[1]) : undefined,
            effectSummary: stripWikiMarkup(itemFields.description) || undefined,
          },
          _wikiTitle: rawTitle,
        });
      }
    }
  }

  // Enrich all recipes with wikitext stats, effects, weights, decay, and exact {{itemRecipe}} amounts
  for (const recipe of recipes) {
    const rev = recipe._wikiTitle ? revisions.get(recipe._wikiTitle) : null;
    if (!rev) continue;
    const wt = rev.wikitext;
    const itemFields = parseTemplateBlocks(wt, 'item')[0] || {};
    const recipeBlocks = parseTemplateBlocks(wt, 'itemrecipe');
    const chemBlocks = parseTemplateBlocks(wt, 'chemistryrecipe');

    // Exact ingredient amounts for Chef's Counter / Prepared foods
    if (recipe.subcategory === 'chefs-counter' && recipeBlocks.length > 0) {
      const rb = recipeBlocks[0];
      const exactIngs = [];
      for (let k = 1; k <= 6; k++) {
        const ingName = stripWikiMarkup(rb[`ingredient${k}Item`]);
        if (!ingName) continue;
        const ingQty = parseNumber(rb[`ingredient${k}Amount`]) || 1;
        const ingItem = registerItem(ingName, { kind: 'raw' });
        if (ingItem) exactIngs.push({ itemId: ingItem.id, quantity: ingQty });
      }
      if (exactIngs.length > 0) recipe.ingredients = exactIngs;
      const resultAmt = parseNumber(rb.resultAmount);
      if (resultAmt && resultAmt > 1 && !recipe.stats.servings) {
        recipe.stats.servings = resultAmt;
      }
    }

    if (chemBlocks.length > 0) {
      const cb = chemBlocks[0];
      const resultAmt = parseNumber(cb.resultAmount);
      if (resultAmt && resultAmt > 1) {
        recipe.stats.servings = resultAmt;
      }
    }

    // Weight, decay, radiation, fatigue
    const weight = parseNumber(itemFields.weight);
    if (weight !== undefined && recipe.stats.weight === undefined) recipe.stats.weight = weight;
    if (itemFields.decayLimit && !recipe.stats.decay) {
      recipe.stats.decay = `${cleanText(itemFields.decayLimit)}`;
    }
    const rad = parseNumber(itemFields.consumableRadiation);
    if (rad !== undefined && recipe.stats.radiation === undefined) recipe.stats.radiation = rad;
    const hunger = parseNumber(itemFields.consumableHungerFill);
    if (hunger !== undefined && recipe.stats.hunger === undefined) recipe.stats.hunger = hunger;
    const thirst = parseNumber(itemFields.consumableThirstFill);
    if (thirst !== undefined && recipe.stats.thirst === undefined) recipe.stats.thirst = thirst;

    // Extract Effects section text for Chemistry & special items
    const effectsMatch = wt.match(/==\s*Effects\s*==\s*([\s\S]*?)(?:\n==|$)/i);
    if (effectsMatch) {
      const lines = effectsMatch[1]
        .split('\n')
        .map((l) => stripWikiMarkup(l).replace(/^\*+\s*/, ''))
        .filter((l) => l && !l.startsWith('{') && !l.startsWith('|'));
      const joined = lines.join(' ').replace(new RegExp(recipe.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), recipe.name).trim();
      if (joined) {
        if (!recipe.stats.effectSummary) {
          recipe.stats.effectSummary = joined.length > 180 ? `${joined.slice(0, 177)}...` : joined;
        }
        if (!recipe.notes) recipe.notes = joined;
      }
    }
    if (!recipe.notes && itemFields.description) {
      recipe.notes = stripWikiMarkup(itemFields.description);
    }
    if (!recipe.stats.effectSummary && itemFields.description && recipe.category === 'chemistry') {
      recipe.stats.effectSummary = stripWikiMarkup(itemFields.description);
    }

    // Add buff from infobox if table omitted it
    for (let b = 1; b <= 3; b++) {
      const bName = stripWikiMarkup(itemFields[`consumableAddsBuff${b}`]);
      if (!bName) continue;
      recipe.stats.buffs = recipe.stats.buffs || [];
      const built = buildBuffObject(
        bName,
        recipe.subcategory === 'unsafe-soup'
      );
      const normKey = normalizeBuffKey(built.name);
      if (
        normKey &&
        !recipe.stats.buffs.some((x) => normalizeBuffKey(x.name) === normKey)
      ) {
        recipe.stats.buffs.push(built);
      }
    }

    if (
      recipe.category !== 'chemistry' &&
      recipe.stats.buffs?.length &&
      !(recipe.stats.effectSummary || '').startsWith('Produces ')
    ) {
      recipe.stats.effectSummary = formatBuffSummary(recipe.stats.buffs);
    }
  }

  // 4. Resolve missing item icons via pageimages & wikitext `image = ...`
  const missingImgItems = [...itemRegistry.values()].filter((it) => !it._imgUrl);
  if (missingImgItems.length > 0) {
    console.log(`Resolving ${missingImgItems.length} missing item icons via MediaWiki API...`);
    const pageImgMap = await resolveWikiImagesByPageTitles(missingImgItems.map((i) => i._wikiTitle));
    for (const item of missingImgItems) {
      if (pageImgMap.has(item._wikiTitle)) {
        item._imgUrl = pageImgMap.get(item._wikiTitle);
      }
    }
    // Try imageinfo for any still missing using revision image field
    const stillMissing = [...itemRegistry.values()].filter((it) => !it._imgUrl);
    if (stillMissing.length > 0) {
      const revMap = await fetchRevisionsMap(stillMissing.map((i) => i._wikiTitle));
      const filesToLookup = new Map();
      for (const item of stillMissing) {
        const rev = revMap.get(item._wikiTitle);
        if (!rev) continue;
        const fields = parseTemplateBlocks(rev.wikitext, 'item')[0] || {};
        if (fields.image) {
          const fileTitle = stripWikiMarkup(fields.image).replace(/\{\{PAGENAME\}\}/g, rev.title);
          filesToLookup.set(item.id, fileTitle);
        }
      }
      if (filesToLookup.size > 0) {
        const fileUrls = await resolveWikiFileUrls([...filesToLookup.values()]);
        for (const [id, fileTitle] of filesToLookup.entries()) {
          const item = itemRegistry.get(id);
          if (item && fileUrls.has(fileTitle)) item._imgUrl = fileUrls.get(fileTitle);
        }
      }
    }
  }

  // Fallback: match foodStatsByName icons if any item matches
  for (const item of itemRegistry.values()) {
    if (!item._imgUrl) {
      const hit = foodStatsByName.get(item.id);
      if (hit?.imgUrl) item._imgUrl = hit.imgUrl;
    }
  }

  // 5. Download all unique item images locally into public/images/items/
  const downloadTargets = [...itemRegistry.values()].filter((it) => Boolean(it._imgUrl));
  let downloadedCount = 0;
  let cachedCount = 0;
  let failedImgCount = 0;

  console.log(`Caching ${downloadTargets.length} item icons to public/images/items/...`);
  await runPool(downloadTargets, 6, async (item) => {
    const extMatch = item._imgUrl.match(/\.(png|webp|jpg|jpeg|gif)(?:$|\?)/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'png';
    const relPath = `images/items/${item.id}.${ext}`;
    const absPath = path.join(ROOT, 'public', relPath);

    try {
      if (!FORCE_IMAGES) {
        try {
          const st = await fs.stat(absPath);
          if (st.size > 0) {
            item.image = relPath;
            cachedCount++;
            return;
          }
        } catch {
          // file not yet cached
        }
      }
      const res = await fetchWithRetry(item._imgUrl);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 0) {
        await fs.writeFile(absPath, buf);
        item.image = relPath;
        downloadedCount++;
      } else {
        failedImgCount++;
      }
    } catch {
      failedImgCount++;
    }
  });

  // Update recipe images from resolved itemRegistry entries
  for (const recipe of recipes) {
    const outItem = itemRegistry.get(slugify(recipe.name));
    if (outItem?.image && !outItem.image.startsWith('images/fallbacks/')) {
      recipe.image = outItem.image;
    } else if (recipe._wikiTitle) {
      const altItem = itemRegistry.get(slugify(recipe._wikiTitle));
      if (altItem?.image && !altItem.image.startsWith('images/fallbacks/')) {
        recipe.image = altItem.image;
      }
    }
    delete recipe._wikiTitle;
  }

  // Clean internal fields on items
  const cleanItems = {};
  for (const [id, item] of [...itemRegistry.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const { _imgUrl, _wikiTitle, ...rest } = item;
    cleanItems[id] = rest;
  }

  // Deduplicate recipes by ID just in case
  const uniqueRecipes = [];
  const seenRecipeIds = new Set();
  for (const r of recipes) {
    if (seenRecipeIds.has(r.id)) continue;
    seenRecipeIds.add(r.id);
    uniqueRecipes.push(r);
  }

  const db = {
    syncedAt: new Date().toISOString(),
    source: WIKI_BASE,
    items: cleanItems,
    distillationIds,
    recipes: uniqueRecipes,
  };

  await fs.writeFile(DATA_PATH, `${JSON.stringify(db, null, 2)}\n`, 'utf8');

  const allBuffs = uniqueRecipes.flatMap((r) => r.stats.buffs || []);
  const buffsWithDetails = allBuffs.filter((b) => Boolean(b.effect || b.description)).length;
  const buffsMissingDetails = allBuffs.length - buffsWithDetails;

  const counts = {
    soup: uniqueRecipes.filter((r) => r.category === 'soup').length,
    food: uniqueRecipes.filter((r) => r.category === 'food').length,
    chemistry: uniqueRecipes.filter((r) => r.category === 'chemistry').length,
    distillations: distillationIds.length,
    items: Object.keys(cleanItems).length,
    buffsWithDetails,
    buffsMissingDetails,
    downloadedImages: downloadedCount,
    cachedImages: cachedCount,
    fallbackImages: Object.values(cleanItems).filter((i) => i.image.startsWith('images/fallbacks/')).length,
    failedDownloads: failedImgCount,
  };

  console.log('\n=== Sync Complete ===');
  console.table(counts);

  if (counts.soup === 0 || counts.food === 0 || counts.chemistry === 0 || counts.distillations === 0) {
    console.error('ERROR: One or more required recipe categories parsed 0 entries!');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
