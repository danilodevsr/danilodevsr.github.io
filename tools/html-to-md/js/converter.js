import { parseHtmlString } from './htmlParser.js';
import { cleanDocumentContent } from './contentCleaner.js';
import { convertHtmlToMarkdown } from './markdownConverter.js';
import { sourceMetadata, httpUrl, resolveContentUrls } from './sourceMetadata.js';

export function convertDocument(html, { scope = 'auto', sourceUrl = '' } = {}) {
  const doc = parseHtmlString(html);
  const metadata = sourceMetadata(doc, html);
  const override = sourceUrl.trim();
  if (override && !httpUrl(override)) throw new Error('La URL original debe comenzar por http:// o https:// y ser válida.');
  const origin = override ? httpUrl(override) : metadata.sourceUrl;
  const extracted = cleanDocumentContent(doc, scope);
  const warnings = [...extracted.warnings, ...resolveContentUrls(extracted.content, origin, metadata.baseHref)];
  let markdown = convertHtmlToMarkdown(extracted.content);
  const title = extracted.title || metadata.title;
  const firstHeading = extracted.content.querySelector('h1, h2, h3, h4, h5, h6')?.textContent.trim();
  const normalize = value => (value || '').replace(/\s+/g, ' ').toLocaleLowerCase().trim();
  if (title && normalize(title) !== normalize(firstHeading)) {
    const escaped = title.replace(/\s+/g, ' ').replace(/[\\`*_\[\]<>]/g, '\\$&');
    markdown = `# ${escaped}\n\n${markdown}`;
  }
  if (origin) markdown += `\n\n---\nFuente: <${origin}>`;
  return { markdown, method: extracted.method, warnings, sourceUrl: origin };
}
