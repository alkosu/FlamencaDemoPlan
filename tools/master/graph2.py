import json,math,numpy as np,heapq
from collections import defaultdict
G=json.load(open('graph_raw.json')); M=json.load(open('model.json'))
P=[tuple(p) for p in G['nodes']]; adj=defaultdict(set)
for a,b in G['edges']: adj[a].add(b); adj[b].add(a)
d=lambda a,b:math.dist(P[a],P[b])
# 1) срезать короткие тупики (шпоры скелета) — несколько проходов
for it in range(6):
    removed=0
    for n in list(adj):
        if len(adj[n])==1:
            # пройти по цепочке до развилки
            chain=[n]; prev=None; cur=n; L=0
            while len(adj[cur])<=2:
                nx=[x for x in adj[cur] if x!=prev]
                if not nx: break
                L+=d(cur,nx[0]); prev,cur=cur,nx[0]; chain.append(cur)
                if len(adj[cur])>2 or L>45: break
            if len(adj[cur])>2 and L<=45:
                for x in chain[:-1]:
                    for y in list(adj[x]): adj[y].discard(x)
                    adj.pop(x,None)
                removed+=1
    if not removed: break
alive=sorted(k for k in adj if adj[k])
# 2) компоненты
comp={};cid=0
for s in alive:
    if s in comp: continue
    st=[s];comp[s]=cid
    while st:
        u=st.pop()
        for v in adj[u]:
            if v not in comp: comp[v]=cid; st.append(v)
    cid+=1
size=defaultdict(int)
for k,c in comp.items(): size[c]+=1
main=max(size,key=size.get)
# 3) соединить компоненты с главной, если зазор < 70 px
arr=np.array([P[k] for k in alive]); ids=np.array(alive); cs=np.array([comp[k] for k in alive])
changed=True
while changed:
    changed=False
    for c in sorted(set(cs.tolist())):
        if c==main: continue
        mi=cs==c; mo=cs!=c
        A=arr[mi]; B=arr[mo]
        D=((A[:,None,:]-B[None])**2).sum(2)
        i,j=np.unravel_index(D.argmin(),D.shape)
        if D[i,j]<70**2:
            a=ids[mi][i]; b=ids[mo][j]; adj[a].add(b); adj[b].add(a)
            tgt=cs[mo][j]; cs[cs==c]=tgt
            if c==main or tgt==main: main=tgt if c==main else main
            changed=True; break
keepset={k for k,c in zip(ids,cs) if c==main}
print('alive',len(alive),'main comp',len(keepset),'dropped',len(alive)-len(keepset))
# 4) перенумерация
order=sorted(keepset); newid={k:i for i,k in enumerate(order)}
nodes=[list(P[k]) for k in order]
edges=sorted({tuple(sorted((newid[a],newid[b]))) for a in order for b in adj[a] if b in keepset})
NP=np.array(nodes,float)
def attach(x,y):
    D=((NP-[x,y])**2).sum(1); i=int(D.argmin()); return i,math.sqrt(D[i])
stairs=[]
for s in M['stairs']:
    i,dist=attach(s['x'],s['y']); stairs.append({'id':s['id'],'node':i,'gap':round(dist,1)})
print('stair gaps',sorted([(s['gap'],s['id']) for s in stairs])[-6:])
json.dump({'nodes':nodes,'edges':[list(e) for e in edges],'stairs':stairs},open('graph.json','w'))
print('nodes',len(nodes),'edges',len(edges))
