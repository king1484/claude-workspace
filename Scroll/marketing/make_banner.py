import sys, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W,H=2560,1440
SAFE=(507,508,2053,931)
import os
FONTS=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','assets','fonts')+'/'
# usage: [KEEP=x0,y0,x1,y1] python3 make_banner.py DP OUT GUIDES(0/1) SCALE NAME_PX EDGE_FADE HEAD_X,HEAD_Y,HOOD_TOP X DESK_Y
# current banner: KEEP=792,612,892,722 python3 make_banner.py channel_dp.webp channel_banner_2560x1440.jpg 0 0.5 132 120 650,490,125 445 1060
src=Image.open(sys.argv[1]).convert('RGB'); out=sys.argv[2]; guides=len(sys.argv)>3 and sys.argv[3]=='1'
a=np.asarray(src).astype(np.float32)
R,G,B=a[...,0],a[...,1],a[...,2]
V=a.max(-1); gr=G/np.maximum(R,1)
# background = bright-ish amber/brown; character = red / black / white / dark grey
bgness=np.clip((gr-0.40)/0.10,0,1)*np.clip((V-55)/30,0,1)*np.clip((R-B-40)/30,0,1)
alpha=1-bgness
# KEEP=x0,y0,x1,y1 (source px): force opaque where the prop shares the glow's colour (e.g. a pencil)
import os
if os.environ.get('KEEP'):
    x0,y0,x1,y1=[int(v) for v in os.environ['KEEP'].split(',')]
    alpha[y0:y1,x0:x1]=1
al=Image.fromarray((alpha*255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
char=src.convert('RGBA'); char.putalpha(al)
PAD=0
FADE=int(sys.argv[6]) if len(sys.argv)>6 else 0
if FADE:
    ca=np.asarray(char).astype(np.float32)
    xs=np.arange(ca.shape[1])
    ca[...,3]*=np.clip(xs/FADE,0,1)[None,:]**1.3
    ca[...,3]*=np.clip((ca.shape[1]-1-xs)/(FADE*0.6),0,1)[None,:]
    char=Image.fromarray(ca.clip(0,255).astype(np.uint8),'RGBA')

s=float(sys.argv[4]) if len(sys.argv)>4 else 0.64
cw=int(char.width*s); chh=int(char.height*s); char=char.resize((cw,chh),Image.LANCZOS)
HX,HY,TOP=[float(v) for v in (sys.argv[7] if len(sys.argv)>7 else '600,480,150').split(',')]
ox,oy=int(sys.argv[8]) if len(sys.argv)>8 else 440,512-int(TOP*s)
hx,hy=ox+int((HX+PAD)*s),oy+int(HY*s)

yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
d=np.sqrt(((xx-hx)/1.25)**2+(yy-hy)**2)
t=np.clip(d/1600,0,1)[...,None]
c0=np.array([255,206,96.]); c1=np.array([234,158,60.]); c2=np.array([112,64,30.])
k=np.clip(t/0.32,0,1); k2=np.clip((t-0.32)/0.68,0,1)**0.9
bg=(c0*(1-k)+c1*k)*(1-k2)+c2*k2
img=Image.fromarray(bg.clip(0,255).astype(np.uint8)).convert('RGBA')

# rim glow behind the character
glow=char.getchannel('A').filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(26))
gl=Image.new('RGBA',(cw,chh),(255,224,130,0)); gl.putalpha(glow.point(lambda v:int(v*0.85)))
img.alpha_composite(gl,(ox,oy))
img.alpha_composite(char,(ox,oy))

dr=ImageDraw.Draw(img)
# desk in front, hiding the cut-off body (only visible on TV / full banner)
dy=int(sys.argv[9]) if len(sys.argv)>9 else 1090
dr.rectangle((0,dy,W,H),fill=(58,34,22))
dr.rectangle((0,dy,W,dy+14),fill=(122,74,40))
dr.rectangle((0,dy+14,W,dy+22),fill=(44,26,17))
# sketchbook + pencil on the desk, right of the character
dr.polygon([(1240,dy+4),(1760,dy+4),(1800,dy+60),(1200,dy+60)],fill=(236,226,204))
dr.polygon([(1200,dy+60),(1800,dy+60),(1800,dy+74),(1200,dy+74)],fill=(196,184,160))
dr.line([(1860,dy+40),(2160,dy+18)],fill=(232,178,48),width=16)
dr.line([(2160,dy+18),(2190,dy+16)],fill=(60,50,40),width=10)

name=ImageFont.truetype(FONTS+'EBGaramond.ttf',int(sys.argv[5]) if len(sys.argv)>5 else 132)
try: name.set_variation_by_axes([620])
except Exception as e: print('var',e)
tag=ImageFont.truetype(FONTS+'EBGaramond-Italic.ttf',56)
ink=(28,14,8); ink2=(58,26,12)
tx=1150; ny=585
dr.text((tx,ny),'Unsaid Lessons',font=name,fill=ink)
nb=dr.textbbox((tx,ny),'Unsaid Lessons',font=name)
ly=nb[3]+28
dr.rounded_rectangle((tx+4,ly,tx+130,ly+6),radius=3,fill=(176,30,36))
dr.text((tx,ly+26),'The lessons life never says out loud.',font=tag,fill=ink2)
tb=dr.textbbox((tx,ly+26),'The lessons life never says out loud.',font=tag)
print('name',nb,'tag',tb,'head',hx,hy)
img=img.convert('RGB')
g=np.random.default_rng(3).normal(0,4.5,(H,W,1))
img=Image.fromarray((np.asarray(img).astype(np.float32)+g).clip(0,255).astype(np.uint8))
if guides:
    d2=ImageDraw.Draw(img); d2.rectangle(SAFE,outline=(0,255,255),width=4); d2.rectangle((0,508,W-1,931),outline=(255,0,255),width=3)
img.save(out,quality=95)
