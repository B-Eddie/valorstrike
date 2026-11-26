// ---- r149 API names the page still uses (removed by three r162-r170), appended to the core bundle by build.cjs ----
// Texture.encoding / renderer.outputEncoding map onto colorSpace / outputColorSpace exactly as three r152-r161 did;
// SkinnedMesh.boneTransform is r151+'s applyBoneTransform under its r149 name.
(function (T) {
  const sRGB = 3001, Linear = 3000;
  T.sRGBEncoding = sRGB; T.LinearEncoding = Linear;
  Object.defineProperty(T.Texture.prototype, 'encoding', { configurable: true,
    get() { return this.colorSpace === T.SRGBColorSpace ? sRGB : Linear; },
    set(v) { this.colorSpace = v === sRGB ? T.SRGBColorSpace : T.NoColorSpace; } });
  Object.defineProperty(T.WebGLRenderer.prototype, 'outputEncoding', { configurable: true,
    get() { return this.outputColorSpace === T.SRGBColorSpace ? sRGB : Linear; },
    set(v) { this.outputColorSpace = v === sRGB ? T.SRGBColorSpace : T.LinearSRGBColorSpace; } });
  if (!T.SkinnedMesh.prototype.boneTransform) T.SkinnedMesh.prototype.boneTransform = T.SkinnedMesh.prototype.applyBoneTransform;
})(THREE);
