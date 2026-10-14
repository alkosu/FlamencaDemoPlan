#!/usr/bin/env python3
"""Сборка данных навигатора из сводной модели комплекса.

Вход:   data/complex.json        — настройки: заголовок, языки, точки старта
        data/master/model.json   — стояки (контуры, коды квартир), лестницы, объекты легенды
        data/master/vector.json  — векторные слои территории
        data/qgis/flamenca.gpkg  — правки из QGIS: дорожки, лестницы, точки старта, лифты, щиты воды
                                   (если файла нет — дорожки берутся из data/master/paths.json)
Выход:  data/plan-data.js        — всё для страницы (window.ZHK)
        export/plan_layers.svg   — сводный план со слоями (в т.ч. по этажам) для Inkscape/Figma
        export/apartments.csv    — перечень апартаментов и помещений

Только стандартная библиотека Python. Запуск из корня: python tools/build.py
"""
import csv, html, json, math, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
rd = lambda p: json.loads((ROOT / p).read_text(encoding="utf-8"))
CFG, MODEL, VEC = rd("data/complex.json"), rd("data/master/model.json"), rd("data/master/vector.json")
W, H = MODEL["size"]
S = 0.1                       # метров на пиксель; в QGIS: X = px·S, Y = −py·S
GPKG = ROOT / "data/qgis/flamenca.gpkg"
NODES, EDGES = [], []


