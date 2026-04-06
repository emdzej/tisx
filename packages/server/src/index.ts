import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import type {
  DocType,
  DocumentDetail,
  DocumentListItem,
  DocumentResponse,
  Engine,
  GroupNode,
  Model,
  Series,
  SymptomNode,
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.TIS_DB_PATH ?? './data/tis.sqlite';

const parseId = (value: string): number | null => {
  const id = Number.parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
};

const padDocTypeId = (docTypeId: number) => String(docTypeId).padStart(6, '0');

/**
 * Parse a comma-separated query param into an array of numbers.
 * Returns an empty array if the param is missing or malformed.
 */
const parseIdList = (value: string | undefined): number[] => {
  if (!value) return [];
  return value.split(',').map(Number).filter((n) => !Number.isNaN(n));
};

/**
 * Validate that a table name exists in the database AND matches one of the
 * known TIS dynamic-table patterns. This prevents SQL injection via table
 * names which can't be parameterized in prepared statements.
 *
 * Allowed patterns (all uppercase, 6-digit zero-padded suffix):
 *   TZUKN{nnnnnn}, TGRR{nnnnnn}, THGR{nnnnnn}, TKNHG{nnnnnn}
 *
 * The table name is first checked against the regex allowlist, then
 * confirmed to exist via a parameterized sqlite_master lookup.
 */
const SAFE_DYNAMIC_TABLE_RE = /^(TZUKN|TGRR|THGR|TKNHG)\d{6}$/;

const safeDynamicTable = (
  db: Database.Database,
  tableName: string,
): string | null => {
  if (!SAFE_DYNAMIC_TABLE_RE.test(tableName)) {
    return null;
  }
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(tableName) as { name?: string } | undefined;
  return row?.name ?? null;
};

const getDocType = (db: Database.Database, docTypeId: number): DocType | null => {
  const row = db
    .prepare(
      'SELECT DOKART_ID as id, DOKART_KZ as code, DOKART_BEZ as name, HGNAME as mainGroupLabel, UGNAME as subGroupLabel, METHODE as methode, ZUGRIFF as zugriff, FZG_REQU as fzgRequ FROM TDOKART WHERE DOKART_ID = ?',
    )
    .get(docTypeId) as DocType | undefined;
  return row ?? null;
};

/**
 * Apply variant filtering to a list of group nodes based on the selected vehicle.
 *
 * Variant system:
 *   VARIANT_ART 0    → no variant dimension; always shown
 *   VARIANT_ART 3000 → engine (MOTOR_ID)
 *   VARIANT_ART 4000 → body (KAROSSERIE_ID)
 *   VARIANT_ART 5000 → gearbox (GETRIEBE_ID)
 *
 * For each (knoten_kz, VARIANT_ART) group:
 *   - If specific variant rows (VARIANT_WERT > 0) match the vehicle → keep those, drop generic
 *   - If no specific variants match → keep only the generic (VARIANT_WERT = 0) row
 *   - VARIANT_ART = 0 rows always pass through
 *
 * If no vehicle variant IDs are provided at all, returns all nodes unfiltered.
 */
const filterVariants = (
  nodes: GroupNode[],
  engineId: number | null,
  bodyIds: number[],
  gearboxIds: number[],
): GroupNode[] => {
  // If no variant IDs to filter against, return everything
  if (engineId === null && bodyIds.length === 0 && gearboxIds.length === 0) {
    return nodes;
  }

  const result: GroupNode[] = [];
  // Map: "code|variantArt" → node[]
  const groups = new Map<string, GroupNode[]>();

  for (const node of nodes) {
    if (node.variantArt === 0) {
      result.push(node);
      continue;
    }
    const key = `${node.code}|${node.variantArt}`;
    let group = groups.get(key);
    if (!group) {
      group = [];
      groups.set(key, group);
    }
    group.push(node);
  }

  for (const [, group] of groups) {
    const variantArt = group[0].variantArt;
    let vehicleIds: number[];
    if (variantArt === 3000) {
      vehicleIds = engineId !== null ? [engineId] : [];
    } else if (variantArt === 4000) {
      vehicleIds = bodyIds;
    } else if (variantArt === 5000) {
      vehicleIds = gearboxIds;
    } else {
      result.push(...group);
      continue;
    }

    if (vehicleIds.length === 0) {
      const generic = group.filter((n) => n.variantWert === 0);
      result.push(...(generic.length > 0 ? generic : group));
      continue;
    }

    const specific = group.filter((n) => n.variantWert > 0 && vehicleIds.includes(n.variantWert));
    if (specific.length > 0) {
      result.push(...specific);
    } else {
      const generic = group.filter((n) => n.variantWert === 0);
      result.push(...(generic.length > 0 ? generic : []));
    }
  }

  // Re-sort by original ordering fields
  result.sort((a, b) => {
    const codeA = a.code ?? '';
    const codeB = b.code ?? '';
    if (codeA < codeB) return -1;
    if (codeA > codeB) return 1;
    if (a.variantArt !== b.variantArt) return a.variantArt - b.variantArt;
    return a.variantWert - b.variantWert;
  });

  return result;
};

/**
 * Build SQL WHERE clauses and params for vehicle filtering on TFZGREFBR.
 * Handles series, model, engine, body, and gearbox filters.
 *
 * KAROSSERIE_ID is never 0 in TFZGREFBR (always in 14001-14012 range),
 * so we filter with a simple IN (...).
 *
 * GETRIEBE_ID can be 0 (meaning "applies to all gearbox types"),
 * so we use (GETRIEBE_ID IN (...) OR GETRIEBE_ID = 0).
 *
 * Returns { clauses: string[], params: number[] } to be appended to a WHERE.
 */
const buildVehicleFilter = (query: {
  series?: string;
  model?: string;
  engine?: string;
  body?: string;
  gearbox?: string;
}, alias: string = 'f'): { clauses: string[]; params: number[]; hasVehicle: boolean } => {
  const seriesId = parseId(query.series as string);
  const modelId = parseId(query.model as string);
  const engineId = parseId(query.engine as string);
  const bodyIds = parseIdList(query.body as string);
  const gearboxIds = parseIdList(query.gearbox as string);

  const clauses: string[] = [];
  const params: number[] = [];

  if (seriesId !== null) {
    clauses.push(`${alias}.BAUREIHE_ID = ?`);
    params.push(seriesId);
  }
  if (modelId !== null) {
    clauses.push(`${alias}.MODELL_ID = ?`);
    params.push(modelId);
  }
  if (engineId !== null) {
    clauses.push(`${alias}.MOTOR_ID = ?`);
    params.push(engineId);
  }
  if (bodyIds.length > 0) {
    clauses.push(`${alias}.KAROSSERIE_ID IN (${bodyIds.map(() => '?').join(', ')})`);
    params.push(...bodyIds);
  }
  if (gearboxIds.length > 0) {
    clauses.push(`(${alias}.GETRIEBE_ID IN (${gearboxIds.map(() => '?').join(', ')}) OR ${alias}.GETRIEBE_ID = 0)`);
    params.push(...gearboxIds);
  }

  return { clauses, params, hasVehicle: seriesId !== null };
};

/**
 * Decode raw bytes from better-sqlite3 into a string.
 * RTF files are Windows-1252 / latin-1 encoded.
 * better-sqlite3 returns BLOBs as Buffers.
 */
const decodeContent = (raw: Buffer | string): string => {
  if (Buffer.isBuffer(raw)) {
    return raw.toString('latin1');
  }
  return String(raw ?? '');
};

/**
 * Convert GRAFIK placeholder path from RTF format to images.db id format.
 *
 * RTF placeholder:  N:GRAFIK\1\13\97\26.itw;11.005cm;8.324cm;TIFF;
 * images.db id:     1/13/97/26.png
 *
 * The path segment after N:GRAFIK\ uses backslash separators and has a .itw extension;
 * the DB id uses forward slashes and .png extension.
 */
const graphicPlaceholderToImageId = (placeholder: string): string | null => {
  // placeholder is the full token, e.g. "N:GRAFIK\1\13\97\26.itw;11.005cm;8.324cm;TIFF;"
  // In RTF the backslashes are escaped as \\, but by the time we process the string they are single \
  const match = placeholder.match(/N:GRAFIK\\([^;]+\.itw)/i);
  if (!match) return null;
  const itwPath = match[1]; // e.g. "1\13\97\26.itw"
  return itwPath.replace(/\\/g, '/').replace(/\.itw$/i, '.png');
};

/**
 * Pre-process RTF content before sending to pandoc:
 * 1. Replace image placeholders (.Z. / N:GRAFIK\...) with an HTML <img> tag embedded via a
 *    raw-HTML RTF field that pandoc will pass through verbatim using \htmlrtf.
 *    Because pandoc does not support inline raw HTML in RTF, we use a simpler trick:
 *    replace the entire hidden-text block containing the GRAFIK reference with a plain-text
 *    sentinel token that we can find and replace in the output HTML.
 * 2. Replace text placeholders (--TYP--, --FGSTNR--, etc.) with their values.
 */
const preprocessRtf = (
  rtf: string,
  textPlaceholders: Record<string, string>,
): { processed: string; imageMap: Map<string, string> } => {
  const imageMap = new Map<string, string>(); // sentinel → imageId

  // Strip the font table group from RTF to prevent pandoc from leaking font names
  // (e.g. "Helvetica;Symbol;") as literal text in the HTML output.
  // Actual structure: {\deff0\fonttbl{\f0\fswiss Helvetica;}{\f1\ftech Symbol;}\n}
  // The outer braces may contain \deffN before \fonttbl, so match the whole group.
  let processed = rtf.replace(
    /\{[^{}]*\\fonttbl\s*(?:\{[^}]*\}\s*)*\}/g,
    '',
  );

  // Replace GRAFIK image references.
  // Pattern in RTF: \plain\v\f0\fs<N> .Z.\n\plain\f0\fs<N> N:GRAFIK\path\to\file.itw;...;
  // The \v marks "hidden text" in RTF.  We remove the entire hidden+visible block and replace
  // with a unique sentinel that we can post-process in the HTML output.
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
    // Escape the placeholder for use in a regex (it may contain -- which is fine, but be safe)
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
 * multi-row RTF tables. TIS RTF uses a standard pattern where each table row has its
 * own \trowd column definition, separated by \pard\plain\sl-1\par spacers. Pandoc
 * treats each \trowd after a row break as a NEW table context, producing deeply
 * nested HTML instead of a flat table. This affects the majority of RA (repair
 * instruction) documents which use two-column layout (image left, text right).
 *
 * A custom RTF-to-HTML renderer that understands the TIS RTF dialect would eliminate
 * the need for this post-processing entirely, and could also handle other TIS-specific
 * RTF conventions (GRAFIK references, \strike hotspots, \v hidden text) natively
 * instead of through the current pre/post-processing pipeline. Given that the TIS RTF
 * subset is relatively small (no nested groups, limited control words), a purpose-built
 * renderer would likely be simpler and more reliable than the pandoc + fixup approach.
 *
 * The nesting pattern pandoc produces:
 *
 *   <table><tr>
 *     <td><table><tr>           ← level 2
 *       <td><table><tr>         ← level 3
 *         ...
 *           <td><table><tr></tr></tbody></table>  ← innermost empty
 *           <p>GRAFIK</p></td>                     ← left cell (image)
 *           <td>...text...</td>                    ← right cell (text)
 *         </tr><tr><td></td><td></td></tr></tbody></table>
 *         <p>GRAFIK</p></td>
 *         <td>...text...</td>
 *       </tr>...
 *
 * This function detects such structures and rebuilds them as a flat 2-column table.
 */
const flattenNestedTables = (html: string): string => {
  // Only process if we detect the nested pattern: <td><table> appearing 3+ times
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
        sections.push({ start: sectionStart, end, content: html.substring(sectionStart, end) });
      }
    }
  }

  // Step 2: Identify the deeply nested section (the one with 3+ levels of <td><table>)
  let nestedIdx = -1;
  for (let i = 0; i < sections.length; i++) {
    const innerNest = (sections[i].content.match(/<td><table>/g) || []).length;
    if (innerNest >= 3) {
      nestedIdx = i;
      break;
    }
  }
  if (nestedIdx === -1) return html; // no deeply nested section found

  // Step 3: Extract rows from the nested section.
  // After each </table> inside the nested block, the pattern is:
  //   {left-content}</td>\s*<td>{right-content}</td>
  // where neither left nor right content contains <table> or </table> tags.
  // We use indexOf-based parsing instead of regex to avoid catastrophic backtracking.
  const nestedHtml = sections[nestedIdx].content;
  const rows: Array<{ left: string; right: string }> = [];
  let searchFrom = 0;
  while (true) {
    const closeIdx = nestedHtml.indexOf('</table>', searchFrom);
    if (closeIdx === -1) break;
    searchFrom = closeIdx + 8;

    const afterClose = nestedHtml.substring(searchFrom);
    // Find the next </td> — this ends the left cell
    const leftEndIdx = afterClose.indexOf('</td>');
    if (leftEndIdx === -1) continue;
    const leftContent = afterClose.substring(0, leftEndIdx).trim();

    // Left content must not contain table tags (would mean we're at the wrong nesting level)
    if (leftContent.includes('<table>') || leftContent.includes('</table>')) continue;

    // After </td>, expect whitespace then <td> for the right cell
    const afterLeftTd = afterClose.substring(leftEndIdx + 5);
    const rightStartMatch = afterLeftTd.match(/^\s*<td>/);
    if (!rightStartMatch) continue;
    const rightStart = rightStartMatch[0].length;
    const rightHtml = afterLeftTd.substring(rightStart);

    // Find the closing </td> for the right cell
    const rightEndIdx = rightHtml.indexOf('</td>');
    if (rightEndIdx === -1) continue;
    const rightContent = rightHtml.substring(0, rightEndIdx).trim();

    // Right content must not contain table tags either
    if (rightContent.includes('<table>') || rightContent.includes('</table>')) continue;

    if (rightContent) rows.push({ left: leftContent, right: rightContent });
  }

  if (rows.length < 2) return html; // not enough rows extracted

  // Step 4: Collect content between top-level sections (e.g. "Note:" paragraphs)
  const betweenParts: string[] = [];
  for (let i = 0; i < sections.length - 1; i++) {
    const between = html.substring(sections[i].end, sections[i + 1].start).trim();
    // Skip font leak artifacts (already handled by font cleanup, but filter here too)
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
  // Keep: everything before the nested section (header tables, between-content)
  // Replace: the nested section with the flat table
  // Keep: everything after the nested section
  const before = html.substring(0, sections[nestedIdx].start).trim();
  const after = html.substring(sections[nestedIdx].end).trim();

  const parts: string[] = [];
  // Include non-nested tables before the nested one (e.g. header table),
  // skipping empty pandoc artifact tables
  for (let i = 0; i < nestedIdx; i++) {
    const isEmptyTable = sections[i].content.match(
      /^<table>\s*<tbody>\s*<tr>\s*<\/tr>\s*<\/tbody>\s*<\/table>$/,
    );
    if (!isEmptyTable) parts.push(sections[i].content);

    // Add between-section content (e.g. "Note:" paragraphs)
    if (i < betweenParts.length) {
      const bp = betweenParts[i];
      // Skip the ">" artifact from font-leak cleanup
      if (bp && bp !== '>') parts.push(bp);
    }
  }
  // Add between content just before the nested section
  if (nestedIdx > 0 && nestedIdx - 1 < betweenParts.length) {
    const bp = betweenParts[nestedIdx - 1];
    if (bp && bp !== '>' && !parts.includes(bp)) parts.push(bp);
  }
  parts.push(flatTable);
  if (after) parts.push(after);

  return parts.join('\n');
};

