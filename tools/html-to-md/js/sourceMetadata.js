export function httpUrl(value, base) {
  if (!value?.trim()) return '';
  try {
    const url = base ? new URL(value.trim(), base) : new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

export function sourceMetadata(doc, html) {
  const saved = html.match(/<!--\s*saved from url=\(\d+\)\s*(https?:\/\/[^\s]+?)\s*-->/i)?.[1];
  const canonical = doc.querySelector('link[rel~="canonical"]')?.getAttribute('href');
  const og = doc.querySelector('meta[property="og:url"]')?.getAttribute('content');
  const base = doc.querySelector('base[href]')?.getAttribute('href');
  const sourceUrl = [saved, canonical, og, base].map(value => httpUrl(value)).find(Boolean) || '';
  return { sourceUrl, title: doc.title.trim(), baseHref: base || '' };
}

export function resolveContentUrls(content, sourceUrl, baseHref = '') {
  const warnings = [];
  const base = httpUrl(baseHref, sourceUrl || undefined) || sourceUrl;
  let unresolved = false;
  content.querySelectorAll('img[data-md-src]').forEach(node => {
    node.setAttribute('src', node.getAttribute('data-md-src'));
    node.removeAttribute('data-md-src');
  });
  content.querySelectorAll('a[href], img[src]').forEach(node => {
    const attr = node.nodeName === 'A' ? 'href' : 'src';
    const value = node.getAttribute(attr)?.trim() || '';
    if (/^(?:javascript|vbscript):/i.test(value) || (attr === 'href' && /^data:/i.test(value))) {
      node.removeAttribute(attr);
      return;
    }
    if (/^[a-z][a-z\d+.-]*:/i.test(value)) return;
    if (!value) return;
    const resolved = base ? httpUrl(value, base) : '';
    if (resolved) node.setAttribute(attr, resolved);
    else unresolved = true;
  });
  if (unresolved) warnings.push('El archivo no conserva una dirección de origen suficiente. Algunos enlaces quedan relativos.');
  return warnings;
}
