import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import os from 'node:os';
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

const dbPath =
  process.env.TIS_DB_PATH ?? join(os.homedir(), 'Documents', 'tis.sqlite');

const db = new Database(dbPath);

const app = express();
app.use(cors());
app.use(express.json());

const assetsPath = join(__dirname, '..', 'assets');
app.use('/assets', express.static(assetsPath));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const parseId = (value: string): number | null => {
  const id = Number.parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
};

const padDokart = (dokartId: number) => String(dokartId).padStart(6, '0');

const hasTable = (tableName: string): boolean => {
  const row = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
    )
    .get(tableName) as { name?: string } | undefined;
  return Boolean(row?.name);
};

const getDocType = (dokartId: number): DocType | null => {
  const row = db
    .prepare(
      'SELECT DOKART_ID as id, DOKART_KZ as code, DOKART_BEZ as name, HGNAME as mainGroupLabel, UGNAME as subGroupLabel FROM TDOKART WHERE DOKART_ID = ?;',
    )
    .get(dokartId) as DocType | undefined;
  return row ?? null;
};

app.get('/api/series', (_req, res) => {
  const rows = db
    .prepare(
      'SELECT DISTINCT m.BAUREIHE_ID as id, b.BENENNUNG as code, m.BAUREIHE_LANG as name FROM TFZGMODELL m LEFT JOIN TBENENNUNG b ON m.BAUREIHE_ID = b.KEY ORDER BY m.BAUREIHE_LANG;',
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
      'SELECT m.MODELL_ID as id, b.BENENNUNG as code, m.MODELL_LANG as name, MIN(m.PRODDAT_AB) as productionFrom, MAX(m.PRODDAT_BIS) as productionTo FROM TFZGMODELL m LEFT JOIN TBENENNUNG b ON m.MODELL_ID = b.KEY WHERE m.BAUREIHE_ID = ? GROUP BY m.MODELL_ID, b.BENENNUNG, m.MODELL_LANG ORDER BY m.MODELL_LANG;',
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
      'SELECT DISTINCT t.MOTOR_ID as id, b.BENENNUNG as code FROM TFZGTYP t LEFT JOIN TBENENNUNG b ON t.MOTOR_ID = b.KEY WHERE t.MODELL_ID = ? ORDER BY b.BENENNUNG;',
    )
    .all(modelId) as Engine[];

  if (rows.length === 0) {
    res.status(404).json({ error: 'Model not found' });
    return;
  }

  res.json(rows);
});

app.get('/api/doctypes', (_req, res) => {
  const rows = db
    .prepare(
      "SELECT DOKART_ID as id, DOKART_KZ as code, DOKART_BEZ as name, HGNAME as mainGroupLabel, UGNAME as subGroupLabel FROM TDOKART WHERE DOKART_KZ IN ('SI','RA','TD','AZD') ORDER BY DOKART_SORT;",
    )
    .all() as DocType[];
  res.json(rows);
});

app.get('/api/groups/:dokartId', (req, res) => {
  const dokartId = parseId(req.params.dokartId);
  if (dokartId === null) {
    res.status(400).json({ error: 'Invalid document type id' });
    return;
  }

  if (!getDocType(dokartId)) {
    res.status(404).json({ error: 'Document type not found' });
    return;
  }

  const dokartSuffix = padDokart(dokartId);
  const groupTable = `TZUKN${dokartSuffix}`;
  const fallbackTable = 'TZUKN000200';

  if (hasTable(groupTable)) {
    const rows = db
      .prepare(
        `SELECT DISTINCT KNOTEN_ID as id, KNOTEN_KZ as code, KNOTEN_BEZ as name, VATER_ID as parentId FROM ${groupTable} WHERE VATER_ID = -1 ORDER BY KNOTEN_SORT, KNOTEN_ID;`,
      )
      .all() as GroupNode[];
    res.json(rows);
    return;
  }

  const thgrTable = `THGR${dokartSuffix}`;
  if (!hasTable(thgrTable)) {
    res.status(404).json({ error: 'Group table not found' });
    return;
  }

  const rows = db
    .prepare(
      `SELECT DISTINCT t.KNOTEN_ID as id, z.KNOTEN_KZ as code, z.KNOTEN_BEZ as name, -1 as parentId FROM ${thgrTable} t LEFT JOIN ${fallbackTable} z ON z.KNOTEN_ID = t.KNOTEN_ID AND z.VATER_ID = -1 ORDER BY t.KNOTEN_ID;`,
    )
    .all() as GroupNode[];

  res.json(rows);
});

