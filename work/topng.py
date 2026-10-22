import sys
from PIL import Image, ImageDraw
im=Image.open(sys.argv[1]); d=ImageDraw.Draw(im)
if len(sys.argv)>3:
  n=sys.argv[3].split(',');W=im.width
  for i,x in enumerate(n): d.text((int((i+0.15)*W/len(n)),8),x,fill=(230,230,230))
im.save(sys.argv[2])
