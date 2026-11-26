// Source patches applied by work/three/build.cjs to three r170 (exact text, each must match `n` times, default 1).
// Each keeps an r149 behaviour the page's look depends on (the shipped build ran three r149 + GLTFLoader r147), so the
// upgrade draws the same pixels. Anything not listed here is three r170 as published.
'use strict';
const R = 'src/renderers/WebGLRenderer.js';
const CORE = [
  // 1. Render-list depth = the object's origin in NDC (r149), not its bounding-sphere centre in clip space (r151+ /
  //    r16x Vector4). Opaque draws are sorted material-first then by this depth, so the r170 key reorders equal-material
  //    draws and changes which of two coplanar surfaces wins the depth test (seen with re-chunked maps), and it reorders
  //    transparent effects. Sprites and meshes both use r149's _vector3.setFromMatrixPosition().applyMatrix4().
  { id: 'sort-sprite', file: R,
    find: "\t\t\t\t\t\tif ( sortObjects ) {\n\n\t\t\t\t\t\t\t_vector4.setFromMatrixPosition( object.matrixWorld )\n\t\t\t\t\t\t\t\t.applyMatrix4( _projScreenMatrix );\n\n\t\t\t\t\t\t}\n\n\t\t\t\t\t\tconst geometry = objects.update( object );\n\t\t\t\t\t\tconst material = object.material;\n\n\t\t\t\t\t\tif ( material.visible ) {\n\n\t\t\t\t\t\t\tcurrentRenderList.push( object, geometry, material, groupOrder, _vector4.z, null );",
    replace: "\t\t\t\t\t\tif ( sortObjects ) {\n\n\t\t\t\t\t\t\t_vector3.setFromMatrixPosition( object.matrixWorld )\n\t\t\t\t\t\t\t\t.applyMatrix4( _projScreenMatrix );\n\n\t\t\t\t\t\t}\n\n\t\t\t\t\t\tconst geometry = objects.update( object );\n\t\t\t\t\t\tconst material = object.material;\n\n\t\t\t\t\t\tif ( material.visible ) {\n\n\t\t\t\t\t\t\tcurrentRenderList.push( object, geometry, material, groupOrder, _vector3.z, null );" },
  { id: 'sort-mesh', file: R,
    find: "\t\t\t\t\t\tif ( sortObjects ) {\n\n\t\t\t\t\t\t\tif ( object.boundingSphere !== undefined ) {\n\n\t\t\t\t\t\t\t\tif ( object.boundingSphere === null ) object.computeBoundingSphere();\n\t\t\t\t\t\t\t\t_vector4.copy( object.boundingSphere.center );\n\n\t\t\t\t\t\t\t} else {\n\n\t\t\t\t\t\t\t\tif ( geometry.boundingSphere === null ) geometry.computeBoundingSphere();\n\t\t\t\t\t\t\t\t_vector4.copy( geometry.boundingSphere.center );\n\n\t\t\t\t\t\t\t}\n\n\t\t\t\t\t\t\t_vector4\n\t\t\t\t\t\t\t\t.applyMatrix4( object.matrixWorld )\n\t\t\t\t\t\t\t\t.applyMatrix4( _projScreenMatrix );\n\n\t\t\t\t\t\t}",
    replace: "\t\t\t\t\t\tif ( sortObjects ) {\n\n\t\t\t\t\t\t\t_vector3.setFromMatrixPosition( object.matrixWorld )\n\t\t\t\t\t\t\t\t.applyMatrix4( _projScreenMatrix );\n\n\t\t\t\t\t\t}" },
  { id: 'sort-mesh-push', file: R,
    find: "groupOrder, _vector4.z, group );", replace: "groupOrder, _vector3.z, group );" },
  { id: 'sort-mesh-push2', file: R,
    find: "\t\t\t\t\t\t} else if ( material.visible ) {\n\n\t\t\t\t\t\t\tcurrentRenderList.push( object, geometry, material, groupOrder, _vector4.z, null );",
    replace: "\t\t\t\t\t\t} else if ( material.visible ) {\n\n\t\t\t\t\t\t\tcurrentRenderList.push( object, geometry, material, groupOrder, _vector3.z, null );" },
  // 2. Frustum culling of skinned and instanced meshes with the geometry's bounding sphere (r149). r151+ uses a sphere
  //    of the mesh's own (SkinnedMesh: skinned once in JS from the pose at its first frame, never updated; InstancedMesh:
  //    all instances), which culls agents / instanced props differently and skins every vertex of every agent mesh on
  //    the CPU once. BatchedMesh (new) keeps its own sphere.
  { id: 'frustum-object', file: 'src/math/Frustum.js',
    find: "\t\tif ( object.boundingSphere !== undefined ) {\n\n\t\t\tif ( object.boundingSphere === null ) object.computeBoundingSphere();",
    replace: "\t\tif ( object.isBatchedMesh === true && object.boundingSphere !== undefined ) {\n\n\t\t\tif ( object.boundingSphere === null ) object.computeBoundingSphere();" },
  // 3. renderer.outputColorSpace starts linear, as r149's outputEncoding (LinearEncoding) did; the page sets sRGB itself
  //    on every renderer it draws to the screen with (renderer.outputEncoding = sRGBEncoding, see compat.js).
  //    renderer.physicallyCorrectLights is back (r149 default false): false scales light intensities by PI (r149 /
  //    r155-r164 legacy lights). The game renderer sets it true; the menu / agent / skin preview renderers leave it off
  //    and are lit by hemisphere + directional lights only, for which the PI scale is all legacy mode did.
  { id: 'renderer-defaults', file: R,
    find: "\t\tthis._outputColorSpace = SRGBColorSpace;\n",
    replace: "\t\tthis._outputColorSpace = LinearSRGBColorSpace;\n\t\tthis.physicallyCorrectLights = false;\n" },
  { id: 'renderer-lights', file: R, n: 2,
    find: "\t\t\tcurrentRenderState.setupLights();\n", replace: "\t\t\tcurrentRenderState.setupLights( _this.physicallyCorrectLights );\n" },
  { id: 'renderstates-lights', file: 'src/renderers/webgl/WebGLRenderStates.js',
    find: "\tfunction setupLights() {\n\n\t\tlights.setup( lightsArray );",
    replace: "\tfunction setupLights( physicallyCorrectLights ) {\n\n\t\tlights.setup( lightsArray, physicallyCorrectLights );" },
  { id: 'lights-setup', file: 'src/renderers/webgl/WebGLLights.js',
    find: "\tfunction setup( lights ) {\n",
    replace: "\tfunction setup( lights, physicallyCorrectLights ) {\n\n\t\t// r149: artist-friendly light intensity scaling factor\n\t\tconst scaleFactor = ( physicallyCorrectLights !== true ) ? Math.PI : 1;\n" },
  { id: 'lights-ambient', file: 'src/renderers/webgl/WebGLLights.js',
    find: "\t\t\t\tr += color.r * intensity;\n\t\t\t\tg += color.g * intensity;\n\t\t\t\tb += color.b * intensity;",
    replace: "\t\t\t\tr += color.r * intensity * scaleFactor;\n\t\t\t\tg += color.g * intensity * scaleFactor;\n\t\t\t\tb += color.b * intensity * scaleFactor;" },
  { id: 'lights-directional', file: 'src/renderers/webgl/WebGLLights.js',
    find: "\t\t\t} else if ( light.isDirectionalLight ) {\n\n\t\t\t\tconst uniforms = cache.get( light );\n\n\t\t\t\tuniforms.color.copy( light.color ).multiplyScalar( light.intensity );",
    replace: "\t\t\t} else if ( light.isDirectionalLight ) {\n\n\t\t\t\tconst uniforms = cache.get( light );\n\n\t\t\t\tuniforms.color.copy( light.color ).multiplyScalar( light.intensity * scaleFactor );" },
  { id: 'lights-spot', file: 'src/renderers/webgl/WebGLLights.js',
    find: "\t\t\t\tuniforms.position.setFromMatrixPosition( light.matrixWorld );\n\n\t\t\t\tuniforms.color.copy( color ).multiplyScalar( intensity );\n\t\t\t\tuniforms.distance = distance;",
    replace: "\t\t\t\tuniforms.position.setFromMatrixPosition( light.matrixWorld );\n\n\t\t\t\tuniforms.color.copy( color ).multiplyScalar( intensity * scaleFactor );\n\t\t\t\tuniforms.distance = distance;" },
  { id: 'lights-point', file: 'src/renderers/webgl/WebGLLights.js',
    find: "\t\t\t} else if ( light.isPointLight ) {\n\n\t\t\t\tconst uniforms = cache.get( light );\n\n\t\t\t\tuniforms.color.copy( light.color ).multiplyScalar( light.intensity );",
    replace: "\t\t\t} else if ( light.isPointLight ) {\n\n\t\t\t\tconst uniforms = cache.get( light );\n\n\t\t\t\tuniforms.color.copy( light.color ).multiplyScalar( light.intensity * scaleFactor );" },
  { id: 'lights-hemi', file: 'src/renderers/webgl/WebGLLights.js',
    find: "\t\t\t\tuniforms.skyColor.copy( light.color ).multiplyScalar( intensity );\n\t\t\t\tuniforms.groundColor.copy( light.groundColor ).multiplyScalar( intensity );",
    replace: "\t\t\t\tuniforms.skyColor.copy( light.color ).multiplyScalar( intensity * scaleFactor );\n\t\t\t\tuniforms.groundColor.copy( light.groundColor ).multiplyScalar( intensity * scaleFactor );" },
];
const GLTF = [
  // 4. Safari decodes glTF textures with TextureLoader (<img>) as GLTFLoader r147 did, not ImageBitmapLoader (r170 on
  //    Safari >= 17): the page's texture cap (XV_TEXCAP, createImageBitmap resize) and the iOS memory budget were
  //    measured on that path.
  { id: 'gltf-safari-images', file: 'examples/jsm/loaders/GLTFLoader.js',
    find: "( isSafari && safariVersion < 17 )", replace: "isSafari" },
];
const SKEL = [];
module.exports = { CORE, GLTF, SKEL };
