import cv2,numpy as np,json
B=json.load(open('../data/blocks.json'))
BODY={'f1':[14,13],'f2':[14,12],'f3':[14]}
TERR={'f1':[10],'f2':[10,6],'f3':[8,6]}
K=lambda n:cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(n,n))
out={}
for plan,blocks in B.items():
    if plan.startswith('_'): continue
    im=cv2.imread(f'{plan}.png'); lab=np.load(f'lab_{plan}.npy')
    body=np.isin(lab,BODY[plan]).astype(np.uint8)*255
    body=cv2.morphologyEx(body,cv2.MORPH_CLOSE,K(7))
    body=cv2.morphologyEx(body,cv2.MORPH_OPEN,K(5))
    vis=im.copy()
    for b in blocks:
        x0,y0,x1,y1=b['box']; n=len(b['stacks'])
        boxm=np.zeros_like(body); boxm[y0:y1,x0:x1]=255
        for e in b.get('exclude',[]): boxm[e[1]:e[3],e[0]:e[2]]=0
        Bm=cv2.bitwise_and(body,boxm)
        ax=0 if b['axis']=='x' else 1
        lo,hi=(x0,x1) if ax==0 else (y0,y1)
        edges=[lo]+b['cuts']+[hi]
        for i,s in enumerate(b['stacks']):
            sl=np.zeros_like(body)
            if ax==0: sl[:,edges[i]:edges[i+1]]=255
            else: sl[edges[i]:edges[i+1],:]=255
            cell=cv2.bitwise_and(Bm,sl)
            cell=cv2.bitwise_and(cv2.morphologyEx(cell,cv2.MORPH_CLOSE,K(13)),sl)
            ff=cell.copy(); h_,w_=ff.shape; m2=np.zeros((h_+2,w_+2),np.uint8); cv2.floodFill(ff,m2,(0,0),255); cell=cv2.bitwise_or(cell,cv2.bitwise_not(ff))
            cs,_=cv2.findContours(cell,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
            cs=[c for c in cs if cv2.contourArea(c)>60]
            if not cs: print('EMPTY',plan,b['block'],s[0]); continue
            big=max(cs,key=cv2.contourArea)
            # orthogonalize: rasterize at 2px and re-trace
            mk=np.zeros_like(body); cv2.drawContours(mk,[big],-1,255,-1)
            poly=cv2.approxPolyDP(big,1.5,True).reshape(-1,2)
            cm=cv2.moments(big); c=[cm['m10']/cm['m00'],cm['m01']/cm['m00']]
            bx,by,bw,bh=cv2.boundingRect(big)
            out.setdefault(plan,[]).append({'units':s,'poly':poly.tolist(),'centre':c,'w':bw if ax==0 else bh,'h':bh if ax==0 else bw,
               'block':(b.get('sub') or [b['block']]*n)[i],'kind':b.get('kind','apt'),'phase':b['phase'],'axis':b['axis'],'area':cv2.contourArea(big)})
            cv2.polylines(vis,[poly.astype(np.int32)],True,(255,0,255),2)
    cv2.imwrite(f'/tmp/claude-0/-home-claude-flamencademoplan/2cca1b0d-73e9-5811-a7d3-fa45c5f8657e/scratchpad/stk_{plan}.png',vis)
json.dump(out,open('stacks_f123.json','w'))
for p,v in out.items(): print(p,len(v),'min area',round(min(x['area'] for x in v)))
