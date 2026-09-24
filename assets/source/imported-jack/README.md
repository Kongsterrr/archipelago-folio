# Imported Chibi Jack — V9

The playable character is the actual model supplied by Jack as `chibi boy 3d model.glb`, exported by Tripo. Its source had 992,744 triangles, one embedded JPEG, and no skin, joints or animations. It is separate from the earlier procedural Jack.

`rig.blend` is the editable Blender 4.5 scene; `rig.glb` is its fitted 19-joint skin, at the source scale and +Z facing. Its three stress-test clips are replaced by the runtime animation bake. The supplied mesh was welded at coincident UV positions **before** decimation, retaining UVs and the embedded texture. Six disconnected surface fragments were removed. The face, hair, body, shorts and bare feet come from the supplied asset; there is no replacement procedural head underneath it.

The rig uses corrected heat weights, a rigid head region and a maximum of four normalized influences per vertex. The paired shoulder bones maintain the shoulder transitions. Torso weights exclude distant leg influences. There are 44,756 triangles, one material and one skin; the original base-color JPEG remains unchanged. A small white mark on one eyebrow belongs to the supplied surface and is preserved. The source has no independent facial rig, blink or articulated fingers.

Rebuild the current playable model with Node 22.12+:

```sh
npm run models:imported-jack
```

`scripts/imported-jack-animation.mjs` preserves the source bind axes and produces seven clips at approximately 1.20 world units high, facing −Z. The helm uses two-bone IK baked at author time with fixed mesh-based palm anchors; steering does not move the hands. Foot contact is corrected from skinned vertices. Seat height is fitted to the existing bench surface. `scripts/build-imported-jack.mjs` removes unused data, compresses the GLB with Meshopt, and writes the runtime manifest. No Blender executable is required for this bake unless the source skin is edited.

Actual asset review: `/review.html?model=jack`, adding `&pose=walk&time=0.18`, `&pose=helm`, `&pose=sit`, or `&clay`. The previous procedural avatar remains available with `&legacy`.

The source mesh and base-color texture are user-supplied Tripo output. No separate third-party redistribution license was supplied with the file; they are not represented as newly authored MIT artwork. Repository code and locally authored motion tooling retain the repository license. See `THIRD_PARTY_NOTICES.md`.
