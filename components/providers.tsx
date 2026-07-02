"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { PanelManagerProvider } from "@/src/core/panel-manager/PanelManagerProvider";
import { PickerHost } from "@/src/core/picker/PickerHost";
import { PickerProvider } from "@/src/core/picker/usePicker";
import { CoreRuntimeDevButton } from "@/src/core/panel-manager/CoreRuntimeDevButton";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <PanelManagerProvider>
          <PickerProvider>
            {children}
            <PickerHost />
            <CoreRuntimeDevButton />
          </PickerProvider>
        </PanelManagerProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
