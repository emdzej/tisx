import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  openDatabase,
  parseId,
  parseIdList,
  getSeries,
  getModels,
  getEngines,
  getVehicleVariants,
  lookupVin,
  getDocTypes,
  getGroups,
  getGroupChildren,
  getDocumentsByNode,
  getDocumentsByDocType,
  getDocument,
  getDocumentByCode,
  getDocumentByCodeAndType,
  getRelatedDocuments,
  getHotspots,
  getDocContent,
  getDocContentAsHtml,
  getSymptomRoots,
  getSymptomNodes,
  getSymptomTree,
  getSymptomDocuments,
  getImage,
} from '@emdzej/tisx-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.TIS_DB_PATH ?? './data/tis.sqlite';

const main = async () => {
  const db = openDatabase(dbPath);

  const app = express();
  app.use(cors());
  app.use(express.json());

  const assetsPath = join(__dirname, '..', 'assets');
  app.use('/assets', express.static(assetsPath));

  const webBuildPath =
    process.env.WEB_BUILD_PATH || join(__dirname, '..', 'web', 'build');

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // -------------------------------------------------------------------------
  // Images
  // -------------------------------------------------------------------------

  app.get('/api/images/*', (req, res) => {
    const imageId = (req.params as Record<string, string>)[0];
    if (!imageId) {
      res.status(400).json({ error: 'Invalid image id' });
      return;
    }

    const result = getImage(db, imageId);
    if (!result) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    res.set('Content-Type', result.contentType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(result.data);
  });

  // -------------------------------------------------------------------------
  // Document content (RTF / HTML)
  // -------------------------------------------------------------------------

  app.get('/api/docs/*', (req, res) => {
    const docId = (req.params as Record<string, string>)[0];
    const format = req.query.format as string | undefined;

    if (!docId) {
      res.status(400).json({ error: 'Invalid document path' });
      return;
    }

    if (format === 'html') {
      const textPlaceholders: Record<string, string> = {
        '--TYP--': (req.query.typ as string | undefined) ?? '',
        '--FGSTNR--': (req.query.fgstnr as string | undefined) ?? '',
        '--MODELL--': (req.query.modell as string | undefined) ?? '',
        '--MOTOR--': (req.query.motor as string | undefined) ?? '',
        '--KAROSS--': (req.query.kaross as string | undefined) ?? '',
      };

      const html = getDocContentAsHtml(db, docId, textPlaceholders);
      if (html === null) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      res.json({ content: html });
      return;
    }

    const content = getDocContent(db, docId);
    if (content === null) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.json({ content });
  });

  // -------------------------------------------------------------------------
  // Vehicle hierarchy
  // -------------------------------------------------------------------------

  app.get('/api/series', (_req, res) => {
    res.json(getSeries(db));
  });

  app.get('/api/series/:id/models', (req, res) => {
    const seriesId = parseId(req.params.id);
    if (seriesId === null) {
      res.status(400).json({ error: 'Invalid series id' });
      return;
    }
    const rows = getModels(db, seriesId);
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
    const rows = getEngines(db, modelId);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }
    res.json(rows);
  });

  app.get('/api/vehicle-variants', (req, res) => {
    const seriesId = parseId(req.query.series as string);
    if (seriesId === null) {
      res.status(400).json({ error: 'series query param is required' });
      return;
    }
    const modelId = parseId(req.query.model as string);
    const engineId = parseId(req.query.engine as string);
    res.json(getVehicleVariants(db, seriesId, modelId, engineId));
  });

  app.get('/api/vin/:vin', (req, res) => {
    const lookup = lookupVin(db, req.params.vin);
    if ('error' in lookup) {
      res.status(lookup.status).json({ error: lookup.error });
      return;
    }
    res.json(lookup.result);
  });

  // -------------------------------------------------------------------------
  // Doc types & group navigation
  // -------------------------------------------------------------------------

  app.get('/api/doctypes', (_req, res) => {
    res.json(getDocTypes(db));
  });

  app.get('/api/groups/:docTypeId', (req, res) => {
    const docTypeId = parseId(req.params.docTypeId);
    if (docTypeId === null) {
      res.status(400).json({ error: 'Invalid document type id' });
      return;
    }
    const seriesId = parseId(req.query.series as string);
    const modelId = parseId(req.query.model as string);
    const engineId = parseId(req.query.engine as string);
    const bodyIds = parseIdList(req.query.body as string);
    const gearboxIds = parseIdList(req.query.gearbox as string);

    const result = getGroups(
      db,
      docTypeId,
      seriesId,
      modelId,
      engineId,
      bodyIds,
      gearboxIds,
    );
    if (!Array.isArray(result)) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  app.get('/api/groups/:docTypeId/:nodeId', (req, res) => {
    const docTypeId = parseId(req.params.docTypeId);
    const nodeId = parseId(req.params.nodeId);
    if (docTypeId === null || nodeId === null) {
      res.status(400).json({ error: 'Invalid document type or node id' });
      return;
    }
    const seriesId = parseId(req.query.series as string);
    const modelId = parseId(req.query.model as string);
    const engineId = parseId(req.query.engine as string);
    const bodyIds = parseIdList(req.query.body as string);
    const gearboxIds = parseIdList(req.query.gearbox as string);

    const result = getGroupChildren(
      db,
      docTypeId,
      nodeId,
      seriesId,
      modelId,
      engineId,
      bodyIds,
      gearboxIds,
    );
    if (!Array.isArray(result)) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  // -------------------------------------------------------------------------
  // Document listing
  // -------------------------------------------------------------------------

  app.get('/api/documents/:docTypeId/:nodeId', (req, res) => {
    const docTypeId = parseId(req.params.docTypeId);
    const nodeId = parseId(req.params.nodeId);
    if (docTypeId === null || nodeId === null) {
      res.status(400).json({ error: 'Invalid document type or node id' });
      return;
    }
    const seriesId = parseId(req.query.series as string);
    const modelId = parseId(req.query.model as string);
    const engineId = parseId(req.query.engine as string);
    const bodyIds = parseIdList(req.query.body as string);
    const gearboxIds = parseIdList(req.query.gearbox as string);

    res.json(
      getDocumentsByNode(
        db,
        docTypeId,
        nodeId,
        seriesId,
        modelId,
        engineId,
        bodyIds,
        gearboxIds,
      ),
    );
  });

  app.get('/api/documents/:docTypeId', (req, res) => {
    const docTypeId = parseId(req.params.docTypeId);
    if (docTypeId === null) {
      res.status(400).json({ error: 'Invalid document type id' });
      return;
    }
    const seriesId = parseId(req.query.series as string);
    const modelId = parseId(req.query.model as string);
    const engineId = parseId(req.query.engine as string);
    const bodyIds = parseIdList(req.query.body as string);
    const gearboxIds = parseIdList(req.query.gearbox as string);

    res.json(
      getDocumentsByDocType(
        db,
        docTypeId,
        seriesId,
        modelId,
        engineId,
        bodyIds,
        gearboxIds,
      ),
    );
  });

  // -------------------------------------------------------------------------
  // Symptom-based navigation
  // -------------------------------------------------------------------------

  app.get('/api/symptoms/roots', (_req, res) => {
    res.json(getSymptomRoots(db));
  });

  app.get('/api/symptoms/nodes/:parentId', (req, res) => {
    const parentId = parseId(req.params.parentId);
    if (parentId === null) {
      res.status(400).json({ error: 'Invalid parent id' });
      return;
    }
    const seriesId = parseId(req.query.series as string);
    const modelId = parseId(req.query.model as string);
    const engineId = parseId(req.query.engine as string);

    res.json(getSymptomNodes(db, parentId, seriesId, modelId, engineId));
  });

  app.get('/api/symptoms/tree/:rootId', (req, res) => {
    const rootId = parseId(req.params.rootId);
    if (rootId === null) {
      res.status(400).json({ error: 'Invalid root id' });
      return;
    }
    const seriesId = parseId(req.query.series as string);
    const modelId = parseId(req.query.model as string);
    const engineId = parseId(req.query.engine as string);

    res.json(getSymptomTree(db, rootId, seriesId, modelId, engineId));
  });

  app.get('/api/symptoms/documents/:nodeId', (req, res) => {
    const nodeId = parseId(req.params.nodeId);
    if (nodeId === null) {
      res.status(400).json({ error: 'Invalid node id' });
      return;
    }
    const seriesId = parseId(req.query.series as string);
    const modelId = parseId(req.query.model as string);
    const engineId = parseId(req.query.engine as string);

    res.json(getSymptomDocuments(db, nodeId, seriesId, modelId, engineId));
  });

  // -------------------------------------------------------------------------
  // Single document, cross-references, hotspots
  // -------------------------------------------------------------------------

  app.get('/api/doctypes/:docTypeId/documents/by-code/:code', (req, res) => {
    const docTypeId = parseId(req.params.docTypeId);
    if (docTypeId === null) {
      res.status(400).json({ error: 'Invalid document type id' });
      return;
    }
    const code = req.params.code?.trim();
    if (!code || !/^[A-Za-z0-9]+$/.test(code)) {
      res.status(400).json({ error: 'Invalid document code' });
      return;
    }
    const seriesId = parseId(req.query.series as string);
    const modelId = parseId(req.query.model as string);
    const engineId = parseId(req.query.engine as string);

    const rows = getDocumentByCodeAndType(
      db,
      code,
      docTypeId,
      seriesId,
      modelId,
      engineId,
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'No document found with that code' });
      return;
    }
    res.json(rows);
  });

  app.get('/api/document/by-code/:code', (req, res) => {
    const code = req.params.code?.trim();
    if (!code || !/^[A-Za-z0-9.]+$/.test(code)) {
      res.status(400).json({ error: 'Invalid document code' });
      return;
    }
    const seriesId = parseId(req.query.series as string);
    const modelId = parseId(req.query.model as string);
    const engineId = parseId(req.query.engine as string);

    const rows = getDocumentByCode(db, code, seriesId, modelId, engineId);
    if (rows.length === 0) {
      res.status(404).json({ error: 'No document found with that code' });
      return;
    }
    res.json(rows);
  });

  app.get('/api/document/:id', (req, res) => {
    const documentId = parseId(req.params.id);
    if (documentId === null) {
      res.status(400).json({ error: 'Invalid document id' });
      return;
    }
    const result = getDocument(db, documentId);
    if (!result) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.json(result);
  });

  app.get('/api/document/:id/related', (req, res) => {
    const documentId = parseId(req.params.id);
    if (documentId === null) {
      res.status(400).json({ error: 'Invalid document id' });
      return;
    }
    const seriesId = parseId(req.query.series as string);
    const modelId = parseId(req.query.model as string);
    const engineId = parseId(req.query.engine as string);

    res.json(getRelatedDocuments(db, documentId, seriesId, modelId, engineId));
  });

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

    res.json(
      getHotspots(
        db,
        documentId,
        seriesId,
        modelId,
        engineId,
        bodyIds,
        gearboxIds,
      ),
    );
  });

  // -------------------------------------------------------------------------
  // SPA fallback
  // -------------------------------------------------------------------------

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
    console.log(`Server listening on port ${port}`);
    console.log(`Database: ${dbPath}`);
  });

  process.on('exit', () => db.close());
  process.on('SIGINT', () => process.exit(128 + 2));
  process.on('SIGTERM', () => process.exit(128 + 15));
};

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
