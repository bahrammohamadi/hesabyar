"use client";

import React, { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";
import type {
  DocumentType,
  EntityPanelType,
  OpenPanelOptions,
  PanelAction,
  PanelInstance,
  PanelManagerApi,
  PanelType,
} from "./types";

function createPanelId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `panel-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeStack(stack: Omit<PanelInstance, "stackIndex">[]): PanelInstance[] {
  return stack.map((panel, index) => ({ ...panel, stackIndex: index }));
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
    default:
      return state;
  }
}

const PanelManagerContext = createContext<PanelManagerApi | null>(null);

export function PanelManagerStoreProvider({ children }: { children: ReactNode }) {
  const [stack, dispatch] = useReducer(panelReducer, []);

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

      dispatch(opts?.replace ? { type: "REPLACE_TOP", panel } : { type: "PUSH", panel });
      return id;
    },
    []
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

  const closeTop = useCallback(() => dispatch({ type: "CLOSE_TOP" }), []);
  const closeAll = useCallback(() => dispatch({ type: "CLOSE_ALL" }), []);

  const replaceTop = useCallback((panel: Omit<PanelInstance, "id" | "stackIndex"> & { id?: string }) => {
    const id = panel.id ?? createPanelId();
    dispatch({ type: "REPLACE_TOP", panel: { ...panel, id } });
    return id;
  }, []);

  const value = useMemo<PanelManagerApi>(
    () => ({
      stack,
      topPanel: stack.at(-1) ?? null,
      openEntity,
      openDocument,
      openPanel,
      closeTop,
      closeAll,
      replaceTop,
    }),
    [stack, openEntity, openDocument, openPanel, closeTop, closeAll, replaceTop]
  );

  return React.createElement(PanelManagerContext.Provider, { value }, children);
}

export function usePanelManager() {
  const context = useContext(PanelManagerContext);
  if (!context) throw new Error("usePanelManager must be used inside PanelManagerProvider");
  return context;
}
