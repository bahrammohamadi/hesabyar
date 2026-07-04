export type EntityPanelType = "contact" | "product";
export type DocumentPanelType = "invoice";
export type UtilityPanelType = "payment";
export type PanelType = EntityPanelType | DocumentPanelType | UtilityPanelType;

export type DocumentType = "sale" | "purchase";
export type PanelMode = "view" | "edit" | "create";

export type PanelContext =
  | "dashboard"
  | "workspace"
  | "entity-link"
  | "picker"
  | "invoice"
  | "global-search"
  | "dev-poc";

export interface PanelInstance {
  id: string;
  type: PanelType;
  entityId?: string;
  docType?: DocumentType;
  mode: PanelMode;
  stackIndex: number;
  context?: PanelContext;
  title?: string;
  props?: Record<string, unknown>;
}

export interface OpenPanelOptions {
  mode?: PanelMode;
  context?: PanelContext;
  title?: string;
  props?: Record<string, unknown>;
  replace?: boolean;
}

export interface PanelResult {
  id: string;
  type?: PanelType;
  title?: string;
  data?: unknown;
}

export type PanelAction =
  | { type: "PUSH"; panel: Omit<PanelInstance, "stackIndex"> }
  | { type: "REPLACE_TOP"; panel: Omit<PanelInstance, "stackIndex"> }
  | { type: "CLOSE_TOP" }
  | { type: "CLOSE_ALL" }
  | { type: "SET_STACK"; stack: PanelInstance[] };

export interface PanelManagerApi {
  stack: PanelInstance[];
  topPanel: PanelInstance | null;
  openEntity: (type: EntityPanelType, id?: string, opts?: OpenPanelOptions) => string;
  openEntityForResult: (type: EntityPanelType, opts?: OpenPanelOptions) => Promise<PanelResult | null>;
  resolveTop: (result: PanelResult) => void;
  openDocument: (docType: DocumentType, id?: string, opts?: OpenPanelOptions) => string;
  openPanel: (type: PanelType, opts?: OpenPanelOptions & { entityId?: string; docType?: DocumentType }) => string;
  closeTop: () => void;
  closeAll: () => void;
  replaceTop: (panel: Omit<PanelInstance, "id" | "stackIndex"> & { id?: string }) => string;
}
