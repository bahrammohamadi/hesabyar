import type { GlobalSearchResult, GlobalSearchResultType } from "@/src/core/services/search-service";

export type PickerType = GlobalSearchResultType | "all";

export interface PickerOptions {
  title?: string;
  placeholder?: string;
  limit?: number;
  initialQuery?: string;
}

export interface PickerRequest {
  id: string;
  type: PickerType;
  onSelect: (item: GlobalSearchResult) => void;
  options?: PickerOptions;
}

export type PickerAction =
  | { type: "OPEN"; request: PickerRequest }
  | { type: "CLOSE" };

export interface PickerApi {
  activePicker: PickerRequest | null;
  openPicker: (type: PickerType, onSelect: (item: GlobalSearchResult) => void, options?: PickerOptions) => string;
  closePicker: () => void;
}
