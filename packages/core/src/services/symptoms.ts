import type Database from 'better-sqlite3';
import type { GroupNode, SymptomNode, DocumentListItem } from '../types.js';

// ---------------------------------------------------------------------------
// Symptom-based navigation (ZUWEG_ID = 1)
// ---------------------------------------------------------------------------

/**
 * Returns the two meta-root categories: "Vehicle component system" (-1) and
 * "diagnosis" (-2). These are the top-level entry points for symptom navigation.
 */
export const getSymptomRoots = (db: Database.Database): GroupNode[] => {
  return db
    .prepare(
      `SELECT KNOTEN_ID as id, KNOTEN_KZ as code, KNOTEN_BEZ as name, VATER_ID as parentId
       FROM tzuwegknoten
       WHERE ZUWEG_ID = 1 AND VATER_ID = 0 AND LAND_OK = 1
       ORDER BY KNOTEN_SORT`,
    )
    .all() as GroupNode[];
};

/**
 * Returns child nodes for a given parent in the symptom tree.
 * Optionally filtered by vehicle.
 */
export const getSymptomNodes = (
  db: Database.Database,
  parentId: number,
  seriesId: number | null,
  modelId: number | null,
  engineId: number | null,
): SymptomNode[] => {
  const hasVehicle = seriesId !== null;

  let sql: string;
  const params: number[] = [];

  if (hasVehicle) {
    const vehicleWhere: string[] = [];

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
  return rows;
};

/**
 * Returns ALL nodes in a symptom tree under a given root (e.g. -1 or -2)
 * in a single query. Each node includes its parentId so the client can
 * build the full tree structure. Optionally filtered by vehicle.
 */
export const getSymptomTree = (
  db: Database.Database,
  rootId: number,
  seriesId: number | null,
  modelId: number | null,
  engineId: number | null,
): SymptomNode[] => {
  const hasVehicle = seriesId !== null;

  let sql: string;
  const params: number[] = [];

  if (hasVehicle) {
    const vehicleWhere: string[] = [];

    params.push(rootId);

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
      WITH RECURSIVE tree AS (
        SELECT t.KNOTEN_ID, t.KNOTEN_KZ, t.KNOTEN_BEZ, t.VATER_ID, t.KNOTEN_SORT
        FROM tzuwegknoten t
        JOIN TKN_SY_REF k ON k.ZUWEG_ID = 1 AND k.KNOTEN_ID = t.KNOTEN_ID
        WHERE t.ZUWEG_ID = 1 AND t.VATER_ID = ? AND t.LAND_OK = 1
          AND ${vehicleWhere.join(' AND ')}

        UNION

        SELECT c.KNOTEN_ID, c.KNOTEN_KZ, c.KNOTEN_BEZ, c.VATER_ID, c.KNOTEN_SORT
        FROM tzuwegknoten c
        JOIN tree p ON c.VATER_ID = p.KNOTEN_ID
        JOIN TKN_SY_REF k2 ON k2.ZUWEG_ID = 1 AND k2.KNOTEN_ID = c.KNOTEN_ID
        WHERE c.ZUWEG_ID = 1 AND c.LAND_OK = 1
          AND ${vehicleWhere.map((w) => w.replace('k.', 'k2.')).join(' AND ')}
      )
      SELECT DISTINCT
        tree.KNOTEN_ID as id, tree.KNOTEN_KZ as code, tree.KNOTEN_BEZ as name,
        tree.VATER_ID as parentId,
        CASE WHEN EXISTS (
          SELECT 1 FROM tzuwegknoten ch
          WHERE ch.ZUWEG_ID = 1 AND ch.VATER_ID = tree.KNOTEN_ID AND ch.LAND_OK = 1
        ) THEN 1 ELSE 0 END as hasChildren
      FROM tree
      ORDER BY tree.KNOTEN_SORT, tree.KNOTEN_ID
    `;

    // The recursive CTE re-uses vehicle params for both base and recursive cases
    // We need to duplicate the vehicle params for the recursive part
    const vehicleParams = params.slice(1); // skip rootId
    params.push(...vehicleParams);
  } else {
    sql = `
      WITH RECURSIVE tree AS (
        SELECT t.KNOTEN_ID, t.KNOTEN_KZ, t.KNOTEN_BEZ, t.VATER_ID, t.KNOTEN_SORT
        FROM tzuwegknoten t
        WHERE t.ZUWEG_ID = 1 AND t.VATER_ID = ? AND t.LAND_OK = 1

        UNION

        SELECT c.KNOTEN_ID, c.KNOTEN_KZ, c.KNOTEN_BEZ, c.VATER_ID, c.KNOTEN_SORT
        FROM tzuwegknoten c
        JOIN tree p ON c.VATER_ID = p.KNOTEN_ID
        WHERE c.ZUWEG_ID = 1 AND c.LAND_OK = 1
      )
      SELECT DISTINCT
        tree.KNOTEN_ID as id, tree.KNOTEN_KZ as code, tree.KNOTEN_BEZ as name,
        tree.VATER_ID as parentId,
        CASE WHEN EXISTS (
          SELECT 1 FROM tzuwegknoten ch
          WHERE ch.ZUWEG_ID = 1 AND ch.VATER_ID = tree.KNOTEN_ID AND ch.LAND_OK = 1
        ) THEN 1 ELSE 0 END as hasChildren
      FROM tree
      ORDER BY tree.KNOTEN_SORT, tree.KNOTEN_ID
    `;
    params.push(rootId);
  }

  const rows = db.prepare(sql).all(...params) as SymptomNode[];
  for (const row of rows) {
    row.hasChildren = Boolean(row.hasChildren);
  }
  return rows;
};

/**
 * Returns documents associated with a symptom tree node via TSYREFALL.
 */
export const getSymptomDocuments = (
  db: Database.Database,
  nodeId: number,
  seriesId: number | null,
  modelId: number | null,
  engineId: number | null,
): DocumentListItem[] => {
  const hasVehicle = seriesId !== null;

  let sql: string;
  const params: (number | null)[] = [];

  if (hasVehicle) {
    const vehicleWhere: string[] = [];

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

    params.push(nodeId);

    const vehicleFilter =
      vehicleWhere.length > 0 ? ` AND ${vehicleWhere.join(' AND ')}` : '';

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

  return db.prepare(sql).all(...params) as DocumentListItem[];
};
