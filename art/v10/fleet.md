# V10 imported fleet

V10 uses three owner-provided Tripo GLBs for non-player traffic. The player-controlled runabout remains the original Archipelago boat.

| Runtime vessel | Source file | Runtime fit |
| --- | --- | --- |
| Pacific Explorer | `cruise ship 3d model.glb` | 14-unit hull length; 3.35-unit beam; aligned from the source model's long Z axis |
| Solstice | `luxury yacht 3d model (1).glb` | 11-unit hull length; 4.2-unit beam; long Z axis |
| Blue Horizon | `luxury yacht 3d model.glb` | 11-unit hull length; 3.6-unit beam; long X axis rotated to the fleet's bow-forward axis |

The source exports are normalized to unit length and contain roughly **0.96–1.95 million triangles** each. The runtime importer welds and simplifies their geometry, caps high/low texture dimensions at **1024/512 pixels**, and writes Meshopt-compressed GLBs. The six variants total **2,265,008 bytes**. High variants contain **21,192–23,392 triangles**; low variants contain **4,332–6,068 triangles**.

The original large downloads are not stored in Git. To rebuild the runtime copies, provide the source files locally:

```sh
node scripts/import-fleet-assets.mjs \
  --cruise "/path/to/cruise ship 3d model.glb" \
  --yacht-one "/path/to/luxury yacht 3d model (1).glb" \
  --yacht-two "/path/to/luxury yacht 3d model.glb"
```

The builder verifies each generated GLB can be reopened, retains source textures, and stays within per-LOD triangle budgets. `static/models/fleet/v10/manifest.json` records sizes and triangle counts. `sources/fleet-review.html` is a development-only view of the actual optimized runtime models.
