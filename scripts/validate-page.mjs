#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';

const input = process.argv[2];

if (!input) {
  console.error('Usage: node scripts/validate-page.mjs <path/to/index.html>');
  process.exit(1);
}

const path = resolve(input);
const html = await readFile(path, 'utf8');
const errors = [];

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
if (scripts.length === 0) {
  errors.push('No inline script found.');
}

const pageScript = scripts.at(-1)?.[1] ?? '';
try {
  new vm.Script(pageScript, { filename: path });
} catch (error) {
  errors.push(`Inline JavaScript is invalid: ${error.message}`);
}

const messagesMatch = pageScript.match(/const messages\s*=\s*(\{[\s\S]*?\n\s*\});/);
const i18nAttrCount = [...html.matchAll(/data-i18n(?:-html|-aria)?="/g)].length;

// Single-language pages have no i18n attributes and no messages object.
// Both absent together is valid; one without the other is a mistake.
let messages;
if (!messagesMatch) {
  if (i18nAttrCount > 0) {
    errors.push('data-i18n attributes found but no messages object.');
  }
} else if (i18nAttrCount === 0) {
  errors.push('messages object found but no data-i18n attributes reference it.');
} else {
  try {
    messages = vm.runInNewContext(`(${messagesMatch[1]})`, Object.create(null), {
      timeout: 1000
    });
  } catch (error) {
    errors.push(`Could not parse the messages object: ${error.message}`);
  }
}

const referencedKeys = new Set(messagesMatch ? ['metaTitle'] : []);
for (const match of html.matchAll(/data-i18n(?:-html|-aria)?="([^"]+)"/g)) {
  referencedKeys.add(match[1]);
}

if (messages) {
  for (const language of ['en', 'zh']) {
    const dictionary = messages[language];
    if (!dictionary || typeof dictionary !== 'object') {
      errors.push(`Missing ${language} message dictionary.`);
      continue;
    }

    const dictionaryKeys = new Set(Object.keys(dictionary));
    const missing = [...referencedKeys].filter((key) => !dictionaryKeys.has(key));
    const unused = [...dictionaryKeys].filter((key) => !referencedKeys.has(key));
    const empty = [...dictionaryKeys].filter((key) => {
      const value = dictionary[key];
      return typeof value !== 'string' || value.trim().length === 0;
    });

    if (missing.length > 0) errors.push(`${language} is missing: ${missing.join(', ')}`);
    if (unused.length > 0) errors.push(`${language} has unused keys: ${unused.join(', ')}`);
    if (empty.length > 0) errors.push(`${language} has empty values: ${empty.join(', ')}`);
  }

  if (messages.en && messages.zh) {
    const enKeys = Object.keys(messages.en).sort();
    const zhKeys = Object.keys(messages.zh).sort();
    if (JSON.stringify(enKeys) !== JSON.stringify(zhKeys)) {
      errors.push('English and Chinese dictionaries do not contain the same keys.');
    }
  }
}

const navBlock = html.match(/<nav(?:\s[^>]*)?>([\s\S]*?)<\/nav>/i)?.[1] ?? '';
const navTargets = [...navBlock.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
const sectionIds = [...html.matchAll(/<section\s+id="([^"]+)"/g)].map((match) => match[1]);

if (JSON.stringify(navTargets) !== JSON.stringify(sectionIds)) {
  errors.push(
    `Navigation and section order differ: nav=[${navTargets.join(', ')}], sections=[${sectionIds.join(', ')}]`
  );
}

if (/\{\{[^}]+\}\}/.test(html)) {
  errors.push('Unresolved {{placeholder}} token found.');
}

// ── SVG text overflow estimation ─────────────────────────────────────────
// Text spilling out of its box is the most common defect in generated
// figures. This estimates each <text>'s rendered width from character
// counts (CJK ≈ 1em, latin mono ≈ 0.62em, latin sans ≈ 0.56em) and flags
// lines that clearly exceed their enclosing rect. It is a heuristic: it
// cannot see kerning or font fallbacks, so it only flags overflows larger
// than a 12px tolerance — treat every flag as real.

// font-size per class from embedded CSS, e.g. `.sc { ... font-size: 11px ... }`
const classFontSizes = {};
const classIsMono = {};
for (const rule of html.matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)) {
  const size = rule[2].match(/font-size:\s*([\d.]+)px/);
  if (size) classFontSizes[rule[1]] = Number(size[1]);
  if (/mono/i.test(rule[2])) classIsMono[rule[1]] = true;
}

