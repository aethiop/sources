#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const opts = { page: 1, limit: 10, dryRun: false, inspect: false, json: false, response: '' };
const pos = [];

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--dry-run') {
    opts.dryRun = true;
  } else if (arg === '--inspect') {
    opts.inspect = true;
  } else if (arg === '--json') {
    opts.json = true;
  } else if (arg === '--page') {
    opts.page = Number(args[++i] || 1);
  } else if (arg === '--limit') {
    opts.limit = Number(args[++i] || 10);
  } else if (arg === '--response') {
    opts.response = args[++i] || '';
  } else {
    pos.push(arg);
  }
}

const target = pos[0];
const query = pos[1] || '';

if (!target) usage();

try {
  const shelf = parseShelf(await readText(target));
  if (!shelf) fail('That file is not a Pillcrow shelf.');

  const report = {
    source: target,
    name: shelf.name,
    home: shelf.home,
    books: shelf.books.length,
    search: shelf.search ? shelf.search.url : '',
    searchUrl: '',
    results: [],
    diagnostics: [],
  };

  if (query) {
    if (!shelf.search) fail('This shelf does not declare search.');
    report.searchUrl = searchUrl(shelf.search, query, opts.page);
    if (opts.dryRun) {
      print(report);
      process.exit(0);
    }
    const body = opts.response ? await readFile(opts.response, 'utf8') : await readText(report.searchUrl);
    const searched = searchWorks(shelf.search, body);
    report.results = searched.results;
    report.diagnostics = searched.diagnostics;
    if (opts.inspect) {
      print(report);
      process.exit(report.results.length ? 0 : 1);
    }
    if (!report.results.length) {
      print(report);
      fail('Search returned no valid Pillcrow book rows.');
    }
  }

  print(report);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

function usage() {
  console.error(`Usage:
  node scripts/test-source.mjs <shelf-url-or-file> [query] [--page n] [--limit n]
  node scripts/test-source.mjs <shelf-url-or-file> [query] --dry-run
  node scripts/test-source.mjs <shelf-url-or-file> [query] --inspect
  node scripts/test-source.mjs <shelf-file> [query] --response <json-file>

Examples:
  node scripts/test-source.mjs shelf.json douglass
  node scripts/test-source.mjs https://raw.githubusercontent.com/aethiop/sources/refs/heads/main/shelf.json douglass
  node scripts/test-source.mjs examples/example.com.shelf.json 10.2307/3762753 --dry-run
  node scripts/test-source.mjs examples/example.com.shelf.json sample --response examples/example.com.response.json`);
  process.exit(1);
}

function fail(message) {
  console.error('Source test failed: ' + message);
  process.exit(1);
}

async function readText(target) {
  if (/^https?:\/\//.test(target)) {
    if (typeof fetch !== 'function') throw new Error('Node 18+ is required to fetch URLs.');
    const response = await fetch(target);
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${target}`);
    return response.text();
  }
  return readFile(target, 'utf8');
}

function parseShelf(json) {
  let value;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object' || value.pillcrowShelf !== 1) return null;
  const shelf = shape(value);
  return shelf;
}

function shape(value) {
  if (!value || typeof value !== 'object') return null;
  const name = str(value.name);
  if (!name) return null;
  const books = Array.isArray(value.books) ? value.books.map(work).filter(Boolean) : [];
  const shelf = { name, home: str(value.home), about: str(value.about), books };
  const recipe = search(value.search);
  if (recipe) shelf.search = recipe;
  return shelf;
}

function work(value) {
  if (!value || typeof value !== 'object') return null;
  const id = str(value.id);
  const title = str(value.title);
  const file = str(value.file);
  if (!id || !title || !https(file)) return null;
  const out = { id, title, author: str(value.author), file };
  const words = Number(value.words);
  if (Number.isFinite(words) && words > 0) out.words = Math.round(words);
  const map = str(value.map);
  if (https(map)) out.map = map;
  const updated = str(value.updated);
  if (updated) out.updated = updated;
  return out;
}

function search(value) {
  if (!value || typeof value !== 'object') return undefined;
  const url = str(value.url);
  const items = str(value.items);
  const fields = searchFields(value.fields);
  if (value.version !== 1 || value.format !== 'json' || !https(url) || !url.includes('{query}') || !items.startsWith('/') || !fields) return undefined;
  return { version: 1, format: 'json', url, items, fields };
}

function searchFields(value) {
  if (!value || typeof value !== 'object') return null;
  const id = str(value.id);
  const title = str(value.title);
  const file = str(value.file);
  if (!id || !title || !file) return null;
  const out = { id, title, file };
  for (const key of ['author', 'words', 'map', 'updated']) {
    const next = str(value[key]);
    if (next) out[key] = next;
  }
  return out;
}

function searchUrl(recipe, value, page) {
  const p = Math.max(1, Math.round(Number(page) || 1));
  return recipe.url
    .replace(/\{query\}/g, encodeURIComponent(str(value)))
    .replace(/\{page\}/g, encodeURIComponent(String(p)));
}

function searchWorks(recipe, json) {
  const diagnostics = [];
  let root;
  try {
    root = JSON.parse(json);
  } catch {
    return { results: [], diagnostics: ['Response is not valid JSON.'] };
  }
  diagnostics.push(`Response root is ${kind(root)}.`);
  const rows = at(root, recipe.items);
  if (!Array.isArray(rows)) {
    diagnostics.push(`items "${recipe.items}" resolved to ${kind(rows)}, not an array.`);
    const arrays = findArrays(root).slice(0, 8);
    if (arrays.length) diagnostics.push('Candidate array pointers: ' + arrays.join(', '));
    if (Array.isArray(root)) diagnostics.push('This response is a top-level array; the current Pillcrow source contract expects a JSON pointer to an array on an object, such as "/records".');
    return { results: [], diagnostics };
  }

  diagnostics.push(`items "${recipe.items}" resolved to ${rows.length} row(s).`);
  const results = [];
  let dropped = 0;
  rows.forEach((row, index) => {
    const mapped = {
      id: field(row, recipe.fields.id),
      title: field(row, recipe.fields.title),
      author: field(row, recipe.fields.author),
      file: field(row, recipe.fields.file),
      words: numberField(row, recipe.fields.words),
      map: field(row, recipe.fields.map),
      updated: field(row, recipe.fields.updated),
    };
    const item = work(mapped);
    if (item) {
      results.push(item);
      return;
    }
    dropped += 1;
    if (dropped <= 3) diagnostics.push(`Dropped row ${index}: ${rejectReason(mapped)}. Mapped id=${quote(mapped.id)}, title=${quote(mapped.title)}, file=${quote(mapped.file)}.`);
  });

  if (dropped) diagnostics.push(`Dropped ${dropped} row(s). Pillcrow requires id, title, and a direct https book file.`);
  if (!results.length && rows.length) {
    const first = rows.find((row) => row && typeof row === 'object') || rows[0];
    const titles = findPointers(first, titleish).slice(0, 8);
    const links = findPointers(first, directHttps).slice(0, 8);
    const fileish = findPointers(first, fileishValueOrKey).slice(0, 8);
    if (titles.length) diagnostics.push('First row title-like pointers: ' + titles.join(', '));
    if (links.length) diagnostics.push('First row https value pointers: ' + links.join(', '));
    if (fileish.length) diagnostics.push('First row file-like pointers: ' + fileish.join(', '));
    if (!links.length) diagnostics.push('No direct https value was found in the first row; metadata-only APIs need a lawful normalized endpoint that returns the importable file URL.');
  }
  return { results, diagnostics };
}

function field(row, expr) {
  if (!expr) return '';
  if (!expr.includes('{') && expr.startsWith('/')) return text(at(row, expr));
  return expr.replace(/\{([^}]+)\}/g, (_, token) => {
    const pointer = token.startsWith('/') ? token : `/${token}`;
    return text(at(row, pointer));
  }).trim();
}

function numberField(row, expr) {
  const raw = expr && !expr.includes('{') && expr.startsWith('/') ? at(row, expr) : field(row, expr);
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

function at(root, pointer) {
  if (pointer === '') return root;
  if (!pointer || !pointer.startsWith('/')) return undefined;
  let current = root;
  for (const raw of pointer.slice(1).split('/')) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (Array.isArray(current)) {
      const index = Number(key);
      current = Number.isInteger(index) ? current[index] : undefined;
    } else if (current && typeof current === 'object') {
      current = current[key];
    } else {
      return undefined;
    }
  }
  return current;
}

function kind(value) {
  if (Array.isArray(value)) return `array(${value.length})`;
  if (value === null) return 'null';
  return typeof value;
}

function quote(value) {
  const textValue = String(value == null ? '' : value);
  return JSON.stringify(textValue.length > 90 ? textValue.slice(0, 87) + '...' : textValue);
}

function rejectReason(mapped) {
  if (!mapped.id) return 'missing id';
  if (!mapped.title) return 'missing title';
  if (!mapped.file) return 'missing file';
  if (!https(mapped.file)) return 'file is not a direct https URL';
  return 'row did not match the Pillcrow book contract';
}

function findArrays(root) {
  const out = [];
  walk(root, '', 0, (value, pointer) => {
    if (Array.isArray(value)) out.push(pointer || '');
  });
  return out;
}

function findPointers(root, keep) {
  const out = [];
  walk(root, '', 0, (value, pointer, key) => {
    if (keep(value, key, pointer)) out.push(pointer || '');
  });
  return out;
}

function walk(value, pointer, depth, visit) {
  if (depth > 5 || value == null) return;
  visit(value, pointer, pointer.split('/').pop() || '');
  if (Array.isArray(value)) {
    value.slice(0, 5).forEach((item, index) => walk(item, `${pointer}/${index}`, depth + 1, visit));
    return;
  }
  if (typeof value === 'object') {
    Object.keys(value).slice(0, 40).forEach((key) => {
      walk(value[key], `${pointer}/${escapePointer(key)}`, depth + 1, visit);
    });
  }
}

function escapePointer(value) {
  return String(value).replace(/~/g, '~0').replace(/\//g, '~1');
}

function titleish(value, key) {
  return /title|name/i.test(key) && (typeof value === 'string' || typeof value === 'number');
}

function directHttps(value) {
  return typeof value === 'string' && value.startsWith('https://');
}

function fileishValueOrKey(value, key) {
  return /file|epub|download|url|md5|hash/i.test(key) && (typeof value === 'string' || typeof value === 'number');
}

function print(report) {
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(`Source: ${report.name}`);
  if (report.home) console.log(`Home: ${report.home}`);
  console.log(`Static books: ${report.books}`);
  if (report.search) console.log(`Search recipe: ${report.search}`);
  if (report.searchUrl) console.log(`Search URL: ${report.searchUrl}`);
  if (report.diagnostics.length) {
    console.log('Diagnostics:');
    report.diagnostics.forEach((line) => console.log(`- ${line}`));
  }
  if (report.results.length) {
    console.log(`Results: ${report.results.length}`);
    report.results.slice(0, opts.limit).forEach((book, index) => {
      const by = book.author ? ` by ${book.author}` : '';
      console.log(`${index + 1}. ${book.title}${by}`);
      console.log(`   id: ${book.id}`);
      console.log(`   file: ${book.file}`);
    });
  }
}

function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function text(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function https(value) {
  return value.startsWith('https://') && value.length > 'https://'.length;
}
