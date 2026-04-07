import type Database from 'better-sqlite3';
import type {
  Series,
  Model,
  Engine,
  VehicleVariants,
  VinResult,
} from '../types.js';

/**
 * GET all vehicle series.
 */
export const getSeries = (db: Database.Database): Series[] => {
  return db
    .prepare(
      'SELECT DISTINCT m.BAUREIHE_ID as id, b.BENENNUNG as code, m.BAUREIHE_LANG as name FROM TFZGMODELL m LEFT JOIN TBENENNUNG b ON m.BAUREIHE_ID = b.KEY ORDER BY m.BAUREIHE_LANG',
    )
    .all() as Series[];
};

/**
 * GET models for a series.
 */
export const getModels = (
  db: Database.Database,
  seriesId: number,
): Model[] => {
  return db
    .prepare(
      'SELECT m.MODELL_ID as id, b.BENENNUNG as code, m.MODELL_LANG as name, MIN(m.PRODDAT_AB) as productionFrom, MAX(m.PRODDAT_BIS) as productionTo FROM TFZGMODELL m LEFT JOIN TBENENNUNG b ON m.MODELL_ID = b.KEY WHERE m.BAUREIHE_ID = ? GROUP BY m.MODELL_ID, b.BENENNUNG, m.MODELL_LANG ORDER BY m.MODELL_LANG',
    )
    .all(seriesId) as Model[];
};

/**
 * GET engines for a model.
 */
export const getEngines = (
  db: Database.Database,
  modelId: number,
): Engine[] => {
  return db
    .prepare(
      'SELECT DISTINCT t.MOTOR_ID as id, b.BENENNUNG as name FROM TFZGTYP t LEFT JOIN TBENENNUNG b ON t.MOTOR_ID = b.KEY WHERE t.MODELL_ID = ? ORDER BY b.BENENNUNG',
    )
    .all(modelId) as Engine[];
};

/**
 * Resolve the full set of variant IDs (body types, gearbox types) for a vehicle.
 */
export const getVehicleVariants = (
  db: Database.Database,
  seriesId: number,
  modelId: number | null,
  engineId: number | null,
): VehicleVariants => {
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
    .all(...params) as Array<{
    bodyId: number;
    gearboxId: number;
    driveId: number;
  }>;

  const bodyIds = [...new Set(rows.map((r) => r.bodyId))].sort(
    (a, b) => a - b,
  );
  const gearboxIds = [...new Set(rows.map((r) => r.gearboxId))].sort(
    (a, b) => a - b,
  );
  const driveIds = [...new Set(rows.map((r) => r.driveId))].sort(
    (a, b) => a - b,
  );

  const nameOf = (key: number): string | null => {
    const row = db
      .prepare('SELECT BENENNUNG as name FROM TBENENNUNG WHERE KEY = ? LIMIT 1')
      .get(key) as { name: string } | undefined;
    return row?.name ?? null;
  };

  const bodyNames = bodyIds
    .map((id) => nameOf(id))
    .filter(Boolean) as string[];
  const gearboxNames = gearboxIds
    .map((id) => nameOf(id))
    .filter(Boolean) as string[];
  const driveNames = driveIds
    .map((id) => nameOf(id))
    .filter(Boolean) as string[];

  // Resolve model year range from TFZGMODELL
  let modelYear: string | null = null;
  if (modelId !== null) {
    const yearRow = db
      .prepare(
        'SELECT MIN(PRODDAT_AB) as fromYear, MAX(PRODDAT_BIS) as toYear FROM TFZGMODELL WHERE BAUREIHE_ID = ? AND MODELL_ID = ?',
      )
      .get(seriesId, modelId) as
      | { fromYear: number | null; toYear: number | null }
      | undefined;
    if (yearRow?.fromYear) {
      const from = String(yearRow.fromYear).slice(0, 4);
      const to = yearRow.toYear ? String(yearRow.toYear).slice(0, 4) : '';
      modelYear = to && to !== from ? `${from}-${to}` : from;
    }
  }

  return {
    bodyIds,
    gearboxIds,
    driveIds,
    bodyNames,
    gearboxNames,
    driveNames,
    modelYear,
  };
};

// ---------------------------------------------------------------------------
// VIN decoding
// ---------------------------------------------------------------------------

/**
 * Decode a single VIN character to its base-36 numeric value.
 */
const base36Char = (ch: string): number | null => {
  const c = ch.toUpperCase();
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48;
  if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 55;
  return null;
};

