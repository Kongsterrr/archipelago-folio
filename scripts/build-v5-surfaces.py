#!/usr/bin/env python3
"""Original, repeatable V5 PBR tiles. Requires numpy, Pillow and Khronos toktx.

Run: python scripts/build-v5-surfaces.py --toktx /path/to/toktx
The height fields are the editable source; no photographs or third-party art.
UV: U across grain / rope strands, V along the grain / rope length. RGB maps
modulate the model's existing color, preserving all three boat liveries.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'static/textures/v5'
KINDS = ['wood', 'canvas', 'leather', 'stone', 'sand', 'rope']


def fields(kind, size=1024):
    y, x = np.mgrid[0:size, 0:size].astype(np.float32) / size
    tau = np.pi * 2
    rng = np.random.default_rng(411 + KINDS.index(kind))
    noise = np.zeros_like(x)
    for f, a in [(2, .55), (5, .22), (13, .13), (29, .07), (67, .03)]:
        noise += a * np.sin(tau * (x * f + .31 * np.sin(tau * y * 3)) + rng.uniform(0, tau)) * np.cos(tau * y * f + rng.uniform(0, tau))
    if kind == 'wood':
        # Ring distortion creates long flowing annual grain, never straight stripes.
        warp = .24 * np.sin(tau*y) + .08*np.sin(tau*y*3) + .018*noise
        grain = np.sin(tau*(x*23+warp))
        fiber = np.sin(tau*(x*119+warp*3.2))
        pores = np.maximum(0, grain-.6)**3
        height = .15*grain + .035*fiber - .16*pores + noise*.09
        shade = .935 + .026*grain + .013*fiber + noise*.02 - pores*.025
        color = np.stack((shade, shade*.985, shade*.96), axis=-1)
        rough = .89 + grain*.03 + noise*.025
        ao = .99 - pores*.075
        normal_strength = 3.0
    elif kind == 'canvas':
        warp = np.sin(tau*x*96)
        weft = np.sin(tau*y*96)
        basket = np.sin(tau*x*48)*np.sin(tau*y*48)
        height = .034*(warp+weft) + .016*basket + noise*.014
        shade = .974 + .008*(warp+weft) + .005*basket + noise*.009
        color = np.stack((shade, shade*.997, shade*.99), axis=-1)
        rough = .97 + .01*basket
        ao = .997 - np.maximum(0, -basket)*.01
        normal_strength = 1.25
    elif kind == 'leather':
        cells = np.sin(tau*(x*83+noise*.13))*np.sin(tau*(y*79+noise*.11))
        pores = np.abs(cells)**.22
        height = pores*.025 + noise*.025
        shade = .978 + .008*pores + noise*.012
        color = np.stack((shade, shade*.997, shade*.993), axis=-1)
        rough = .91 + pores*.025 + noise*.015
        ao = .99 + pores*.007
        normal_strength = 2.8
    elif kind == 'stone':
        fine = np.sin(tau*x*117)*np.cos(tau*y*93)
        height = .12*noise + .025*fine
        shade = .95 + noise*.05 + fine*.01
        color = np.stack((shade, shade*.995, shade*.988), axis=-1)
        rough = .98 + noise*.02
        ao = .975 + noise*.02
        normal_strength = 2.8
    elif kind == 'sand':
        fine = np.sin(tau*(x*199+y*47))*np.sin(tau*(y*187-x*61))
        ripple = np.sin(tau*(y*8 + .2*np.sin(tau*x*2)))
        height = noise*.035 + fine*.012 + ripple*.045
        shade = .962 + noise*.016 + fine*.008 + ripple*.008
        color = np.stack((shade, shade*.987, shade*.959), axis=-1)
        rough = .985 + fine*.01
        ao = .993 + fine*.005
        normal_strength = 1.4
    else:
        strand = np.cos(tau*(x*3-y*8))
        twist = np.cos(tau*(x*27-y*72))
        height = strand*.11 + twist*.012
        shade = .944 + strand*.027 + twist*.008
        color = np.stack((shade, shade*.987, shade*.957), axis=-1)
        rough = .975 + twist*.015
        ao = .985 + strand*.012
        normal_strength = 2.0
    dx = (np.roll(height, -1, 1)-np.roll(height, 1, 1))*normal_strength
    dy = (np.roll(height, -1, 0)-np.roll(height, 1, 0))*normal_strength
    normal = np.stack((-dx, dy, np.ones_like(x)), axis=-1)
    normal /= np.linalg.norm(normal, axis=-1)[..., None]
    orm = np.stack((np.broadcast_to(ao, x.shape), np.broadcast_to(rough, x.shape), np.zeros_like(x)), axis=-1)
    return {'color': color, 'normal': normal*.5+.5, 'orm': orm}


def build(toktx, hair_normal=None):
    OUTPUT.mkdir(parents=True, exist_ok=True)
    result = {'version': 5, 'generator': 'scripts/build-v5-surfaces.py', 'license': 'MIT; original procedural material artwork and original sculpted hair bake', 'uvConvention': 'U across grain, V along grain; tile 0–1 per feature. Hair uses unique UV1 atlas.', 'qualities': {}}
    with tempfile.TemporaryDirectory(prefix='archipelago-v5-surfaces-') as tmp:
        for quality, normal_size, other_size in [('high', 1024, 512), ('low', 512, 256)]:
            entries = {}
            for kind in KINDS + (['hair'] if hair_normal and Path(hair_normal).exists() else []):
                maps = {}
                channels = {'normal': np.asarray(Image.open(hair_normal).convert('RGB'), dtype=np.float32)/255} if kind == 'hair' else fields(kind)
                for channel, data in channels.items():
                    size = normal_size if channel == 'normal' else other_size
                    image = Image.fromarray(np.uint8(np.clip(data, 0, 1)*255), 'RGB').resize((size, size), Image.Resampling.LANCZOS)
                    source = Path(tmp) / f'{kind}-{channel}-{quality}.png'
                    image.save(source)
                    target = OUTPUT / quality / f'{kind}-{channel}.ktx2'
                    target.parent.mkdir(exist_ok=True)
                    encoding = ['--encode', 'uastc', '--uastc_quality', '2', '--zcmp', '18'] if channel == 'normal' else ['--encode', 'etc1s', '--qlevel', '200']
                    args = [toktx, '--t2', '--genmipmap', '--threads', '2', '--assign_oetf', 'srgb' if channel == 'color' else 'linear', *encoding, str(target), str(source)]
                    subprocess.run(args, check=True, stdout=subprocess.DEVNULL)
                    payload = target.read_bytes()
                    maps[channel] = {'url': '/textures/v5/'+quality+'/'+target.name, 'width': size, 'height': size, 'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest(), 'colorSpace': 'srgb' if channel == 'color' else 'linear', 'encoding': 'UASTC/Zstd' if channel == 'normal' else 'ETC1S', 'mipLevels': int(np.log2(size))+1}
                    if kind == 'hair':
                        maps[channel].update({'channel': 1, 'wrap': 'clamp', 'source': 'Blender high-to-runtime tangent normal bake'})
                entries[kind] = maps
                print(quality, kind, sum(m['bytes'] for m in maps.values()), flush=True)
            # A conservative RGBA8 fallback, including mipmaps, is also within budget.
            worst_gpu = sum(sum(int(m['width']*m['height']*4*4/3) for m in maps.values()) for maps in entries.values())
            result['qualities'][quality] = {'bytes': sum(m['bytes'] for maps in entries.values() for m in maps.values()), 'worstCaseRGBABytes': worst_gpu, 'surfaces': entries}
    basis = OUTPUT / 'basis'
    basis.mkdir(exist_ok=True)
    for filename in ['basis_transcoder.js', 'basis_transcoder.wasm', 'README.md']:
        shutil.copyfile(ROOT/'node_modules/three/examples/jsm/libs/basis'/filename, basis/filename)
    result['transcoderBytes'] = sum((basis/f).stat().st_size for f in ['basis_transcoder.js', 'basis_transcoder.wasm'])
    (OUTPUT/'manifest.json').write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps({q:{k:v for k,v in entry.items() if k!='surfaces'} for q,entry in result['qualities'].items()}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--toktx', default=shutil.which('toktx'))
    parser.add_argument('--hair-normal', default=ROOT/'assets/source/jack/jack-hair-normal.png', help='Optional Blender-baked unique hair UV1 atlas')
    options = parser.parse_args()
    if not options.toktx:
        parser.error('Install the free Khronos KTX-Software tools, or pass --toktx. Encoder tested with 4.4.2.')
    build(options.toktx, options.hair_normal)
