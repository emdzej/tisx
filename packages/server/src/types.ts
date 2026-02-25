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
  code: string | null;
}

export interface DocType {
  id: number;
  code: string;
  name: string;
  mainGroupLabel: string | null;
  subGroupLabel: string | null;
}

export interface GroupNode {
  id: number;
  code: string | null;
  name: string | null;
  parentId: number | null;
}

export interface DocumentListItem {
  id: number;
  code: string | null;
  dokartId: number;
  title: string;
  publicationDate: number | null;
}

export interface DocumentFile {
  filename: string;
  deviceType: string | null;
  deviceCode: string | null;
  graphicsPath: string;
  textPath: string;
  textUrl: string;
}

export interface DocumentDetail {
  id: number;
  code: string | null;
  dokartId: number;
  title: string;
  publicationDate: number | null;
  security: number | null;
}

export interface DocumentResponse {
  document: DocumentDetail;
  files: DocumentFile[];
}

export interface ErrorResponse {
  error: string;
}
