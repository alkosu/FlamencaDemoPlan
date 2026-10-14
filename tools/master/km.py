import cv2,numpy as np,json,sys
J=json.load(open('global.json'))
k=sys.argv[1]; K=int(sys.argv[2]) if len(sys.argv)>2 else 16
im=cv2.imread(k+'.png'); b=cv2.medianBlur(im,3)
m=np.zeros(im.shape[:2],np.uint8); cv2.fillPoly(m,[np.array(J['area'][k],np.int32)],255)
Z=b[m>0].reshape(-1,3).astype(np.float32)
crit=(cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER,30,0.5)
cv2.setRNGSeed(1)
_,_,cen=cv2.kmeans(Z[::5],K,None,crit,4,cv2.KMEANS_PP_CENTERS)
cen=cen[np.argsort(cen.sum(1))]
np.save(f'cen_{k}.npy',cen)
lab=((b.reshape(-1,1,3).astype(np.float32)-cen[None])**2).sum(2).argmin(1).reshape(im.shape[:2])
np.save(f'lab_{k}.npy',lab.astype(np.uint8))
rng=np.random.RandomState(3); pal=rng.randint(0,255,(K,3)).astype(np.uint8)
# sheet: each cluster mask small
tiles=[]
for i in range(K):
    t=cv2.resize(((lab==i)*255).astype(np.uint8),(400,283)); t=cv2.cvtColor(t,cv2.COLOR_GRAY2BGR)
    sw=np.zeros((283,40,3),np.uint8); sw[:]=cen[i]
    cv2.putText(t,f'{i} {tuple(int(v) for v in cen[i][::-1])}',(5,20),cv2.FONT_HERSHEY_SIMPLEX,0.5,(0,0,255),1)
    tiles.append(np.hstack([sw,t]))
rows=[np.hstack(tiles[j:j+4]) for j in range(0,K,4)]
cv2.imwrite(f'/tmp/claude-0/-home-claude-flamencademoplan/2cca1b0d-73e9-5811-a7d3-fa45c5f8657e/scratchpad/km_{k}.png',np.vstack(rows))
print([tuple(int(v) for v in c[::-1]) for c in cen])
