#!/usr/bin/env python3
"""Сборка данных навигатора из исходной картинки плана и ручной разметки.

Вход:   data/complex.json   — разметка (стояки, лестницы, сеть дорожек, точки старта…)
        source/plan.jpg     — растровый план (путь задан в complex.json → image.file)
Выход:  data/plan-data.js   — векторные слои + блоки квартир + конфиг для страницы
        export/plan_layers.svg — тот же вектор отдельным файлом со слоями (Inkscape/Figma)
        export/apartments.csv  — реестр квартир (этаж, лестница, доступ, расстояние)

Запуск из корня репозитория:  python tools/build.py
"""
import csv
import heapq
import json
import math
import re
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
CFG = json.loads((ROOT / "data/complex.json").read_text(encoding="utf-8"))

# Фиксированная палитра классов (BGR), подобрана k-means по исходному листу.
# Каждый пиксель относится к ближайшему цвету — результат детерминирован.
PALETTE = {
    "building": (223, 237, 242), "parking": (127, 131, 129), "walk": (177, 202, 205),
    "lawn": (69, 190, 168), "trees": (52, 162, 95), "white": (254, 254, 254),
    "terrace": (142, 174, 180), "pool": (245, 217, 127), "deck": (103, 130, 178),
    "nbwater": (204, 219, 216), "boundary": (27, 38, 110), "gallery": (153, 217, 234),
    "hedge": (61, 128, 129), "road": (232, 230, 227),
}
NAMES = list(PALETTE)


def kernel(n):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (n, n))


def segment(img):
    blur = cv2.medianBlur(img, 5).reshape(-1, 3).astype(np.float32)
    centers = np.array([PALETTE[n] for n in NAMES], np.float32)
    lab = np.empty(blur.shape[0], np.int32)
    for i in range(0, blur.shape[0], 200_000):  # по частям, чтобы не раздувать память
        chunk = blur[i:i + 200_000]
        lab[i:i + 200_000] = ((chunk[:, None, :] - centers[None]) ** 2).sum(2).argmin(1)
    return lab.reshape(img.shape[:2])


def poly_mask(shape, pts):
    m = np.zeros(shape, np.uint8)
    cv2.fillPoly(m, [np.array(pts, np.int32)], 255)
    return m


def to_path(contours, eps, minarea):
    out = []
    for c in contours:
        if abs(cv2.contourArea(c)) < minarea:
            continue
        a = cv2.approxPolyDP(c, eps, True).reshape(-1, 2) if eps else c.reshape(-1, 2)
        if len(a) >= 3:
            out.append("M" + " ".join(f"{x},{y}" for x, y in a) + "Z")
    return "".join(out)


def organic(mask, eps=1.5, minarea=150):
    cs, _ = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    return to_path(cs, eps, minarea)


