// Database
export { openDatabase, safeDynamicTable } from './db.js';
export type { DatabaseType } from './db.js';

// Types
export type {
  Series,
  Model,
  Engine,
  DocType,
  GroupNode,
  DocumentListItem,
  DocumentFile,
  DocumentDetail,
  DocumentResponse,
  SymptomNode,
  ErrorResponse,
  VehicleFilter,
  VehicleVariants,
  VinResult,
  TextPlaceholders,
  RelatedDocument,
  HotspotTarget,
  HotspotMap,
  DocumentCodeResult,
} from './types.js';

// Utilities
export {
  parseId,
  padDocTypeId,
  parseIdList,
  buildVehicleFilter,
  filterVariants,
  decodeContent,
} from './utils.js';

// RTF processing
export {
  preprocessRtf,
  flattenNestedTables,
  postprocessHtml,
  rtfToHtml,
} from './rtf.js';

// Services — Vehicle
export {
  getSeries,
  getModels,
  getEngines,
  getVehicleVariants,
  parseVin,
  lookupVin,
} from './services/vehicle.js';

// Services — Documents
export {
  getDocType,
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
} from './services/documents.js';

// Services — Symptoms
export {
  getSymptomRoots,
  getSymptomNodes,
  getSymptomTree,
  getSymptomDocuments,
} from './services/symptoms.js';

// Services — Images
export { getImage } from './services/images.js';
export type { ImageResult } from './services/images.js';
