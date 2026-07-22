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
