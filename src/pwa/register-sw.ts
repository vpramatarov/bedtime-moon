export interface RegisterServiceWorkerDeps {
  isProd: boolean;
  hasSupport: boolean;
  register: (url: string) => Promise<unknown>;
  /** Defaults to import.meta.env.BASE_URL; overridable for tests (TKT-0007). */
  basePath?: string;
}

/** Registers the service worker only in production, on a browser that supports it. Best-effort: a failed registration must never block the app. */
export function registerServiceWorker(deps: RegisterServiceWorkerDeps): void {
  if (!deps.isProd || !deps.hasSupport) return;
  const basePath = deps.basePath ?? import.meta.env.BASE_URL;
  deps.register(`${basePath}sw.js`).catch(() => {});
}