def ortho(mask, cell=3, minarea=300, smooth=True):
    """Ортогонализация: маска огрубляется до сетки cell×cell — контуры зданий получаются прямоугольными."""
    h, w = mask.shape
    small = cv2.resize((mask > 0).astype(np.float32), (w // cell, h // cell), interpolation=cv2.INTER_AREA)
    s = (small > 0.5).astype(np.uint8) * 255
    if smooth:
        k = np.ones((3, 3), np.uint8)
        s = cv2.morphologyEx(cv2.morphologyEx(s, cv2.MORPH_OPEN, k), cv2.MORPH_CLOSE, k)
    cs, _ = cv2.findContours(s, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    cs = [c * cell for c in cs]
    return to_path(cs, 0, minarea)


def vectorize(img):
    lab = segment(img)
    shape = lab.shape
    m = lambda *names: np.isin(lab, [NAMES.index(n) for n in names]).astype(np.uint8) * 255

    site = poly_mask(shape, CFG["site"])
    zone = poly_mask(shape, CFG["neighbourZone"])

    def clean(mask, close=5, open_=3, clip=site):
        mask = cv2.bitwise_and(mask, clip)
        if close:
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel(close))
        if open_:
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel(open_))
        return mask

    nonwhite = cv2.morphologyEx(255 - m("white"), cv2.MORPH_CLOSE, kernel(9))
    vec = {
        "site": "M" + " ".join(f"{x},{y}" for x, y in CFG["site"]) + "Z",
        "road": organic(clean(m("road"), 7, 5), 1.5, 300),
        "parking": organic(clean(m("parking"), 5, 5), 2.5, 300),
        "walk": organic(clean(m("walk"), 7, 5), 1.5, 200),
        "lawn": organic(clean(m("lawn", "hedge"), 5, 5), 1.5, 150),
        "trees": organic(clean(m("trees"), 3, 5), 1.5, 120),
        "pool": organic(clean(m("pool"), 3, 3), 1, 60),
        "deck": organic(clean(m("deck"), 7, 5), 1.5, 200),
        "bldbody": ortho(clean(m("building", "terrace"), 11, 5), 3, 800),
        "terrace": ortho(clean(m("terrace"), 5, 5), 3, 200),
        "gallery": ortho(clean(m("gallery"), 5, 3), 3, 120, smooth=False),
        "neighbour": organic(cv2.morphologyEx(cv2.bitwise_and(nonwhite, zone), cv2.MORPH_OPEN, kernel(7)), 2, 2000),
        "nbwater": organic(cv2.bitwise_and(cv2.morphologyEx(m("nbwater"), cv2.MORPH_OPEN, kernel(7)), zone), 2, 800),
    }

    body = cv2.morphologyEx(m("building", "terrace"), cv2.MORPH_CLOSE, kernel(11))
    stacks = []
    for s in CFG["stacks"]:
        x0, y0, x1, y1 = s["cut"]
        cut = np.zeros_like(body)
        cut[y0:y1, x0:x1] = 255
        d = ortho(cv2.bitwise_and(body, cut), 3, 400)
        polys = [np.array([[int(v) for v in p.split(",")] for p in poly.split()], np.int32)
                 for poly in re.findall(r"M([^Z]+)Z", d)]
        if not polys:
            raise SystemExit(f"Стояк {s['units'][0]}: в области cut не найдено здание — проверьте координаты")
        big = max(polys, key=lambda p: abs(cv2.contourArea(p)))
        mo = cv2.moments(big)
        _, _, w, h = cv2.boundingRect(big)
        stacks.append({"d": d, "c": [round(mo["m10"] / mo["m00"]), round(mo["m01"] / mo["m00"])], "w": w, "h": h})
    return vec, stacks


# ---------- реестр квартир (та же логика, что в assets/app.js) ----------
def dijkstra(src):
    nodes, adj = CFG["network"]["nodes"], {k: [] for k in CFG["network"]["nodes"]}
    for a, b in CFG["network"]["edges"]:
        w = math.dist(nodes[a], nodes[b])
        adj[a].append((b, w))
        adj[b].append((a, w))
    dist = {k: math.inf for k in nodes}
    dist[src] = 0
    pq = [(0, src)]
    while pq:
        du, u = heapq.heappop(pq)
        if du > dist[u]:
            continue
        for v, w in adj[u]:
            if du + w < dist[v]:
                dist[v] = du + w
                heapq.heappush(pq, (dist[v], v))
    return dist


def apartments(stacks):
    esc = CFG["escaleras"]
    dist = dijkstra(CFG["starts"][0]["node"])
    rows = []
    for s, geo in zip(CFG["stacks"], stacks):
        base = s["building"].split(".")[0]
        key = min((k for k, e in esc.items() if e["building"] == base),
                  key=lambda k: math.dist((esc[k]["x"], esc[k]["y"]), geo["c"]))
        e = esc[key]
        for code in s["units"]:
            mm = re.match(r"^([A-Z])(\d)([a-z]?)-(\d+)$", code)
            floor = int(mm.group(2))
            rows.append({
                "num": int(mm.group(4)), "code": code, "building": s["building"], "floor": floor,
                "stack": re.sub(r"\d", "", s["units"][0]).split("-")[0],
                "stair": f"Escalera {e['n']}" + (" (на плане не подписана)" if e.get("unlabeled") else ""),
                "lift": "не нужен" if floor == 0 else f"у Escalera {e['n']} (предположительно)",
                "access": CFG["access"][s["building"]].replace("{n}", str(e["n"]))
                          + (" (уровень входа)" if floor == 0 else f" → {floor} этаж"),
                "meters": round(dist[e["node"]] * CFG["image"]["metersPerPx"]),
            })
    return sorted(rows, key=lambda r: r["num"])


def layered_svg(vec, stacks):
    W, H = CFG["image"]["width"], CFG["image"]["height"]
    layers = [
        ("neighbour", "Соседний участок", [("neighbour", "#e9ece5"), ("nbwater", "#cfe3ec")]),
        ("site", "Фон участка", [("site", "#f2efe6")]), ("road", "Проезды", [("road", "#d3d6d3")]),
        ("walk", "Пешеходные дорожки", [("walk", "#e9dcbd")]),
        ("lawn", "Озеленение", [("lawn", "#bcd592"), ("trees", "#79a858")]),
        ("pool", "Бассейн", [("deck", "#cdb79b"), ("pool", "#57c1ea")]),
        ("parking", "Парковка", [("parking", "#848985")]),
        ("buildings", "Корпуса и террасы", [("bldbody", "#e7e1d3"), ("terrace", "#d9cfbb")]),
        ("gallery", "Галереи и лестничные ядра", [("gallery", "#efd57c")]),
    ]
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" '
           f'viewBox="0 0 {W} {H}" width="{W}" height="{H}">']
    for gid, name, parts in layers:
        out.append(f'<g id="{gid}" inkscape:groupmode="layer" inkscape:label="{name}">'
                   + "".join(f'<path id="{k}" d="{vec[k]}" fill="{c}" fill-rule="evenodd"/>' for k, c in parts) + "</g>")
    out.append(f'<g id="boundary" inkscape:groupmode="layer" inkscape:label="Граница участка"><path d="{vec["site"]}" '
               'fill="none" stroke="#9a3b2b" stroke-width="2.5" stroke-dasharray="10 6"/></g>')
    out.append('<g id="apartments" inkscape:groupmode="layer" inkscape:label="Квартиры (стояки)">')
    for s, g in zip(CFG["stacks"], stacks):
        top = s["units"][0]
        out.append(f'<g id="stack-{s["building"]}-{top}" data-building="{s["building"]}" data-units="{" ".join(s["units"])}">'
                   f'<path d="{g["d"]}" fill="#fbf8f1" stroke="#8f846f" stroke-width="1.2"/>'
                   f'<text x="{g["c"][0]}" y="{g["c"][1] + 4}" text-anchor="middle" font-family="IBM Plex Mono,monospace" '
                   f'font-size="11">{top}</text></g>')
    out.append("</g></svg>")
    return "".join(out)


