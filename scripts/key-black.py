# Key out a near-black background: soft alpha ramp on max channel, only for pixels reachable from the border.
import sys,os
from PIL import Image,ImageFilter,ImageChops
src,dst=sys.argv[1],sys.argv[2]
LO,HI=10,34
MIN=900
for f in sorted(os.listdir(src)):
    if not f.endswith('.png') or f in('fern-basket.png','stone-wall.png','og-image.png'):continue
    im=Image.open(os.path.join(src,f)).convert('RGB')
    m=im.split();mx=ImageChops.lighter(ImageChops.lighter(m[0],m[1]),m[2])
    bg=mx.point(lambda v:255 if v<HI else 0)            # candidate background
    # keep only background regions connected to the border
    seed=bg.copy();w,h=seed.size
    from PIL import ImageDraw
    for x in range(0,w,4):
        for y in(0,h-1):
            if seed.getpixel((x,y))==255:ImageDraw.floodfill(seed,(x,y),128)
    for y in range(0,h,4):
        for x in(0,w-1):
            if seed.getpixel((x,y))==255:ImageDraw.floodfill(seed,(x,y),128)
    # enclosed dark regions (ring centre, monstera holes) count as background when big enough
    for y in range(0,h,6):
        for x in range(0,w,6):
            if seed.getpixel((x,y))==255:
                ImageDraw.floodfill(seed,(x,y),100)
                n=seed.histogram()[100]
                ImageDraw.floodfill(seed,(x,y),128 if n>=MIN else 60)
    outer=seed.point(lambda v:255 if v==128 else 0).filter(ImageFilter.MaxFilter(3))
    ramp=mx.point(lambda v:0 if v<=LO else 255 if v>=HI else int((v-LO)*255/(HI-LO)))
    alpha=ImageChops.lighter(ramp,ImageChops.invert(outer))
    out=im.convert('RGBA');out.putalpha(alpha.filter(ImageFilter.GaussianBlur(.6)))
    out.save(os.path.join(dst,f));print('keyed',f)
