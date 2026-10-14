import cv2,numpy as np,json,math,heapq
from skimage.morphology import skeletonize
lab=np.load('lab_master.npy'); site=np.load('site_mask.npy'); M=json.load(open('model.json'))
H,W=lab.shape
K=lambda n:cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(n,n))
m=lambda *ids:np.isin(lab,ids).astype(np.uint8)*255
walk=m(15,7,16)              # дорожки, настилы у бассейнов, галереи
road=m(17,14)                # проезды (по ним тоже можно идти)
walkable=cv2.bitwise_or(walk,road)
siteD=cv2.dilate(site,K(41))
walkable=cv2.bitwise_and(walkable,siteD)
walkable=cv2.morphologyEx(walkable,cv2.MORPH_CLOSE,K(9))
walkable=cv2.morphologyEx(walkable,cv2.MORPH_OPEN,K(7))
# зданиям нельзя: вычесть корпуса (кроме галерей)
body=cv2.morphologyEx(m(18),cv2.MORPH_CLOSE,K(7))
walkable[(body>0)&(m(16)==0)]=0
# оставить крупные связные области
n,cc,st,_=cv2.connectedComponentsWithStats(walkable,8)
keep=np.zeros_like(walkable)
for i in range(1,n):
    if st[i,4]>4000: keep[cc==i]=255
np.save('walkable.npy',keep)
sk=skeletonize(keep>0)
ys,xs=np.nonzero(sk); idx=-np.ones((H,W),np.int32); idx[ys,xs]=np.arange(len(xs))
pts=np.c_[xs,ys]
# пиксельный граф 8-связности
nb=[(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]
adj=[[] for _ in range(len(xs))]
for k,(x,y) in enumerate(pts):
    for dx,dy in nb:
        X,Y=x+dx,y+dy
        if 0<=X<W and 0<=Y<H and idx[Y,X]>=0: adj[k].append(idx[Y,X])
deg=np.array([len(a) for a in adj])
# узлы: развилки, концы, и каждые ~30 px вдоль цепочек
key=set(np.nonzero(deg!=2)[0].tolist())
visited=set(); edges=[]
def walk_chain(a,b):
    chain=[a,b]; prev,cur=a,b
    while cur not in key:
        nxt=[c for c in adj[cur] if c!=prev]
        if not nxt: break
        prev,cur=cur,nxt[0]; chain.append(cur)
        if cur==a: break
    return chain
for a in key:
    for b in adj[a]:
        if (a,b) in visited: continue
        ch=walk_chain(a,b)
        for i in range(len(ch)-1): visited.add((ch[i],ch[i+1])); visited.add((ch[i+1],ch[i]))
        edges.append(ch)
# isolated loops without key nodes are ignored
nodes={}; E=[]
def nid(p):
    p=int(p)
    if p not in nodes: nodes[p]=len(nodes)
    return nodes[p]
for ch in edges:
    if len(ch)<2: continue
    sel=[ch[0]]; acc=0
    for i in range(1,len(ch)):
        acc+=math.dist(pts[ch[i]],pts[ch[i-1]])
        if acc>=30 or i==len(ch)-1: sel.append(ch[i]); acc=0
    for a,b in zip(sel,sel[1:]):
        if a!=b: E.append((nid(a),nid(b)))
NP=np.zeros((len(nodes),2))
for p,i in nodes.items(): NP[i]=pts[p]
# слить близкие узлы (< 6 px)
E=list({tuple(sorted(e)) for e in E if e[0]!=e[1]})
print('nodes',len(NP),'edges',len(E))
json.dump({'nodes':np.round(NP).astype(int).tolist(),'edges':E},open('graph_raw.json','w'))
v=cv2.cvtColor((keep//3+170).astype(np.uint8),cv2.COLOR_GRAY2BGR)
for a,b in E: cv2.line(v,tuple(map(int,NP[a])),tuple(map(int,NP[b])),(200,60,20),2)
for s in M['stairs']: cv2.circle(v,(int(s['x']),int(s['y'])),9,(0,140,0),-1)
cv2.imwrite('/tmp/claude-0/-home-claude-flamencademoplan/2cca1b0d-73e9-5811-a7d3-fa45c5f8657e/scratchpad/graph.png',cv2.resize(v,(W*2//5,H*2//5),interpolation=cv2.INTER_AREA))
