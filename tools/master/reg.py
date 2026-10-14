import cv2,numpy as np,sys
im={k:cv2.imread(k+'.png',0) for k in ['f1','f2','f3','f4']}
def mask(k):
    h,w=im[k].shape; m=np.full((h,w),255,np.uint8)
    if k!='f4':
        m[:, :480]=0; m[1030:,:]=0; m[:120,1370:]=0
    return m
sift=cv2.SIFT_create(nfeatures=30000,contrastThreshold=0.02)
kd={k:sift.detectAndCompute(v,mask(k)) for k,v in im.items()}
bf=cv2.BFMatcher()
def pair(a,b,ratio=0.8,thr=5):
    ka,da=kd[a];kb,db=kd[b]
    m=bf.knnMatch(da,db,k=2)
    good=[x for x,y in m if x.distance<ratio*y.distance]
    pa=np.float32([ka[g.queryIdx].pt for g in good]);pb=np.float32([kb[g.trainIdx].pt for g in good])
    M,inl=cv2.estimateAffinePartial2D(pa,pb,method=cv2.RANSAC,ransacReprojThreshold=thr,maxIters=50000,confidence=0.999)
    n=int(inl.sum()) if inl is not None else 0
    s=np.hypot(M[0,0],M[1,0]);ang=np.degrees(np.arctan2(M[1,0],M[0,0]))
    P=pa[inl.ravel()==1]
    print(a,'->',b,'good',len(good),'inliers',n,'scale',round(s,4),'rot',round(ang,2),'t',M[:,2].round(1),'spread',P.min(0).round(),P.max(0).round() if n else '')
    np.save(f'M_{a}_{b}.npy',M)
for a,b in [('f1','f2'),('f4','f2'),('f3','f2'),('f3','f4'),('f1','f3')]: pair(a,b)
