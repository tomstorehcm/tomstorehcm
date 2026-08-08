const { Jimp } = require('jimp');

const BANNER_SIZES = {
  hero: { w: 1800, h: 480 },
  featured: { w: 480, h: 840 },
  thumb: { w: 640, h: 640 },
  product: { w: 1000, h: 1000 }
};

async function cropToFixedSize(filePath, sizeKey) {
  const size = BANNER_SIZES[sizeKey];
  if (!size) throw new Error('Unknown image size key: ' + sizeKey);
  const image = await Jimp.read(filePath);
  image.cover({ w: size.w, h: size.h });
  await image.write(filePath);
}

module.exports = { cropToFixedSize, BANNER_SIZES };
