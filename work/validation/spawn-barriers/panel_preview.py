# Software port of the page's spawn-wall fragment shader (native_maps_runtime xSbMat) for one 6 x 4 m panel, front view,
# additive over a mid-grey wall; teal (your spawn) on the left, red (enemy) on the right, uG=0 standing / drop flash.
import math
from PIL import Image
def ss(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def frag(u,v,L,H,T,C,A,G):
    mx,my=u*L,v*H;px,py=mx*1.6,my*1.6
    def md(x,m): return x-m*math.floor(x/m)
    ax,ay=md(px,1)-.5,md(py,1.732)-.866;bx,by=md(px-.5,1)-.5,md(py-.866,1.732)-.866
    gx,gy=(ax,ay) if ax*ax+ay*ay<bx*bx+by*by else (bx,by)
    hx=max(abs(gx)*.5+abs(gy)*.866025,abs(gx));e=ss(.43,.49,hx)
    f=md(my*.18-T*.35,1);scan=ss(0,.35,f)*(1-ss(.35,.42,f))
    ex=min(u,1-u)*L;rim=1-ss(0,.18,ex);top=1-ss(0,.25,(1-v)*H);fl=1-ss(0,.35,v*H-.4)
    s=.10+.30*e+.16*scan+.55*rim+.35*top+.65*max(fl,0)+.04*math.sin(T*2.3+mx*1.7)
    k=max(0,min(1,e*.6+rim+fl*.5));c=[(C[i]*.7*(1-k)+(C[i]*.45+.55)*k)*(1+G*.8) for i in range(3)]
    a=max(0,min(.9,s*A*(.55+G*.25)));return c,a
W,Hp=360,240;img=Image.new('RGB',(W*2+20,Hp),(70,72,78))
for j,(C,G) in enumerate((((.21,.88,.78),0),((1,.27,.33),0))):
    for y in range(Hp):
        for x in range(W):
            c,a=frag(x/W,1-y/Hp,6,4,1.3,C,1,G);base=img.getpixel((x+j*(W+20),y))
            img.putpixel((x+j*(W+20),y),tuple(min(255,int(base[i]+255*c[i]*a)) for i in range(3)))
img.save('panel-preview.png');print('ok')
