import cv2,numpy as np,json
J=json.load(open('global.json')); W,H=J['size']
def tf(k,P): M=np.array(J['M'][k]); P=np.asarray(P,float); return P@M[:,:2].T+M[:,2]
order_in=['f4','f3','f2','f1']; order_out=['f1','f2','f3','f4']
out=np.full((H,W,3),255,np.uint8); done=np.zeros((H,W),bool)
warped={}
for k in order_out:
    im=cv2.imread(f'{k}.png'); M=np.array(J['M'][k])
    a=np.zeros(im.shape[:2],np.uint8); cv2.fillPoly(a,[np.array(J['area'][k],np.int32)],255)
    warped[k]=(cv2.warpAffine(im,M,(W,H),flags=cv2.INTER_CUBIC,borderValue=(255,255,255)),cv2.warpAffine(a,M,(W,H),flags=cv2.INTER_NEAREST)>0)
polys={}
for k in order_in:
    P=tf(k,np.load(f'sitepoly_{k}.npy')); polys[k]=P
    m=np.zeros((H,W),np.uint8); cv2.fillPoly(m,[np.round(P).astype(np.int32)],255)
    m=cv2.dilate(m,np.ones((7,7),np.uint8))>0
    sel=m&~done&warped[k][1]; out[sel]=warped[k][0][sel]; done|=sel
for k in order_out:
    sel=~done&warped[k][1]; out[sel]=warped[k][0][sel]; done|=sel
cv2.imwrite('master.png',out); cv2.imwrite('master.jpg',out,[cv2.IMWRITE_JPEG_QUALITY,88])
json.dump({k:np.round(v,1).tolist() for k,v in polys.items()},open('phase_polys.json','w'))
cv2.imwrite('/tmp/claude-0/-home-claude-flamencademoplan/2cca1b0d-73e9-5811-a7d3-fa45c5f8657e/scratchpad/master_s.png',cv2.resize(out,(W*2//5,H*2//5),interpolation=cv2.INTER_AREA))
print(W,H)
