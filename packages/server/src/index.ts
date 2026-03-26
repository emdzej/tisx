import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { readFileSync } from 'node:fs';
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
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.TIS_DB_PATH ?? './data/tis.sqlite';
const docsDbPath = process.env.DOCS_DB_PATH ?? './data/docs.sqlite';
const imagesDbPath = process.env.IMAGES_DB_PATH ?? './data/images.db';

const parseId = (value: string): number | null => {
  const id = Number.parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
};

const padDokart = (dokartId: number) => String(dokartId).padStart(6, '0');

const queryAll = <T>(
  db: SqlJsDatabase,
  sql: string,
  params: Array<number | string> = [],
): T[] => {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
};

const queryGet = <T>(
  db: SqlJsDatabase,
  sql: string,
  params: Array<number | string> = [],
): T | undefined => {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? (stmt.getAsObject() as T) : undefined;
  stmt.free();
  return row;
};

const hasTable = (db: SqlJsDatabase, tableName: string): boolean => {
  const row = queryGet<{ name?: string }>(
    db,
    "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
    [tableName],
  );
  return Boolean(row?.name);
};

const getDocType = (db: SqlJsDatabase, dokartId: number): DocType | null => {
  const row = queryGet<DocType>(
    db,
    'SELECT DOKART_ID as id, DOKART_KZ as code, DOKART_BEZ as name, HGNAME as mainGroupLabel, UGNAME as subGroupLabel FROM TDOKART WHERE DOKART_ID = ?;',
    [dokartId],
  );
  return row ?? null;
};

/**
 * Decode raw bytes from sql.js into a string.
 * RTF files are Windows-1252 / latin-1 encoded.
 */
