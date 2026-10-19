import { loadLesson, loadLessonIndex } from "./parser.js";

const KNOWN_KEY = "english-known-v1";
const THEME_KEY = "english-theme";
const FACE_KEY = "english-flash-face";
const app = document.querySelector("#app");
const themeButton = document.querySelector("#theme-toggle");

const state = {
  index: [],
  lessons: new Map(),
  route: parseRoute(),
  query: "",
  study: {
    filter: "all",
    shuffled: false,
    face: localStorage.getItem(FACE_KEY) === "meaning" ? "meaning" : "term",
    index: 0,
    flipped: false,
    items: [],
  },
};

function parseRoute() {
  const hash = window.location.hash.replace(/^#/, "") || "/";
  const parts = hash.split("/").filter(Boolean);
  if (parts[0] === "lesson" && parts[1]) {
    return {
      name: parts[2] === "study" ? "study" : "lesson",
      slug: parts[1],
    };
  }
  return { name: "home" };
}

function navigate(path) {
  window.location.hash = path;
}

function readKnown() {
  try {
    return JSON.parse(localStorage.getItem(KNOWN_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeKnown(value) {
  localStorage.setItem(KNOWN_KEY, JSON.stringify(value));
}

function isKnown(slug, id) {
  return Boolean(readKnown()?.[slug]?.[id]);
}

function toggleKnown(slug, id) {
  const known = readKnown();
  known[slug] = known[slug] || {};
  if (known[slug][id]) delete known[slug][id];
  else known[slug][id] = true;
  writeKnown(known);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function searchable(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function ensureLesson(slug) {
  if (state.lessons.has(slug)) return state.lessons.get(slug);
  const meta = state.index.find((lesson) => lesson.slug === slug);
  if (!meta) throw new Error(`No lesson named “${slug}” in lessons/index.json.`);
  const lesson = await loadLesson(meta.file);
  state.lessons.set(slug, lesson);
  return lesson;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  if (themeButton) {
    themeButton.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    themeButton.textContent = theme === "dark" ? "Light" : "Dark";
  }
}

function renderHome() {
  const query = searchable(state.query.trim());
  const lessons = state.index.filter((lesson) => {
    const haystack = searchable(`${lesson.title} ${lesson.description} ${lesson.level}`);
    return haystack.includes(query);
  });

  app.innerHTML = `
    <section class="hero">
      <p class="kicker">Phrasebook</p>
      <h1>Learn English from the phrases you actually write down.</h1>
      <p>Each lesson lives in a markdown file. The site reads those files and turns them into vocabulary, phrases, and flashcards — no database, ready for GitHub Pages.</p>
    </section>
    <div class="toolbar">
      <input class="search" type="search" value="${escapeHtml(state.query)}" placeholder="Search lessons" aria-label="Search lessons">
    </div>
    ${
      lessons.length
        ? `<div class="lesson-grid">${lessons.map(lessonCard).join("")}</div>`
        : `<p class="empty-state">${state.index.length ? "No lessons match that search." : "No lessons yet. Add a markdown file in lessons/ and list it in lessons/index.json."}</p>`
    }
  `;
}

function lessonCard(lesson) {
  const cached = state.lessons.get(lesson.slug);
  const counts = cached
    ? `<span class="count">${plural(cached.words.length, "word")} · ${plural(cached.phrases.length, "phrase")}</span>`
    : "";

  return `
    <a class="lesson-card" href="#/lesson/${encodeURIComponent(lesson.slug)}">
      <div class="badge-row">
        ${lesson.level ? `<span class="badge">${escapeHtml(lesson.level)}</span>` : ""}
        ${counts}
      </div>
      <h2>${escapeHtml(lesson.title)}</h2>
      <p>${escapeHtml(lesson.description || "Open this lesson to study its words and phrases.")}</p>
    </a>
  `;
}

function renderLesson(lesson, tab = "words") {
  const items = tab === "phrases" ? lesson.phrases : lesson.words;
  const heading = tab === "phrases" ? "Phrases" : "Words";

  app.innerHTML = `
    <div class="page-head">
      <div>
        <button class="text-button" data-back type="button">← All lessons</button>
        <p class="kicker">${escapeHtml(lesson.level || "Lesson")}</p>
        <h1>${escapeHtml(lesson.title)}</h1>
        <p>${escapeHtml(lesson.description || "")}</p>
      </div>
      <a class="primary-button" href="#/lesson/${encodeURIComponent(lesson.slug)}/study">Study flashcards</a>
    </div>
    <div class="tabs" role="tablist">
      <button class="tab ${tab === "words" ? "is-active" : ""}" data-tab="words" type="button">Words (${lesson.words.length})</button>
      <button class="tab ${tab === "phrases" ? "is-active" : ""}" data-tab="phrases" type="button">Phrases (${lesson.phrases.length})</button>
    </div>
    <section class="entry-list" aria-label="${heading}">
      ${items.length ? items.map(entryCard).join("") : `<p class="empty-state">No ${heading.toLowerCase()} in this lesson yet.</p>`}
    </section>
  `;
}

function entryCard(item) {
  return `
    <article class="entry-card">
      <div class="meta-row">
        <span class="badge">${item.kind}</span>
        ${item.ipa ? `<span class="ipa">${escapeHtml(item.ipa)}</span>` : ""}
      </div>
      <h3>${escapeHtml(item.term)}</h3>
      ${item.definition ? `<p>${escapeHtml(item.definition)}</p>` : ""}
      ${item.example ? `<p class="example"><span class="field-label">Example</span> ${escapeHtml(item.example)}</p>` : ""}
      ${item.synonyms ? `<p class="notes"><span class="field-label">Synonyms</span> ${escapeHtml(item.synonyms)}</p>` : ""}
      ${item.translation ? `<p class="notes"><span class="field-label">Translation</span> ${escapeHtml(item.translation)}</p>` : ""}
      ${item.breakdown ? `<p class="notes"><span class="field-label">Breakdown</span> ${escapeHtml(item.breakdown)}</p>` : ""}
      ${item.notes ? `<p class="notes">${escapeHtml(item.notes)}</p>` : ""}
    </article>
  `;
}

function studyItems(lesson) {
  const pool =
    state.study.filter === "words"
      ? lesson.words
      : state.study.filter === "phrases"
        ? lesson.phrases
        : lesson.items;
  const items = [...pool];
  if (state.study.shuffled) {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
  }
  return items;
}

function termFace(item) {
  return `
    <span class="flash-kind">${escapeHtml(item.kind)}</span>
    <span class="flash-term">${escapeHtml(item.term)}</span>
    ${item.ipa ? `<span class="ipa">${escapeHtml(item.ipa)}</span>` : ""}
  `;
}

function meaningFace(item) {
  return `
    <span class="flash-kind">Meaning</span>
    <p class="flash-definition">${escapeHtml(item.definition || "No definition yet.")}</p>
    ${item.example ? `<p class="example">${escapeHtml(item.example)}</p>` : ""}
    ${item.synonyms ? `<p class="notes"><span class="field-label">Synonyms</span> ${escapeHtml(item.synonyms)}</p>` : ""}
    ${item.translation ? `<p>${escapeHtml(item.translation)}</p>` : ""}
    ${item.breakdown ? `<p class="notes"><span class="field-label">Breakdown</span> ${escapeHtml(item.breakdown)}</p>` : ""}
    ${item.notes ? `<p class="notes">${escapeHtml(item.notes)}</p>` : ""}
  `;
}

function renderStudy(lesson) {
  const items = state.study.items;
  const total = items.length;
  const current = items[state.study.index];
  const progress = total ? Math.round(((state.study.index + 1) / total) * 100) : 0;
  const known = current ? isKnown(lesson.slug, current.id) : false;
  const meaningFirst = state.study.face === "meaning";

  app.innerHTML = `
    <div class="page-head">
      <div>
        <a class="text-button" href="#/lesson/${encodeURIComponent(lesson.slug)}">← ${escapeHtml(lesson.title)}</a>
        <p class="kicker">Flashcards</p>
        <h1>Study this lesson</h1>
      </div>
    </div>
    <div class="flash-layout">
      <div class="flash-toolbar">
        <div class="tabs" role="group" aria-label="Card filter">
          ${["all", "words", "phrases"]
            .map(
              (filter) =>
                `<button class="tab ${state.study.filter === filter ? "is-active" : ""}" data-filter="${filter}" type="button">${filter[0].toUpperCase() + filter.slice(1)}</button>`
            )
            .join("")}
        </div>
        <div class="flash-actions">
          <button class="ghost-button" data-shuffle type="button">${state.study.shuffled ? "Original order" : "Shuffle"}</button>
        </div>
      </div>
      <div class="tabs" role="group" aria-label="Which side to show first">
        <button class="tab ${meaningFirst ? "" : "is-active"}" data-face="term" type="button">Word first</button>
        <button class="tab ${meaningFirst ? "is-active" : ""}" data-face="meaning" type="button">Meaning first</button>
      </div>
      ${
        current
          ? `
        <div class="progress-wrap">
          <div class="progress-label">
            <span>Card ${state.study.index + 1} of ${total}</span>
            <span>${known ? "Marked known" : "Still learning"}</span>
          </div>
          <div class="progress-bar" aria-hidden="true"><span style="width: ${progress}%"></span></div>
        </div>
        <div class="flash-stage">
          <div class="card-scene">
            <div class="flash-card ${state.study.flipped ? "is-flipped" : ""}" aria-live="polite">
              <div class="flash-face flash-front">
                ${meaningFirst ? meaningFace(current) : termFace(current)}
              </div>
              <div class="flash-face flash-back">
                ${meaningFirst ? termFace(current) : meaningFace(current)}
              </div>
            </div>
          </div>
          <button class="primary-button flip-button" data-flip type="button">${state.study.flipped ? "Flip back" : "Flip"}</button>
        </div>
        <div class="flash-nav">
          <button class="ghost-button" data-prev type="button">Previous</button>
          <button class="ghost-button" data-next type="button">Next</button>
          <button class="ghost-button" data-known type="button">${known ? "Unmark known" : "Mark known"}</button>
        </div>
      `
          : `<p class="empty-state">This lesson has no cards in the current filter.</p>`
      }
    </div>
  `;
}

function renderError(error) {
  app.innerHTML = `
    <div class="error-state">
      <h1>Could not load this page</h1>
      <p>${escapeHtml(error.message)}</p>
      <p>If you opened the files directly, start a local server instead: <code>python3 -m http.server</code></p>
    </div>
  `;
}

async function render() {
  state.route = parseRoute();
  try {
    if (!state.index.length) {
      state.index = await loadLessonIndex();
      await Promise.allSettled(
        state.index.map(async (meta) => {
          const lesson = await loadLesson(meta.file);
          state.lessons.set(meta.slug, lesson);
        })
      );
    }

    if (state.route.name === "home") {
      renderHome();
      return;
    }

    const lesson = await ensureLesson(state.route.slug);
    if (state.route.name === "study") {
      if (!state.study.items.length || state.study.lesson !== lesson.slug) {
        state.study.lesson = lesson.slug;
        state.study.index = 0;
        state.study.flipped = false;
        state.study.items = studyItems(lesson);
      }
      renderStudy(lesson);
      return;
    }

    renderLesson(lesson, state.tab || "words");
  } catch (error) {
    renderError(error);
  }
}

function toggleFlip() {
  state.study.flipped = !state.study.flipped;
  app.querySelector(".flash-card")?.classList.toggle("is-flipped", state.study.flipped);
  const button = app.querySelector("[data-flip]");
  if (button) button.textContent = state.study.flipped ? "Flip back" : "Flip";
}

function moveCard(step) {
  const total = state.study.items.length;
  if (!total) return;
  state.study.index = (state.study.index + step + total) % total;
  state.study.flipped = false;
  const lesson = state.lessons.get(state.route.slug);
  if (lesson) renderStudy(lesson);
}

app.addEventListener("input", (event) => {
  if (event.target.matches(".search")) {
    state.query = event.target.value;
    renderHome();
    event.target.focus();
    event.target.setSelectionRange(state.query.length, state.query.length);
  }
});

app.addEventListener("click", (event) => {
  const back = event.target.closest("[data-back]");
  if (back) {
    navigate("/");
    return;
  }

  const tab = event.target.closest("[data-tab]");
  if (tab) {
    state.tab = tab.dataset.tab;
    const lesson = state.lessons.get(state.route.slug);
    if (lesson) renderLesson(lesson, state.tab);
    return;
  }

  const filter = event.target.closest("[data-filter]");
  if (filter) {
    const lesson = state.lessons.get(state.route.slug);
    state.study.filter = filter.dataset.filter;
    state.study.index = 0;
    state.study.flipped = false;
    state.study.items = studyItems(lesson);
    renderStudy(lesson);
    return;
  }

  const face = event.target.closest("[data-face]");
  if (face) {
    state.study.face = face.dataset.face;
    state.study.flipped = false;
    localStorage.setItem(FACE_KEY, state.study.face);
    const lesson = state.lessons.get(state.route.slug);
    if (lesson) renderStudy(lesson);
    return;
  }

  const shuffle = event.target.closest("[data-shuffle]");
  if (shuffle) {
    const lesson = state.lessons.get(state.route.slug);
    state.study.shuffled = !state.study.shuffled;
    state.study.index = 0;
    state.study.flipped = false;
    state.study.items = studyItems(lesson);
    renderStudy(lesson);
    return;
  }

  const flip = event.target.closest("[data-flip]");
  if (flip) {
    toggleFlip();
    return;
  }

  if (event.target.closest("[data-prev]")) {
    moveCard(-1);
    return;
  }

  if (event.target.closest("[data-next]")) {
    moveCard(1);
    return;
  }

  const known = event.target.closest("[data-known]");
  if (known) {
    const current = state.study.items[state.study.index];
    if (current) toggleKnown(state.route.slug, current.id);
    const lesson = state.lessons.get(state.route.slug);
    if (lesson) renderStudy(lesson);
  }
});

window.addEventListener("keydown", (event) => {
  if (state.route.name !== "study") return;
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  if (event.code === "Space") {
    event.preventDefault();
    toggleFlip();
  }
  if (event.key === "ArrowRight") moveCard(1);
  if (event.key === "ArrowLeft") moveCard(-1);
});

themeButton?.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
});

window.addEventListener("hashchange", () => {
  state.tab = "words";
  state.study.items = [];
  render();
});

applyTheme(localStorage.getItem(THEME_KEY) || "light");
render();
