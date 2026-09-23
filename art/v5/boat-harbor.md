# V5 boat and harbor source assets

Original assets authored in `scripts/premium-boat.mjs` and `scripts/build-walk-islands.mjs`. The Blender 4.5 LTS files preserve the individual source parts, UV coordinates, material names and game animation pivots. `REVIEW_ONLY` contains a studio light and inspection camera; it is not part of the runtime model.

The Blender files are editable snapshots of the generator output, not baked high-poly sculpt sources. The reproducible geometry authority remains the JavaScript builders. The shared V5 surface library supplies the runtime maps and material response separately.

## Regeneration

With Node 22.12+ and repository dependencies installed:

```sh
ARCHIPELAGO_SOURCE_OUT=/tmp/archipelago-v5-source node scripts/rebuild-boat.mjs
ARCHIPELAGO_ISLANDS=harbor ARCHIPELAGO_SOURCE_OUT=/tmp/archipelago-v5-source node scripts/build-walk-islands.mjs
```

The optional source folder receives uncompressed, unmerged GLBs suitable for Blender import. Default output is `static/models`; final runtime GLBs use Meshopt compression and merge by material while preserving gameplay nodes.

## Contracts

- Boat: original external envelope, four animated controls, three livery material names, helm and engine pivots retained; 18,031 triangles and 16 material batches.
- Harbor: same coastline, dock dimensions, 31-second scenic route, obstacles, berths, stations and bench. The walk-layout file remains byte-identical to V4.6.
- Harbor paths are one unioned surface; this removes coplanar overlap at repeated route segments. Palm leaves have front-facing normals and use a double-sided material.
- Other eight islands remain byte-identical, including both high and low assets.
- Wood UVs: U across grain, V along grain. Rope UVs: U around the radial direction, V along the tube. Material names are stable and bind to the shared V5 material library.
- Mesh proportions and collisions are intentionally separate; visual bevels, knots, seams and fasteners do not add gameplay obstacles.