const decodeContent = (raw: string | Uint8Array | Record<string, number>): string => {
  if (raw instanceof Uint8Array) {
    return new TextDecoder('latin1').decode(raw);
  }
  if (typeof raw === 'object' && raw !== null) {
    return new TextDecoder('latin1').decode(new Uint8Array(Object.values(raw)));
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
const grafikPlaceholderToImageId = (placeholder: string): string | null => {
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

  // Replace GRAFIK image references.
  // Pattern in RTF: \plain\v\f0\fs<N> .Z.\n\plain\f0\fs<N> N:GRAFIK\path\to\file.itw;...;
  // The \v marks "hidden text" in RTF.  We remove the entire hidden+visible block and replace
  // with a unique sentinel that we can post-process in the HTML output.
  let processed = rtf.replace(
    /\\plain\\v[^]*?N:GRAFIK(\\[^;]+\.itw;[^;]*;[^;]*;[^;]*;)/gi,
    (_match, pathAndAttrs) => {
      const fullToken = `N:GRAFIK${pathAndAttrs}`;
      const imageId = grafikPlaceholderToImageId(fullToken);
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
 * Post-process the HTML output from pandoc:
 * Replace sentinel tokens with <img> tags that load from /api/images/:id
 */
const postprocessHtml = (html: string, imageMap: Map<string, string>): string => {
  // Pandoc leaks the RTF font table ({\fonttbl{\f0\fswiss Helvetica;}{\f1\ftech Symbol;}})
  // as literal text at the start of the output. Two forms:
  //   standalone:  <p>Helvetica;Symbol;</p>  → remove entirely
  //   mixed:       <p>Helvetica;Symbol;<strong>title</strong></p>  → strip prefix only
  let result = html
    .replace(/^<p>Helvetica;Symbol;\s*<\/p>\n?/, '')
    .replace(/^<p>Helvetica;Symbol;\s*/, '<p>');

  for (const [sentinel, imageId] of imageMap) {
    const escapedSentinel = sentinel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // The sentinel might be wrapped in <p>, <td>, or other tags — replace just the text node
    result = result.replace(
      new RegExp(escapedSentinel, 'g'),
      `<img src="/api/images/${imageId}" alt="Technical illustration" class="tis-inline-image" loading="lazy" />`,
    );
  }
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
    const html = execSync('pandoc -f rtf -t html', {
      input: processed,
      encoding: 'latin1',
      maxBuffer: 10 * 1024 * 1024, // 10 MB
    });
    return postprocessHtml(html, imageMap);
  } catch (err) {
    console.error('Pandoc RTF→HTML conversion failed:', err);
    // Return a minimal fallback showing the raw text
    return `<pre style="white-space:pre-wrap">${processed.replace(/</g, '&lt;')}</pre>`;
  }
};

const main = async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync(dbPath));
  const docsDb = new SQL.Database(readFileSync(docsDbPath));

  // images.db is large (4.9 GB); sql.js loads entire files into memory which is not feasible.
  // We access it via the sqlite3 CLI subprocess instead.
  // This is cached per-process via execSync for each image request.
  const getImageFromDb = (imageId: string): { data: Buffer; contentType: string } | null => {
    try {
      const result = execSync(
        `sqlite3 "${imagesDbPath}" "SELECT hex(data), content_type FROM images WHERE id = '${imageId.replace(/'/g, "''")}' LIMIT 1;"`,
        { encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024 },
      ).trim();

      if (!result) return null;

      const pipeIdx = result.indexOf('|');
      if (pipeIdx < 0) return null;

      const hexData = result.slice(0, pipeIdx);
      const contentType = result.slice(pipeIdx + 1).trim() || 'image/png';

      if (!hexData) return null;

      const data = Buffer.from(hexData, 'hex');
      return { data, contentType };
    } catch {
      return null;
    }
  };

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
   * Serve an image from images.db by its id (e.g. 1/13/97/26.png).
   * The id is passed as a wildcard path segment.
   */
  app.get('/api/images/*', (req, res) => {
    const imageId = (req.params as Record<string, string>)[0];
    if (!imageId) {
      res.status(400).json({ error: 'Invalid image id' });
      return;
    }

    const image = getImageFromDb(imageId);
    if (!image) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    res.set('Content-Type', image.contentType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(image.data);
  });

  /**
   * GET /api/docs/:path
   * Serve document content from docs.sqlite.
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
  app.get('/api/docs/*', (req, res) => {
    const docId = (req.params as Record<string, string>)[0];
    const format = req.query.format as string | undefined;

    if (!docId) {
      res.status(400).json({ error: 'Invalid document path' });
      return;
    }

    const row = queryGet<{ content: string | Uint8Array }>(
      docsDb,
      'SELECT content FROM content WHERE id = ?',
      [docId],
    );

    if (!row) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const content = decodeContent(row.content as string | Uint8Array | Record<string, number>);

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
    const rows = queryAll<Series>(
      db,
      'SELECT DISTINCT m.BAUREIHE_ID as id, b.BENENNUNG as code, m.BAUREIHE_LANG as name FROM TFZGMODELL m LEFT JOIN TBENENNUNG b ON m.BAUREIHE_ID = b.KEY ORDER BY m.BAUREIHE_LANG;',
    );
    res.json(rows);
  });

  app.get('/api/series/:id/models', (req, res) => {
    const seriesId = parseId(req.params.id);
    if (seriesId === null) {
      res.status(400).json({ error: 'Invalid series id' });
      return;
    }

    const rows = queryAll<Model>(
      db,
      'SELECT m.MODELL_ID as id, b.BENENNUNG as code, m.MODELL_LANG as name, MIN(m.PRODDAT_AB) as productionFrom, MAX(m.PRODDAT_BIS) as productionTo FROM TFZGMODELL m LEFT JOIN TBENENNUNG b ON m.MODELL_ID = b.KEY WHERE m.BAUREIHE_ID = ? GROUP BY m.MODELL_ID, b.BENENNUNG, m.MODELL_LANG ORDER BY m.MODELL_LANG;',
      [seriesId],
    );

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

    const rows = queryAll<Engine>(
      db,
      'SELECT DISTINCT t.MOTOR_ID as id, b.BENENNUNG as name FROM TFZGTYP t LEFT JOIN TBENENNUNG b ON t.MOTOR_ID = b.KEY WHERE t.MODELL_ID = ? ORDER BY b.BENENNUNG;',
      [modelId],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    res.json(rows);
  });

  app.get('/api/doctypes', (_req, res) => {
    const rows = queryAll<DocType>(
      db,
      "SELECT DOKART_ID as id, DOKART_KZ as code, DOKART_BEZ as name, HGNAME as mainGroupLabel, UGNAME as subGroupLabel FROM TDOKART WHERE DOKART_KZ IN ('SI','RA','TD','AZD') ORDER BY DOKART_SORT;",
    );
    res.json(rows);
  });

  app.get('/api/groups/:dokartId', (req, res) => {
    const dokartId = parseId(req.params.dokartId);
    if (dokartId === null) {
      res.status(400).json({ error: 'Invalid document type id' });
      return;
    }

    if (!getDocType(db, dokartId)) {
      res.status(404).json({ error: 'Document type not found' });
      return;
    }

    const dokartSuffix = padDokart(dokartId);
    const groupTable = `TZUKN${dokartSuffix}`;
    const fallbackTable = 'TZUKN000200';

    if (hasTable(db, groupTable)) {
      const rows = queryAll<GroupNode>(
        db,
        `SELECT DISTINCT KNOTEN_ID as id, KNOTEN_KZ as code, KNOTEN_BEZ as name, VATER_ID as parentId FROM ${groupTable} WHERE VATER_ID = -1 ORDER BY KNOTEN_SORT, KNOTEN_ID;`,
      );
      res.json(rows);
      return;
    }

    const thgrTable = `THGR${dokartSuffix}`;
    if (!hasTable(db, thgrTable)) {
      res.status(404).json({ error: 'Group table not found' });
      return;
    }

    const rows = queryAll<GroupNode>(
      db,
      `SELECT DISTINCT t.KNOTEN_ID as id, z.KNOTEN_KZ as code, z.KNOTEN_BEZ as name, -1 as parentId FROM ${thgrTable} t LEFT JOIN ${fallbackTable} z ON z.KNOTEN_ID = t.KNOTEN_ID AND z.VATER_ID = -1 ORDER BY t.KNOTEN_ID;`,
    );

    res.json(rows);
  });

  app.get('/api/groups/:dokartId/:nodeId', (req, res) => {
    const dokartId = parseId(req.params.dokartId);
    const nodeId = parseId(req.params.nodeId);
    if (dokartId === null || nodeId === null) {
      res.status(400).json({ error: 'Invalid document type or node id' });
      return;
    }

    if (!getDocType(db, dokartId)) {
      res.status(404).json({ error: 'Document type not found' });
      return;
    }

    const dokartSuffix = padDokart(dokartId);
    const groupTable = `TZUKN${dokartSuffix}`;
    const fallbackTable = 'TZUKN000200';

    if (hasTable(db, groupTable)) {
      const rows = queryAll<GroupNode>(
        db,
        `SELECT DISTINCT KNOTEN_ID as id, KNOTEN_KZ as code, KNOTEN_BEZ as name, VATER_ID as parentId FROM ${groupTable} WHERE VATER_ID = ? ORDER BY KNOTEN_SORT, KNOTEN_ID;`,
        [nodeId],
      );

      if (rows.length === 0) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }

      res.json(rows);
      return;
    }

    const tgrrTable = `TGRR${dokartSuffix}`;
    if (!hasTable(db, tgrrTable)) {
      res.status(404).json({ error: 'Group table not found' });
      return;
    }

    const rows = queryAll<GroupNode>(
      db,
      `SELECT DISTINCT z.KNOTEN_ID as id, z.KNOTEN_KZ as code, z.KNOTEN_BEZ as name, z.VATER_ID as parentId FROM ${fallbackTable} z WHERE z.VATER_ID = ? ORDER BY z.KNOTEN_SORT, z.KNOTEN_ID;`,
      [nodeId],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    res.json(rows);
  });

  app.get('/api/documents/:nodeId', (req, res) => {
    const nodeId = parseId(req.params.nodeId);
    if (nodeId === null) {
      res.status(400).json({ error: 'Invalid node id' });
      return;
    }

    const dokartIds = [100, 200, 300, 400];
    const results: DocumentListItem[] = [];

    for (const dokartId of dokartIds) {
      const tableSuffix = padDokart(dokartId);
      const tgrrTable = `TGRR${tableSuffix}`;
      if (!hasTable(db, tgrrTable)) {
        continue;
      }

      const rows = queryAll<DocumentListItem>(
        db,
        `SELECT o.INFOOBJ_ID as id, o.INFOOBJ_KZ as code, o.DOKART_ID as dokartId, o.TITEL as title, o.ERSCHDAT as publicationDate FROM ${tgrrTable} g JOIN TINFO_OBJEKT o ON g.INFOOBJ_ID = o.INFOOBJ_ID WHERE g.KNOTEN_ID = ? ORDER BY o.TITEL;`,
        [nodeId],
      );

      results.push(...rows);
    }

    if (results.length === 0) {
      res.status(404).json({ error: 'Documents not found' });
      return;
    }

    res.json(results);
  });

  app.get('/api/document/:id', (req, res) => {
    const documentId = parseId(req.params.id);
    if (documentId === null) {
      res.status(400).json({ error: 'Invalid document id' });
      return;
    }

    const document = queryGet<DocumentDetail>(
      db,
      'SELECT INFOOBJ_ID as id, INFOOBJ_KZ as code, DOKART_ID as dokartId, TITEL as title, ERSCHDAT as publicationDate, SECURITY as security FROM TINFO_OBJEKT WHERE INFOOBJ_ID = ?;',
      [documentId],
    );

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const files = queryAll<{
      filename: string;
      deviceType: string | null;
      deviceCode: string | null;
    }>(
      db,
      'SELECT INFO_FILENAME as filename, DEVICETYP as deviceType, DEVICEKZ as deviceCode FROM TINFO_FILE WHERE INFOOBJ_ID = ?;',
      [documentId],
    ).map((file) => ({
      ...file,
      graphicsPath: `GRAFIK/${file.filename}.ITW`,
      textPath: `${file.filename}.rtf`,
      textUrl: `/api/docs/${file.filename}.rtf`,
    }));

    const response: DocumentResponse = {
      document,
      files,
    };

    res.json(response);
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
    console.log(`SQLite database: ${dbPath}`);
    console.log(`Docs database: ${docsDbPath}`);
    console.log(`Images database: ${imagesDbPath}`);
  });

  process.on('SIGINT', () => {
    db.close();
    docsDb.close();
    process.exit(0);
  });
};

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', error);
  process.exit(1);
});
