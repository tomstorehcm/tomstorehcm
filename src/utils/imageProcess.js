const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');
const { createJimp } = require('@jimp/core');
const { defaultFormats, defaultPlugins } = require('jimp');

const BANNER_SIZES = {
  hero: { w: 1800, h: 700 },
  heroMobile: { w: 1080, h: 1350 },
  // Same 1080x1350 (4:5) as heroMobile so admin can reuse one Instagram-ready
  // image across both this banner and the mobile hero.
  featured: { w: 1080, h: 1350 },
  thumb: { w: 640, h: 640 },
  product: { w: 1000, h: 1000 }
};

// Node's built-in fetch() does not support the file:// scheme ("not implemented
// yet" in undici), but the WebP codec's Emscripten glue always loads its .wasm
// binary via fetch() regardless of environment. Patch fetch once to serve
// file:// requests straight off disk (with the content-type WebAssembly.
// instantiateStreaming requires) and pass everything else through untouched.
let fetchPatched = false;
function ensureFileFetchSupport() {
  if (fetchPatched) return;
  fetchPatched = true;
  const originalFetch = global.fetch;
  global.fetch = async function patchedFetch(input, init) {
    const url = typeof input === 'string' ? input : input.url;
    if (url && url.startsWith('file://')) {
      const buf = fs.readFileSync(fileURLToPath(url));
      return new Response(buf, { status: 200, headers: { 'content-type': 'application/wasm' } });
    }
    return originalFetch(input, init);
  };
}

// @jimp/wasm-webp only ships an ESM build, so it must be loaded via dynamic
// import() even though this file is CommonJS. Build the WebP-aware Jimp class
// once and cache it for subsequent calls.
let jimpWithWebpPromise = null;
function getJimp() {
  if (!jimpWithWebpPromise) {
    ensureFileFetchSupport();
    jimpWithWebpPromise = import('@jimp/wasm-webp').then((webp) =>
      createJimp({
        formats: [...defaultFormats, webp.default],
        plugins: defaultPlugins
      })
    );
  }
  return jimpWithWebpPromise;
}

// iPhone photos are often HEIC/HEIF, which Jimp can't read and no browser
// besides Safari can render in an <img> tag. Convert to JPEG first -- this
// changes the file's extension, so the caller must use the returned filename
// (not the one it uploaded) when building the final URL.
const HEIC_EXTENSIONS = ['.heic', '.heif'];

async function convertHeicIfNeeded(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!HEIC_EXTENSIONS.includes(ext)) return filePath;

  const heicConvert = require('heic-convert');
  const inputBuffer = fs.readFileSync(filePath);
  const outputBuffer = await heicConvert({ buffer: inputBuffer, format: 'JPEG', quality: 0.9 });
  const newPath = filePath.slice(0, -ext.length) + '.jpg';
  fs.writeFileSync(newPath, outputBuffer);
  fs.unlinkSync(filePath);
  return newPath;
}

// Returns the final filename (basename only) after cropping -- identical to
// the input filename unless the file was HEIC/HEIF and got converted to .jpg.
async function cropToFixedSize(filePath, sizeKey) {
  const size = BANNER_SIZES[sizeKey];
  if (!size) throw new Error('Unknown image size key: ' + sizeKey);
  const finalPath = await convertHeicIfNeeded(filePath);
  const Jimp = await getJimp();
  const image = await Jimp.read(finalPath);
  image.cover({ w: size.w, h: size.h });
  await image.write(finalPath);
  return path.basename(finalPath);
}

module.exports = { cropToFixedSize, BANNER_SIZES };
