export function parseHtmlString(htmlString) {
  if (!htmlString?.trim()) throw new Error('El HTML no contiene texto para convertir.');
  // Template contents are inert: no scripts, stylesheets or images are loaded.
  // Separate head metadata from body while removing resource-loading elements.
  const template = window.document.createElement('template');
  template.innerHTML = htmlString;
  const doc = window.document.implementation.createHTMLDocument('');
  doc.head.replaceChildren();
  template.content.querySelectorAll('script, iframe, object, embed, link:not([rel~="canonical"]), meta[http-equiv]').forEach(node => node.remove());
  template.content.querySelectorAll('img, source, video, audio, input').forEach(node => {
    if (node.hasAttribute('src')) {
      node.setAttribute('data-md-src', node.getAttribute('src'));
      node.removeAttribute('src');
    }
    node.removeAttribute('srcset');
    node.removeAttribute('poster');
    node.removeAttribute('autoplay');
  });
  template.content.querySelectorAll('title, meta, base, link[rel~="canonical"]').forEach(node => doc.head.append(node));
  doc.body.append(template.content);
  return doc;
}