const CJK_RE = /[⺀-鿿豈-﫿＀-￯　-〿]/;
function estimateWidth(text, fontSize, mono) {
  let w = 0;
  for (const ch of text) {
    w += CJK_RE.test(ch) ? fontSize : fontSize * (mono ? 0.62 : 0.56);
  }
  return w;
}

const svgBlocks = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)];
let svgIndex = 0;
for (const [svg] of svgBlocks) {
  svgIndex += 1;
  const viewBox = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const vbWidth = viewBox ? Number(viewBox[1]) : null;
  const rects = [...svg.matchAll(/<rect\s[^>]*>/g)]
    .map(([tag]) => {
      const attr = (name) => {
        const m = tag.match(new RegExp(`${name}="([\\d.]+)"`));
        return m ? Number(m[1]) : null;
      };
      return { x: attr('x'), y: attr('y'), w: attr('width'), h: attr('height') };
    })
    .filter((r) => r.x !== null && r.y !== null && r.w !== null && r.h !== null);

  for (const t of svg.matchAll(/<text\s([^>]*)>([^<]*)<\/text>/g)) {
    const attrs = t[1];
    if (/text-anchor="(middle|end)"/.test(attrs)) continue;
    const x = Number(attrs.match(/\bx="([\d.]+)"/)?.[1]);
    const y = Number(attrs.match(/\by="([\d.]+)"/)?.[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const content = t[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    if (!content) continue;
    const classes = (attrs.match(/class="([^"]+)"/)?.[1] ?? '').split(/\s+/);
    const inlineSize = attrs.match(/font-size="([\d.]+)"/);
    const fontSize = inlineSize
      ? Number(inlineSize[1])
      : classes.map((c) => classFontSizes[c]).find((s) => s) ?? 12;
    const mono = classes.some((c) => classIsMono[c]);

    // On bilingual pages the zh dictionary value replaces this text at
    // runtime, so both language variants must fit the same box.
    const i18nKey = attrs.match(/data-i18n="([^"]+)"/)?.[1];
    const zhValue = i18nKey && messages?.zh?.[i18nKey];
    const variants = [{ label: '', text: content }];
    if (typeof zhValue === 'string' && !/[<>]/.test(zhValue)) {
      variants.push({ label: ' (zh variant)', text: zhValue.trim() });
    }
    const widest = variants
      .map((v) => ({ ...v, width: estimateWidth(v.text, fontSize, mono) }))
      .sort((a, b) => b.width - a.width)[0];
    const estWidth = widest.width;

    // tightest rect containing the text's start point (baseline sits below
    // cap). A start at a rect's right edge is a label *outside* the box, so
    // require the start to sit clearly in the interior.
    const enclosing = rects
      .filter((r) => x >= r.x && x <= r.x + r.w - 8 && y > r.y && y < r.y + r.h)
      .sort((a, b) => a.w * a.h - b.w * b.h)[0];
    const limit = enclosing ? enclosing.x + enclosing.w - 4 : vbWidth;
    if (limit && x + estWidth > limit + 12) {
      errors.push(
        `SVG ${svgIndex}: text "${widest.text.slice(0, 40)}"${widest.label} at x=${x} is ~${Math.round(
          x + estWidth - limit
        )}px wider than its ${enclosing ? 'box' : 'viewBox'} (est. ${Math.round(estWidth)}px wide, limit x=${Math.round(limit)}).`
      );
    }
  }
}

if (errors.length > 0) {
  console.error(`Validation failed for ${path}:`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

const mode = messagesMatch
  ? `${referencedKeys.size} bilingual keys`
  : 'single-language page';
console.log(
  `Validated ${path}: ${mode}, ${sectionIds.length} sections, valid inline JavaScript.`
);
