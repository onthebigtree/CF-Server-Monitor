"""Generate the optional console icon set (requires Pillow, only at build time)."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

out = Path(__file__).resolve().parents[1] / 'public/files/console-icons-v1'
out.mkdir(parents=True, exist_ok=True)
svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#087f72"/><rect x="108" y="118" width="296" height="116" rx="28" fill="#fff"/><rect x="108" y="278" width="296" height="116" rx="28" fill="#fff"/><circle cx="154" cy="176" r="14" fill="#087f72"/><circle cx="154" cy="336" r="14" fill="#087f72"/><path d="M218 176h126M218 336h126" stroke="#087f72" stroke-width="20" stroke-linecap="round"/></svg>\n'''
(out / 'icon.svg').write_text(svg)
scale = 4
im = Image.new('RGBA', (512*scale, 512*scale))
d = ImageDraw.Draw(im)
def box(bounds, radius, color):
    d.rounded_rectangle(tuple(v*scale for v in bounds), radius*scale, fill=color)
box((0,0,512,512),112,'#087f72')
for y in (118,278):
    box((108,y,404,y+116),28,'white')
    d.ellipse(tuple(v*scale for v in (140,y+44,168,y+72)), fill='#087f72')
    box((208,y+48,354,y+68),10,'#087f72')
for size in (32,180,192,512):
    # Mobile icons use an opaque background; launchers provide their own mask.
    output=im.copy()
    if size != 32:
        background=Image.new('RGBA',output.size,'#087f72');background.alpha_composite(output);output=background.convert('RGB')
    output.resize((size,size),Image.Resampling.LANCZOS).save(out / f'icon-{size}.png')
im.resize((256,256),Image.Resampling.LANCZOS).save(out/'favicon.ico',sizes=[(16,16),(32,32),(48,48)])
manifest={'name':'服务器看板','short_name':'服务器看板','lang':'zh-CN','id':'/','start_url':'/','scope':'/','display':'browser','background_color':'#f6f8fa','theme_color':'#087f72','icons':[{'src':f'/files/console-icons-v1/icon-{n}.png','sizes':f'{n}x{n}','type':'image/png','purpose':'any'} for n in (192,512)]}
(out/'manifest.webmanifest').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('Generated SVG, ICO, PNG and manifest')
