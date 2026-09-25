# Third-party notices and provenance

- **Bruno Simon, folio-2025** — https://github.com/brunosimon/folio-2025/tree/41046b57eeed8d156d9c3fd7fa259900baef7816 — MIT. `sources/core/Events.js` is retained from `sources/Game/Events.js`; `LICENSE` preserves the original copyright and license. Input actions, separate update systems, world areas and exploration/focus camera transitions informed this implementation. No Bruno car, terrain, personal content, music, branding, private service, or proprietary asset is shipped.
- **Three.js** — https://github.com/mrdoob/three — MIT. Renderer, Three Shading Language, loaders/exporters, Meshopt decoder integration and geometry utilities.
- **Rapier / Dimforge** — https://github.com/dimforge/rapier.js — Apache-2.0. Planar rigid body collisions and continuous collision detection. Version 0.17.3 compatibility build.
- **glTF Transform** — https://github.com/donmccurdy/glTF-Transform — MIT. Build-time geometry compression.
- **meshoptimizer** — https://github.com/zeux/meshoptimizer — MIT. Meshopt encoding and decoding.
- **Vite** — https://github.com/vitejs/vite — MIT. Development and static production build.
- **Manrope** — Mikhail Sharanda and contributors, SIL Open Font License 1.1. **DM Sans** — Colophon Foundry and contributors, SIL Open Font License 1.1. Served with display=swap through Google Fonts; system sans-serif fallback remains available.
- **Helvetiker Bold** — bundled Three.js typeface, used for original 3D island lettering; Copyright © 2004 Magenta Ltd. The font permission notice is included in `static/licenses/helvetiker.txt`.
- **Boat, nine islands, duck, bottle, ocean material and interface** — original work made for this portfolio. V1 geometry is reproducible from `scripts/build-assets.mjs`; current generators and V5 material provenance are listed below; no third-party model, photographic project screenshot, texture, music recording, or illustration is presented as Jack's work.
- **Résumé PDF and career/project content** — supplied by Jack. The original attachment is copied as `static/resume.pdf`. Project illustrations are conceptual island dioramas, not screenshots of the underlying applications.

Dependency-specific license files remain available with their installed packages.

- **V9 imported chibi avatar** — actual mesh and embedded base-color texture supplied by Jack as `chibi boy 3d model.glb`, with Tripo recorded as the GLB generator. Local processing welds seams, reduces geometry, removes six detached artifacts, fits a 19-joint skeleton and supplies seven original movement clips. The runtime is `static/models/jack-imported.glb`; editable skin sources are in `assets/source/imported-jack/`. The supplied mesh/texture are not represented as original MIT artwork; their use remains subject to the supplier's applicable rights and Tripo terms. No separate redistribution license was provided in the attachment. The historical original-character descriptions below refer to V4–V8, not this imported asset.

- **V12 quad bike** — static high/low runtime GLBs are derived from Jack's supplied `quad bike 3d model.glb` Tripo export by `scripts/build-quad-bike.mjs`. The source file is not copied into this repository. Its mesh and embedded texture remain owner-supplied artwork, not original MIT art; redistribution remains subject to the applicable supplier terms. No separate model license was provided in the attachment.

- **V3 fleet, marine fauna and island detail overlays** — original procedural assets authored for Jack’s Archipelago. Sources: `scripts/fleet-vessels.mjs`, `scripts/animals.mjs`, `scripts/island-details.mjs`. Small applied labels use original stroke geometry; no external model or animal imagery is embedded.

- **V4/V4.1/V4.2/V4.3/V4.4/V4.5/V4.6 Jack character and V4 walkable islands** — original procedural geometry, rig and animation authored for this portfolio, reproduced by `scripts/jack-character.mjs`, `scripts/jack-hair.mjs`, `scripts/build-jack.mjs`, and `scripts/build-walk-islands.mjs`. No third-party character scan, photograph or motion-capture clip is included. V4 replaces the original island GLBs while retaining their maritime shorelines and uses the same licensed Helvetiker typeface for plaques.

- **V4.4 reference-led redesign** — modeled from Jack’s supplied generated character concept. The reference bitmap is not embedded in the website or repository. Hair strands use an original procedural normal field; no purchased model, stock texture or outside character asset is included.

- **V4.5 proportion and pose refinement** — original shortened-body geometry and animations, based on the same supplied concept. No additional third-party character, texture or animation asset is introduced.

- **V4.6 sculpted character surfaces** — original authored cross-sections, garment field, rig weights and animations in `scripts/jack-shapes.mjs` and `scripts/jack-trousers.mjs`. The marching-cubes topology table in the latter is copied from Three.js (MIT; copyright © 2010–2026 Three.js authors). Its complete license is preserved in `static/licenses/three.txt`. Concept reference bitmaps and temporary review assets are not shipped.

## V5 runtime components and original art

- **Basis Universal transcoder** — Binomial LLC and contributors, [Apache License 2.0](https://github.com/BinomialLLC/basis_universal/blob/master/LICENSE). `static/textures/v5/basis/basis_transcoder.js` and `basis_transcoder.wasm` are copied from the installed Three.js distribution’s Basis loader support files. Their complete license is retained at `static/textures/v5/basis/LICENSE`, alongside the upstream README. The runtime uses them to transcode the original KTX2 surface packs.
- **Three.js V5 rendering modules** — Three.js authors, MIT. The daylight environment, TSL-based water, GTAO and FXAA integrations use Three.js APIs/addons; the upstream license remains in `static/licenses/three.txt` and installed packages.
- **V5 character, boat, Harbor, material tiles and hair bake** — original portfolio assets under the repository’s MIT license. Character construction remains based on the original curve/implicit-surface generators and shared rig. `assets/source/jack/` includes an editable Blender scene and a real sculpt-to-runtime hair normal bake. `art/v5/` contains editable boat/Harbor source-part snapshots. `scripts/build-v5-surfaces.py` generates the remaining surface tiles mathematically, without stock photography or downloaded artwork. Reference concept bitmaps are not embedded in the site or repository. No new third-party character, boat, texture art or animation clip is included.

## Optional asset-building tools

These programs are used to author or compress assets and are **not distributed in the website** or required to run it:

- **Blender 4.5.3 LTS / Cycles** — Blender Foundation and contributors, GNU GPL. Used for editable source scenes, offline inspection and tangent-normal baking. Source, binary downloads and licensing are available from [Blender](https://www.blender.org/download/lts/4-5/) and its [license documentation](https://www.blender.org/about/license/). The generated original artwork remains covered by this repository’s asset license; Blender executable code is not included.
- **Khronos KTX-Software 4.4.2 (`toktx`)** — Khronos Group and contributors. Repository-specific code is generally Apache-2.0; bundled components retain their own licenses. Used to encode original maps to ETC1S or UASTC/Zstd KTX2. See the [upstream license inventory](https://github.com/KhronosGroup/KTX-Software/blob/main/LICENSE.md) and [4.4.2 source/release](https://github.com/KhronosGroup/KTX-Software/releases/tag/v4.4.2).
- **NumPy and Pillow** — optional Python build dependencies for procedural material generation; respectively BSD-3-Clause and HPND/Pillow licensing. Installed packages carry their notices. Neither package is included in the browser bundle.
