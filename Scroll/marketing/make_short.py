import subprocess, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import tempfile
T=tempfile.mkdtemp()
SRC='/home/user/claude-workspace/Scroll/out/SCROLL_final_1080p.mp4'
F='/home/user/claude-workspace/Scroll/assets/fonts/'
OUT='/home/user/claude-workspace/Scroll/out/SCROLL_short_1080x1920.mp4'
W,H=1080,1920; SQ_Y=500; BG='0x0a0d16'
# Builds the vertical Short from the film master: python3 make_short.py
# (film start, film end, crop x, caption or None)
SEG=[(39.6,42.4,380,'11:43 PM. "Just one video."'),
     (42.4,44.8,300,None),
     (52.3,57.3,420,'One more.'),
     (45.5,50.5,468,'Every swipe pulls a lever.'),
     (62.5,67.0,420,'The feed never ends.'),
     (81.0,86.5,630,'Hours disappear.'),
     (109.5,113.0,420,None),
     (142.0,147.0,840,'So he gave it a bottom.'),
     (170.3,172.6,420,None),
     (176.6,181.0,380,None),
     (184.6,187.8,700,'Phone across the room.'),
     (202.0,205.0,200,None)]
END=4.6; END_AUDIO=215.0
def font(name,size,wght=None):
    f=ImageFont.truetype(F+name,size)
    if wght:
        try: f.set_variation_by_axes([wght])
        except Exception as e: print('var',e)
    return f
def textpng(path,lines,fnt,fill=(255,255,255,255),spacing=14,shadow=True):
    tmp=Image.new('RGBA',(W,10)); d=ImageDraw.Draw(tmp)
    hs=[d.textbbox((0,0),l,font=fnt) for l in lines]
    h=sum(b[3]-b[1] for b in hs)+spacing*(len(lines)-1)+40
    im=Image.new('RGBA',(W,h),(0,0,0,0)); d=ImageDraw.Draw(im); y=20
    for l,b in zip(lines,hs):
        w=b[2]-b[0]; d.text(((W-w)//2-b[0],y-b[1]),l,font=fnt,fill=fill); y+=b[3]-b[1]+spacing
    if shadow:
        sh=Image.new('RGBA',im.size,(0,0,0,0)); sh.putalpha(im.getchannel('A').filter(ImageFilter.GaussianBlur(8)).point(lambda v:int(v*0.6)))
        base=Image.new('RGBA',im.size,(0,0,0,0)); base.alpha_composite(sh); base.alpha_composite(im); im=base
    im.save(path); return h
# texts
title=font('EBGaramond.ttf',76,640)
cap=font('EBGaramond-Italic.ttf',68,500)
endf=font('EBGaramond-Italic.ttf',72,500)
endb=font('EBGaramond-Italic.ttf',96,560)
brand=font('Inter.ttf',30,600)
textpng(T+'/title.png',["Why you can't stop","scrolling at night"],title,spacing=10)
textpng(T+'/brand.png',['UNSAID LESSONS'],brand,fill=(255,214,140,235),shadow=False)
textpng(T+'/end1.png',['The feed has no bottom.'],endf)
textpng(T+'/end2.png',['Build one.'],endb,fill=(244,220,206,255))
# timeline
inputs=[]; fc=[]; vl=[]; t=0; caps=[]
for i,(a,b,x,c) in enumerate(SEG):
    d=b-a; inputs+=['-ss',f'{a}','-t',f'{d}','-i',SRC]
    fc.append(f'[{i}:v]crop=1080:1080:{x}:0,setsar=1,fps=30,format=yuv420p[v{i}]')
    fc.append(f'[{i}:a]aresample=48000,afade=t=in:d=0.06,afade=t=out:st={d-0.08:.3f}:d=0.08[a{i}]')
    if c: caps.append((c,t,t+d))
    t+=d
n=len(SEG)
inputs+=['-ss',f'{END_AUDIO}','-t',f'{END}','-i',SRC]
fc.append(f'color=c={BG}:s=1080x1080:r=30:d={END},format=yuv420p,setsar=1[v{n}]')
fc.append(f'[{n}:a]aresample=48000,afade=t=in:d=0.06,afade=t=out:st={END-0.6}:d=0.6[a{n}]')
endt=t; t+=END
# merge consecutive identical captions
merged=[]
for c in caps:
    if merged and merged[-1][0]==c[0] and abs(merged[-1][2]-c[1])<1e-6: merged[-1]=(c[0],merged[-1][1],c[2])
    else: merged.append(c)
# a caption spanning segs 0-1
merged=[(c,a,(b if c!='11:43 PM. "Just one video."' else SEG[1][1]-SEG[0][0])) for c,a,b in merged]
fc.append(''.join(f'[v{i}][a{i}]' for i in range(n+1))+f'concat=n={n+1}:v=1:a=1[vc][ac]')
fc.append(f'[vc]pad={W}:{H}:0:{SQ_Y}:color={BG}[base]')
# overlays
ov=[]; k=n+1
def add(png,y,a,b,fade=0.25):
    global k
    inputs.extend(['-loop','1','-t',f'{t}','-i',png])
    fi=0.01 if a==0 else fade
    fc.append(f'[{k}:v]format=rgba,fade=t=in:st={a}:d={fi}:alpha=1,fade=t=out:st={max(a,b-fade):.3f}:d={fade}:alpha=1[o{k}]')
    ov.append((k,y,a,b)); k+=1
add(T+'/title.png',150,0,t,0.01)
add(T+'/brand.png',SQ_Y+1080+30,0,t,0.01)
for i,(c,a,b) in enumerate(merged):
    p=f'{T}/cap{i}.png'; textpng(p,[c],cap); add(p,385,a,b)
add(T+'/end1.png',SQ_Y+380,endt+0.3,t-0.05,0.5)
add(T+'/end2.png',SQ_Y+560,endt+1.9,t-0.05,0.5)
cur='base'
for j,(kk,y,a,b) in enumerate(ov):
    nxt=f'm{j}'; fc.append(f"[{cur}][o{kk}]overlay=0:{y}:enable='between(t,{a},{b})'[{nxt}]"); cur=nxt
fc.append(f'[{cur}]format=yuv420p[vout]')
fc.append('[ac]loudnorm=I=-14:TP=-1.5:LRA=11[aout]')
cmd=['ffmpeg','-y','-loglevel','error']+inputs+['-filter_complex',';'.join(fc),'-map','[vout]','-map','[aout]','-t',f'{t}',
     '-c:v','libx264','-crf','18','-preset','medium','-pix_fmt','yuv420p','-r','30','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',OUT]
print('duration',round(t,2),'captions',merged)
subprocess.run(cmd,check=True)
