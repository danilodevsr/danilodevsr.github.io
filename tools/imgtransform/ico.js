// ICO directory + uncompressed 32-bit DIBs, with bottom-up BGRA and AND masks.
export function encodeIco(frames) {
  const headerSize = 6 + 16 * frames.length;
  const sizes = frames.map(({width, height}) => 40 + width * height * 4 + Math.ceil(width / 32) * 4 * height);
  const bytes = new Uint8Array(headerSize + sizes.reduce((a, b) => a + b, 0));
  const view = new DataView(bytes.buffer);
  view.setUint16(2, 1, true);
  view.setUint16(4, frames.length, true);
  let offset = headerSize;
  frames.forEach(({width, height, data}, index) => {
    const entry = 6 + index * 16;
    bytes[entry] = width === 256 ? 0 : width;
    bytes[entry + 1] = height === 256 ? 0 : height;
    view.setUint16(entry + 4, 1, true);
    view.setUint16(entry + 6, 32, true);
    view.setUint32(entry + 8, sizes[index], true);
    view.setUint32(entry + 12, offset, true);
    view.setUint32(offset, 40, true);
    view.setInt32(offset + 4, width, true);
    view.setInt32(offset + 8, height * 2, true);
    view.setUint16(offset + 12, 1, true);
    view.setUint16(offset + 14, 32, true);
    view.setUint32(offset + 20, sizes[index] - 40, true);
    const maskStart = offset + 40 + width * height * 4;
    const maskStride = Math.ceil(width / 32) * 4;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const source = (y * width + x) * 4;
        const row = height - 1 - y;
        const target = offset + 40 + (row * width + x) * 4;
        bytes.set([data[source + 2], data[source + 1], data[source], data[source + 3]], target);
        if (data[source + 3] === 0) bytes[maskStart + row * maskStride + (x >> 3)] |= 128 >> (x % 8);
      }
    }
    offset += sizes[index];
  });
  return bytes;
}
