# English phrasebook

A static English-learning site for GitHub Pages. You write lessons in markdown; the website parses those files and shows words, phrases, and flashcards. There is no backend or database.

## Add a lesson

1. Copy `lessons/_template.md` to a new file, for example `lessons/04-shopping.md`.
2. Fill in the front matter and the **Words** / **Phrases** sections.
3. Add the file to `lessons/index.json`, or run:

```bash
python3 scripts/generate-index.py
```

Files that start with `_` are ignored, so the template will not show up as a lesson.

### Lesson format

```markdown
---
title: At the shops
level: A2
description: Ask for sizes, prices, and bags.
---

## Words

### receipt
**Definition:** The paper that proves what you bought and how much you paid.
**Example:** Could I have a receipt, please?
**IPA:** /rɪˈsiːt/
**Notes:** Optional extra tip.
**Translation:** Optional translation into your language.

## Phrases

### How much is this?
**Definition:** A direct question about the price of something in front of you.
**Example:** Excuse me, how much is this jacket?
```

You can also write tables if that is faster:

```markdown
## Words

| Word | Definition | Example | IPA |
| --- | --- | --- | --- |
| cheap | low in price | This café is cheap and good. | /tʃiːp/ |
```

## Preview locally

The browser cannot load markdown files from `file://`, so serve the folder:

```bash
python3 -m http.server
```

Then open [http://127.0.0.1:8000](http://127.0.0.1:8000).

## GitHub Pages

1. Push this repository to GitHub.
2. In **Settings → Pages**, set the source to **GitHub Actions**.
3. The workflow in `.github/workflows/pages.yml` rebuilds `lessons/index.json` and publishes the site.

If you deploy from the `main` branch instead of Actions, keep `lessons/index.json` up to date yourself.

## Flashcards

Each lesson has a **Study flashcards** view. The front of a card is the word or phrase; the back is the definition, example, and any notes. Progress of cards marked **known** is stored in your browser, not on a server.
# en-