# ---------- чтение GeoPackage без GDAL ----------
def _wkb(buf, o=0):
    import struct
    bo = "<" if buf[o] == 1 else ">"
    t = struct.unpack_from(bo + "I", buf, o + 1)[0]; o += 5
    dims = 3 if (t // 1000) in (1, 2) or t & 0x80000000 else 2
    if (t // 1000) == 3: dims = 4
    t = (t & 0xFFFF) % 1000
    pt = lambda o: (struct.unpack_from(bo + "dd", buf, o), o + 8 * dims)
    if t == 1:
        p, o = pt(o); return ("Point", p), o
    if t == 2:
        n = struct.unpack_from(bo + "I", buf, o)[0]; o += 4; pts = []
        for _ in range(n):
            p, o = pt(o); pts.append(p)
        return ("LineString", pts), o
    if t == 3:
        rings = []; n = struct.unpack_from(bo + "I", buf, o)[0]; o += 4
        for _ in range(n):
            k = struct.unpack_from(bo + "I", buf, o)[0]; o += 4; r = []
            for _ in range(k):
                p, o = pt(o); r.append(p)
            rings.append(r)
        return ("Polygon", rings), o
    if t in (4, 5, 6):
        n = struct.unpack_from(bo + "I", buf, o)[0]; o += 4; parts = []
        for _ in range(n):
            g, o = _wkb(buf, o); parts.append(g)
        return ("Multi", parts), o
    raise ValueError(f"WKB type {t}")


def read_gpkg(layer):
    """Строки слоя: список (геометрия, dict атрибутов). Пустой список, если слоя нет."""
    import sqlite3
    if not GPKG.exists(): return []
    con = sqlite3.connect(GPKG)
    try:
        r = con.execute("select column_name from gpkg_geometry_columns where table_name=?", (layer,)).fetchone()
        if not r: return []
        gcol = r[0]; cur = con.execute(f'select * from "{layer}"'); cols = [c[0] for c in cur.description]; out = []
        for row in cur:
            rec = dict(zip(cols, row)); blob = rec.pop(gcol)
            if not blob: continue
            flags = blob[3]; env = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[(flags >> 1) & 7]
            geom, _ = _wkb(blob, 8 + env); out.append((geom, rec))
        return out
    finally:
        con.close()


to_px = lambda p: (p[0] / S, -p[1] / S)


def lines_of(g):
    if g[0] == "LineString": return [g[1]]
    if g[0] == "Multi": return [x for part in g[1] for x in lines_of(part)]
    return []


def load_paths():
    """Полилинии дорожек в пикселях плана: из QGIS, иначе из автосети."""
    rows = read_gpkg("paths")
    if rows:
        out = []
        for g, a in rows:
            if str(a.get("access") or "").lower() == "closed": continue
            out += [[to_px(p) for p in l] for l in lines_of(g)]
        return out, "QGIS"
    return rd("data/master/paths.json"), "автосеть"


def graph_from_lines(lines, snap=3.0, tsnap=20.0):
    """Узлы — вершины (совпадающие в пределах snap px сливаются), рёбра — сегменты.
    Висячие концы ближе tsnap px к чужому сегменту врезаются в него (T-образные примыкания)."""
    grid = {}
    def node(p):
        gx, gy = int(p[0] // snap), int(p[1] // snap)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for i in grid.get((gx + dx, gy + dy), []):
                    if math.dist(NODES[i], p) <= snap: return i
        NODES.append([round(p[0], 1), round(p[1], 1)]); grid.setdefault((gx, gy), []).append(len(NODES) - 1); return len(NODES) - 1
    es = set()
    for l in lines:
        ids = [node(p) for p in l]
        for a, b in zip(ids, ids[1:]):
            if a != b: es.add((min(a, b), max(a, b)))
    deg = {}
    for a, b in es: deg[a] = deg.get(a, 0) + 1; deg[b] = deg.get(b, 0) + 1
    for n in [n for n, d in deg.items() if d == 1]:
        px, py = NODES[n]; best = None
        for a, b in es:
            if n in (a, b): continue
            (ax, ay), (bx, by) = NODES[a], NODES[b]; dx, dy = bx - ax, by - ay; L2 = dx * dx + dy * dy
            if not L2: continue
            t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L2)); qx, qy = ax + t * dx, ay + t * dy; d = math.hypot(px - qx, py - qy)
            if d <= tsnap and (best is None or d < best[0]): best = (d, a, b, t, qx, qy)
        if best:
            d, a, b, t, qx, qy = best
            if t <= 0.01: es.add((min(n, a), max(n, a)))
            elif t >= 0.99: es.add((min(n, b), max(n, b)))
            else:
                NODES.append([round(qx, 1), round(qy, 1)]); m = len(NODES) - 1
                es.discard((a, b)); es |= {(min(a, m), max(a, m)), (min(m, b), max(m, b)), (min(n, m), max(n, m))}
    # оторванные куски: пришить к основной сети, если зазор < bridge px
    bridge = 80.0; added = 0
    while True:
        adj = {}
        for a, b in es: adj.setdefault(a, []).append(b); adj.setdefault(b, []).append(a)
        comp = {}
        for s0 in adj:
            if s0 in comp: continue
            comp[s0] = s0; st = [s0]
            while st:
                u = st.pop()
                for v in adj[u]:
                    if v not in comp: comp[v] = s0; st.append(v)
        groups = {}
        for n, c in comp.items(): groups.setdefault(c, []).append(n)
        if len(groups) == 1: break
        done = False
        for g in sorted(groups.values(), key=len)[:-1]:   # от мелких кусков к крупным
            gs = set(g); others = [n for n in comp if n not in gs]
            best = min(((math.dist(NODES[a], NODES[b]), a, b) for a in g for b in others), default=None)
            if best and best[0] < bridge:
                es.add((min(best[1], best[2]), max(best[1], best[2]))); added += 1; done = True; break
        if not done: break
    if added: print(f"Пришито оторванных участков: {added} (зазор < {bridge * S:.0f} м)")
    EDGES.extend([list(e) for e in sorted(es)])


def nearest_node(x, y):
    return min(range(len(NODES)), key=lambda i: (NODES[i][0] - x) ** 2 + (NODES[i][1] - y) ** 2)


def poly_d(P):
    return "M" + " ".join(f"{x:.0f},{y:.0f}" for x, y in P) + "Z"


def add_extra_paths():
    """Ручные отрезки из complex.json → новые узлы и рёбра сети."""
    for line in CFG.get("extraPaths", {}).get("paths", []):
        ends = [nearest_node(*line[0]), nearest_node(*line[-1])]
        ids = []
        for x, y in line:
            NODES.append([round(x), round(y)]); ids.append(len(NODES) - 1)
        EDGES.append([ends[0], ids[0]]); EDGES.append([ids[-1], ends[1]])
        EDGES.extend([a, b] for a, b in zip(ids, ids[1:]))


def build():
    lines, src = load_paths()
    graph_from_lines(lines)
    if src != "QGIS":  # в QGIS-файле ручные отрезки уже лежат слоем paths
        add_extra_paths()
    print(f"Дорожки: {src}, {len(lines)} линий")
    pos = {a["id"]: to_px(g[1]) for g, a in read_gpkg("stairs") if g[0] == "Point"}
    stairs = []
    for s in MODEL["stairs"]:
        x, y = pos.get(s["id"], (s["x"], s["y"]))
        stairs.append({"id": s["id"], "group": s["group"], "n": s["n"], "x": round(x), "y": round(y), "node": nearest_node(x, y)})
    stacks = []
    for s in MODEL["stacks"]:
        xs = [p[0] for p in s["poly"]]; ys = [p[1] for p in s["poly"]]
        w, h = max(xs) - min(xs), max(ys) - min(ys)
        stacks.append({"block": s["block"], "phase": s["phase"], "kind": s["kind"], "units": s["units"], "stair": s["stair"],
                       "d": poly_d(s["poly"]), "c": [round(v) for v in s["c"]], "box": [round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys))],
                       "w": round(min(w, h)), "axis": "x" if w >= h else "y"})
    # соседи: квартира и два ближайших стояка того же корпуса (по оси корпуса)
    by_block = {}
    for i, s in enumerate(stacks):
        by_block.setdefault(s["block"], []).append(i)
    for b, idx in by_block.items():
        xs = [stacks[i]["c"][0] for i in idx]; ys = [stacks[i]["c"][1] for i in idx]
        ax = 0 if (max(xs) - min(xs)) >= (max(ys) - min(ys)) else 1
        idx.sort(key=lambda i: stacks[i]["c"][ax])
        for k, i in enumerate(idx):
            st = max(0, min(k - 1, len(idx) - 3))
            stacks[i]["near"] = idx[st:st + 3]
    badges = []
    for b, idx in by_block.items():
        x0 = min(stacks[i]["box"][0] for i in idx); y0 = min(stacks[i]["box"][1] for i in idx)
        x1 = max(stacks[i]["box"][2] for i in idx); y1 = max(stacks[i]["box"][3] for i in idx)
        badges.append([b, round((x0 + x1) / 2), round((y0 + y1) / 2)])
    units = [{"num": u["num"], "code": u["code"], "floor": u["floor"], "kind": u["kind"], "stack": u["stack"]} for u in MODEL["units"]]
    starts = CFG["starts"]
    q = read_gpkg("starts")
    if q:
        starts = [{"id": a["id"], "x": round(to_px(g[1])[0]), "y": round(to_px(g[1])[1]),
                   "name": {l: a.get("name_" + l) or a["id"] for l in CFG["languages"]}} for g, a in q if g[0] == "Point"]
    starts = [{**s, "node": nearest_node(s["x"], s["y"])} for s in starts]
    pt = lambda layer: [{**{k: v for k, v in a.items() if k != "fid"}, "x": round(to_px(g[1])[0]), "y": round(to_px(g[1])[1])}
                        for g, a in read_gpkg(layer) if g[0] == "Point" and a.get("id") != "EXAMPLE"]
    lifts, water = pt("lifts"), pt("water_panels")
    payload = {"config": CFG, "size": [W, H], "metersPerPx": MODEL["metersPerPx"], "vector": VEC, "stacks": stacks, "stairs": stairs,
               "units": units, "pois": MODEL["pois"], "legend": MODEL["legend"], "badges": badges, "starts": starts,
               "graph": {"nodes": NODES, "edges": EDGES}, "lifts": lifts, "water": water}
    js = ("// Сгенерировано tools/build.py — не редактируйте вручную\nwindow.ZHK=" +
          json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n")
    (ROOT / "data/plan-data.js").write_text(js, encoding="utf-8")
    return payload, len(js)


def export_svg(P):
    L = lambda gid, name, body, vis=True: (f'<g id="{gid}" inkscape:groupmode="layer" inkscape:label="{name}"'
                                           f'{"" if vis else " style=&quot;display:none&quot;".replace("&quot;", chr(34))}>{body}</g>')
    path = lambda d, fill, extra="": f'<path d="{d}" fill="{fill}" fill-rule="evenodd"{extra}/>'
    V = P["vector"]
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
           '<style>text{font-family:"IBM Plex Mono",monospace}</style>',
           L("raster", "Исходные планы (подложка)", f'<image href="../source/master.jpg" width="{W}" height="{H}" opacity="0.6"/>', False),
           L("road", "Проезды", path(V["road"], "#d3d6d3")), L("walk", "Пешеходные дорожки", path(V["walk"], "#e9dcbd")),
           L("lawn", "Озеленение", path(V["lawn"], "#bcd592") + path(V["trees"], "#79a858")),
           L("pool", "Бассейны и пляжи", path(V["deck"], "#cdb79b") + path(V["pool"], "#57c1ea", ' stroke="#2e95c2" stroke-width="1.5"')),
           L("parking", "Парковка", path(V["parking"], "#848985")),
           L("buildings", "Корпуса и террасы", path(V["bldbody"], "#e7e1d3", ' stroke="#a99d86" stroke-width="1"') + path(V["terrace"], "#d9cfbb")),
           L("gallery", "Галереи и лестничные ядра", path(V["gallery"], "#efd57c", ' stroke="#c9a93f" stroke-width=".8"'))]
    unit_by_stack = {}
    for u in P["units"]:
        unit_by_stack.setdefault(u["stack"], {})[u["floor"]] = u
    for f in range(4):
        g = []
        for i, s in enumerate(P["stacks"]):
            u = unit_by_stack[i].get(f)
            if not u: continue
            lab = str(u["num"]) if u["kind"] == "apt" else u["code"].split(":")[1]
            g.append(f'<g id="u-{html.escape(u["code"])}" data-block="{s["block"]}" data-stair="{s["stair"] or ""}">'
                     f'<path d="{s["d"]}" fill="{"#e6eefb" if s["kind"] == "apt" else "#f3e4f2"}" stroke="#57627a" stroke-width="1.4"/>'
                     f'<text x="{s["c"][0]}" y="{s["c"][1] + 6}" text-anchor="middle" font-size="17">{html.escape(lab)}</text></g>')
        out.append(L(f"floor{f}", "Этаж 0 (planta baja)" if f == 0 else f"Этаж {f}", "".join(g), f == 0))
    out.append(L("stairs", "Лестницы", "".join(
        f'<g><rect x="{s["x"] - 10}" y="{s["y"] - 10}" width="20" height="20" rx="4" fill="#2f7a4d" stroke="#fff" stroke-width="2"/>'
        f'<text x="{s["x"]}" y="{s["y"] + 4}" text-anchor="middle" font-size="11" fill="#fff" font-weight="700">E{s["n"]}</text>'
        f'<title>Escalera {s["n"]} · корпус {s["group"]}</title></g>' for s in P["stairs"])))
    out.append(L("lifts", "Лифты (условно, у лестниц)", "".join(
        f'<g><rect x="{s["x"] + 11}" y="{s["y"] - 9}" width="16" height="18" rx="2" fill="#1f4fd1" stroke="#fff" stroke-width="2"/>'
        f'<text x="{s["x"] + 19}" y="{s["y"] + 4}" text-anchor="middle" font-size="10" fill="#fff" font-weight="700">L</text></g>' for s in P["stairs"])))
    out.append(L("pois", "Объекты инфраструктуры", "".join(
        f'<g><circle cx="{q["x"]}" cy="{q["y"]}" r="13" fill="#fff" stroke="#3a3f3b" stroke-width="1.5"/>'
        f'<text x="{q["x"]}" y="{q["y"] + 4}" text-anchor="middle" font-size="{11 if len(q["code"]) < 3 else 9}" fill="#3a3f3b">{q["code"]}</text>'
        f'<title>{q["code"]} — {html.escape(P["legend"].get(q["code"], {}).get("ru", ""))}</title></g>' for q in P["pois"])))
    out.append(L("blocks", "Номера корпусов", "".join(
        f'<g><rect x="{x - 24}" y="{y - 15}" width="48" height="30" rx="15" fill="#2b2f2c" stroke="#fff" stroke-width="2.5"/>'
        f'<text x="{x}" y="{y + 6}" text-anchor="middle" font-size="16" fill="#fff" font-family="IBM Plex Sans,sans-serif">{b}</text></g>' for b, x, y in P["badges"])))
    out.append("</svg>")
    (ROOT / "export").mkdir(exist_ok=True)
    (ROOT / "export/plan_layers.svg").write_text("".join(out), encoding="utf-8")


