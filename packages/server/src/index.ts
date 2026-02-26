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

const main = async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync(dbPath));
  const docsDb = new SQL.Database(readFileSync(docsDbPath));

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

    // sql.js returns binary as Uint8Array, convert to string
    let content: string;
    if (row.content instanceof Uint8Array) {
      content = new TextDecoder('utf-8').decode(row.content);
    } else if (typeof row.content === 'object' && row.content !== null) {
      // Handle object with numeric keys (Buffer-like)
      const bytes = Object.values(row.content as Record<string, number>);
      content = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    } else {
      content = String(row.content ?? '');
    }

    // Convert to HTML using Pandoc if requested
    if (format === 'html') {
      try {
        const html = execSync('pandoc -f markdown -t html', {
          input: content,
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024, // 10MB
        });
        res.json({ content: html });
      } catch (err) {
        console.error('Pandoc conversion failed:', err);
        res.json({ content }); // Fallback to raw markdown
      }
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
      textPath: `DOCS/${file.filename}.md`,
      textUrl: `/api/docs/DOCS/${file.filename}.md`,
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
