import sys
from PIL import Image, ImageDraw
def g(src,box,out,step=20,scale=2):
    im=Image.open(src).convert('RGB').crop(box); im=im.resize((im.width*scale,im.height*scale),Image.LANCZOS)
    d=ImageDraw.Draw(im); x0,y0=box[:2]
    for x in range((x0//step+1)*step,box[2],step):
        X=(x-x0)*scale; d.line([(X,0),(X,im.height)],fill=(255,0,0) if x%100==0 else (255,170,170),width=1)
        if x%100==0: d.text((X+2,2),str(x),fill=(200,0,0))
    for y in range((y0//step+1)*step,box[3],step):
        Y=(y-y0)*scale; d.line([(0,Y),(im.width,Y)],fill=(255,0,0) if y%100==0 else (255,170,170),width=1)
        if y%100==0: d.text((2,Y+2),str(y),fill=(200,0,0))
    im.save(out)
if __name__=='__main__':
    a=sys.argv; g(a[1],tuple(map(int,a[2].split(','))),a[3],int(a[4]) if len(a)>4 else 20,int(a[5]) if len(a)>5 else 2)
