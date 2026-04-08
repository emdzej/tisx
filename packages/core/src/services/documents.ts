import type Database from 'better-sqlite3';
import type {
  DocType,
  GroupNode,
  DocumentListItem,
  DocumentDetail,
  DocumentFile,
  DocumentResponse,
  RelatedDocument,
  HotspotTarget,
  HotspotMap,
  DocumentCodeResult,
} from '../types.js';
import { padDocTypeId, filterVariants, buildVehicleFilter } from '../utils.js';
import { safeDynamicTable } from '../db.js';
import { rtfToHtml } from '../rtf.js';
import { decodeContent } from '../utils.js';

// ---------------------------------------------------------------------------
// DocType helpers
// ---------------------------------------------------------------------------

/** Derive the fixed alphabetic code prefix for a doc type.
 *  ISB (id 1600) codes start with "IB"; all others are purely numeric. */
const deriveCodePrefix = (dt: Omit<DocType, 'codePrefix'>): string => {
  if (dt.id === 1600) return 'IB';
  return '';
};

/** Hydrate keyLength, minLength, codePrefix on a raw doc-type row. */
const hydrateDocType = (
  row: Omit<DocType, 'codePrefix'> & { keyLength: number; minLength: number },
): DocType => ({
  ...row,
  codePrefix: deriveCodePrefix(row),
});

export const getDocType = (
  db: Database.Database,
  docTypeId: number,
): DocType | null => {
  const row = db
    .prepare(
      'SELECT DOKART_ID as id, DOKART_KZ as code, DOKART_BEZ as name, HGNAME as mainGroupLabel, UGNAME as subGroupLabel, METHODE as methode, ZUGRIFF as zugriff, FZG_REQU as fzgRequ, KEY_LENGTH as keyLength, MIN_LENGTH as minLength FROM TDOKART WHERE DOKART_ID = ?',
    )
    .get(docTypeId) as (Omit<DocType, 'codePrefix'> & { keyLength: number; minLength: number }) | undefined;
  return row ? hydrateDocType(row) : null;
};

export const getDocTypes = (db: Database.Database): DocType[] => {
  const rows = db
    .prepare(
      "SELECT DOKART_ID as id, DOKART_KZ as code, DOKART_BEZ as name, HGNAME as mainGroupLabel, UGNAME as subGroupLabel, METHODE as methode, ZUGRIFF as zugriff, FZG_REQU as fzgRequ, KEY_LENGTH as keyLength, MIN_LENGTH as minLength FROM TDOKART WHERE LAND_OK = 1 ORDER BY DOKART_SORT",
    )
    .all() as (Omit<DocType, 'codePrefix'> & { keyLength: number; minLength: number })[];
  return rows.map(hydrateDocType);
};

// ---------------------------------------------------------------------------
// Group navigation
// ---------------------------------------------------------------------------

/**
 * Get root-level groups for a doc type (parentId = -1).
 */