/**
 * Post-process the HTML output from pandoc:
 * 1. Flatten nested tables from RTF layout tables.
 * 2. Replace sentinel tokens with <img> tags that load from /api/images/:id
 * 3. Convert <del> tags (from RTF \strike) to cross-reference links.
 *    Each <del> is numbered sequentially (1-based) with a data-hotspot attribute.
 *    The frontend resolves targets via /api/document/:id/hotspots using these numbers.
 */
const postprocessHtml = (html: string, imageMap: Map<string, string>): string => {
  // Pandoc leaks the RTF font table ({\fonttbl{\f0\fswiss Helvetica;}{\f1\ftech Symbol;}})
  // as literal text anywhere in the output. Two forms:
  //   standalone:  <p>Helvetica;Symbol;</p>  → remove entirely
  //   mixed:       <p>Helvetica;Symbol;<strong>title</strong></p>  → strip prefix only
  // Also catch any semicolon-separated font name lists that pandoc may produce.
  let result = html
    .replace(/<p>(?:Helvetica|Symbol|Courier|Times)[;,](?:(?:Helvetica|Symbol|Courier|Times)[;,])*\s*<\/p>\n?/g, '')
    .replace(/(<p>)(?:Helvetica|Symbol|Courier|Times)[;,](?:(?:Helvetica|Symbol|Courier|Times)[;,])*\s*/g, '$1')
    // Symbol font's \'b7 (middle dot U+00B7) is used as a bullet in TIS RTF.
    // Pandoc renders it as '·' — replace with proper bullet '•' (U+2022).
    .replace(/\u00b7/g, '\u2022');

  // Flatten deeply-nested tables before processing sentinels/hotspots,
  // since flattening rearranges the HTML structure.
  result = flattenNestedTables(result);

  for (const [sentinel, imageId] of imageMap) {
    const escapedSentinel = sentinel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // The sentinel might be wrapped in <p>, <td>, or other tags — replace just the text node
    result = result.replace(
      new RegExp(escapedSentinel, 'g'),
      `<img src="/api/images/${imageId}" alt="Technical illustration" class="tis-inline-image" loading="lazy" />`,
    );
  }

  // Convert <del> tags (from RTF \strike) to cross-reference links.
  // The Nth <del> block corresponds to HOTSPOT_NR = N in the THOTSPOT table.
  // We number them sequentially and embed a data-hotspot attribute so the
  // frontend can resolve targets via the /api/document/:id/hotspots endpoint.
  let hotspotCounter = 0;
  result = result.replace(/<del>([\s\S]*?)<\/del>/g, (_match, innerText: string) => {
    hotspotCounter++;
    const displayText = innerText.replace(/\n/g, ' ');
    return `<a class="tis-cross-ref" data-hotspot="${hotspotCounter}" href="#">${displayText}</a>`;
  });

  return result;
};

