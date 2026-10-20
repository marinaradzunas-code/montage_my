"""Крупные слова стиля 3 из субтитров импорта.

Берёт public/projects/<композиция>/captions.json (группы по 1–2 слова на
шкале монтажа) и edit-map.json (fps), раскладывает время появления слов внутри
группы пропорционально длине и пишет фразы для src/style3 (тип Phrase).

    python scripts/style3-words.py Video-20261010-120000-ab12 --win "10,тысяч" --pain "странные"

--win/--pain — акцентные слова (результат/боль): крупнее в 1,35 раза и с
маркером. Сравнение без регистра и знаков препинания. Акцентов немного:
1–2 на смысловой блок, только боль или результат.

По умолчанию пишет src/local/<композиция>/words.ts (папка личная, в git не
уходит). Ошибки распознавания правят в копии words-original.json и
пересобирают импорт через --transcript, а не в этом файле.
"""

import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUNCT = re.compile(r"[^\w\-]+", re.UNICODE)


def norm(word):
    return PUNCT.sub("", word.lower())


def split_list(value):
    return {norm(w) for w in (value or "").split(",") if norm(w)}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("composition", help="id композиции = папка в public/projects")
    ap.add_argument("--win", help="акцентные слова-результаты через запятую")
    ap.add_argument("--pain", help="акцентные слова-боли через запятую")
    ap.add_argument("--out", help="куда записать .ts (по умолчанию src/local/<id>/words.ts)")
    args = ap.parse_args()

    project = os.path.join(ROOT, "public", "projects", args.composition)
    captions_path = os.path.join(project, "captions.json")
    if not os.path.exists(captions_path):
        sys.exit(f"Нет {captions_path}: сначала импортируйте видео (scripts/import-video.py).")
    with open(captions_path, encoding="utf-8-sig") as f:
        captions = json.load(f)
    fps = 30.0
    edit_map = os.path.join(project, "edit-map.json")
    if os.path.exists(edit_map):
        with open(edit_map, encoding="utf-8-sig") as f:
            fps = float(json.load(f).get("fps") or fps)

    win, pain = split_list(args.win), split_list(args.pain)
    frame = lambda ms: int(round(ms / 1000 * fps))

    phrases = []
    for i, cap in enumerate(captions):
        words = cap["text"].split()
        if not words:
            continue
        start, end = frame(cap["startMs"]), frame(cap["endMs"])
        nxt = frame(captions[i + 1]["startMs"]) if i + 1 < len(captions) else end
        total = sum(len(w) for w in words)
        tokens, passed = [], 0
        for w in words:
            token = {"t": w, "f": start + int((end - start) * passed / total)}
            key = norm(w)
            if key in win:
                token["tone"] = "win"
            elif key in pain:
                token["tone"] = "pain"
            tokens.append(token)
            passed += len(w)
        phrases.append({"from": start, "to": max(nxt, start + 1), "tokens": tokens})

    out = args.out or os.path.join(ROOT, "src", "local", args.composition, "words.ts")
    out = os.path.abspath(out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    plan_import = os.path.relpath(os.path.join(ROOT, "src", "style3", "plan"), os.path.dirname(out)).replace(os.sep, "/")
    if not plan_import.startswith("."):
        plan_import = "./" + plan_import
    body = ",\n".join("  " + json.dumps(p, ensure_ascii=False) for p in phrases)
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write(
            f"// Сгенерировано scripts/style3-words.py из {args.composition}/captions.json.\n"
            f"// Крупные слова стиля 3, кадры при {fps:g} fps. Акценты — флаги --win/--pain.\n"
            f'import type {{ Phrase }} from "{plan_import}";\n\n'
            f"export const PHRASES: Phrase[] = [\n{body},\n];\n"
        )
    used = sum(1 for p in phrases for t in p["tokens"] if "tone" in t)
    print(f"{out}: {len(phrases)} фраз, акцентов {used}, fps {fps:g}")


if __name__ == "__main__":
    main()
