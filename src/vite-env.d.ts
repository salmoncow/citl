/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  /** Comma-separated sign-in providers: google,email (default: all). */
  readonly VITE_AUTH_PROVIDERS?: string;
  /** Spec 009 league requests: 'true' | 'false'; unset = on only with the emulators. */
  readonly VITE_LEAGUE_REQUESTS?: string;
  /** 'true' points the SDKs at the local emulator suite. */
  readonly VITE_USE_EMULATOR?: string;
  /** reCAPTCHA Enterprise site key for App Check. */
  readonly VITE_RECAPTCHA_ENTERPRISE_SITE_KEY?: string;
  /** App Check debug token; read only under the dev server (appcheck.ts). */
  readonly VITE_APP_CHECK_DEBUG_TOKEN?: string;
}
// Read env vars with dot access only: Vite replaces `import.meta.env.X`
// statically, but `import.meta.env['X']` inlines the whole env object,
// every VITE_* value included (scripts/check-app-check-debug.js).
interface ImportMeta { readonly env: ImportMetaEnv; }
