/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SKIN_AI_ENDPOINT?: string;
  readonly VITE_WEATHER_API_KEY?: string;
  readonly VITE_BARCODE_API_URL?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv; }
