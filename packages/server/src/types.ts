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
