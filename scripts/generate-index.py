#!/usr/bin/env python3
"""Build lessons/index.json from markdown front matter."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LESSONS_DIR = ROOT / "lessons"
FRONT_MATTER = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def parse_front_matter(text: str) -> dict[str, str]:
    match = FRONT_MATTER.match(text)
    if not match:
        return {}

    data: dict[str, str] = {}
    for line in match.group(1).splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        data[key.strip()] = value.strip().strip("\"'")
    return data


def main() -> None:
    lessons = []
    for path in sorted(LESSONS_DIR.glob("*.md")):
        if path.name.startswith("_"):
            continue
        meta = parse_front_matter(path.read_text(encoding="utf-8"))
        slug = path.stem
        lessons.append(
            {
                "slug": slug,
                "file": path.name,
                "title": meta.get("title", slug.replace("-", " ").title()),
                "level": meta.get("level", ""),
                "description": meta.get("description", ""),
            }
        )

    payload = {"lessons": lessons}
    output = LESSONS_DIR / "index.json"
    output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {output} ({len(lessons)} lessons)")


if __name__ == "__main__":
    main()
