import { describeFile, getMarkdownFilename, readHtmlFile, validateHtmlFile } from './fileHandler.js';
import { convertDocument } from './converter.js';

const $ = id => document.getElementById(id);
const state = { file: null, html: '', markdown: '', filename: 'contenido.md', revision: 0 };
const fileInput = $('html-file'), scope = $('content-scope');
const convert = $('convert-btn'), copy = $('copy-btn'), download = $('download-btn');
const output = $('markdown-output');
function setStatus(message, type = 'info') {
  $('status').textContent = message;
  $('status').dataset.type = type;
}
function resetOutput() {
  state.markdown = '';
  output.value = '';
  $('output-meta').textContent = 'El resultado aparecerá aquí.';
  copy.disabled = download.disabled = true;
}
async function selectFile(file) {
  const revision = ++state.revision;
  state.file = null; state.html = '';
  convert.disabled = true;
  resetOutput();
  try {
    validateHtmlFile(file);
    $('file-summary').textContent = describeFile(file);
    setStatus('Leyendo HTML localmente…');
    const html = await readHtmlFile(file);
    if (revision !== state.revision) return;
    state.file = file; state.html = html;
    convert.disabled = false;
    setStatus('Archivo cargado. Puedes convertirlo.', 'success');
  } catch (error) {
    if (revision !== state.revision) return;
    fileInput.value = '';
    $('file-summary').textContent = describeFile(null);
    setStatus(error.message, 'error');
  }
}
function convertSelectedFile() {
  if (!state.file) return;
  resetOutput();
  try {
    const result = convertDocument(state.html, {scope: scope.value});
    state.markdown = result.markdown;
    state.filename = getMarkdownFilename(state.file);
    output.value = state.markdown;
    $('output-meta').textContent = `${result.method} · ${state.markdown.length.toLocaleString('es-PE')} caracteres.`;
    copy.disabled = download.disabled = false;
    const notice = result.warnings.join(' ');
    setStatus(notice || 'Conversión completada. El archivo permanece en tu navegador.', notice ? 'warning' : 'success');
  } catch (error) { setStatus(error.message, 'error'); }
}
async function copyMarkdown() {
  if (!state.markdown.trim()) return;
  try {
    await navigator.clipboard.writeText(state.markdown);
    setStatus('Markdown copiado.', 'success');
  } catch {
    output.focus(); output.select();
    const copied = document.execCommand('copy');
    setStatus(copied ? 'Markdown copiado.' : 'No se pudo copiar automáticamente. El texto está seleccionado: usa Ctrl+C o ⌘C.', copied ? 'success' : 'warning');
  }
}
function downloadMarkdown() {
  if (!state.markdown.trim()) return;
  const url = URL.createObjectURL(new Blob([state.markdown], {type: 'text/markdown;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url; link.download = state.filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus(`Descarga preparada: ${state.filename}`, 'success');
}
function clearAll() {
  state.revision++;
  state.file = null; state.html = ''; state.filename = 'contenido.md';
  fileInput.value = ''; scope.value = 'auto';
  $('file-summary').textContent = describeFile(null);
  convert.disabled = true;
  resetOutput(); setStatus('Listo para convertir.');
}
function optionsChanged() {
  resetOutput();
  setStatus(state.file ? 'Opciones cambiadas. Vuelve a convertir el archivo.' : 'Carga un HTML para comenzar.');
}
$('year').textContent = new Date().getFullYear();
fileInput.addEventListener('change', () => selectFile(fileInput.files?.[0]));
scope.addEventListener('change', optionsChanged);
convert.addEventListener('click', convertSelectedFile);
$('clear-btn').addEventListener('click', clearAll);
copy.addEventListener('click', copyMarkdown);
download.addEventListener('click', downloadMarkdown);
output.addEventListener('input', () => {
  state.markdown = output.value;
  copy.disabled = download.disabled = !state.markdown.trim();
  $('output-meta').textContent = `${state.markdown.length.toLocaleString('es-PE')} caracteres · editado.`;
});
const dropZone = $('drop-zone');
['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, event => {
  event.preventDefault(); dropZone.classList.add('drag-over');
}));
['dragleave', 'drop'].forEach(name => dropZone.addEventListener(name, event => {
  event.preventDefault(); dropZone.classList.remove('drag-over');
}));
dropZone.addEventListener('drop', event => {
  const [file] = event.dataTransfer.files;
  if (file) selectFile(file);
});
