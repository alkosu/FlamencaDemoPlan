import cv2,sys
# usage: rcrop.py img x0,y0,x1,y1 rot(0/90/180/270 = rotate clockwise by) out [scale]
im=cv2.imread(sys.argv[1]); x0,y0,x1,y1=map(int,sys.argv[2].split(',')); rot=int(sys.argv[3]); s=float(sys.argv[5]) if len(sys.argv)>5 else 3
c=cv2.resize(im[y0:y1,x0:x1],None,fx=s,fy=s,interpolation=cv2.INTER_CUBIC)
R={0:None,90:cv2.ROTATE_90_CLOCKWISE,180:cv2.ROTATE_180,270:cv2.ROTATE_90_COUNTERCLOCKWISE}[rot]
if R is not None: c=cv2.rotate(c,R)
cv2.imwrite(sys.argv[4],c)
