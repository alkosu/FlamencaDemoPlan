"""Сеть дорожек (graph.json после graph2.py) → полилинии между развилками для правки в QGIS.
Концы полилиний — общие вершины, поэтому топология сохраняется точно."""
import json, numpy as np, cv2
from collections import defaultdict
G = json.load(open('graph.json')); P = G['nodes']
adj = defaultdict(set)
for a, b in G['edges']: adj[a].add(b); adj[b].add(a)
key = {n for n in adj if len(adj[n]) != 2}
for s in G['stairs']: key.add(s['node'])          # узлы лестниц тоже делают «развилку»
seen, out = set(), []
def chain(a, b):
    line = [a, b]
    while line[-1] not in key:
        nx = [x for x in adj[line[-1]] if x != line[-2]]
        if not nx: break
        line.append(nx[0])
        if line[-1] == line[0]: break
    return line
for a in sorted(key):
    for b in sorted(adj[a]):
        if (a, b) in seen: continue
        ln = chain(a, b)
        for u, v in zip(ln, ln[1:]): seen.add((u, v)); seen.add((v, u))
        pts = np.array([P[i] for i in ln], np.float32)
        s = cv2.approxPolyDP(pts.reshape(-1, 1, 2), 1.5, False).reshape(-1, 2) if len(pts) > 2 else pts
        out.append([[float(x), float(y)] for x, y in s])
# изолированные кольца без развилок
for a in adj:
    for b in adj[a]:
        if (a, b) not in seen:
            ln = chain(a, b); [seen.update({(u, v), (v, u)}) for u, v in zip(ln, ln[1:])]
            out.append([[float(P[i][0]), float(P[i][1])] for i in ln])
out = [l for l in out if len({tuple(p) for p in l}) >= 2]
json.dump(out, open('paths.json', 'w'))
print('lines', len(out), 'vertices', sum(map(len, out)))
