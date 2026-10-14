import cv2,sys,json,numpy as np
B=json.load(open('../data/blocks.json'))
S='/tmp/claude-0/-home-claude-flamencademoplan/2cca1b0d-73e9-5811-a7d3-fa45c5f8657e/scratchpad/'
plan,blk=sys.argv[1],sys.argv[2]; sc=int(sys.argv[3]) if len(sys.argv)>3 else 4
b=[x for x in B[plan] if x['block']==blk][0]
im=cv2.imread(plan+'.png'); x0,y0,x1,y1=b['box']; pad=4
x0-=pad;y0-=pad;x1+=pad;y1+=pad
c=cv2.resize(im[y0:y1,x0:x1],None,fx=sc,fy=sc,interpolation=cv2.INTER_CUBIC)
if b['axis']=='x':
    c=cv2.copyMakeBorder(c,24,0,0,0,cv2.BORDER_CONSTANT,value=(255,255,255))
    for x in range(x0-x0%5+5,x1,5):
        X=(x-x0)*sc; col=(0,0,255) if x%10==0 else (150,150,255)
        cv2.line(c,(X,24),(X,c.shape[0]),col,1)
        if x%10==0: cv2.putText(c,str(x%1000),(X-10,16),cv2.FONT_HERSHEY_SIMPLEX,0.4,(0,0,200),1)
else:
    c=cv2.copyMakeBorder(c,0,0,44,0,cv2.BORDER_CONSTANT,value=(255,255,255))
    for y in range(y0-y0%5+5,y1,5):
        Y=(y-y0)*sc; col=(0,0,255) if y%10==0 else (150,150,255)
        cv2.line(c,(44,Y),(c.shape[1],Y),col,1)
        if y%10==0: cv2.putText(c,str(y),(2,Y+4),cv2.FONT_HERSHEY_SIMPLEX,0.4,(0,0,200),1)
cv2.imwrite(S+f'ax_{plan}_{blk}.png',c)
print(c.shape)
