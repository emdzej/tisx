export interface Series {
  id: number;
  code: string | null;
  name: string;
}

export interface Model {
  id: number;
  code: string | null;
  name: string;
  productionFrom: number | null;
  productionTo: number | null;
}

export interface Engine {
  id: number;
  name: string | null;
}

export interface DocType {
  id: number;
  code: string;
  name: string;
  mainGroupLabel: string | null;
  subGroupLabel: string | null;
  /** Navigation method: 2/3=TZUKN, 5=flat/vehicle, 6/7/9=tzuwegknoten */
  methode: number;
  /** ZUWEG_ID used for tzuwegknoten-based navigation (METHODE 6/7/9) */
  zugriff: number;
  /** Whether a vehicle selection is required (1 = required, e.g. ISB) */
  fzgRequ: number;
  /** Total length of the document code (0 = no structured codes, e.g. TD/AZD) */
  keyLength: number;
  /** Minimum meaningful prefix length for search (typically 2 = main group digits) */
  minLength: number;
  /** Fixed alphabetic prefix for codes of this type (e.g. "IB" for ISB), empty if purely numeric */
  codePrefix: string;
}

export interface GroupNode {
  id: number;
  code: string | null;
  name: string | null;
  parentId: number | null;
  /** Variant type: 3000=motor, 4000=body, 5000=transmission, 0=none */
  variantArt: number;
  /** Variant value (e.g. MOTOR_ID, KAROSSERIE_ID, GETRIEBE_ID). 0=generic */
  variantWert: number;
  /** Human-readable variant name from TBENENNUNG (e.g. "M54", "TOUR", "MECH") */
  variantName: string | null;
}

export interface DocumentListItem {
  id: number;
  code: string | null;
  docTypeId: number;
  title: string;
  publicationDate: number | null;
}

export interface DocumentFile {
  filename: string;
  deviceType: string | null;
  deviceCode: string | null;
  textPath: string;
  textUrl: string;
}

export interface DocumentDetail {
  id: number;
  code: string | null;
  docTypeId: number;
  title: string;
  publicationDate: number | null;
  security: number | null;
}

export interface DocumentResponse {
  document: DocumentDetail;
  files: DocumentFile[];
}

export interface SymptomNode {
  id: number;
  code: string | null;
  name: string | null;
  parentId: number;
  hasChildren: boolean;
}

export interface ErrorResponse {
  error: string;
}

/** Parameters for vehicle-scoped queries */
export interface VehicleFilter {
  seriesId: number | null;
  modelId: number | null;
  engineId: number | null;
  bodyIds: number[];
  gearboxIds: number[];
}

/** Result of vehicle variant resolution */
export interface VehicleVariants {
  bodyIds: number[];
  gearboxIds: number[];
  driveIds: number[];
  bodyNames: string[];
  gearboxNames: string[];
  driveNames: string[];
  modelYear: string | null;
}

/** VIN lookup result */
export interface VinResult {
  seriesId: number;
  seriesName: string | null;
  modelId: number;
  modelName: string | null;
  engineId: number;
  engineName: string | null;
  bodyId: number;
  bodyName: string | null;
  gearboxId: number;
  gearboxName: string | null;
  driveId: number;
  driveName: string | null;
  productionDate: number | null;
}

/** RTF text placeholder substitution map */
export interface TextPlaceholders {
  '--TYP--': string;
  '--FGSTNR--': string;
  '--MODELL--': string;
  '--MOTOR--': string;
  '--KAROSS--': string;
  [key: string]: string;
}

/** Related document with doc type info */
export interface RelatedDocument {
  id: number;
  code: string | null;
  docTypeId: number;
  title: string;
  publicationDate: number | null;
  docTypeCode: string;
  docTypeName: string;
}

/** Hotspot target document */
export interface HotspotTarget {
  id: number;
  code: string | null;
  docTypeId: number;
  title: string;
}

/** Hotspot map: hotspotNr → target documents */
export type HotspotMap = Record<number, HotspotTarget[]>;

/** Document lookup by code result */
export interface DocumentCodeResult {
  id: number;
  code: string;
  docTypeId: number;
  title: string;
}
