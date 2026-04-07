/**
 * RTF → HTML conversion pipeline.
 *
 * Pre-processes TIS RTF (image placeholders, text substitution),
 * converts via pandoc, then post-processes the HTML output
 * (flatten nested tables, image sentinels, hotspot links).
 */

import { execSync } from 'node:child_process';

/**
 * Convert GRAFIK placeholder path from RTF format to images.db id format.
 *
 * RTF placeholder:  N:GRAFIK\1\13\97\26.itw;11.005cm;8.324cm;TIFF;
 * images.db id:     1/13/97/26.png
 */
const graphicPlaceholderToImageId = (placeholder: string): string | null => {
  const match = placeholder.match(/N:GRAFIK\\([^;]+\.itw)/i);
  if (!match) return null;
  const itwPath = match[1]; // e.g. "1\13\97\26.itw"
  return itwPath.replace(/\\/g, '/').replace(/\.itw$/i, '.png');
};

/**
 * Pre-process RTF content before sending to pandoc:
 * 1. Replace image placeholders (.Z. / N:GRAFIK\...) with sentinel tokens.
 * 2. Replace text placeholders (--TYP--, --FGSTNR--, etc.) with their values.
 */
export const preprocessRtf = (
  rtf: string,
  textPlaceholders: Record<string, string>,
): { processed: string; imageMap: Map<string, string> } => {
  const imageMap = new Map<string, string>(); // sentinel → imageId

  // Strip the font table group from RTF to prevent pandoc from leaking font names
  let processed = rtf.replace(
    /\{[^{}]*\\fonttbl\s*(?:\{[^}]*\}\s*)*\}/g,
    '',
  );

  // Replace GRAFIK image references
  processed = processed.replace(
    /\\plain\\v[^]*?N:GRAFIK(\\[^;]+\.itw;[^;]*;[^;]*;[^;]*;)/gi,
    (_match, pathAndAttrs) => {
      const fullToken = `N:GRAFIK${pathAndAttrs}`;
      const imageId = graphicPlaceholderToImageId(fullToken);
      if (!imageId) return '';
      const sentinel = `__IMG_${imageId.replace(/[/.]/g, '_')}__`;
      imageMap.set(sentinel, imageId);
      return `\\plain\\f0 ${sentinel}`;
    },
  );

  // Replace text placeholders
  for (const [placeholder, value] of Object.entries(textPlaceholders)) {
    const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    processed = processed.replace(new RegExp(escaped, 'g'), value);
  }

  return { processed, imageMap };
};

/**
 * Flatten deeply-nested tables produced by pandoc from TIS RTF layout tables.
 *
 * PANDOC LIMITATION — CANDIDATE FOR CUSTOM RTF RENDERER:
 * This entire function exists to work around a fundamental pandoc limitation with
 * multi-row RTF tables. See the original source for full rationale.
 */
