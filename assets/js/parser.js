const FRONT_MATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
const FIELD_ALIASES = {
  definition: ["definition", "meaning"],
  example: ["example", "examples"],
  ipa: ["ipa", "pronunciation"],
  translation: ["translation"],
  synonyms: ["synonyms", "synonym", "alternatives", "alternative"],
  breakdown: ["breakdown", "break down", "unpack"],
  notes: ["notes", "note", "tip"],
};

function parseFrontMatter(markdown) {
  const match = markdown.match(FRONT_MATTER_RE);
  if (!match) {
    return { meta: {}, body: markdown.trim() };
  }

  const meta = {};
  for (const line of match[1].split("\n")) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key) meta[key] = value;
  }

  return { meta, body: markdown.slice(match[0].length).trim() };
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function splitSections(body) {
  const sections = { words: "", phrases: "", extra: "" };
  const chunks = body.split(/^##\s+/m).filter(Boolean);

  for (const chunk of chunks) {
    const newline = chunk.indexOf("\n");
    const heading = (newline === -1 ? chunk : chunk.slice(0, newline)).trim().toLowerCase();
    const content = newline === -1 ? "" : chunk.slice(newline + 1).trim();

    if (/^(words?|vocabulary|vocab)$/.test(heading)) {
      sections.words += (sections.words ? "\n\n" : "") + content;
    } else if (/^phrases?$/.test(heading)) {
      sections.phrases += (sections.phrases ? "\n\n" : "") + content;
    } else {
      sections.extra += (sections.extra ? "\n\n" : "") + `## ${heading}\n${content}`;
    }
  }

  return sections;
}

function parseTable(section) {
  const lines = section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));

  if (lines.length < 2) return null;

  const splitRow = (line) =>
    line
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => stripMarkdown(cell.trim()));

  const headers = splitRow(lines[0]).map((header) => header.toLowerCase());
  const divider = lines[1];
  if (!/^\|?\s*:?-{3,}/.test(divider)) return null;

  const termKey = headers.find((header) =>
    ["word", "phrase", "term", "expression"].includes(header)
  );
  if (!termKey) return null;

  const rows = [];
  for (const line of lines.slice(2)) {
    const cells = splitRow(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] || "";
    });
    const term = row[termKey];
    if (!term) continue;
    rows.push({
      term,
      definition: row.definition || row.meaning || "",
      example: row.example || row.examples || "",
      ipa: row.ipa || row.pronunciation || "",
      translation: row.translation || "",
      synonyms: row.synonyms || row.synonym || row.alternatives || row.alternative || "",
      breakdown: row.breakdown || row.unpack || "",
      notes: row.notes || row.note || row.tip || "",
    });
  }

  return rows;
}

function parseLabeledFields(block) {
  const fields = {};
  const leftover = [];
  const lines = block.split("\n");
  let currentField = null;

  for (const line of lines) {
    const labeled = line.match(/^\*\*([^*]+)\*\*\s*:?\s*(.*)$/);
    if (labeled) {
      const label = labeled[1].trim().toLowerCase().replace(/:$/, "");
      const value = stripMarkdown(labeled[2] || "");
      let matched = false;
      for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
        if (aliases.includes(label)) {
          fields[field] = value;
          currentField = field;
          matched = true;
          break;
        }
      }
      if (!matched) {
        currentField = null;
        if (value) leftover.push(value);
      }
      continue;
    }

    if (currentField && line.trim()) {
      const extra = stripMarkdown(line);
      fields[currentField] = [fields[currentField], extra].filter(Boolean).join(" ");
      continue;
    }

    leftover.push(line);
    if (line.trim()) currentField = null;
  }

  const untitled = leftover.join("\n").trim();
  if (!fields.definition && untitled) {
    fields.definition = stripMarkdown(untitled.split(/\n\n/)[0]);
  }

  return fields;
}

function parseHeadingEntries(section) {
  const chunks = section.split(/^###\s+/m).filter(Boolean);
  const entries = [];

  for (const chunk of chunks) {
    const newline = chunk.indexOf("\n");
    const term = stripMarkdown((newline === -1 ? chunk : chunk.slice(0, newline)).trim());
    if (!term) continue;
    const body = newline === -1 ? "" : chunk.slice(newline + 1).trim();
    const fields = parseLabeledFields(body);
    entries.push({
      term,
      definition: fields.definition || "",
      example: fields.example || "",
      ipa: fields.ipa || "",
      translation: fields.translation || "",
      synonyms: fields.synonyms || "",
      breakdown: fields.breakdown || "",
      notes: fields.notes || "",
    });
  }

  return entries;
}

function parseEntries(section, kind) {
  if (!section.trim()) return [];
  const fromTable = parseTable(section);
  const raw = fromTable && fromTable.length ? fromTable : parseHeadingEntries(section);

  return raw.map((entry, index) => ({
    ...entry,
    kind,
    id: `${kind}:${slugify(entry.term) || index + 1}`,
  }));
}

export function parseLessonMarkdown(markdown, fileName) {
  const { meta, body } = parseFrontMatter(markdown);
  const slug = fileName.replace(/\.md$/i, "");
  const sections = splitSections(body);
  const words = parseEntries(sections.words, "word");
  const phrases = parseEntries(sections.phrases, "phrase");

  return {
    slug,
    file: fileName,
    title: meta.title || slug.replace(/-/g, " "),
    level: meta.level || "",
    description: meta.description || "",
    words,
    phrases,
    items: [...words, ...phrases],
  };
}

export async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load ${url} (${response.status})`);
  }
  return response.text();
}

export async function loadLessonIndex() {
  const response = await fetch("lessons/index.json");
  if (!response.ok) {
    throw new Error("Could not load lessons/index.json");
  }
  const data = await response.json();
  return Array.isArray(data.lessons) ? data.lessons : [];
}

export async function loadLesson(fileName) {
  const markdown = await fetchText(`lessons/${fileName}`);
  return parseLessonMarkdown(markdown, fileName);
}
