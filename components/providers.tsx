"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { PanelManagerProvider } from "@/src/core/panel-manager/PanelManagerProvider";
import { PickerHost } from "@/src/core/picker/PickerHost";
import { PickerProvider } from "@/src/core/picker/usePicker";
import { CoreRuntimeDevButton } from "@/src/core/panel-manager/CoreRuntimeDevButton";
import { ConfirmProvider, ToastProvider } from "@/src/shared/ui";

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
        <ToastProvider>
          <ConfirmProvider>
            <PanelManagerProvider>
              <PickerProvider>
                {children}
                <PickerHost />
                <CoreRuntimeDevButton />
              </PickerProvider>
            </PanelManagerProvider>
          </ConfirmProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