export const getGroups = (
  db: Database.Database,
  docTypeId: number,
  seriesId: number | null,
  modelId: number | null,
  engineId: number | null,
  bodyIds: number[],
  gearboxIds: number[],
): GroupNode[] | { error: string; status: number } => {
  const docType = getDocType(db, docTypeId);
  if (!docType) {
    return { error: 'Document type not found', status: 404 };
  }

  const docTypeSuffix = padDocTypeId(docTypeId);

  // METHODE 5 (ISB): flat document list, no tree navigation
  if (docType.methode === 5) {
    return [];
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

    return filterVariants(rows, engineId, bodyIds, gearboxIds);
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
         WHERE t.ZUWEG_ID = ? AND t.VATER_ID = -1 AND t.LAND_OK = 1
         ORDER BY t.KNOTEN_SORT, t.KNOTEN_KZ, t.VARIANT_ART, t.VARIANT_WERT`,
      )
      .all(zuweg_id) as GroupNode[];
    return filterVariants(rows, engineId, bodyIds, gearboxIds);
  }

  return { error: 'Group table not found', status: 404 };
};

/**
 * Get child groups for a given node.
 */
export const getGroupChildren = (
  db: Database.Database,
  docTypeId: number,
  nodeId: number,
  seriesId: number | null,
  modelId: number | null,
  engineId: number | null,
  bodyIds: number[],
  gearboxIds: number[],
): GroupNode[] | { error: string; status: number } => {
  const docType = getDocType(db, docTypeId);
  if (!docType) {
    return { error: 'Document type not found', status: 404 };
  }

  const docTypeSuffix = padDocTypeId(docTypeId);

  if (docType.methode === 5) {
    return [];
  }

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

    return filterVariants(rows, engineId, bodyIds, gearboxIds);
  }

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

    return filterVariants(rows, engineId, bodyIds, gearboxIds);
  }

  return { error: 'Group table not found', status: 404 };
};

// ---------------------------------------------------------------------------
// Document listing
// ---------------------------------------------------------------------------

/**
 * List documents for a navigation tree node, scoped to a single document type.
 */
export const getDocumentsByNode = (
  db: Database.Database,
  docTypeId: number,
  nodeId: number,
  seriesId: number | null,
  modelId: number | null,
  engineId: number | null,
  bodyIds: number[],
  gearboxIds: number[],
): DocumentListItem[] => {
  const thgrTable = safeDynamicTable(db, `THGR${padDocTypeId(docTypeId)}`);
  if (!thgrTable) {
    return [];
  }

  const {
    clauses: vehicleWhere,
    params: vehicleParams,
    hasVehicle,
  } = buildVehicleFilter(seriesId, modelId, engineId, bodyIds, gearboxIds);

  let sql: string;
  const params: (number | null)[] = [];

  if (hasVehicle) {
    const vehicleFilter =
      vehicleWhere.length > 0 ? ` AND ${vehicleWhere.join(' AND ')}` : '';

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

  return db.prepare(sql).all(...params) as DocumentListItem[];
};

/**
 * List ALL documents for a doc type without tree navigation.
 * Used for METHODE 5 (ISB) which has no group tree.
 */
export const getDocumentsByDocType = (
  db: Database.Database,
  docTypeId: number,
  seriesId: number | null,
  modelId: number | null,
  engineId: number | null,
  bodyIds: number[],
  gearboxIds: number[],
): DocumentListItem[] => {
  const {
    clauses: vehicleWhere,
    params: vehicleParams,
    hasVehicle,
  } = buildVehicleFilter(seriesId, modelId, engineId, bodyIds, gearboxIds);

  let sql: string;
  const params: (number | null)[] = [];

  if (hasVehicle) {
    const vehicleFilter =
      vehicleWhere.length > 0 ? ` AND ${vehicleWhere.join(' AND ')}` : '';

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

  return db.prepare(sql).all(...params) as DocumentListItem[];
};

// ---------------------------------------------------------------------------
// Single document detail
// ---------------------------------------------------------------------------

/**
 * Get a single document by ID with its associated files.
 */
export const getDocument = (
  db: Database.Database,
  documentId: number,
): DocumentResponse | null => {
  const document = db
    .prepare(
      'SELECT INFOOBJ_ID as id, INFOOBJ_KZ as code, DOKART_ID as docTypeId, TITEL as title, ERSCHDAT as publicationDate, SECURITY as security FROM TINFO_OBJEKT WHERE INFOOBJ_ID = ?',
    )
    .get(documentId) as DocumentDetail | undefined;

  if (!document) {
    return null;
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

  return { document, files };
};

/**
 * Look up document(s) by INFOOBJ_KZ code. Used for cross-reference links.
 */
export const getDocumentByCode = (
  db: Database.Database,
  code: string,
  seriesId: number | null,
  modelId: number | null,
  engineId: number | null,
): DocumentCodeResult[] => {
  const hasVehicle = seriesId !== null;

  if (hasVehicle) {
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
    const vehicleFilter =
      vehicleWhere.length > 0 ? ` AND ${vehicleWhere.join(' AND ')}` : '';

    return db
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
      .all(code, ...vehicleParams, code) as DocumentCodeResult[];
  }

  return db
    .prepare(
      `SELECT INFOOBJ_ID as id, INFOOBJ_KZ as code, DOKART_ID as docTypeId, TITEL as title
       FROM TINFO_OBJEKT WHERE INFOOBJ_KZ = ? AND LAND_OK = 1`,
    )
    .all(code) as DocumentCodeResult[];
};

/**
 * Look up document(s) by INFOOBJ_KZ code scoped to a specific doc type.
 * Used for the document code search feature.
 */
export const getDocumentByCodeAndType = (
  db: Database.Database,
  code: string,
  docTypeId: number,
  seriesId: number | null,
  modelId: number | null,
  engineId: number | null,
): DocumentCodeResult[] => {
  const hasVehicle = seriesId !== null;

  if (hasVehicle) {
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
    const vehicleFilter =
      vehicleWhere.length > 0 ? ` AND ${vehicleWhere.join(' AND ')}` : '';

    return db
      .prepare(
        `SELECT DISTINCT o.INFOOBJ_ID as id, o.INFOOBJ_KZ as code, o.DOKART_ID as docTypeId, o.TITEL as title
         FROM TINFO_OBJEKT o
         JOIN TFZGREFBR f ON f.INFOOBJ_ID = o.INFOOBJ_ID
         WHERE o.INFOOBJ_KZ = ? AND o.DOKART_ID = ? AND o.LAND_OK = 1${vehicleFilter}

         UNION

         SELECT DISTINCT o.INFOOBJ_ID as id, o.INFOOBJ_KZ as code, o.DOKART_ID as docTypeId, o.TITEL as title
         FROM TINFO_OBJEKT o
         JOIN TFZGREFBR f ON f.INFOOBJ_ID = o.INFOOBJ_ID
         WHERE o.INFOOBJ_KZ = ? AND o.DOKART_ID = ? AND o.LAND_OK = 1 AND f.BAUREIHE_ID = 0`,
      )
      .all(code, docTypeId, ...vehicleParams, code, docTypeId) as DocumentCodeResult[];
  }

  return db
    .prepare(
      `SELECT INFOOBJ_ID as id, INFOOBJ_KZ as code, DOKART_ID as docTypeId, TITEL as title
       FROM TINFO_OBJEKT WHERE INFOOBJ_KZ = ? AND DOKART_ID = ? AND LAND_OK = 1`,
    )
    .all(code, docTypeId) as DocumentCodeResult[];
};

// ---------------------------------------------------------------------------
// Related documents & hotspots
// ---------------------------------------------------------------------------

/**
 * Get documents linked via TINFO_REF (Verbund/cross-references).
 */
export const getRelatedDocuments = (
  db: Database.Database,
  documentId: number,
  seriesId: number | null,
  modelId: number | null,
  engineId: number | null,
): RelatedDocument[] => {
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

    const vehicleFilter =
      vehicleWhere.length > 0 ? ` AND ${vehicleWhere.join(' AND ')}` : '';

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

  return db.prepare(sql).all(...params) as RelatedDocument[];
};

/**
 * Get all hotspot cross-reference targets for a document.
 */
export const getHotspots = (
  db: Database.Database,
  documentId: number,
  seriesId: number | null,
  modelId: number | null,
  engineId: number | null,
  bodyIds: number[],
  gearboxIds: number[],
): HotspotMap => {
  const hasVehicle = seriesId !== null;

  let sql: string;
  const params: (number | null)[] = [];

  if (hasVehicle) {
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
      vehicleWhere.push(
        `f.KAROSSERIE_ID IN (${bodyIds.map(() => '?').join(',')})`,
      );
      vehicleParams.push(...bodyIds);
    }
    if (gearboxIds.length > 0) {
      vehicleWhere.push(
        `(f.GETRIEBE_ID IN (${gearboxIds.map(() => '?').join(',')}) OR f.GETRIEBE_ID = 0)`,
      );
      vehicleParams.push(...gearboxIds);
    }

    const vehicleFilter =
      vehicleWhere.length > 0 ? ` AND ${vehicleWhere.join(' AND ')}` : '';

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
    params.push(documentId, ...vehicleParams);
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

  const hotspots: HotspotMap = {};
  for (const row of rows) {
    if (!hotspots[row.hotspotNr]) {
      hotspots[row.hotspotNr] = [];
    }
    if (!hotspots[row.hotspotNr].some((t) => t.id === row.id)) {
      hotspots[row.hotspotNr].push({
        id: row.id,
        code: row.code,
        docTypeId: row.docTypeId,
        title: row.title,
      });
    }
  }

  return hotspots;
};

// ---------------------------------------------------------------------------
// Doc content (RTF / raw)
// ---------------------------------------------------------------------------

/**
 * Get raw document content from the DOCS table.
 * Returns null if not found.
 */
export const getDocContent = (
  db: Database.Database,
  docId: string,
): string | null => {
  const row = db
    .prepare('SELECT data FROM DOCS WHERE id = ?')
    .get(docId.toUpperCase()) as { data: Buffer | string } | undefined;
  if (!row) return null;
  return decodeContent(row.data as Buffer | string);
};

/**
 * Get document content as HTML (RTF → HTML conversion).
 * Returns null if the document is not found.
 */
export const getDocContentAsHtml = (
  db: Database.Database,
  docId: string,
  textPlaceholders: Record<string, string>,
  imageBaseUrl: string = '/api/images',
): string | null => {
  const content = getDocContent(db, docId);
  if (content === null) return null;
  return rtfToHtml(content, textPlaceholders, imageBaseUrl);
};