/**
 * Convert RTF content to HTML via pandoc, with pre/post processing for placeholders.
 */
const rtfToHtml = (
  rtfContent: string,
  textPlaceholders: Record<string, string>,
): string => {
  const { processed, imageMap } = preprocessRtf(rtfContent, textPlaceholders);

  try {
    // Input: RTF is ANSI/Latin-1 — encode the JS string as Latin-1 bytes for pandoc's stdin.
    // Output: pandoc always emits UTF-8 HTML — read as buffer and decode as UTF-8.
    const inputBuffer = Buffer.from(processed, 'latin1');
    const outputBuffer = execSync('pandoc -f rtf -t html', {
      input: inputBuffer,
      maxBuffer: 10 * 1024 * 1024, // 10 MB
    });
    const html = outputBuffer.toString('utf-8');
    return postprocessHtml(html, imageMap);
  } catch (err) {
    console.error('Pandoc RTF→HTML conversion failed:', err);
    // Return a minimal fallback showing the raw text
    return `<pre style="white-space:pre-wrap">${processed.replace(/</g, '&lt;')}</pre>`;
  }
};

const main = async () => {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });

  // Memory-map the file for faster reads (256 MB window)
  db.pragma('mmap_size = 268435456');

  const app = express();
  app.use(cors());
  app.use(express.json());

  const assetsPath = join(__dirname, '..', 'assets');
  app.use('/assets', express.static(assetsPath));

  // In production Docker: /app/dist -> /app/web/build
  // In dev: packages/server/dist -> packages/web/build
  const webBuildPath = process.env.WEB_BUILD_PATH || join(__dirname, '..', 'web', 'build');

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  /**
   * GET /api/images/:id
   * Serve an image from the IMAGES table by its id (e.g. 1/13/97/26.PNG).
   * The id is passed as a wildcard path segment.
   */
  const getImageStmt = db.prepare(
    'SELECT data, content_type FROM IMAGES WHERE id = ? LIMIT 1',
  );

  app.get('/api/images/*', (req, res) => {
    const imageId = (req.params as Record<string, string>)[0];
    if (!imageId) {
      res.status(400).json({ error: 'Invalid image id' });
      return;
    }

    const row = getImageStmt.get(imageId.toUpperCase()) as
      | { data: Buffer; content_type: string }
      | undefined;

    if (!row) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    res.set('Content-Type', row.content_type || 'image/png');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(row.data);
  });

  /**
   * GET /api/docs/:path
   * Serve document content from the DOCS table.
   * Supports ?format=html to convert RTF → HTML via pandoc.
   * Accepts browsing-context query params for placeholder substitution:
   *   ?typ=<vehicle type>
   *   ?fgstnr=<chassis/VIN number>
   *   ?modell=<model designation>
   *   ?motor=<engine designation>
   *   ?kaross=<body type>
   *   &series=<series id>    (informational, for display)
   *   &model=<model id>      (informational, for display)
   *   &engine=<engine id>    (informational, for display)
   */
  const getDocStmt = db.prepare('SELECT data FROM DOCS WHERE id = ?');

  app.get('/api/docs/*', (req, res) => {
    const docId = (req.params as Record<string, string>)[0];
    const format = req.query.format as string | undefined;

    if (!docId) {
      res.status(400).json({ error: 'Invalid document path' });
      return;
    }

    const row = getDocStmt.get(docId.toUpperCase()) as
      | { data: Buffer | string }
      | undefined;

    if (!row) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const content = decodeContent(row.data as Buffer | string);

    if (format === 'html') {
      // Build text-placeholder substitution map from query params
      const textPlaceholders: Record<string, string> = {
        '--TYP--': (req.query.typ as string | undefined) ?? '',
        '--FGSTNR--': (req.query.fgstnr as string | undefined) ?? '',
        '--MODELL--': (req.query.modell as string | undefined) ?? '',
        '--MOTOR--': (req.query.motor as string | undefined) ?? '',
        '--KAROSS--': (req.query.kaross as string | undefined) ?? '',
      };

      const html = rtfToHtml(content, textPlaceholders);
      res.json({ content: html });
      return;
    }

    res.json({ content });
  });

  app.get('/api/series', (_req, res) => {
    const rows = db
      .prepare(
        'SELECT DISTINCT m.BAUREIHE_ID as id, b.BENENNUNG as code, m.BAUREIHE_LANG as name FROM TFZGMODELL m LEFT JOIN TBENENNUNG b ON m.BAUREIHE_ID = b.KEY ORDER BY m.BAUREIHE_LANG',
      )
      .all() as Series[];
    res.json(rows);
  });

  app.get('/api/series/:id/models', (req, res) => {
    const seriesId = parseId(req.params.id);
    if (seriesId === null) {
      res.status(400).json({ error: 'Invalid series id' });
      return;
    }

    const rows = db
      .prepare(
        'SELECT m.MODELL_ID as id, b.BENENNUNG as code, m.MODELL_LANG as name, MIN(m.PRODDAT_AB) as productionFrom, MAX(m.PRODDAT_BIS) as productionTo FROM TFZGMODELL m LEFT JOIN TBENENNUNG b ON m.MODELL_ID = b.KEY WHERE m.BAUREIHE_ID = ? GROUP BY m.MODELL_ID, b.BENENNUNG, m.MODELL_LANG ORDER BY m.MODELL_LANG',
      )
      .all(seriesId) as Model[];

    if (rows.length === 0) {
      res.status(404).json({ error: 'Series not found' });
      return;
    }

    res.json(rows);
  });

  app.get('/api/models/:id/engines', (req, res) => {
    const modelId = parseId(req.params.id);
    if (modelId === null) {
      res.status(400).json({ error: 'Invalid model id' });
      return;
    }

    const rows = db
      .prepare(
        'SELECT DISTINCT t.MOTOR_ID as id, b.BENENNUNG as name FROM TFZGTYP t LEFT JOIN TBENENNUNG b ON t.MOTOR_ID = b.KEY WHERE t.MODELL_ID = ? ORDER BY b.BENENNUNG',
      )
      .all(modelId) as Engine[];

    if (rows.length === 0) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    res.json(rows);
  });

  /**
   * GET /api/vehicle-variants
   *
   * Resolve the full set of variant IDs (body types, gearbox types) for a vehicle.
   * The frontend calls this after vehicle selection to enable variant filtering
   * in the group navigation endpoints.
   *
   * Query params: ?series=<baureihe_id>&model=<modell_id>&engine=<motor_id>
   * Returns: { bodyIds: number[], gearboxIds: number[] }
   */
  app.get('/api/vehicle-variants', (req, res) => {
    const seriesId = parseId(req.query.series as string);
    const modelId = parseId(req.query.model as string);
    const engineId = parseId(req.query.engine as string);

    if (seriesId === null) {
      res.status(400).json({ error: 'series query param is required' });
      return;
    }

    const whereParts: string[] = ['BAUREIHE_ID = ?'];
    const params: number[] = [seriesId];
    if (modelId !== null) {
      whereParts.push('MODELL_ID = ?');
      params.push(modelId);
    }
    if (engineId !== null) {
      whereParts.push('MOTOR_ID = ?');
      params.push(engineId);
    }

    const rows = db
      .prepare(
        `SELECT DISTINCT t.KAROSSERIE_ID as bodyId, t.GETRIEBE_ID as gearboxId, t.ANTRIEB_ID as driveId
         FROM TFZGTYP t
         WHERE ${whereParts.join(' AND ')}`,
      )
      .all(...params) as Array<{ bodyId: number; gearboxId: number; driveId: number }>;

    const bodyIds = [...new Set(rows.map((r) => r.bodyId))].sort((a, b) => a - b);
    const gearboxIds = [...new Set(rows.map((r) => r.gearboxId))].sort((a, b) => a - b);
    const driveIds = [...new Set(rows.map((r) => r.driveId))].sort((a, b) => a - b);

    // Resolve human-readable names from TBENENNUNG
    const nameOf = (key: number): string | null => {
      const row = db.prepare('SELECT BENENNUNG as name FROM TBENENNUNG WHERE KEY = ? LIMIT 1').get(key) as { name: string } | undefined;
      return row?.name ?? null;
    };

    const bodyNames = bodyIds.map((id) => nameOf(id)).filter(Boolean) as string[];
    const gearboxNames = gearboxIds.map((id) => nameOf(id)).filter(Boolean) as string[];
    const driveNames = driveIds.map((id) => nameOf(id)).filter(Boolean) as string[];

    // Resolve model year range from TFZGMODELL
    let modelYear: string | null = null;
    if (modelId !== null) {
      const yearRow = db.prepare(
        'SELECT MIN(PRODDAT_AB) as fromYear, MAX(PRODDAT_BIS) as toYear FROM TFZGMODELL WHERE BAUREIHE_ID = ? AND MODELL_ID = ?',
      ).get(seriesId, modelId) as { fromYear: number | null; toYear: number | null } | undefined;
      if (yearRow?.fromYear) {
        const from = String(yearRow.fromYear).slice(0, 4);
        const to = yearRow.toYear ? String(yearRow.toYear).slice(0, 4) : '';
        modelYear = to && to !== from ? `${from}-${to}` : from;
      }
    }

    res.json({ bodyIds, gearboxIds, driveIds, bodyNames, gearboxNames, driveNames, modelYear });
  });

  /**
   * Decode a single VIN character to its base-36 numeric value.
   * BMW VINs use 0-9 and A-Z excluding I, O, Q.
   * Standard base-36: 0-9 → 0-9, A-Z → 10-35.
   */
  const base36Char = (ch: string): number | null => {
    const c = ch.toUpperCase();
    if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48;
    if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 55; // A=10, B=11, …, Z=35
    return null;
  };

  /**
   * Decode a multi-character base-36 string to an integer.
   * Returns null if any character is invalid.
   */
  const base36Decode = (s: string): number | null => {
    let result = 0;
    for (const ch of s) {
      const v = base36Char(ch);
      if (v === null) return null;
      result = result * 36 + v;
    }
    return result;
  };

  /**
   * Parse a BMW VIN into the TFGSTNRK lookup parameters.
   *
   * The last 7 characters of a BMW VIN encode the production identifier:
   *   Positions 11-12 (0-indexed 10-11): BEREICH — base-36 encoded, 2 chars
   *   Positions 13-17 (0-indexed 12-16): FGSTNR  — base-36 encoded, 5 chars
   *
   * Returns { bereich, fgstnr } or null if the VIN is malformed.
   */
  const parseVin = (vin: string): { bereich: number; fgstnr: number } | null => {
    const v = vin.toUpperCase().replace(/[\s-]/g, '');
    if (v.length !== 17) return null;

    // Real VINs use 0-9 and A-Z excluding I, O, Q
    if (!/^[0-9A-HJ-NPR-Z]{17}$/.test(v)) return null;

    // Last 7 chars: positions 11-12 (0-indexed 10-11) → BEREICH
    const bereich = base36Decode(v.slice(10, 12));
    if (bereich === null) return null;

    // Last 7 chars: positions 13-17 (0-indexed 12-16) → FGSTNR
    const fgstnr = base36Decode(v.slice(12, 17));
    if (fgstnr === null) return null;

    return { bereich, fgstnr };
  };

  /**
   * GET /api/vin/:vin
   *
   * Look up a BMW VIN and return the resolved vehicle identity.
   * Flow: VIN → parse → TFGSTNRK (bereich + fgstnr range) → TFZGTYP → TFZGMODELL + TBENENNUNG.
   *
   * Returns:
   *   { seriesId, seriesName, modelId, modelName, engineId, engineName, productionDate }
   * or 404 if the VIN doesn't match any known vehicle.
   */
  app.get('/api/vin/:vin', (req, res) => {
    const parsed = parseVin(req.params.vin);
    if (!parsed) {
      res.status(400).json({ error: 'Invalid VIN format — expected 17 characters (0-9, A-Z excluding I, O, Q)' });
      return;
    }

    // Step 1: TFGSTNRK lookup — find vehicle type from chassis number range
    const chassisRow = db
      .prepare(
        'SELECT FZGTYP as vehicleType, PRODDAT as productionDate FROM TFGSTNRK WHERE BEREICH = ? AND FGSTNRAB <= ? AND FGSTNRBIS >= ? LIMIT 1',
      )
      .get(parsed.bereich, parsed.fgstnr, parsed.fgstnr) as
      | { vehicleType: number; productionDate: number | null }
      | undefined;

    if (!chassisRow) {
      res.status(404).json({ error: 'VIN not found in chassis number database' });
      return;
    }

    // Step 2: TFZGTYP — decompose vehicle type into series/model/engine/body/drive
    const typeRow = db
      .prepare(
        'SELECT BAUREIHE_ID as seriesId, MODELL_ID as modelId, MOTOR_ID as engineId, KAROSSERIE_ID as bodyId, GETRIEBE_ID as gearboxId, ANTRIEB_ID as driveId FROM TFZGTYP WHERE FZGTYP = ?',
      )
      .get(chassisRow.vehicleType) as
      | { seriesId: number; modelId: number; engineId: number; bodyId: number; gearboxId: number; driveId: number }
      | undefined;

    if (!typeRow) {
      res.status(404).json({ error: 'Vehicle type not found' });
      return;
    }

    // Step 3: Resolve human-readable names from TFZGMODELL + TBENENNUNG
    const seriesRow = db
      .prepare(
        'SELECT DISTINCT BAUREIHE_LANG as name FROM TFZGMODELL WHERE BAUREIHE_ID = ? LIMIT 1',
      )
      .get(typeRow.seriesId) as { name: string } | undefined;

    // TFZGMODELL can have multiple rows per MODELL_ID (one per body type).
    // Filter by KAROSSERIE_ID from TFZGTYP to get the correct model name variant.
    const modelRow = db
      .prepare(
        'SELECT DISTINCT MODELL_LANG as name FROM TFZGMODELL WHERE BAUREIHE_ID = ? AND MODELL_ID = ? AND KAROSSERIE_ID = ? LIMIT 1',
      )
      .get(typeRow.seriesId, typeRow.modelId, typeRow.bodyId) as { name: string } | undefined
      // Fallback without body filter in case no match
      ?? db
        .prepare(
          'SELECT DISTINCT MODELL_LANG as name FROM TFZGMODELL WHERE BAUREIHE_ID = ? AND MODELL_ID = ? LIMIT 1',
        )
        .get(typeRow.seriesId, typeRow.modelId) as { name: string } | undefined;

    const engineRow = db
      .prepare(
        'SELECT BENENNUNG as name FROM TBENENNUNG WHERE KEY = ? LIMIT 1',
      )
      .get(typeRow.engineId) as { name: string } | undefined;

    const bodyRow = db
      .prepare('SELECT BENENNUNG as name FROM TBENENNUNG WHERE KEY = ? LIMIT 1')
      .get(typeRow.bodyId) as { name: string } | undefined;

    const gearboxRow = db
      .prepare('SELECT BENENNUNG as name FROM TBENENNUNG WHERE KEY = ? LIMIT 1')
      .get(typeRow.gearboxId) as { name: string } | undefined;

    const driveRow = db
      .prepare('SELECT BENENNUNG as name FROM TBENENNUNG WHERE KEY = ? LIMIT 1')
      .get(typeRow.driveId) as { name: string } | undefined;

    res.json({
      seriesId: typeRow.seriesId,
      seriesName: seriesRow?.name ?? null,
      modelId: typeRow.modelId,
      modelName: modelRow?.name ?? null,
      engineId: typeRow.engineId,
      engineName: engineRow?.name ?? null,
      bodyId: typeRow.bodyId,
      bodyName: bodyRow?.name ?? null,
      gearboxId: typeRow.gearboxId,
      gearboxName: gearboxRow?.name ?? null,
      driveId: typeRow.driveId,
      driveName: driveRow?.name ?? null,
      productionDate: chassisRow.productionDate,
    });
  });

  app.get('/api/doctypes', (_req, res) => {
    const rows = db
      .prepare(
        "SELECT DOKART_ID as id, DOKART_KZ as code, DOKART_BEZ as name, HGNAME as mainGroupLabel, UGNAME as subGroupLabel, METHODE as methode, ZUGRIFF as zugriff, FZG_REQU as fzgRequ FROM TDOKART WHERE LAND_OK = 1 ORDER BY DOKART_SORT",
      )
      .all() as DocType[];
    res.json(rows);
  });

  app.get('/api/groups/:docTypeId', (req, res) => {
    const docTypeId = parseId(req.params.docTypeId);
    if (docTypeId === null) {
      res.status(400).json({ error: 'Invalid document type id' });
      return;
    }

    const docType = getDocType(db, docTypeId);
    if (!docType) {
      res.status(404).json({ error: 'Document type not found' });
      return;
    }

    const docTypeSuffix = padDocTypeId(docTypeId);
    const seriesId = parseId(req.query.series as string);
    const modelId = parseId(req.query.model as string);
    const engineId = parseId(req.query.engine as string);
    const bodyIds = parseIdList(req.query.body as string);
    const gearboxIds = parseIdList(req.query.gearbox as string);

    // METHODE 5 (ISB): flat document list, no tree navigation
    if (docType.methode === 5) {
      res.json([]);
      return;
    }

    // METHODE 2,3 (RA, TD, AZD): use per-doc-type TZUKN table
    const groupTable = safeDynamicTable(db, `TZUKN${docTypeSuffix}`);
    if (groupTable) {
      const knhgTable = safeDynamicTable(db, `TKNHG${docTypeSuffix}`);

      let rows: GroupNode[];

      if (knhgTable && seriesId !== null) {
        const vehicleWhere: string[] = [];
        const params: number[] = [];

        vehicleWhere.push('k.BAUREIHE_ID = ?');
        params.push(seriesId);
        if (modelId !== null) {
          vehicleWhere.push('k.MODELL_ID = ?');
          params.push(modelId);
        }
        if (engineId !== null) {
          vehicleWhere.push('k.MOTOR_ID = ?');
          params.push(engineId);
        }

        rows = db
          .prepare(
            `SELECT DISTINCT t.KNOTEN_ID as id, t.KNOTEN_KZ as code, t.KNOTEN_BEZ as name,
               t.VATER_ID as parentId, t.VARIANT_ART as variantArt,
               t.VARIANT_WERT as variantWert, b.BENENNUNG as variantName
             FROM ${groupTable} t
             JOIN ${knhgTable} k ON k.KNOTEN_ID = t.KNOTEN_ID
             LEFT JOIN TBENENNUNG b ON t.VARIANT_WERT = b.KEY AND t.VARIANT_WERT > 0
             WHERE t.LAND_OK = 1 AND t.VATER_ID = -1 AND ${vehicleWhere.join(' AND ')}
             ORDER BY t.KNOTEN_SORT, t.KNOTEN_KZ, t.VARIANT_ART, t.VARIANT_WERT`,
          )
          .all(...params) as GroupNode[];
      } else {
        rows = db
          .prepare(
            `SELECT DISTINCT KNOTEN_ID as id, KNOTEN_KZ as code, KNOTEN_BEZ as name,
               VATER_ID as parentId, VARIANT_ART as variantArt,
               VARIANT_WERT as variantWert, b.BENENNUNG as variantName
             FROM ${groupTable} t
             LEFT JOIN TBENENNUNG b ON t.VARIANT_WERT = b.KEY AND t.VARIANT_WERT > 0
             WHERE t.LAND_OK = 1 AND t.VATER_ID = -1
             ORDER BY t.KNOTEN_SORT, t.KNOTEN_KZ, t.VARIANT_ART, t.VARIANT_WERT`,
          )
          .all() as GroupNode[];
      }

      res.json(filterVariants(rows, engineId, bodyIds, gearboxIds));
      return;
    }

    // METHODE 6,7,9 (SI, SBS, SBT, IDC, SWS, SWZ): use shared tzuwegknoten table
    // The ZUGRIFF column in TDOKART holds the ZUWEG_ID for this doc type's tree
    const zuweg_id = docType.zugriff;
    if (zuweg_id) {
      const rows = db
        .prepare(
          `SELECT DISTINCT KNOTEN_ID as id, KNOTEN_KZ as code, KNOTEN_BEZ as name,
             VATER_ID as parentId, VARIANT_ART as variantArt,
             VARIANT_WERT as variantWert, b.BENENNUNG as variantName
           FROM tzuwegknoten t
           LEFT JOIN TBENENNUNG b ON t.VARIANT_WERT = b.KEY AND t.VARIANT_WERT > 0
           WHERE t.ZUWEG_ID = ? AND t.VATER_ID = -1 AND t.LAND_OK = 1
           ORDER BY t.KNOTEN_SORT, t.KNOTEN_KZ, t.VARIANT_ART, t.VARIANT_WERT`,
        )
        .all(zuweg_id) as GroupNode[];
      res.json(filterVariants(rows, engineId, bodyIds, gearboxIds));
      return;
    }

    res.status(404).json({ error: 'Group table not found' });
  });

  app.get('/api/groups/:docTypeId/:nodeId', (req, res) => {
    const docTypeId = parseId(req.params.docTypeId);
    const nodeId = parseId(req.params.nodeId);
    if (docTypeId === null || nodeId === null) {
      res.status(400).json({ error: 'Invalid document type or node id' });
      return;
    }

    const docType = getDocType(db, docTypeId);
    if (!docType) {
      res.status(404).json({ error: 'Document type not found' });
      return;
    }

    const docTypeSuffix = padDocTypeId(docTypeId);
    const seriesId = parseId(req.query.series as string);
    const modelId = parseId(req.query.model as string);
    const engineId = parseId(req.query.engine as string);
    const bodyIds = parseIdList(req.query.body as string);
    const gearboxIds = parseIdList(req.query.gearbox as string);

    // METHODE 5 (ISB): no tree navigation
    if (docType.methode === 5) {
      res.json([]);
      return;
    }

    // METHODE 2,3 (RA, TD, AZD): use per-doc-type TZUKN table
    const groupTable = safeDynamicTable(db, `TZUKN${docTypeSuffix}`);
    if (groupTable) {
      const knhgTable = safeDynamicTable(db, `TKNHG${docTypeSuffix}`);

      let rows: GroupNode[];

      if (knhgTable && seriesId !== null) {
        const vehicleWhere: string[] = [];
        const params: (number | null)[] = [nodeId];

        vehicleWhere.push('k.BAUREIHE_ID = ?');
        params.push(seriesId);
        if (modelId !== null) {
          vehicleWhere.push('k.MODELL_ID = ?');
          params.push(modelId);
        }
        if (engineId !== null) {
          vehicleWhere.push('k.MOTOR_ID = ?');
          params.push(engineId);
        }

        rows = db
          .prepare(
            `SELECT DISTINCT t.KNOTEN_ID as id, t.KNOTEN_KZ as code, t.KNOTEN_BEZ as name,
               t.VATER_ID as parentId, t.VARIANT_ART as variantArt,
               t.VARIANT_WERT as variantWert, b.BENENNUNG as variantName
             FROM ${groupTable} t
             JOIN ${knhgTable} k ON k.KNOTEN_ID = t.KNOTEN_ID
             LEFT JOIN TBENENNUNG b ON t.VARIANT_WERT = b.KEY AND t.VARIANT_WERT > 0
             WHERE t.LAND_OK = 1 AND t.VATER_ID = ? AND ${vehicleWhere.join(' AND ')}
             ORDER BY t.KNOTEN_SORT, t.KNOTEN_KZ, t.VARIANT_ART, t.VARIANT_WERT`,
          )
          .all(...params) as GroupNode[];
      } else {
        rows = db
          .prepare(
            `SELECT DISTINCT KNOTEN_ID as id, KNOTEN_KZ as code, KNOTEN_BEZ as name,
               VATER_ID as parentId, VARIANT_ART as variantArt,
               VARIANT_WERT as variantWert, b.BENENNUNG as variantName
             FROM ${groupTable} t
             LEFT JOIN TBENENNUNG b ON t.VARIANT_WERT = b.KEY AND t.VARIANT_WERT > 0
             WHERE t.LAND_OK = 1 AND t.VATER_ID = ?
             ORDER BY t.KNOTEN_SORT, t.KNOTEN_KZ, t.VARIANT_ART, t.VARIANT_WERT`,
          )
          .all(nodeId) as GroupNode[];
      }

      res.json(filterVariants(rows, engineId, bodyIds, gearboxIds));
      return;
    }

    // METHODE 6,7,9 (SI, SBS, SBT, IDC, SWS, SWZ): use shared tzuwegknoten table
    const zuweg_id = docType.zugriff;
    if (zuweg_id) {
      const rows = db
        .prepare(
          `SELECT DISTINCT KNOTEN_ID as id, KNOTEN_KZ as code, KNOTEN_BEZ as name,
             VATER_ID as parentId, VARIANT_ART as variantArt,
             VARIANT_WERT as variantWert, b.BENENNUNG as variantName
           FROM tzuwegknoten t
           LEFT JOIN TBENENNUNG b ON t.VARIANT_WERT = b.KEY AND t.VARIANT_WERT > 0
           WHERE t.ZUWEG_ID = ? AND t.VATER_ID = ? AND t.LAND_OK = 1
           ORDER BY t.KNOTEN_SORT, t.KNOTEN_KZ, t.VARIANT_ART, t.VARIANT_WERT`,
        )
        .all(zuweg_id, nodeId) as GroupNode[];

      res.json(filterVariants(rows, engineId, bodyIds, gearboxIds));
      return;
    }

    res.status(404).json({ error: 'Group table not found' });
  });

  /**
   * GET /api/documents/:docTypeId/:nodeId
   *
   * List documents for a navigation tree node, scoped to a single document type.
   * Optionally filtered by vehicle via query params:
   *   ?series=<baureihe_id>&model=<modell_id>&engine=<motor_id>
   *
   * Uses THGR{docTypeId} to map node→document (main group assignment), then joins TINFO_OBJEKT.
   * When vehicle params are provided, joins TFZGREFBR to filter applicability
   * with a UNION fallback for baureihe_id = 0 (generic/all-vehicle entries).
   */
  app.get('/api/documents/:docTypeId/:nodeId', (req, res) => {
    const docTypeId = parseId(req.params.docTypeId);
    const nodeId = parseId(req.params.nodeId);
    if (docTypeId === null || nodeId === null) {
      res.status(400).json({ error: 'Invalid document type or node id' });
      return;
    }

    const thgrTable = safeDynamicTable(db, `THGR${padDocTypeId(docTypeId)}`);
    if (!thgrTable) {
      res.json([]);
      return;
    }

    const { clauses: vehicleWhere, params: vehicleParams, hasVehicle } = buildVehicleFilter(
      req.query as Record<string, string>,
    );

    let sql: string;
    const params: (number | null)[] = [];

    if (hasVehicle) {
      const vehicleFilter = vehicleWhere.length > 0 ? ` AND ${vehicleWhere.join(' AND ')}` : '';

      sql = `
        SELECT DISTINCT o.INFOOBJ_ID as id, o.INFOOBJ_KZ as code, o.DOKART_ID as docTypeId,
          o.TITEL as title, o.ERSCHDAT as publicationDate, o.INFOOBJ_SORT as sortOrder
        FROM ${thgrTable} g
        JOIN TINFO_OBJEKT o ON g.INFOOBJ_ID = o.INFOOBJ_ID
        JOIN TFZGREFBR f ON f.INFOOBJ_ID = o.INFOOBJ_ID
        WHERE g.KNOTEN_ID = ? AND g.SECURITY = 0 AND o.LAND_OK = 1${vehicleFilter}

        UNION

        SELECT DISTINCT o.INFOOBJ_ID as id, o.INFOOBJ_KZ as code, o.DOKART_ID as docTypeId,
          o.TITEL as title, o.ERSCHDAT as publicationDate, o.INFOOBJ_SORT as sortOrder
        FROM ${thgrTable} g
        JOIN TINFO_OBJEKT o ON g.INFOOBJ_ID = o.INFOOBJ_ID
        JOIN TFZGREFBR f ON f.INFOOBJ_ID = o.INFOOBJ_ID
        WHERE g.KNOTEN_ID = ? AND g.SECURITY = 0 AND o.LAND_OK = 1 AND f.BAUREIHE_ID = 0

        ORDER BY sortOrder, title
      `;
      params.push(nodeId);
      params.push(...vehicleParams);
      params.push(nodeId);
    } else {
      sql = `
        SELECT DISTINCT o.INFOOBJ_ID as id, o.INFOOBJ_KZ as code, o.DOKART_ID as docTypeId,
          o.TITEL as title, o.ERSCHDAT as publicationDate, o.INFOOBJ_SORT as sortOrder
        FROM ${thgrTable} g
        JOIN TINFO_OBJEKT o ON g.INFOOBJ_ID = o.INFOOBJ_ID
        WHERE g.KNOTEN_ID = ? AND g.SECURITY = 0 AND o.LAND_OK = 1
        ORDER BY o.INFOOBJ_SORT, o.TITEL
      `;
      params.push(nodeId);
    }

    const results = db.prepare(sql).all(...params) as DocumentListItem[];
    res.json(results);
  });

  /**
   * GET /api/documents/:docTypeId
   *
   * List ALL documents for a doc type without tree navigation.
   * Used for METHODE 5 (ISB) which has no group tree — documents are listed flat.
   * Requires vehicle filtering (ISB documents are vehicle-specific).
   * Also supports other doc types as a fallback.
   *
   * Query params: ?series=<baureihe_id>&model=<modell_id>&engine=<motor_id>
   */
  app.get('/api/documents/:docTypeId', (req, res) => {
    const docTypeId = parseId(req.params.docTypeId);
    if (docTypeId === null) {
      res.status(400).json({ error: 'Invalid document type id' });
      return;
    }

    const { clauses: vehicleWhere, params: vehicleParams, hasVehicle } = buildVehicleFilter(
      req.query as Record<string, string>,
    );

    let sql: string;
    const params: (number | null)[] = [];

    if (hasVehicle) {
      const vehicleFilter = vehicleWhere.length > 0 ? ` AND ${vehicleWhere.join(' AND ')}` : '';

      sql = `
        SELECT DISTINCT o.INFOOBJ_ID as id, o.INFOOBJ_KZ as code, o.DOKART_ID as docTypeId,
          o.TITEL as title, o.ERSCHDAT as publicationDate, o.INFOOBJ_SORT as sortOrder
        FROM TINFO_OBJEKT o
        JOIN TFZGREFBR f ON f.INFOOBJ_ID = o.INFOOBJ_ID
        WHERE o.DOKART_ID = ? AND o.LAND_OK = 1${vehicleFilter}

        UNION

        SELECT DISTINCT o.INFOOBJ_ID as id, o.INFOOBJ_KZ as code, o.DOKART_ID as docTypeId,
          o.TITEL as title, o.ERSCHDAT as publicationDate, o.INFOOBJ_SORT as sortOrder
        FROM TINFO_OBJEKT o
        JOIN TFZGREFBR f ON f.INFOOBJ_ID = o.INFOOBJ_ID
        WHERE o.DOKART_ID = ? AND o.LAND_OK = 1 AND f.BAUREIHE_ID = 0

        ORDER BY sortOrder, title
      `;
      params.push(docTypeId);
      params.push(...vehicleParams);
      params.push(docTypeId);
    } else {
      sql = `
        SELECT DISTINCT o.INFOOBJ_ID as id, o.INFOOBJ_KZ as code, o.DOKART_ID as docTypeId,
          o.TITEL as title, o.ERSCHDAT as publicationDate, o.INFOOBJ_SORT as sortOrder
        FROM TINFO_OBJEKT o
        WHERE o.DOKART_ID = ? AND o.LAND_OK = 1
        ORDER BY o.INFOOBJ_SORT, o.TITEL
      `;
      params.push(docTypeId);
    }

    const results = db.prepare(sql).all(...params) as DocumentListItem[];
    res.json(results);
  });

  // ---------------------------------------------------------------------------
  // Symptom-based navigation (ZUWEG_ID = 1)
  //
  // The symptom tree lives in tzuwegknoten with ZUWEG_ID=1. It has two sub-trees:
  //   VATER_ID=0 → two meta-roots: -1 (component system), -2 (diagnosis/conditions)
  //   VATER_ID=-2 → 13 condition categories (3 levels deep)
  //   VATER_ID=-1 → 4 component systems (4 levels deep)
  //
  // Documents are mapped via TSYREFALL (KNOTEN_ID → INFOOBJ_ID).
  // Vehicle filtering of the tree uses TKN_SY_REF (analogous to TKNHG for doc types).
  // Vehicle filtering of documents uses TFZGREFBR (same pattern as doc-type endpoints).
  // ---------------------------------------------------------------------------

  /**
   * GET /api/symptoms/roots
   *
   * Returns the two meta-root categories: "Vehicle component system" (-1) and
   * "diagnosis" (-2). These are the top-level entry points for symptom navigation.
   */
  app.get('/api/symptoms/roots', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT KNOTEN_ID as id, KNOTEN_KZ as code, KNOTEN_BEZ as name, VATER_ID as parentId
         FROM tzuwegknoten
         WHERE ZUWEG_ID = 1 AND VATER_ID = 0 AND LAND_OK = 1
         ORDER BY KNOTEN_SORT`,
      )
      .all() as GroupNode[];
    res.json(rows);
  });

  /**
   * GET /api/symptoms/nodes/:parentId
   *
   * Returns child nodes for a given parent in the symptom tree.
   * Optionally filtered by vehicle via query params:
   *   ?series=<baureihe_id>&model=<modell_id>&engine=<motor_id>
   *
   * When vehicle params are provided, uses TKN_SY_REF to filter which nodes
   * are relevant for the selected vehicle.
   *
   * Each node includes a `hasChildren` flag so the UI knows whether to render
   * an expand arrow.
   */
  app.get('/api/symptoms/nodes/:parentId', (req, res) => {
    const parentId = parseId(req.params.parentId);
    if (parentId === null) {
      res.status(400).json({ error: 'Invalid parent id' });
      return;
    }

    const seriesId = parseId(req.query.series as string);
    const modelId = parseId(req.query.model as string);
    const engineId = parseId(req.query.engine as string);

    const hasVehicle = seriesId !== null;

    let sql: string;
    const params: number[] = [];

    if (hasVehicle) {
      // Vehicle-filtered: JOIN TKN_SY_REF to restrict visible nodes
      const vehicleWhere: string[] = [];

      // parentId must be first param (matches first ? in SQL)
      params.push(parentId);

      vehicleWhere.push('k.BAUREIHE_ID = ?');
      params.push(seriesId!);
      if (modelId !== null) {
        vehicleWhere.push('k.MODELL_ID = ?');
        params.push(modelId);
      }
      if (engineId !== null) {
        vehicleWhere.push('k.MOTOR_ID = ?');
        params.push(engineId);
      }

      sql = `
        SELECT DISTINCT t.KNOTEN_ID as id, t.KNOTEN_KZ as code, t.KNOTEN_BEZ as name,
          t.VATER_ID as parentId,
          CASE WHEN EXISTS (
            SELECT 1 FROM tzuwegknoten c
            WHERE c.ZUWEG_ID = 1 AND c.VATER_ID = t.KNOTEN_ID AND c.LAND_OK = 1
          ) THEN 1 ELSE 0 END as hasChildren
        FROM tzuwegknoten t
        JOIN TKN_SY_REF k ON k.ZUWEG_ID = 1 AND k.KNOTEN_ID = t.KNOTEN_ID
        WHERE t.ZUWEG_ID = 1 AND t.VATER_ID = ? AND t.LAND_OK = 1
          AND ${vehicleWhere.join(' AND ')}
        ORDER BY t.KNOTEN_SORT, t.KNOTEN_ID
      `;
    } else {
      // Unfiltered: return all children
      sql = `
        SELECT DISTINCT t.KNOTEN_ID as id, t.KNOTEN_KZ as code, t.KNOTEN_BEZ as name,
          t.VATER_ID as parentId,
          CASE WHEN EXISTS (
            SELECT 1 FROM tzuwegknoten c
            WHERE c.ZUWEG_ID = 1 AND c.VATER_ID = t.KNOTEN_ID AND c.LAND_OK = 1
          ) THEN 1 ELSE 0 END as hasChildren
        FROM tzuwegknoten t
        WHERE t.ZUWEG_ID = 1 AND t.VATER_ID = ? AND t.LAND_OK = 1
        ORDER BY t.KNOTEN_SORT, t.KNOTEN_ID
      `;
      params.push(parentId);
    }

    const rows = db.prepare(sql).all(...params) as SymptomNode[];
    // SQLite returns 0/1, convert to boolean
    for (const row of rows) {
      row.hasChildren = Boolean(row.hasChildren);
    }
    res.json(rows);
  });

  /**
   * GET /api/symptoms/documents/:nodeId
   *
   * Returns documents associated with a symptom tree node via TSYREFALL.
   * Optionally filtered by vehicle via query params:
   *   ?series=<baureihe_id>&model=<modell_id>&engine=<motor_id>
   *
   * When vehicle params provided, joins TFZGREFBR with UNION fallback for
   * baureihe_id = 0 (generic/all-vehicle entries).
   */
  app.get('/api/symptoms/documents/:nodeId', (req, res) => {
    const nodeId = parseId(req.params.nodeId);
    if (nodeId === null) {
      res.status(400).json({ error: 'Invalid node id' });
      return;
    }

    const seriesId = parseId(req.query.series as string);
    const modelId = parseId(req.query.model as string);
    const engineId = parseId(req.query.engine as string);

    const hasVehicle = seriesId !== null;

    let sql: string;
    const params: (number | null)[] = [];

    if (hasVehicle) {
      const vehicleWhere: string[] = [];

      // nodeId for first SELECT must be first param
      params.push(nodeId);

      if (seriesId !== null) {
        vehicleWhere.push('f.BAUREIHE_ID = ?');
        params.push(seriesId);
      }
      if (modelId !== null) {
        vehicleWhere.push('f.MODELL_ID = ?');
        params.push(modelId);
      }
      if (engineId !== null) {
        vehicleWhere.push('f.MOTOR_ID = ?');
        params.push(engineId);
      }

      // nodeId for UNION SELECT
      params.push(nodeId);

      const vehicleFilter = vehicleWhere.length > 0 ? ` AND ${vehicleWhere.join(' AND ')}` : '';

      sql = `
        SELECT DISTINCT o.INFOOBJ_ID as id, o.INFOOBJ_KZ as code, o.DOKART_ID as docTypeId,
          o.TITEL as title, o.ERSCHDAT as publicationDate, o.INFOOBJ_SORT as sortOrder
        FROM TSYREFALL s
        JOIN TINFO_OBJEKT o ON o.INFOOBJ_ID = s.INFOOBJ_ID
        JOIN TFZGREFBR f ON f.INFOOBJ_ID = s.INFOOBJ_ID
        WHERE s.KNOTEN_ID = ? AND s.SECURITY = 0 AND o.LAND_OK = 1${vehicleFilter}

        UNION

        SELECT DISTINCT o.INFOOBJ_ID as id, o.INFOOBJ_KZ as code, o.DOKART_ID as docTypeId,
          o.TITEL as title, o.ERSCHDAT as publicationDate, o.INFOOBJ_SORT as sortOrder
        FROM TSYREFALL s
        JOIN TINFO_OBJEKT o ON o.INFOOBJ_ID = s.INFOOBJ_ID
        JOIN TFZGREFBR f ON f.INFOOBJ_ID = s.INFOOBJ_ID
        WHERE s.KNOTEN_ID = ? AND s.SECURITY = 0 AND o.LAND_OK = 1 AND f.BAUREIHE_ID = 0

        ORDER BY sortOrder, title
      `;
    } else {
      sql = `
        SELECT DISTINCT o.INFOOBJ_ID as id, o.INFOOBJ_KZ as code, o.DOKART_ID as docTypeId,
          o.TITEL as title, o.ERSCHDAT as publicationDate, o.INFOOBJ_SORT as sortOrder
        FROM TSYREFALL s
        JOIN TINFO_OBJEKT o ON o.INFOOBJ_ID = s.INFOOBJ_ID
        WHERE s.KNOTEN_ID = ? AND s.SECURITY = 0 AND o.LAND_OK = 1
        ORDER BY o.INFOOBJ_SORT, o.TITEL
      `;
      params.push(nodeId);
    }

    const results = db.prepare(sql).all(...params) as DocumentListItem[];
    res.json(results);
  });

  /**
   * GET /api/document/by-code/:code
   *
   * Look up a document by its INFOOBJ_KZ code. Used by cross-reference links
   * generated from RTF \strike text. Returns the matching document(s) so the
   * frontend can navigate to the correct doc page.
   *
   * Optionally accepts vehicle query params (?series=&model=&engine=) to
   * filter to the most relevant match when multiple documents share the same code.
   */
  app.get('/api/document/by-code/:code', (req, res) => {
    const code = req.params.code?.trim();
    if (!code || !/^[\d.]+$/.test(code)) {
      res.status(400).json({ error: 'Invalid document code' });
      return;
    }

    const seriesId = parseId(req.query.series as string);
    const modelId = parseId(req.query.model as string);
    const engineId = parseId(req.query.engine as string);
    const hasVehicle = seriesId !== null;

    let rows: Array<{ id: number; code: string; docTypeId: number; title: string }>;

    if (hasVehicle) {
      // When a vehicle is selected, prefer documents applicable to that vehicle,
      // falling back to generic (BAUREIHE_ID = 0) entries.
      const vehicleWhere: string[] = [];
      const vehicleParams: (number | null)[] = [];
      if (seriesId !== null) {
        vehicleWhere.push('f.BAUREIHE_ID = ?');
        vehicleParams.push(seriesId);
      }
      if (modelId !== null) {
        vehicleWhere.push('f.MODELL_ID = ?');
        vehicleParams.push(modelId);
      }
      if (engineId !== null) {
        vehicleWhere.push('f.MOTOR_ID = ?');
        vehicleParams.push(engineId);
      }
      const vehicleFilter = vehicleWhere.length > 0 ? ` AND ${vehicleWhere.join(' AND ')}` : '';

      rows = db
        .prepare(
          `SELECT DISTINCT o.INFOOBJ_ID as id, o.INFOOBJ_KZ as code, o.DOKART_ID as docTypeId, o.TITEL as title
           FROM TINFO_OBJEKT o
           JOIN TFZGREFBR f ON f.INFOOBJ_ID = o.INFOOBJ_ID
           WHERE o.INFOOBJ_KZ = ? AND o.LAND_OK = 1${vehicleFilter}

           UNION

           SELECT DISTINCT o.INFOOBJ_ID as id, o.INFOOBJ_KZ as code, o.DOKART_ID as docTypeId, o.TITEL as title
           FROM TINFO_OBJEKT o
           JOIN TFZGREFBR f ON f.INFOOBJ_ID = o.INFOOBJ_ID
           WHERE o.INFOOBJ_KZ = ? AND o.LAND_OK = 1 AND f.BAUREIHE_ID = 0`,
        )
        .all(code, ...vehicleParams, code) as typeof rows;
    } else {
      rows = db
        .prepare(
          `SELECT INFOOBJ_ID as id, INFOOBJ_KZ as code, DOKART_ID as docTypeId, TITEL as title
           FROM TINFO_OBJEKT WHERE INFOOBJ_KZ = ? AND LAND_OK = 1`,
        )
        .all(code) as typeof rows;
    }

    if (rows.length === 0) {
      res.status(404).json({ error: 'No document found with that code' });
      return;
    }

    // Return all matches; the frontend picks the best one (or shows a disambiguation list)
    res.json(rows);
  });

  app.get('/api/document/:id', (req, res) => {
    const documentId = parseId(req.params.id);
    if (documentId === null) {
      res.status(400).json({ error: 'Invalid document id' });
      return;
    }

    const document = db
      .prepare(
        'SELECT INFOOBJ_ID as id, INFOOBJ_KZ as code, DOKART_ID as docTypeId, TITEL as title, ERSCHDAT as publicationDate, SECURITY as security FROM TINFO_OBJEKT WHERE INFOOBJ_ID = ?',
      )
      .get(documentId) as DocumentDetail | undefined;

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const files = (
      db
        .prepare(
          'SELECT INFO_FILENAME as filename, DEVICETYP as deviceType, DEVICEKZ as deviceCode FROM TINFO_FILE WHERE INFOOBJ_ID = ?',
        )
        .all(documentId) as Array<{
        filename: string;
        deviceType: string | null;
        deviceCode: string | null;
      }>
    ).map((file) => ({
      ...file,
      textPath: `${file.filename}.rtf`,
      textUrl: `/api/docs/${file.filename}.rtf`,
    }));

    const response: DocumentResponse = {
      document,
      files,
    };

    res.json(response);
  });

  /**
   * GET /api/document/:id/related
   *
   * Get documents linked to the given document via TINFO_REF (Verbund/cross-references).
   * Optionally filtered by vehicle via query params:
   *   ?series=<baureihe_id>&model=<modell_id>&engine=<motor_id>
   *
   * Matches the original TIS_VerbundVsFZG query pattern with baureihe_id = 0 fallback.
   */
  app.get('/api/document/:id/related', (req, res) => {
    const documentId = parseId(req.params.id);
    if (documentId === null) {
      res.status(400).json({ error: 'Invalid document id' });
      return;
    }

    const seriesId = parseId(req.query.series as string);
    const modelId = parseId(req.query.model as string);
    const engineId = parseId(req.query.engine as string);

    const hasVehicle = seriesId !== null;

    let sql: string;
    const params: (number | null)[] = [];

    if (hasVehicle) {
      const vehicleWhere: string[] = [];
      if (seriesId !== null) {
        vehicleWhere.push('f.BAUREIHE_ID = ?');
        params.push(seriesId);
      }
      if (modelId !== null) {
        vehicleWhere.push('f.MODELL_ID = ?');
        params.push(modelId);
      }
      if (engineId !== null) {
        vehicleWhere.push('f.MOTOR_ID = ?');
        params.push(engineId);
      }

      const vehicleFilter = vehicleWhere.length > 0 ? ` AND ${vehicleWhere.join(' AND ')}` : '';

      sql = `
        SELECT DISTINCT o.INFOOBJ_ID as id, o.INFOOBJ_KZ as code, o.DOKART_ID as docTypeId,
          o.TITEL as title, o.ERSCHDAT as publicationDate,
          d.DOKART_KZ as docTypeCode, d.DOKART_BEZ as docTypeName
        FROM TINFO_REF r
        JOIN TINFO_OBJEKT o ON o.INFOOBJ_ID = r.INFOOBJ_ID_N
        JOIN TDOKART d ON d.DOKART_ID = o.DOKART_ID
        JOIN TFZGREFBR f ON f.INFOOBJ_ID = o.INFOOBJ_ID
        WHERE r.INFOOBJ_ID_V = ? AND r.LAND_OK = 1 AND o.LAND_OK = 1${vehicleFilter}

        UNION

        SELECT DISTINCT o.INFOOBJ_ID as id, o.INFOOBJ_KZ as code, o.DOKART_ID as docTypeId,
          o.TITEL as title, o.ERSCHDAT as publicationDate,
          d.DOKART_KZ as docTypeCode, d.DOKART_BEZ as docTypeName
        FROM TINFO_REF r
        JOIN TINFO_OBJEKT o ON o.INFOOBJ_ID = r.INFOOBJ_ID_N
        JOIN TDOKART d ON d.DOKART_ID = o.DOKART_ID
        JOIN TFZGREFBR f ON f.INFOOBJ_ID = o.INFOOBJ_ID
        WHERE r.INFOOBJ_ID_V = ? AND r.LAND_OK = 1 AND o.LAND_OK = 1 AND f.BAUREIHE_ID = 0

        ORDER BY docTypeCode, title
      `;
      params.push(documentId); // first SELECT
      params.push(documentId); // UNION SELECT
    } else {
      sql = `
        SELECT DISTINCT o.INFOOBJ_ID as id, o.INFOOBJ_KZ as code, o.DOKART_ID as docTypeId,
          o.TITEL as title, o.ERSCHDAT as publicationDate,
          d.DOKART_KZ as docTypeCode, d.DOKART_BEZ as docTypeName
        FROM TINFO_REF r
        JOIN TINFO_OBJEKT o ON o.INFOOBJ_ID = r.INFOOBJ_ID_N
        JOIN TDOKART d ON d.DOKART_ID = o.DOKART_ID
        WHERE r.INFOOBJ_ID_V = ? AND r.LAND_OK = 1 AND o.LAND_OK = 1
        ORDER BY d.DOKART_KZ, o.TITEL
      `;
      params.push(documentId);
    }

    const results = db.prepare(sql).all(...params) as Array<{
      id: number;
      code: string | null;
      docTypeId: number;
      title: string;
      publicationDate: number | null;
      docTypeCode: string;
      docTypeName: string;
    }>;
    res.json(results);
  });

  /**
   * GET /api/document/:id/hotspots
   *
   * Returns all hotspot cross-reference targets for a document. Each hotspot
   * is identified by HOTSPOT_NR (1-based sequential index matching the Nth
   * \strike block in the RTF source). A single hotspot may have multiple
   * target documents (vehicle-dependent variants).
   *
   * Optional vehicle filtering via query params:
   *   ?series=<baureihe_id>&model=<modell_id>&engine=<motor_id>
   *   &body=<karosserie_ids>&gearbox=<getriebe_ids>
   */
  app.get('/api/document/:id/hotspots', (req, res) => {
    const documentId = parseId(req.params.id);
    if (documentId === null) {
      res.status(400).json({ error: 'Invalid document id' });
      return;
    }

    const seriesId = parseId(req.query.series as string);
    const modelId = parseId(req.query.model as string);
    const engineId = parseId(req.query.engine as string);
    const bodyIds = parseIdList(req.query.body as string);
    const gearboxIds = parseIdList(req.query.gearbox as string);
    const hasVehicle = seriesId !== null;

    let sql: string;
    const params: (number | null)[] = [];

    if (hasVehicle) {
      // With vehicle context: prefer vehicle-specific docs, fall back to generic (BAUREIHE_ID=0)
      const vehicleWhere: string[] = [];
      const vehicleParams: (number | null)[] = [];
      if (seriesId !== null) {
        vehicleWhere.push('f.BAUREIHE_ID = ?');
        vehicleParams.push(seriesId);
      }
      if (modelId !== null) {
        vehicleWhere.push('f.MODELL_ID = ?');
        vehicleParams.push(modelId);
      }
      if (engineId !== null) {
        vehicleWhere.push('f.MOTOR_ID = ?');
        vehicleParams.push(engineId);
      }
      if (bodyIds.length > 0) {
        vehicleWhere.push(`f.KAROSSERIE_ID IN (${bodyIds.map(() => '?').join(',')})`);
        vehicleParams.push(...bodyIds);
      }
      if (gearboxIds.length > 0) {
        vehicleWhere.push(`(f.GETRIEBE_ID IN (${gearboxIds.map(() => '?').join(',')}) OR f.GETRIEBE_ID = 0)`);
        vehicleParams.push(...gearboxIds);
      }

      const vehicleFilter = vehicleWhere.length > 0 ? ` AND ${vehicleWhere.join(' AND ')}` : '';

      sql = `
        SELECT h.HOTSPOT_NR as hotspotNr, o.INFOOBJ_ID as id, o.INFOOBJ_KZ as code,
          o.DOKART_ID as docTypeId, o.TITEL as title
        FROM THOTSPOT h
        JOIN TINFO_OBJEKT o ON o.INFOOBJ_ID = h.INFOOBJ_ID_N
        JOIN TFZGREFBR f ON f.INFOOBJ_ID = o.INFOOBJ_ID
        WHERE h.INFOOBJ_ID_V = ? AND h.LAND_OK = 1 AND o.LAND_OK = 1${vehicleFilter}

        UNION

        SELECT h.HOTSPOT_NR as hotspotNr, o.INFOOBJ_ID as id, o.INFOOBJ_KZ as code,
          o.DOKART_ID as docTypeId, o.TITEL as title
        FROM THOTSPOT h
        JOIN TINFO_OBJEKT o ON o.INFOOBJ_ID = h.INFOOBJ_ID_N
        JOIN TFZGREFBR f ON f.INFOOBJ_ID = o.INFOOBJ_ID
        WHERE h.INFOOBJ_ID_V = ? AND h.LAND_OK = 1 AND o.LAND_OK = 1 AND f.BAUREIHE_ID = 0

        ORDER BY hotspotNr, id
      `;
      // First SELECT: documentId + vehicleParams
      params.push(documentId, ...vehicleParams);
      // UNION SELECT: documentId only (generic fallback)
      params.push(documentId);
    } else {
      sql = `
        SELECT h.HOTSPOT_NR as hotspotNr, o.INFOOBJ_ID as id, o.INFOOBJ_KZ as code,
          o.DOKART_ID as docTypeId, o.TITEL as title
        FROM THOTSPOT h
        JOIN TINFO_OBJEKT o ON o.INFOOBJ_ID = h.INFOOBJ_ID_N
        WHERE h.INFOOBJ_ID_V = ? AND h.LAND_OK = 1 AND o.LAND_OK = 1
        ORDER BY h.HOTSPOT_NR, o.INFOOBJ_ID
      `;
      params.push(documentId);
    }

    const rows = db.prepare(sql).all(...params) as Array<{
      hotspotNr: number;
      id: number;
      code: string | null;
      docTypeId: number;
      title: string;
    }>;

    // Group by hotspot number: { [hotspotNr]: [targets] }
    const hotspots: Record<number, Array<{ id: number; code: string | null; docTypeId: number; title: string }>> = {};
    for (const row of rows) {
      if (!hotspots[row.hotspotNr]) {
        hotspots[row.hotspotNr] = [];
      }
      // Deduplicate by doc id (UNION can produce dupes)
      if (!hotspots[row.hotspotNr].some((t) => t.id === row.id)) {
        hotspots[row.hotspotNr].push({ id: row.id, code: row.code, docTypeId: row.docTypeId, title: row.title });
      }
    }

    res.json(hotspots);
  });

  app.use(express.static(webBuildPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/assets')) {
      next();
      return;
    }

    res.sendFile(join(webBuildPath, 'index.html'));
  });

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${port}`);
    console.log(`Database: ${dbPath}`);
  });

  process.on('exit', () => db.close());
  process.on('SIGINT', () => process.exit(128 + 2));
  process.on('SIGTERM', () => process.exit(128 + 15));
};

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', error);
  process.exit(1);
});
