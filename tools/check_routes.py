#!/usr/bin/env python3
"""Проверка сети: от каждой точки старта достижимы все лестницы. Печатает длины маршрутов.
Запуск после python tools/build.py:  python tools/check_routes.py"""
import heapq, json, math, sys
from pathlib import Path
js = (Path(__file__).resolve().parent.parent / "data/plan-data.js").read_text(encoding="utf-8")
Z = json.loads(js[js.index("=") + 1:].strip().rstrip(";"))
N = Z["graph"]["nodes"]; adj = [[] for _ in N]
for a, b in Z["graph"]["edges"]:
    w = math.dist(N[a], N[b]); adj[a].append((b, w)); adj[b].append((a, w))
bad = 0
for sp in Z["starts"]:
    d = [math.inf] * len(N); d[sp["node"]] = 0; h = [(0, sp["node"])]
    while h:
        du, u = heapq.heappop(h)
        if du > d[u]: continue
        for v, w in adj[u]:
            if du + w < d[v]: d[v] = du + w; heapq.heappush(h, (d[v], v))
    miss = [s["id"] for s in Z["stairs"] if d[s["node"]] == math.inf]
    far = max((s for s in Z["stairs"] if d[s["node"]] < math.inf), key=lambda s: d[s["node"]])
    print(f"{sp['id']:8} → самая дальняя {far['id']:7} {d[far['node']] * Z['metersPerPx']:5.0f} м" + (f"  НЕДОСТИЖИМЫ: {', '.join(miss)}" if miss else ""))
    bad += len(miss)
sys.exit(1 if bad else 0)
