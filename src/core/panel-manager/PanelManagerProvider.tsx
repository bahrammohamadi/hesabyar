"use client";

import type { ReactNode } from "react";
import { PanelManagerStoreProvider } from "./panel-manager.store";
import { PanelHost } from "./PanelHost";

export function PanelManagerProvider({ children }: { children: ReactNode }) {
  return (
    <PanelManagerStoreProvider>
      {children}
      <PanelHost />
    </PanelManagerStoreProvider>
  );
}
