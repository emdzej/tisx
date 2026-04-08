/**
 * RTF → HTML conversion.
 *
 * Delegates to @emdzej/tisx-rtf — a custom renderer that natively handles
 * TIS-specific RTF extensions (GRAFIK images, \strike cross-references,
 * text placeholders, Symbol font bullets).
 *
 * This replaces the previous pandoc-based pipeline and its pre/post processing.
 */

import { rtfToHtml as renderRtf } from '@emdzej/tisx-rtf';

/**
 * Convert RTF content to HTML.
 *
 * @param imageBaseUrl - Base URL for image src attributes (default: "/api/images")
 */
export const rtfToHtml = (
  rtfContent: string,
  textPlaceholders: Record<string, string>,
  imageBaseUrl: string = '/api/images',
): string => {
  try {
    return renderRtf(rtfContent, {
      textPlaceholders,
      imageBaseUrl,
    });
  } catch (err) {
    console.error('RTF→HTML conversion failed:', err);
    return `<pre style="white-space:pre-wrap">${rtfContent.replace(/</g, '&lt;')}</pre>`;
  }
};
