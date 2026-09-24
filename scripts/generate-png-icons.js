import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const crcVal = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generatePng(width, height, isMaskable = false) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit depth
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // no interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw image bytes: (width * 4 + 1) * height
  const rowStride = width * 4 + 1;
  const rawData = Buffer.alloc(rowStride * height);

  const cx = width / 2;
  const cy = height / 2;
  const rGauge = width * 0.35;
  const crossW = width * 0.12;
  const crossH = width * 0.32;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowStride;
    rawData[rowOffset] = 0; // Filter: none

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Default background: dark slate (#0f172a)
      let r = 15;
      let g = 23;
      let b = 42;
      let a = 255;

      // Outer ring for gauge (cyan #06b6d4)
      if (dist >= rGauge - (width * 0.04) && dist <= rGauge + (width * 0.04)) {
        if (y < cy + rGauge * 0.7) {
          r = 6;
          g = 182;
          b = 212;
        }
      }

      // Medical Cross in Center (#10b981 emerald)
      const inVertBar = Math.abs(dx) <= crossW / 2 && Math.abs(dy) <= crossH / 2;
      const inHorizBar = Math.abs(dy) <= crossW / 2 && Math.abs(dx) <= crossH / 2;

      if (inVertBar || inHorizBar) {
        r = 16;
        g = 185;
        b = 129;
      }

      // Central dial dot (#38bdf8 sky)
      if (dist <= width * 0.04) {
        r = 56;
        g = 189;
        b = 248;
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', deflated);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. 192x192
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), generatePng(192, 192));
// 2. 512x512
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), generatePng(512, 512));
// 3. Maskable 512x512
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), generatePng(512, 512, true));
// 4. Apple Touch Icon 180x180
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generatePng(180, 180));

console.log('PNG Icons generated successfully in public/');
