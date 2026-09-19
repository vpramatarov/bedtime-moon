/**
 * Thin glue: wires sw-logic.ts's pure handlers to the real service worker globals. Mirrors
 * main.ts's role at the platform boundary -- kept deliberately small and not unit-tested
 * directly (service-worker globals don't exist in jsdom); every branch of behavior lives in
 * sw-logic.ts, which is.
 *
 * Local minimal event/scope shapes below stand in for the "webworker" lib types, which can't be
 * added to this project's single tsconfig without conflicting with the "DOM" lib it also needs
 * for src/main.ts and friends.
 */
import { createActivateHandler, createFetchResponder, createInstallHandler } from './sw-logic';
import manifest from 'virtual:precache-manifest';

interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

interface FetchEvent extends Event {
  readonly request: Request;
  respondWith(response: Promise<Response> | Response): void;
}

interface ServiceWorkerScope {
  addEventListener(type: 'install' | 'activate', listener: (event: ExtendableEvent) => void): void;
  addEventListener(type: 'fetch', listener: (event: FetchEvent) => void): void;
  skipWaiting(): Promise<void>;
  readonly clients: { claim(): Promise<void> };
}

const sw = self as unknown as ServiceWorkerScope;

const install = createInstallHandler(manifest, caches);
const activate = createActivateHandler(manifest, caches);
const respond = createFetchResponder(manifest, caches, fetch);

sw.addEventListener('install', (event) => {
  event.waitUntil(install().then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(activate().then(() => sw.clients.claim()));
});

sw.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(respond(event.request));
});