/**
 * Decode a multi-character base-36 string to an integer.
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
 * Returns { bereich, fgstnr } or null if the VIN is malformed.
 */
export const parseVin = (
  vin: string,
): { bereich: number; fgstnr: number } | null => {
  const v = vin.toUpperCase().replace(/[\s-]/g, '');
  if (v.length !== 17) return null;
  if (!/^[0-9A-HJ-NPR-Z]{17}$/.test(v)) return null;

  const bereich = base36Decode(v.slice(10, 12));
  if (bereich === null) return null;

  const fgstnr = base36Decode(v.slice(12, 17));
  if (fgstnr === null) return null;

  return { bereich, fgstnr };
};

/**
 * Look up a BMW VIN and return the resolved vehicle identity.
 * Returns null if the VIN doesn't match any known vehicle.
 */
export const lookupVin = (
  db: Database.Database,
  vin: string,
): { result: VinResult } | { error: string; status: 400 | 404 } => {
  const parsed = parseVin(vin);
  if (!parsed) {
    return {
      error:
        'Invalid VIN format — expected 17 characters (0-9, A-Z excluding I, O, Q)',
      status: 400,
    };
  }

  // Step 1: TFGSTNRK lookup
  const chassisRow = db
    .prepare(
      'SELECT FZGTYP as vehicleType, PRODDAT as productionDate FROM TFGSTNRK WHERE BEREICH = ? AND FGSTNRAB <= ? AND FGSTNRBIS >= ? LIMIT 1',
    )
    .get(parsed.bereich, parsed.fgstnr, parsed.fgstnr) as
    | { vehicleType: number; productionDate: number | null }
    | undefined;

  if (!chassisRow) {
    return { error: 'VIN not found in chassis number database', status: 404 };
  }

  // Step 2: TFZGTYP — decompose vehicle type
  const typeRow = db
    .prepare(
      'SELECT BAUREIHE_ID as seriesId, MODELL_ID as modelId, MOTOR_ID as engineId, KAROSSERIE_ID as bodyId, GETRIEBE_ID as gearboxId, ANTRIEB_ID as driveId FROM TFZGTYP WHERE FZGTYP = ?',
    )
    .get(chassisRow.vehicleType) as
    | {
        seriesId: number;
        modelId: number;
        engineId: number;
        bodyId: number;
        gearboxId: number;
        driveId: number;
      }
    | undefined;

  if (!typeRow) {
    return { error: 'Vehicle type not found', status: 404 };
  }

  // Step 3: Resolve human-readable names
  const seriesRow = db
    .prepare(
      'SELECT DISTINCT BAUREIHE_LANG as name FROM TFZGMODELL WHERE BAUREIHE_ID = ? LIMIT 1',
    )
    .get(typeRow.seriesId) as { name: string } | undefined;

  const modelRow =
    (db
      .prepare(
        'SELECT DISTINCT MODELL_LANG as name FROM TFZGMODELL WHERE BAUREIHE_ID = ? AND MODELL_ID = ? AND KAROSSERIE_ID = ? LIMIT 1',
      )
      .get(typeRow.seriesId, typeRow.modelId, typeRow.bodyId) as
      | { name: string }
      | undefined) ??
    (db
      .prepare(
        'SELECT DISTINCT MODELL_LANG as name FROM TFZGMODELL WHERE BAUREIHE_ID = ? AND MODELL_ID = ? LIMIT 1',
      )
      .get(typeRow.seriesId, typeRow.modelId) as { name: string } | undefined);

  const nameOf = (key: number): string | null => {
    const row = db
      .prepare('SELECT BENENNUNG as name FROM TBENENNUNG WHERE KEY = ? LIMIT 1')
      .get(key) as { name: string } | undefined;
    return row?.name ?? null;
  };

  return {
    result: {
      seriesId: typeRow.seriesId,
      seriesName: seriesRow?.name ?? null,
      modelId: typeRow.modelId,
      modelName: modelRow?.name ?? null,
      engineId: typeRow.engineId,
      engineName: nameOf(typeRow.engineId),
      bodyId: typeRow.bodyId,
      bodyName: nameOf(typeRow.bodyId),
      gearboxId: typeRow.gearboxId,
      gearboxName: nameOf(typeRow.gearboxId),
      driveId: typeRow.driveId,
      driveName: nameOf(typeRow.driveId),
      productionDate: chassisRow.productionDate,
    },
  };
};
