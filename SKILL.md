---
name: build-plan
description: Build a polished, self-contained HTML plan page (build plan, technical design plan, proposal, playbook, working doc) in the restrained white/ink/orange sidebar style, written in plain language with SVG diagrams carrying the ideas. Handles the user's repo logo, optional additional languages (any, and more than two; EN/中文 is just one example pair), and optional publishing to artifact.cafe for review. Use whenever the user asks for a build plan, design plan, technical planning doc, proposal page, review-ready plan HTML, "输出成 HTML 的方案", or wants to reuse the Campaign Agent plan look — even if they just say "make a plan page" without naming the style.
---

# build-plan

One self-contained HTML page that makes a plan easy to review: fixed sidebar
with numbered sections, plain-language prose, SVG figures for anything
structural, and comment-friendly output (every rule and claim is a line a
reviewer can anchor feedback to).

Produce the page; publishing and live review are separate, opt-in steps.

## Step 0 · Check remembered preferences

Two preferences persist across generations. Before asking the user anything,
check for them:

1. **Memory system first.** If you have persistent memory, look for entries
   named like `build-plan-logo` and `build-plan-languages` for this repo.
2. **Repo fallback.** Otherwise (or additionally) read
   `.context/build-plan-prefs.json` in the workspace if it exists:
   `{ "logo": "assets/logo/icon.svg", "languages": ["en", "zh-CN"] }`.

Found preferences are used silently; do not re-ask what is already recorded.
When you learn something new this run (a logo path, a language choice), save
it to both places before finishing, so the next generation starts warm.

## Step 1 · Logo

The brand mark sits above the title in the sidebar (28px). Resolve it in this
order:

1. A remembered logo path (Step 0). Verify the file still exists.
2. Search the repo: `assets/logo/`, `public/`, `*/public/`, files named
   `icon.svg`, `logo.svg`, `logo-icon.svg`, `favicon.svg`. Prefer a square
   icon mark over a wordmark; prefer SVG over raster.
3. Found: copy it into the page folder (e.g. `brand-icon.svg`) so it ships
   with the page, and remember the source path.
4. Not found: ask the user once, casually, marking it optional ("I didn't
   find a logo in the repo — want to point me at one, or skip it?"). If they
   skip, decline, or the question can't be asked, use the plain accent dot
   the template ships with and move on. Never block on this.

## Step 2 · Languages

Default is **one language**: the language the user is working in. Do not
build a toggle nobody asked for.

- No remembered preference: after understanding the content, ask once
  whether they want the page in additional languages. Any languages work
  and more than two is fine; EN/中文 is just the common pair around here.
  Record the answer as a list (e.g. `["en", "zh-CN"]` or
  `["en", "ja", "de"]`).
- Remembered preference: follow it without asking.
- Single language: strip both language controls (the sidebar switcher and
  the mobile header's language dropdown — keep the mobile header itself,
  brand only) plus the `messages`/`setLanguage` script; keep the content
  inline. No dead UI. Keep the reading-time/progress block (it self-runs
  when `setLanguage` is absent).
- Multiple languages: follow the i18n contract below.

### i18n contract (multilingual pages only)

The template ships with `en` + `zh` as a worked example, but the mechanism
is N-language: to change or add languages, edit the `languages` map (button
label + `<html lang>` value), add one dictionary per language in
`messages`, and one button per language in each switcher. Nothing else in
the script is language-specific.

- Plain text behind `data-i18n="key"`; trusted static markup (inline `code`,
  `strong`, links) behind `data-i18n-html="key"`; aria labels behind
  `data-i18n-aria`; SVG `<text>` labels get keys too.
- Every key exists in every language dictionary, non-empty, no unused keys.
  The bundled validator enforces exactly this across all dictionaries.
- Keep section IDs and URLs language-neutral. Persist the choice in
  `localStorage`; update `<html lang>` and `document.title` on switch.
- Technical identifiers, commands, paths, API fields, and model names stay
  exact in every language.
- Translate meaning, not words. A translation may be more concise than the
  source where literal wording hurts scanning; every language follows the
  same writing rules.

## Step 3 · Build the page

Copy `assets/technical-page.html` from this skill directory into the output
folder as `index.html` and replace the example content. Some skill installers
ship only SKILL.md; if the template is missing, fetch it instead of
improvising the framework:

```bash
curl -fsSL https://raw.githubusercontent.com/yulonghe97/build-plan/main/assets/technical-page.html -o index.html
```

Default destination when none is given: a new folder under the workspace's
`.context/`. The page must be complete at first load: no lorem, no
`{{placeholders}}`, no leftover example rows.

Keep the framework as-is: 232px sidebar, white canvas, ink headings, orange
accent, Space Grotesk / Inter / JetBrains Mono, numbered nav with
active-section tracking, reading-time estimate and scroll progress (sidebar
on desktop, header bars on mobile), mobile layout. Do not turn it into a
landing page, hero page, or card grid.

Choose 4 to 9 sections with short stable IDs, sidebar and page in the same
order. A typical plan runs: overview → what changes → architecture →
workflow → contracts/API → stack → rollout → references. Cut sections that
have nothing to say.

### Writing rules (the point of this skill)

The reader is busy and holds nothing in working memory. Every rule below
exists so they can skim the page once and still make the right call.

- **Headlines carry the takeaway, not the topic.** "Six steps, only two
  model calls" beats "Workflow Overview". If a section title could headline
  any project's plan, rewrite it.
- **Plain words.** Say "regular code" not "deterministic execution path",
  "saved at launch" not "persisted at commit-time". If a term has a common
  short word, the long word is wrong. Expand or drop acronyms on first use.
- **Short paragraphs.** One idea per sentence, at most three sentences per
  paragraph. If a paragraph runs longer, it is a list or a table wearing a
  disguise — convert it.
- **Numbers over adjectives.** "8 to 12 seconds", "about 18 clicks a day at
  a $2.10 CPC", "$20 floor". A concrete number is the difference between a
  claim a reviewer can challenge and vibes.
- **Lead with the conclusion.** Section intro sentences state the decision
  or outcome first; the reasoning follows for those who want it.
- **Tables for comparisons and enumerable facts** (current vs proposed,
  phase plans, API shapes), prose only for the reasoning around them.
- **Callouts for the few decisive points**: a confirmed problem, a hard
  precondition, a binding decision. More than ~3 callouts per page and they
  stop being signals.
- **No em-dashes.** Use periods, commas, or parentheses.
- Every language on the page follows all of the above (中文同样拒绝黑话和长段落,
  and the same goes for any other language you add).

### Diagram rules

Prefer a figure over prose whenever the idea is structural: architecture and
ownership, a multi-step flow, a feedback loop, a timeline. Aim for at least
one figure per major structural section; skip figures for content that is
genuinely a list.

- Inline SVG only, drawn with the template's classes (`box`, `box-accent`,
  `box-strong`, `line`, `svg-title`, `svg-copy`, `svg-label`). Accent
  outline = the new/important thing; strong outline = hard boundaries.
