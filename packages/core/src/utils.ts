/**
 * Pure utility functions — no database or I/O dependencies.
 */

export const parseId = (value: string | undefined): number | null => {
  if (value === undefined || value === null) return null;
  const id = Number.parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
};

export const padDocTypeId = (docTypeId: number): string =>
  String(docTypeId).padStart(6, '0');

/**
 * Parse a comma-separated string into an array of numbers.
 * Returns an empty array if the value is missing or malformed.
 */
export const parseIdList = (value: string | undefined): number[] => {
  if (!value) return [];
  return value
    .split(',')
    .map(Number)
    .filter((n) => !Number.isNaN(n));
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
 */
export const buildVehicleFilter = (
  seriesId: number | null,
  modelId: number | null,
  engineId: number | null,
  bodyIds: number[],
  gearboxIds: number[],
  alias: string = 'f',
): { clauses: string[]; params: number[]; hasVehicle: boolean } => {
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
    clauses.push(
      `${alias}.KAROSSERIE_ID IN (${bodyIds.map(() => '?').join(', ')})`,
    );
    params.push(...bodyIds);
  }
  if (gearboxIds.length > 0) {
    clauses.push(
      `(${alias}.GETRIEBE_ID IN (${gearboxIds.map(() => '?').join(', ')}) OR ${alias}.GETRIEBE_ID = 0)`,
    );
    params.push(...gearboxIds);
  }

  return { clauses, params, hasVehicle: seriesId !== null };
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
import type { GroupNode } from './types.js';

export const filterVariants = (
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

    const specific = group.filter(
      (n) => n.variantWert > 0 && vehicleIds.includes(n.variantWert),
    );
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
 * Decode raw bytes from better-sqlite3 into a string.
 * RTF files are Windows-1252 / latin-1 encoded.
 * better-sqlite3 returns BLOBs as Buffers.
 */
export const decodeContent = (raw: Buffer | string): string => {
  if (Buffer.isBuffer(raw)) {
    return raw.toString('latin1');
  }
  return String(raw ?? '');
};
