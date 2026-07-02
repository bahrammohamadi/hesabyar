"use client";

import React, { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";
import type { GlobalSearchResult } from "@/src/core/services/search-service";
import type { PickerAction, PickerApi, PickerOptions, PickerRequest, PickerType } from "./types";

function createPickerId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `picker-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function reducer(state: PickerRequest | null, action: PickerAction): PickerRequest | null {
  if (action.type === "OPEN") return action.request;
  if (action.type === "CLOSE") return null;
  return state;
}

const PickerContext = createContext<PickerApi | null>(null);

export function PickerProvider({ children }: { children: ReactNode }) {
  const [activePicker, dispatch] = useReducer(reducer, null);

  const openPicker = useCallback((type: PickerType, onSelect: (item: GlobalSearchResult) => void, options?: PickerOptions) => {
    const id = createPickerId();
    dispatch({ type: "OPEN", request: { id, type, onSelect, options } });
    return id;
  }, []);

  const closePicker = useCallback(() => dispatch({ type: "CLOSE" }), []);

  const value = useMemo<PickerApi>(() => ({ activePicker, openPicker, closePicker }), [activePicker, openPicker, closePicker]);

  return React.createElement(PickerContext.Provider, { value }, children);
}

export function usePicker() {
  const context = useContext(PickerContext);
  if (!context) throw new Error("usePicker must be used inside PickerProvider");
  return context;
}