export const flattenNestedTables = (html: string): string => {
  const nestedCount = (html.match(/<td><table>/g) || []).length;
  if (nestedCount < 3) return html;

  // Step 1: Find top-level table sections by tracking open/close depth
  const sections: Array<{ start: number; end: number; content: string }> = [];
  let depth = 0;
  let sectionStart = -1;
  const tagRe = /<(\/?)(table)>/g;
  let tagMatch;
  while ((tagMatch = tagRe.exec(html)) !== null) {
    if (tagMatch[1] === '') {
      if (depth === 0) sectionStart = tagMatch.index;
      depth++;
    } else {
      depth--;
      if (depth === 0 && sectionStart !== -1) {
        const end = tagMatch.index + tagMatch[0].length;
        sections.push({
          start: sectionStart,
          end,
          content: html.substring(sectionStart, end),
        });
      }
    }
  }

  // Step 2: Identify the deeply nested section
  let nestedIdx = -1;
  for (let i = 0; i < sections.length; i++) {
    const innerNest = (sections[i].content.match(/<td><table>/g) || []).length;
    if (innerNest >= 3) {
      nestedIdx = i;
      break;
    }
  }
  if (nestedIdx === -1) return html;

  // Step 3: Extract rows from the nested section
  const nestedHtml = sections[nestedIdx].content;
  const rows: Array<{ left: string; right: string }> = [];
  let searchFrom = 0;
  while (true) {
    const closeIdx = nestedHtml.indexOf('</table>', searchFrom);
    if (closeIdx === -1) break;
    searchFrom = closeIdx + 8;

    const afterClose = nestedHtml.substring(searchFrom);
    const leftEndIdx = afterClose.indexOf('</td>');
    if (leftEndIdx === -1) continue;
    const leftContent = afterClose.substring(0, leftEndIdx).trim();

    if (
      leftContent.includes('<table>') ||
      leftContent.includes('</table>')
    )
      continue;

    const afterLeftTd = afterClose.substring(leftEndIdx + 5);
    const rightStartMatch = afterLeftTd.match(/^\s*<td>/);
    if (!rightStartMatch) continue;
    const rightStart = rightStartMatch[0].length;
    const rightHtml = afterLeftTd.substring(rightStart);

    const rightEndIdx = rightHtml.indexOf('</td>');
    if (rightEndIdx === -1) continue;
    const rightContent = rightHtml.substring(0, rightEndIdx).trim();

    if (
      rightContent.includes('<table>') ||
      rightContent.includes('</table>')
    )
      continue;

    if (rightContent) rows.push({ left: leftContent, right: rightContent });
  }

  if (rows.length < 2) return html;

  // Step 4: Collect content between top-level sections
  const betweenParts: string[] = [];
  for (let i = 0; i < sections.length - 1; i++) {
    const between = html
      .substring(sections[i].end, sections[i + 1].start)
      .trim();
    if (between && !between.match(/^>?\s*$/)) {
      betweenParts.push(between);
    }
  }

  // Step 5: Rebuild as flat two-column table
  const flatRows = rows
    .map(
      (row) =>
        `<tr><td class="tis-img-cell">${row.left}</td><td class="tis-text-cell">${row.right}</td></tr>`,
    )
    .join('\n');
  const flatTable = `<table class="tis-layout-table">\n<tbody>\n${flatRows}\n</tbody>\n</table>`;

  // Step 6: Reconstruct full HTML
  const parts: string[] = [];
  for (let i = 0; i < nestedIdx; i++) {
    const isEmptyTable = sections[i].content.match(
      /^<table>\s*<tbody>\s*<tr>\s*<\/tr>\s*<\/tbody>\s*<\/table>$/,
    );
    if (!isEmptyTable) parts.push(sections[i].content);

    if (i < betweenParts.length) {
      const bp = betweenParts[i];
      if (bp && bp !== '>') parts.push(bp);
    }
  }
  if (nestedIdx > 0 && nestedIdx - 1 < betweenParts.length) {
    const bp = betweenParts[nestedIdx - 1];
    if (bp && bp !== '>' && !parts.includes(bp)) parts.push(bp);
  }
  parts.push(flatTable);
  const after = html.substring(sections[nestedIdx].end).trim();
  if (after) parts.push(after);

  return parts.join('\n');
};

/**
 * Post-process the HTML output from pandoc:
 * 1. Flatten nested tables from RTF layout tables.
 * 2. Replace sentinel tokens with <img> tags that load from /api/images/:id
 * 3. Convert <del> tags (from RTF \strike) to cross-reference links.
 *
 * @param imageBaseUrl - Base URL for image src attributes (default: "/api/images")
 */
export const postprocessHtml = (
  html: string,
  imageMap: Map<string, string>,
  imageBaseUrl: string = '/api/images',
): string => {
  let result = html
    .replace(
      /<p>(?:Helvetica|Symbol|Courier|Times)[;,](?:(?:Helvetica|Symbol|Courier|Times)[;,])*\s*<\/p>\n?/g,
      '',
    )
    .replace(
      /(<p>)(?:Helvetica|Symbol|Courier|Times)[;,](?:(?:Helvetica|Symbol|Courier|Times)[;,])*\s*/g,
      '$1',
    )
    .replace(/\u00b7/g, '\u2022');

  result = flattenNestedTables(result);

  for (const [sentinel, imageId] of imageMap) {
    const escapedSentinel = sentinel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(
      new RegExp(escapedSentinel, 'g'),
      `<img src="${imageBaseUrl}/${imageId}" alt="Technical illustration" class="tis-inline-image" loading="lazy" />`,
    );
  }

  let hotspotCounter = 0;
  result = result.replace(
    /<del>([\s\S]*?)<\/del>/g,
    (_match, innerText: string) => {
      hotspotCounter++;
      const displayText = innerText.replace(/\n/g, ' ');
      return `<a class="tis-cross-ref" data-hotspot="${hotspotCounter}" href="#">${displayText}</a>`;
    },
  );

  return result;
};

/**
 * Convert RTF content to HTML via pandoc, with pre/post processing for placeholders.
 *
 * @param imageBaseUrl - Base URL for image src attributes (default: "/api/images")
 */
export const rtfToHtml = (
  rtfContent: string,
  textPlaceholders: Record<string, string>,
  imageBaseUrl: string = '/api/images',
): string => {
  const { processed, imageMap } = preprocessRtf(rtfContent, textPlaceholders);

  try {
    const inputBuffer = Buffer.from(processed, 'latin1');
    const outputBuffer = execSync('pandoc -f rtf -t html', {
      input: inputBuffer,
      maxBuffer: 10 * 1024 * 1024,
    });
    const html = outputBuffer.toString('utf-8');
    return postprocessHtml(html, imageMap, imageBaseUrl);
  } catch (err) {
    console.error('Pandoc RTF→HTML conversion failed:', err);
    return `<pre style="white-space:pre-wrap">${processed.replace(/</g, '&lt;')}</pre>`;
  }
};