def main():
    img = cv2.imread(str(ROOT / CFG["image"]["file"]))
    if img is None:
        raise SystemExit(f"Не найден файл плана: {CFG['image']['file']}")
    if img.shape[1] != CFG["image"]["width"] or img.shape[0] != CFG["image"]["height"]:
        raise SystemExit("Размер картинки не совпадает с image.width/height в complex.json")
    vec, stacks = vectorize(img)

    payload = {"config": CFG, "vector": vec, "stacks": stacks}
    js = ("// Сгенерировано tools/build.py — не редактируйте вручную, правьте data/complex.json\n"
          "window.ZHK=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n")
    (ROOT / "data/plan-data.js").write_text(js, encoding="utf-8")

    (ROOT / "export").mkdir(exist_ok=True)
    (ROOT / "export/plan_layers.svg").write_text(layered_svg(vec, stacks), encoding="utf-8")

    rows = apartments(stacks)
    head = {"num": "№", "code": "Код", "building": "Корпус", "floor": "Этаж", "stack": "Стояк", "stair": "Лестница",
            "lift": "Лифт", "access": "Как пройти", "meters": "От входа, м"}
    with open(ROOT / "export/apartments.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(head), delimiter=";")
        w.writerow(head)
        w.writerows(rows)

    print(f"OK: {len(stacks)} стояков, {len(rows)} квартир, plan-data.js {len(js) // 1024} КБ")


if __name__ == "__main__":
    main()
