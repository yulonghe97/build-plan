# build-plan

An agent skill that turns a plan (build plan, technical design plan, proposal,
playbook) into a polished, self-contained HTML page: fixed sidebar with
numbered sections, plain-language writing rules, inline SVG diagrams, an
optional EN/中文 toggle, your repo's logo, and optional publishing to
[artifact.cafe](https://artifact.cafe) for click-to-comment review.

## Install

```bash
npx skills add yulonghe97/build-plan --skill build-plan -g
```

Drop `-g` for a repo-local install.

## What it does

- **One self-contained `index.html`** in a restrained white/ink/orange style
  (Space Grotesk, Inter, JetBrains Mono), 4 to 9 numbered sections with
  active-section tracking.
- **Plain language enforced**: headlines carry takeaways, short paragraphs,
  numbers over adjectives, no jargon, no em-dashes. Same rules in both
  languages.
- **Diagrams over prose** for anything structural: architecture, flows,
  loops, timelines, drawn as inline SVG with numbered explanations.
- **Remembers your preferences**: found logo path and language choice are
  saved (agent memory plus `.context/build-plan-prefs.json`) so the next
  page starts warm.
- **Single language by default**; bilingual pages get a full i18n contract
  with key parity enforced by `scripts/validate-page.mjs`.
- **Opt-in review publishing** via artifact.cafe: one command, a share link,
  no-login comments anchored to the exact line or figure.

## Layout

```
SKILL.md                     the skill
assets/technical-page.html   canonical page framework (copy, then fill)
scripts/validate-page.mjs    validates i18n parity, nav order, placeholders
evals/evals.json             test prompts used to iterate on the skill
```