def export_csv(P):
    stair = {s["id"]: s for s in P["stairs"]}
    rows = sorted(MODEL["units"], key=lambda u: (u["kind"] != "apt", u["num"] if u["kind"] == "apt" else int(u["num"][1:])))
    with open(ROOT / "export/apartments.csv", "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh, delimiter=";")
        w.writerow(["№", "Код", "Тип", "Фаза", "Корпус", "Этаж", "Лестница", "Лифт (предп.)"])
        for u in rows:
            s = stair.get(u["stair"])
            w.writerow([u["num"], u["code"], "апартамент" if u["kind"] == "apt" else "коммерческое помещение",
                        u["phase"] if u["phase"] < 4 else "корпуса 14–17", u["block"], u["floor"],
                        f"Escalera {s['n']} ({s['id']})" if s else "—",
                        ("не нужен" if u["floor"] == 0 else f"у Escalera {s['n']}") if s else "—"])


if __name__ == "__main__":
    P, size = build()
    export_svg(P); export_csv(P)
    apts = sum(1 for u in P["units"] if u["kind"] == "apt")
    print(f"OK: {len(P['stacks'])} стояков, {apts} апартаментов, {len(P['units']) - apts} помещений, "
          f"{len(P['stairs'])} лестниц, {len(P['lifts'])} лифтов, {len(P['water'])} щитов воды, граф {len(P['graph']['nodes'])} узлов; plan-data.js {size // 1024} КБ")