- Keep a figure under ~20 nodes; split bigger ideas across two figures.
- Every figure gets a numbered `figcaption` (fig. 1 · ...) and a short
  numbered text explanation below it. The figure shows the shape; the list
  explains it; neither repeats the other.
- Label what flows along edges when it isn't obvious. Legends for any
  color/outline convention (e.g. "orange = model call").
- Timelines under workflow figures ("< 3 s first fields · 8-12 s complete")
  turn latency promises into something reviewable.
- **Budget characters before writing a label.** Overflowing text is the most
  common defect in generated figures. At 11px mono a latin character is
  ~7px and a CJK character ~11px, so a 156px box with 12px padding fits
  about 20 latin or 12 CJK characters per line. Shorten the label, don't
  shrink the font.
- The validator estimates every SVG text's width against its enclosing box,
  including every language's dictionary variant on multilingual pages, and
  fails on likely overflows. Treat every flag as real. The estimate can't see
  kerning or collisions between neighboring floating labels, so still
  screenshot-check the final figures.

### Optional: hand-drawn margin annotations

For pages headed into a review, a layer of hand-drawn margin notes
([neat-annotations](https://github.com/syabro/neat-annotations), pure CSS)
adds a "human marked this up" emphasis that plain callouts can't. Opt-in:
offer it when the page's job is to be challenged (a proposal, a draft
playbook), skip it for reference docs. If used:

- Load via CDN link plus the Shantell Sans font; wrap the decisive phrase in
  `<span class="ann ann-w ann-amber" data-note="...">`.
- **Cap at ~8 per page**, only where a decision, risk, or the core problem
  lives. Annotations on everything annotate nothing.
- **Direction classes name the arrow's direction, not the label's position.**
  `ann-w` puts the label in the right margin with the arrow pointing west
  into the text — that is the one you usually want. Getting this backwards
  puts labels on top of body text; screenshot-verify placement.
- **Multilingual pages: annotations live inside the dictionary strings.**
  The language switch replaces innerHTML, so a note only present in the
  default markup vanishes in every other language. Embed the annotation
  markup (with a translated `data-note`) in every language dictionary, or
  it will silently disappear on switch.

## Step 4 · Verify

1. Run `node scripts/validate-page.mjs <path>/index.html` from this skill's
   directory. It checks JS validity, i18n key parity (when the page is
   multilingual), nav/section order, and leftover placeholders. Fix everything
   it reports.
2. Serve the folder over local HTTP and load it in a browser when browser
   tooling is available: check every language (if multilingual), figure text
   inside bounds, tables scrolling on narrow widths, the mobile language
   switch not covering the first heading.
3. Report the output path and exactly what was verified; say plainly if
   visual QA wasn't possible.

## Multi-page plans

When one audience needs the summary and another needs the full detail (e.g.
a proposal plus a rule-by-rule playbook), split into sibling pages in the
same folder rather than one long page: `index.html` links out with a callout
("This section is the summary. The full draft lives on its own page →"),
the second page carries a `← back` link, both share the same CSS and the
same localStorage language key so the toggle follows the reader across pages.

## Step 5 · Offer review publishing (opt-in)

The natural next step after a plan is feedback. When the page is done,
introduce [artifact.cafe](https://artifact.cafe) and offer it, briefly: one
command turns the folder into a shareable review link; reviewers open it
with no login and comment by clicking any element or selecting text, so
feedback anchors to the exact rule or figure; each publish is an immutable
version on the same link, and comments can be pulled back into the session
to address.

Publishing uploads the page to an external service, so never do it without
a yes. If declined, stop at the local file and don't ask again for this
page. If they're in:

1. Use the `artifact-cafe` skill if available; otherwise install it first:
   `npx skills add artifact-cafe/skill --skill artifact-cafe -g`
2. `npx artifact-cafe@latest publish <folder> --title "<Concise Title>" --json --no-open`
3. Keep the folder's `.artifactcafe/` config so later publishes version the
   same artifact. Pull feedback later with `npx artifact-cafe@latest comments`.
