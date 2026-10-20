"""Проверка кадров импортированного ролика до выдачи.

    .venv\\Scripts\\python.exe scripts\\check-frames.py <композиция>

Рисует кадры в out/check/<композиция>/ (середина и края каждой сцены, лицо
между сценами) и проверяет то, что глазом легко пропустить:

  1. Камера закрывает свою зону целиком — нет пустых полос по бокам и сверху
     (так выглядел contain для телефонного видео в нижней половине 50/50).
  2. Графика сцены стоит в безопасной рамке: не выше Y=250, не ниже субтитра,
     и собрана вокруг середины зоны, а не прижата к верху.
  3. Субтитры в 50/50 стоят на границе половин (Y=960), в обычном кадре —
     на Y из профиля. Проверяется по коду композиции.

Итог — отчёт в консоли и contact sheet out/check/<композиция>/sheet.png с
безопасной рамкой и линией 960 поверх кадров. Код выхода 1, если что-то не так.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
BACKGROUND = 17          # #111 под композицией: так выглядит «ничего»
SAFE_TOP, SAFE_LEFT, SAFE_RIGHT = 234, 72, 1016


def load(ident):
    folder = ROOT / "public" / "projects" / ident
    code_file = ROOT / "src" / "generated" / f"{ident}.tsx"
    if not folder.is_dir() or not code_file.is_file():
        sys.exit(f"Нет импортированной композиции {ident}")
    edit = json.loads((folder / "edit-map.json").read_text(encoding="utf-8"))
    review = json.loads((folder / "review.json").read_text(encoding="utf-8"))
    profile = json.loads((folder / "profile.json").read_text(encoding="utf-8"))
    registry = json.loads((ROOT / "src/generated/registry.json").read_text(encoding="utf-8-sig"))
    entry = next(e for e in registry if e["id"] == ident)
    return edit, review, profile, entry, code_file.read_text(encoding="utf-8")


def pick_frames(total, fps, scenes):
    """Кадры: каждая сцена — вход, середина, конец; лицо — середина промежутков."""
    marks = []
    for s in scenes:
        a, b = round(s["start"] * fps), round(s["end"] * fps)
        marks += [("scene", min(b - 1, a + round(0.5 * fps))), ("scene", (a + b) // 2), ("scene", max(a, b - round(0.25 * fps)))]
    cursor = 0
    for s in scenes + [{"start": total / fps, "end": total / fps}]:
        a = round(s["start"] * fps)
        if a - cursor > fps:
            marks.append(("camera", (cursor + a) // 2))
        cursor = round(s["end"] * fps)
    return sorted(set(marks), key=lambda m: m[1])


def empty_bars(img, top, bottom):
    """Стороны зоны камеры, где вместо видео ровный фон."""
    zone = img[top:bottom].astype(np.float32)
    strips = {"слева": zone[:, :6], "справа": zone[:, -6:], "сверху": zone[:6], "снизу": zone[-6:]}
    found = []
    for side, strip in strips.items():
        if abs(float(strip.mean()) - BACKGROUND) < 6 and float(strip.std()) < 3:
            found.append(side)
    return found


def graphic_box(img, bottom=895):
    """Где в верхней зоне стоит содержимое сцены: яркие пиксели, не фон."""
    gray = img[:bottom].mean(axis=2)
    mask = gray > 100
    rows = np.where(mask.sum(axis=1) > 3)[0]
    cols = np.where(mask.sum(axis=0) > 3)[0]
    if not len(rows) or not len(cols):
        return None
    return int(cols[0]), int(rows[0]), int(cols[-1]), int(rows[-1])


def caption_positions(code):
    """Какие Y у субтитров в коде: для 50/50 и для обычного кадра."""
    flat = re.sub(r"\s+", "", code)
    block = flat.split('name="Субтитры', 1)[-1].split("</Sequence>", 1)[0]
    tops = re.findall(r"top:active&&fullScreenExplanation\?(\d+):split\?(\d+):(\d+)", block)
    count = len(re.findall(r"<Interactive\.Div", block))
    return count, tops


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    ident = sys.argv[1]
    edit, review, profile, entry, code = load(ident)
    fps = edit["fps"]
    total = sum(k["frames"] for k in edit["kept"])
    scenes = review.get("visualScenes", [])
    full_explanation = bool(entry.get("props", {}).get("fullScreenExplanation"))
    marks = pick_frames(total, fps, scenes)
    out = ROOT / "out" / "check" / ident
    for old in out.glob("frame-*.png"):
        old.unlink()
    print(f"Рисую {len(marks)} кадров…", flush=True)
    subprocess.run(["node", str(ROOT / "scripts/render-frames.cjs"), ident, str(out), *[str(f) for _, f in marks]],
                   check=True, cwd=ROOT)
    import cv2

    problems = []
    tiles = []
    for kind, frame in marks:
        img = cv2.imread(str(out / f"frame-{frame:05d}.png"))[:, :, ::-1]
        t = f"{frame / fps:5.2f} с (кадр {frame})"
        split = kind == "scene" and not full_explanation
        if kind == "camera" or split:
            top = 960 if split else 0
            bars = empty_bars(img, top, 1920)
            if bars:
                problems.append(f"{t}: пустая полоса у камеры ({', '.join(bars)}) — видео не закрывает зону")
        if split:
            box = graphic_box(img)
            if box is None:
                problems.append(f"{t}: в верхней половине нет графики")
            else:
                x0, y0, x1, y1 = box
                centre = (y0 + y1) / 2
                note = f"графика X {x0}–{x1}, Y {y0}–{y1}, центр {centre:.0f}"
                if y0 < SAFE_TOP + 16:
                    problems.append(f"{t}: {note} — вылезает к верхней рамке (нужно ниже {SAFE_TOP + 16})")
                elif x0 < SAFE_LEFT + 16 or x1 > SAFE_RIGHT - 16:
                    problems.append(f"{t}: {note} — выходит за боковую рамку")
                elif not 500 <= centre <= 680 and y1 - y0 > 120:
                    problems.append(f"{t}: {note} — сцена прижата {'к верху' if centre < 500 else 'к субтитру'}")
                else:
                    print(f"  {t}: {note}")
        tile = img.copy()
        cv2.rectangle(tile, (72, 234), (1016, 1348), (255, 157, 36), 3)
        cv2.line(tile, (0, 960), (1080, 960), (55, 217, 223), 2)
        tiles.append(cv2.resize(tile, (270, 480)))
    count, tops = caption_positions(code)
    split_y = profile.get("splitCaptionY", 960)
    if count and (len(tops) != count or any(int(s) != split_y for _, s, _ in tops)):
        problems.append(f"субтитры: у {count - sum(int(s) == split_y for _, s, _ in tops)} из {count} в 50/50 не Y={split_y}")
    else:
        print(f"  субтитры: {count} шт., в 50/50 Y={split_y}")
    rows = [np.hstack(tiles[i:i + 6] + [np.zeros((480, 270, 3), np.uint8)] * (6 - len(tiles[i:i + 6])))
            for i in range(0, len(tiles), 6)]
    cv2.imwrite(str(out / "sheet.png"), np.vstack(rows)[:, :, ::-1])
    print(f"Кадры: {out}\\sheet.png")
    if problems:
        print("НЕ ГОТОВО:")
        for p in problems:
            print("  - " + p)
        sys.exit(1)
    print("Кадры в порядке.")


if __name__ == "__main__":
    main()
