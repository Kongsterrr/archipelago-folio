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

- **V14.2 campus bicycle** — derived from Jack’s supplied `bicycle+3d+model.glb`, a Tripo export. `scripts/build-bicycle.mjs` preserves the original artwork and base-color, normal and metallic/roughness maps; it separates wheels, steering and pedals before optimization, corrects a misplaced source pedal, and fits compact frame/seat geometry to the existing chibi. V14.2.2 restores the unmodified source handlebars and uses a forward-leaning rider pose instead. The source file is not published. Runtime variants and provenance/hash are in `static/models/bicycle-manifest.json`. The supplied art is not claimed as original MIT artwork; its use remains subject to the supplier’s applicable terms, and no separate redistribution license accompanied the attachment.

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

## V14 campus architecture references

Education campus meshes are original procedural interpretations made for this portfolio, not downloaded university models or photographic textures. The miniature compresses BU Charles River and CMU Pittsburgh landmarks into one fictional island. It does not imply that Jack studied in a specific pictured building. Reference photographs and university logos are not embedded in the models.

- CMU Hamerschlag Hall photographic reference: https://www.ece.cmu.edu/news-and-events/story/2021/12/chi-sps-distinguished-lecturer.html
- CMU Hamburg Hall / Heinz College building context: https://www.cmu.edu/cdfd/buildings/building-list.html
- CMU The Fence tradition: https://www.cmu.edu/about/traditions
- BU Marsh Chapel architecture: https://www.bu.edu/today/projects/marshchapel/
- BU Bay State Road streetscape: https://www.bu.edu/realestate/our-neighborhoods/bay-state-road/
- BU Green Line setting: https://www.bu.edu/chapel/about/directions-contact/

Academic facts continue to come from Jack's existing resume-backed content. Campus brick/stone/copper colors are authored material values; masonry detail reuses this repository's original V5 stone normal/ORM texture pack without recoloring campus albedo.


## V14.1 Duan Center and campus details

The Duan Center, Scotty sculpture, furniture and architectural details are original procedural geometry, authored for this fictional campus miniature. No university model, logo, photograph or downloaded texture is bundled. Architectural and historical references:

- KPMB — Duan Family Center for Computing & Data Sciences: https://www.kpmb.com/project/duan-family-center-for-computing-data-sciences-at-boston-university/
- Boston University — building history, December 8, 2022 opening and environmental design: https://www.bu.edu/cds-faculty/explore/bu-center-for-computing-data-sciences/
- CMU — Scotty and campus traditions: https://www.cmu.edu/admission/campus-experience/traditions

The landmark article is original concise prose, distinct from Jack’s resume-backed education history. Concept-wall animations illustrate themes and do not represent live building measurements. New glass and metal finishes use authored material colors and the existing sunset environment; no new third-party assets or dependencies are added.


## V14.3 Walking to the Sky reference

The CMU lawn sculpture is a miniature procedural interpretation of **Walking to the Sky** by **Jonathan Borofsky**, based on the owner's supplied reference photograph and CMU's public-art catalog. The six static figures follow the owner's requested miniature composition; this is not an exact survey or claim about the original sculpture's figure count. No photograph, downloaded university mesh, or third-party texture is bundled. The original artwork remains attributed to its artist; the repository's MIT license does not grant rights to the underlying artwork.

- CMU Public Art — Walking to the Sky: https://publicart.cmu.edu/objects/1086/walking-to-the-sky


## V15.1 owner-supplied garage vehicles

The 911 and G63 runtime models derive from the owner-provided `911-grey.glb` and `g63.glb`. `static/models/garage-cars.json` records source hashes, original sizes, geometry partitions, rig anchors and optimized variants. The original files are not distributed. The pipeline retains their UVs and texture artwork, partitions four wheel pivots (plus a separate G63 roof group, retained during driving), and produces reduced high/low geometry. Runtime material response is calibrated to the scene lighting.

These imported car meshes, textures and visible brand marks are **not relicensed under this repository’s MIT code license**. No upstream asset license or author attribution was supplied with the files; downstream reuse requires the appropriate original permissions. Porsche, Mercedes-Benz and AMG names/marks identify the depicted vehicles and do not imply affiliation. No third-party car controller or character animation was added.

V15.1.1 corrects only the 911 wheel assemblies: fitted axle centers, circularized rubber profiles, stationary brake calipers, and wheel-arch faces reassigned to the body. The supplied alloy/spoke artwork and textures are retained. These geometry corrections do not change the imported assets’ licensing status.


## V15.2 owner-supplied Ferrari and Ford vehicles

Ferrari Purosangue and Ford Raptor derive from the owner-provided `ferrari.glb` and `Ford-raptor.glb`. Original uploads remain outside this repository. Their optimized runtime meshes retain source bodywork, full roofs, materials and UV artwork; four wheel rigs, seated-driver anchors and compact interior foot supports are added locally. The Raptor uses its four disconnected source wheel assemblies. Driver seats are locally lowered inside both cabins to accommodate the existing stylized character. Ferrari rubber is rebuilt as complete circular shells fitted to source cross-sections while original alloys are retained and brake components remain stationary. Source hashes, dimensions, partitions and variant budgets are recorded in `static/models/garage-cars.json`.

These imported meshes, textures and visible marks are not relicensed under the MIT code license. No upstream asset license or attribution was supplied; downstream reuse requires the original permissions. Ferrari and Ford names/marks identify the depicted vehicles and imply no affiliation or endorsement.
