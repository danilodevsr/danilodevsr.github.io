import { encodeIco } from './ico.js';
const $ = id => document.getElementById(id);
const input = $('fileInput'), mode = $('mode'), preset = $('preset'), format = $('format');
const quality = $('quality'), fit = $('fit'), generate = $('generateBtn'), download = $('downloadBtn');
const preview = $('preview'), status = $('status');
let image = null, fileName = '', result = null, busy = false, revision = 0, loadId = 0;
let previewUrls = [];
function message(text, error = false) {
  status.textContent = text;
  status.classList.toggle('error', error);
}
function clearPreview() {
  previewUrls.forEach(url => URL.revokeObjectURL(url));
  previewUrls = [];
  preview.replaceChildren();
  preview.hidden = true;
}
function invalidate() {
  revision++;
  result = null;
  download.disabled = true;
  generate.disabled = !image || busy;
  clearPreview();
}
function updateOptions() {
  const icon = mode.value === 'favicon';
  $('imageOptions').hidden = icon;
  $('faviconInfo').hidden = !icon;
  $('qualityControl').hidden = format.value === 'image/png';
  $('qualityVal').textContent = `${Math.round(quality.value * 100)} %`;
  invalidate();
  message(image ? 'Opciones listas. Genera una nueva vista previa.' : 'Elige una imagen para comenzar.');
}
mode.value = new URLSearchParams(location.search).get('mode') === 'favicon' ? 'favicon' : 'image';
if (mode.value === 'favicon') fit.value = 'contain';
mode.addEventListener('change', () => { fit.value = mode.value === 'favicon' ? 'contain' : 'cover'; updateOptions(); });
[preset, format, fit].forEach(control => control.addEventListener('change', updateOptions));
quality.addEventListener('input', updateOptions);
input.addEventListener('change', async () => {
  const current = ++loadId;
  image = null;
  invalidate();
  const file = input.files?.[0];
  $('fileMeta').textContent = 'Sin archivo seleccionado.';
  if (!file) return message('Elige una imagen para comenzar.');
  message('Leyendo imagen…');
  const url = URL.createObjectURL(file);
  try {
    const loaded = new Image();
    loaded.src = url;
    await loaded.decode();
    if (current !== loadId) return;
    image = loaded;
    fileName = file.name;
    if (['image/png', 'image/webp', 'image/jpeg'].includes(file.type)) format.value = file.type;
    $('fileMeta').textContent = `${file.name} · ${loaded.naturalWidth} × ${loaded.naturalHeight} px`;
    updateOptions();
  } catch {
    if (current === loadId) message('No se pudo leer la imagen. Prueba con un PNG, JPG o WebP válido.', true);
  } finally { URL.revokeObjectURL(url); }
});
function render(width, height, whiteBackground = false) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (whiteBackground) { context.fillStyle = '#fff'; context.fillRect(0, 0, width, height); }
  const scale = (fit.value === 'cover' ? Math.max : Math.min)(width / image.naturalWidth, height / image.naturalHeight);
  const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
  context.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
  return canvas;
}
function toBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo generar el archivo.')), type, quality));
}
function showImage(url, description) {
  const img = document.createElement('img');
  img.src = url; img.alt = description; img.className = 'preview-image';
  return img;
}
generate.addEventListener('click', async () => {
  if (!image || busy) return;
  invalidate();
  const currentRevision = revision;
  busy = true; generate.disabled = true;
  message('Generando…');
  try {
    let blob, name, description;
    if (mode.value === 'favicon') {
      const frames = [16, 32, 48].map(size => render(size, size));
      const pixels = frames.map(canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height));
      blob = new Blob([encodeIco(pixels)], {type: 'image/x-icon'});
      name = 'favicon.ico';
      description = 'ICO · 16 × 16, 32 × 32 y 48 × 48 px';
      const strip = document.createElement('div'); strip.className = 'icon-previews';
      frames.forEach(canvas => {
        const figure = document.createElement('figure');
        const img = showImage(canvas.toDataURL('image/png'), `Favicon a ${canvas.width} píxeles`);
        img.width = canvas.width; img.height = canvas.height;
        const caption = document.createElement('figcaption'); caption.textContent = `${canvas.width} × ${canvas.height}`;
        figure.append(img, caption); strip.append(figure);
      });
      preview.append(strip);
    } else {
      const [width, height] = preset.value === 'original' ? [image.naturalWidth, image.naturalHeight] : preset.value.split('x').map(Number);
      const canvas = render(width, height, format.value === 'image/jpeg');
      const requestedType = format.value;
      blob = await toBlob(canvas, requestedType, Number(quality.value));
      if (currentRevision !== revision) return;
      if (blob.type !== requestedType) throw new Error('Este navegador no puede exportar el formato elegido. Prueba con PNG.');
      const extension = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'}[blob.type];
      name = `${fileName.replace(/\.[^.]+$/, '')}_${width}x${height}.${extension}`;
      description = `${width} × ${height} px · ${extension.toUpperCase()}`;
      const url = URL.createObjectURL(blob); previewUrls.push(url);
      preview.append(showImage(url, 'Imagen convertida'));
    }
    if (currentRevision !== revision) return;
    result = {blob, name};
    preview.hidden = false; download.disabled = false;
    message(`${description} · ${(blob.size / 1024).toFixed(1)} KB · Listo para descargar.`);
  } catch (error) {
    if (currentRevision === revision) { clearPreview(); message(error.message || 'No se pudo generar el archivo.', true); }
  } finally { busy = false; generate.disabled = !image; }
});
download.addEventListener('click', () => {
  if (!result) return;
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement('a');
  link.href = url; link.download = result.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
updateOptions();
