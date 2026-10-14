import cv2,numpy as np,json
lab=np.load('lab_master.npy'); site=np.load('site_mask.npy')
K=lambda n:cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(n,n))
m=lambda *ids:np.isin(lab,ids).astype(np.uint8)*255
def clean(x,close=5,open_=3):
    x=cv2.bitwise_and(x,site)
    if close: x=cv2.morphologyEx(x,cv2.MORPH_CLOSE,K(close))
    if open_: x=cv2.morphologyEx(x,cv2.MORPH_OPEN,K(open_))
    return x
def to_path(cs,eps,minarea,scale=1):
    out=[]
    for c in cs:
        if abs(cv2.contourArea(c))*scale*scale<minarea: continue
        a=(cv2.approxPolyDP(c,eps,True).reshape(-1,2) if eps else c.reshape(-1,2))*scale
        if len(a)>=3: out.append('M'+' '.join(f'{int(x)},{int(y)}' for x,y in a)+'Z')
    return ''.join(out)
def organic(x,eps=2,minarea=300):
    cs,_=cv2.findContours(x,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE); return to_path(cs,eps,minarea)
def ortho(x,cell=4,minarea=600,smooth=True):
    h,w=x.shape; s=cv2.resize((x>0).astype(np.float32),(w//cell,h//cell),interpolation=cv2.INTER_AREA); s=(s>0.5).astype(np.uint8)*255
    if smooth:
        k=np.ones((3,3),np.uint8); s=cv2.morphologyEx(cv2.morphologyEx(s,cv2.MORPH_OPEN,k),cv2.MORPH_CLOSE,k)
    cs,_=cv2.findContours(s,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE); return to_path(cs,0,minarea,cell)
body=clean(m(18),9,5)
terr=cv2.bitwise_and(clean(m(12,9),5,3),cv2.dilate(body,K(41)))
V={}
V['road']=organic(clean(m(17,14),9,7),2.5,1500)
V['parking']=organic(clean(m(6),5,5),2,500)
V['walk']=organic(clean(m(15),7,5),2,400)
V['lawn']=organic(clean(m(5,8,4),5,5),2,300)
V['trees']=organic(clean(m(1,3),3,5),2,150)
V['deck']=organic(clean(m(7),7,5),2,300)
V['pool']=organic(clean(m(11,13),3,3),1.5,80)
V['bldbody']=ortho(cv2.bitwise_or(body,terr),4,1500)
V['terrace']=ortho(terr,4,300)
V['gallery']=ortho(clean(m(16),5,3),3,150,False)
json.dump(V,open('vec_master.json','w'))
for k,v in V.items(): print(k,len(v))
