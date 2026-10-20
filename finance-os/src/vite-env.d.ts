/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_STORAGE_MODE?: string;
  readonly VITE_ALLOW_SIGNUP?: string;
  readonly VITE_USERNAME_DOMAIN?: string;
  readonly VITE_IDLE_MINUTES?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }
interface Document { startViewTransition?: (cb: () => void) => { ready: Promise<void> } }
declare module "react" { interface CSSProperties { [key: `--${string}`]: string | number | undefined } }
export {};
