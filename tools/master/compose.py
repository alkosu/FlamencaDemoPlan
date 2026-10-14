import cv2,numpy as np,json
A=lambda M:np.vstack([M,[0,0,1]])
I=np.eye(3)[:2]
M2={'f2':I,'f1':np.load('M_f1_f2.npy'),'f3':np.load('M_f3_f2.npy'),'f4':np.load('M_f4_f2.npy')}
K=1/0.5888577300993532
S=np.array([[K,0,0],[0,K,0],[0,0,1]])
# map content area (exclude legends/titles) per plan, in plan px
AREA={'f1':[[480,20],[1370,20],[1370,130],[1580,130],[1580,1060],[480,1060]],
      'f2':[[480,20],[1370,20],[1370,130],[1580,130],[1580,1060],[480,1060]],
      'f3':[[430,20],[1370,20],[1370,140],[1580,140],[1580,1000],[430,1000]],
      'f4':[[0,0],[1540,0],[1540,1048],[0,1048]]}
pts=[]
for k,M in M2.items():
    G=(S@A(M))
    P=np.array(AREA[k],float); Q=(np.c_[P,np.ones(len(P))]@G.T)[:,:2]; pts.append(Q)
allp=np.vstack(pts); x0,y0=np.floor(allp.min(0))-20; x1,y1=np.ceil(allp.max(0))+20
T=np.array([[1,0,-x0],[0,1,-y0],[0,0,1]])
W,H=int(x1-x0),int(y1-y0); print('global size',W,H)
GM={k:(T@S@A(M))[:2] for k,M in M2.items()}
json.dump({'size':[W,H],'M':{k:v.tolist() for k,v in GM.items()},'area':AREA},open('global.json','w'),indent=1)
