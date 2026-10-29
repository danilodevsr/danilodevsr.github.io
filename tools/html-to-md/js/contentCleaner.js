const REMOVABLE_SELECTORS = [
  'script', 'style', 'noscript', 'template', 'iframe', 'object', 'embed',
  'canvas', 'svg', '[hidden]', '[aria-hidden="true"]',
  'button', 'input', 'select', 'textarea'
];

function clean(root, auto = false) {
  const selectors = [...REMOVABLE_SELECTORS];
  if (auto) selectors.push('nav', 'footer', '.ads', '.advertisement');
  root.querySelectorAll(selectors.join(',')).forEach(node => node.remove());
  // Keep whitespace-only text nodes: they can separate inline words or code.
  return root;
}

function fallbackContent(doc) {
  // A section is not necessarily the whole document (e.g. multi-panel portals).
  const candidates = doc.querySelectorAll('main, article');
  if (candidates.length === 1) return candidates[0].cloneNode(true);
  return doc.body.cloneNode(true);
}

export function cleanDocumentContent(doc, scope = 'auto') {
  if (!doc.body?.textContent.trim()) throw new Error('El HTML no contiene texto útil para convertir.');
  if (scope === 'full') {
    const content = clean(doc.body.cloneNode(true));
    if (!content.textContent.trim()) throw new Error('El HTML no contiene texto útil para convertir.');
    return { content, method: 'Página completa', warnings: [] };
  }
  const warnings = [];
  const clone = doc.cloneNode(true);
  clean(clone, true);
  // Readability strips presentation attributes/classes; retain conversion metadata.
  clone.querySelectorAll('th, td').forEach(cell => {
    const alignment = cell.getAttribute('align') || cell.style.textAlign;
    if (alignment) cell.setAttribute('data-md-align', alignment);
  });
  clone.querySelectorAll('pre').forEach(pre => {
    const classes = `${pre.className} ${pre.querySelector('code')?.className || ''}`;
    const language = classes.match(/(?:language|lang)-([a-zA-Z0-9_+-]+)/)?.[1];
    if (language) pre.setAttribute('data-md-language', language);
  });
  let article = null;
  try {
    if (typeof window.Readability === 'function') article = new window.Readability(clone).parse();
  } catch { /* Fall back to document structure, without dropping all content. */ }
  if (article?.content && article.textContent?.trim()) {
    const template = doc.createElement('template');
    template.innerHTML = article.content;
    const content = doc.createElement('div');
    content.append(template.content.cloneNode(true));
    clean(content, true);
    return { content, title: article.title || '', method: 'Contenido principal', warnings };
  }
  const content = clean(fallbackContent(doc), true);
  if (!content.textContent.trim()) throw new Error('No se encontró texto útil. Prueba con Página completa.');
  warnings.push('No se identificó un artículo. Se conservó el contenido disponible; usa Página completa si faltan secciones.');
  return { content, method: 'Extracción alternativa', warnings };
}