app.get('/api/groups/:dokartId/:nodeId', (req, res) => {
  const dokartId = parseId(req.params.dokartId);
  const nodeId = parseId(req.params.nodeId);
  if (dokartId === null || nodeId === null) {
    res.status(400).json({ error: 'Invalid document type or node id' });
    return;
  }

  if (!getDocType(dokartId)) {
    res.status(404).json({ error: 'Document type not found' });
    return;
  }

  const dokartSuffix = padDokart(dokartId);
  const groupTable = `TZUKN${dokartSuffix}`;
  const fallbackTable = 'TZUKN000200';

  if (hasTable(groupTable)) {
    const rows = db
      .prepare(
        `SELECT DISTINCT KNOTEN_ID as id, KNOTEN_KZ as code, KNOTEN_BEZ as name, VATER_ID as parentId FROM ${groupTable} WHERE VATER_ID = ? ORDER BY KNOTEN_SORT, KNOTEN_ID;`,
      )
      .all(nodeId) as GroupNode[];

    if (rows.length === 0) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    res.json(rows);
    return;
  }

  const tgrrTable = `TGRR${dokartSuffix}`;
  if (!hasTable(tgrrTable)) {
    res.status(404).json({ error: 'Group table not found' });
    return;
  }

  const rows = db
    .prepare(
      `SELECT DISTINCT z.KNOTEN_ID as id, z.KNOTEN_KZ as code, z.KNOTEN_BEZ as name, z.VATER_ID as parentId FROM ${fallbackTable} z WHERE z.VATER_ID = ? ORDER BY z.KNOTEN_SORT, z.KNOTEN_ID;`,
    )
    .all(nodeId) as GroupNode[];

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
    if (!hasTable(tgrrTable)) {
      continue;
    }

    const rows = db
      .prepare(
        `SELECT o.INFOOBJ_ID as id, o.INFOOBJ_KZ as code, o.DOKART_ID as dokartId, o.TITEL as title, o.ERSCHDAT as publicationDate FROM ${tgrrTable} g JOIN TINFO_OBJEKT o ON g.INFOOBJ_ID = o.INFOOBJ_ID WHERE g.KNOTEN_ID = ? ORDER BY o.TITEL;`,
      )
      .all(nodeId) as DocumentListItem[];

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

  const document = db
    .prepare(
      'SELECT INFOOBJ_ID as id, INFOOBJ_KZ as code, DOKART_ID as dokartId, TITEL as title, ERSCHDAT as publicationDate, SECURITY as security FROM TINFO_OBJEKT WHERE INFOOBJ_ID = ?;',
    )
    .get(documentId) as DocumentDetail | undefined;

  if (!document) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const files = (
    db
      .prepare(
        'SELECT INFO_FILENAME as filename, DEVICETYP as deviceType, DEVICEKZ as deviceCode FROM TINFO_FILE WHERE INFOOBJ_ID = ?;',
      )
      .all(documentId) as Array<{
      filename: string;
      deviceType: string | null;
      deviceCode: string | null;
    }>
  ).map((file) => ({
    ...file,
    graphicsPath: `GRAFIK/${file.filename}.ITW`,
    textPath: `TEXT/${file.filename}.xml`,
  }));

  const response: DocumentResponse = {
    document,
    files,
  };

  res.json(response);
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${port}`);
  console.log(`SQLite database: ${dbPath}`);
});

process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});
