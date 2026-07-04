"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import type {
  DocumentType,
  EntityPanelType,
  OpenPanelOptions,
  PanelAction,
  PanelInstance,
  PanelManagerApi,
  PanelMode,
  PanelResult,
  PanelType,
} from "./types";

const PANELS_PARAM = "panels";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createPanelId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `panel-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeStack(stack: Omit<PanelInstance, "stackIndex">[]): PanelInstance[] {
  return stack.map((panel, index) => ({ ...panel, stackIndex: index }));
}

function stripStack(stack: PanelInstance[]): Omit<PanelInstance, "stackIndex">[] {
  return stack.map(({ stackIndex: _stackIndex, ...panel }) => panel);
}

function isPanelMode(value: string): value is PanelMode {
  return value === "view" || value === "edit" || value === "create";
}

function isDocumentType(value: string): value is DocumentType {
  return value === "sale" || value === "purchase";
}

function isSerializableId(id?: string) {
  return !id || id === "new" || UUID_RE.test(id);
}

function encodePanel(panel: PanelInstance) {
  const mode = panel.mode;
  const id = panel.entityId ?? "new";
  if (!isSerializableId(id)) return null;
  if (panel.type === "contact" || panel.type === "product" || panel.type === "payment") {
    return [panel.type, mode, id].map(encodeURIComponent).join(":");
  }
  if (panel.type === "invoice") {
    return ["invoice", panel.docType ?? "sale", mode, id].map(encodeURIComponent).join(":");
  }
  return null;
}

function serializePanels(stack: PanelInstance[]) {
  return stack.map(encodePanel).filter((value): value is string => !!value).join(",");
}

function panelFromSegment(segment: string): Omit<PanelInstance, "stackIndex"> | null {
  const parts = segment.split(":").map((part) => decodeURIComponent(part));
  const type = parts[0];
  if (type === "contact" || type === "product" || type === "payment") {
    const mode = parts[1];
    const id = parts[2];
    if (!isPanelMode(mode) || !isSerializableId(id)) return null;
    return { id: createPanelId(), type, mode, entityId: id === "new" ? undefined : id, context: "workspace" };
  }
  if (type === "invoice") {
    const docType = parts[1];
    const mode = parts[2];
    const id = parts[3];
    if (!isDocumentType(docType) || !isPanelMode(mode) || !isSerializableId(id)) return null;
    return { id: createPanelId(), type: "invoice", docType, mode, entityId: id === "new" ? undefined : id, context: "workspace" };
  }
  return null;
}

function parsePanelsFromUrl(): PanelInstance[] {
  if (typeof window === "undefined") return [];
  const params = new URLSearchParams(window.location.search);
  const raw = params.get(PANELS_PARAM);
  if (!raw) return [];
  const panels = raw.split(",").map(panelFromSegment).filter((panel): panel is Omit<PanelInstance, "stackIndex"> => !!panel);
  const normalized = normalizeStack(panels);
  if (serializePanels(normalized) !== raw) syncUrl(normalized, "replace");
  return normalized;
}

function syncUrl(stack: PanelInstance[], mode: "push" | "replace") {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const serialized = serializePanels(stack);
  if (serialized) url.searchParams.set(PANELS_PARAM, serialized);
  else url.searchParams.delete(PANELS_PARAM);
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return;
  if (mode === "push") window.history.pushState({ panels: serialized }, "", next);
  else window.history.replaceState({ panels: serialized }, "", next);
}

function panelReducer(state: PanelInstance[], action: PanelAction): PanelInstance[] {
  switch (action.type) {
    case "PUSH":
      return normalizeStack([...state, action.panel]);
    case "REPLACE_TOP": {
      if (state.length === 0) return normalizeStack([action.panel]);
      return normalizeStack([...state.slice(0, -1), action.panel]);
    }
    case "CLOSE_TOP":
      return normalizeStack(state.slice(0, -1));
    case "CLOSE_ALL":
      return [];
    case "SET_STACK":
      return normalizeStack(stripStack(action.stack));
    default:
      return state;
  }
}

const PanelManagerContext = createContext<PanelManagerApi | null>(null);

export function PanelManagerStoreProvider({ children }: { children: ReactNode }) {
  const [stack, dispatch] = useReducer(panelReducer, undefined, parsePanelsFromUrl);
  const resultResolvers = useRef(new Map<string, (result: PanelResult | null) => void>());

  useEffect(() => {
    function handlePopState() {
      dispatch({ type: "SET_STACK", stack: parsePanelsFromUrl() });
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const setStack = useCallback((nextStack: PanelInstance[], urlMode: "push" | "replace") => {
    const normalized = normalizeStack(stripStack(nextStack));
    syncUrl(normalized, urlMode);
    dispatch({ type: "SET_STACK", stack: normalized });
  }, []);

  const openPanel = useCallback(
    (type: PanelType, opts?: OpenPanelOptions & { entityId?: string; docType?: DocumentType }) => {
      const id = createPanelId();
      const panel = {
        id,
        type,
        entityId: opts?.entityId,
        docType: opts?.docType,
        mode: opts?.mode ?? (opts?.entityId ? "view" : "create"),
        context: opts?.context,
        title: opts?.title,
        props: opts?.props,
      } satisfies Omit<PanelInstance, "stackIndex">;

      const next = opts?.replace
        ? normalizeStack([...(stack.length ? stripStack(stack.slice(0, -1)) : []), panel])
        : normalizeStack([...stripStack(stack), panel]);
      setStack(next, opts?.replace ? "replace" : "push");
      return id;
    },
    [setStack, stack]
  );

  const openEntity = useCallback(
    (type: EntityPanelType, id?: string, opts?: OpenPanelOptions) =>
      openPanel(type, { ...opts, entityId: id, mode: opts?.mode ?? (id ? "view" : "create") }),
    [openPanel]
  );

  const openDocument = useCallback(
    (docType: DocumentType, id?: string, opts?: OpenPanelOptions) =>
      openPanel("invoice", {
        ...opts,
        docType,
        entityId: id,
        mode: opts?.mode ?? (id ? "view" : "create"),
      }),
    [openPanel]
  );

  const closeTop = useCallback(() => {
    const top = stack.at(-1);
    const requestId = typeof top?.props?.resultRequestId === "string" ? top.props.resultRequestId : null;
    if (requestId && resultResolvers.current.has(requestId)) {
      resultResolvers.current.get(requestId)?.(null);
      resultResolvers.current.delete(requestId);
    }
    setStack(stack.slice(0, -1), "replace");
  }, [setStack, stack]);

  const closeAll = useCallback(() => {
    for (const [, resolve] of resultResolvers.current) resolve(null);
    resultResolvers.current.clear();
    setStack([], "replace");
  }, [setStack]);

  const replaceTop = useCallback((panel: Omit<PanelInstance, "id" | "stackIndex"> & { id?: string }) => {
    const id = panel.id ?? createPanelId();
    const nextPanel = { ...panel, id } satisfies Omit<PanelInstance, "stackIndex">;
    const next = normalizeStack([...(stack.length ? stripStack(stack.slice(0, -1)) : []), nextPanel]);
    setStack(next, "replace");
    return id;
  }, [setStack, stack]);

  const openEntityForResult = useCallback((type: EntityPanelType, opts?: OpenPanelOptions) => {
    const requestId = createPanelId();
    return new Promise<PanelResult | null>((resolve) => {
      resultResolvers.current.set(requestId, resolve);
      openPanel(type, {
        ...opts,
        entityId: undefined,
        mode: opts?.mode ?? "create",
        props: { ...(opts?.props ?? {}), resultRequestId: requestId },
      });
    });
  }, [openPanel]);

  const resolveTop = useCallback((result: PanelResult) => {
    const top = stack.at(-1);
    const requestId = typeof top?.props?.resultRequestId === "string" ? top.props.resultRequestId : null;
    if (requestId && resultResolvers.current.has(requestId)) {
      resultResolvers.current.get(requestId)?.(result);
      resultResolvers.current.delete(requestId);
    }
    setStack(stack.slice(0, -1), "replace");
  }, [setStack, stack]);

  const value = useMemo<PanelManagerApi>(
    () => ({
      stack,
      topPanel: stack.at(-1) ?? null,
      openEntity,
      openEntityForResult,
      resolveTop,
      openDocument,
      openPanel,
      closeTop,
      closeAll,
      replaceTop,
    }),
    [stack, openEntity, openEntityForResult, resolveTop, openDocument, openPanel, closeTop, closeAll, replaceTop]
  );

  return React.createElement(PanelManagerContext.Provider, { value }, children);
}

export function usePanelManager() {
  const context = useContext(PanelManagerContext);
  if (!context) throw new Error("usePanelManager must be used inside PanelManagerProvider");
  return context;
}
