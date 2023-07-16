/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

const sw = /** @type {ServiceWorkerGlobalScope} */ /** @type {unknown} */ self;
import { build, files, version } from "$service-worker";

// Create a unique cache name for this deployment
const CACHE = `cache-${version}`;

const ASSETS = [
  ...build, // the app itself
  ...files, // everything in `static`
];

sw.addEventListener("install", (event) => {
  console.debug("%cservice-worker/install", "color:salmon;");
  // Create a new cache and add all files to it
  async function addFilesToCache() {
    const cache = await caches.open(CACHE);
    try {
      await cache.addAll(ASSETS);
    } catch (err) {
      console.warn("Failed to add assets to cache:", err);
    }
  }

  // @ts-ignore Types are wrong
  event.waitUntil(addFilesToCache());
});

sw.addEventListener("activate", (event) => {
  console.log("%cservice-worker/activate", "color:salmon;");
  // Remove previous cached data from disk
  async function deleteOldCaches() {
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key);
    }
  }

  // @ts-ignore Types are wrong
  event.waitUntil(deleteOldCaches());
});

sw.addEventListener("fetch", (event) => {
  // ignore POST requests etc
  // @ts-ignore Types are wrong
  if (event.request.method !== "GET") return;

  async function respond() {
    // @ts-ignore Types are wrong
    const { request } = event;
    const url = new URL(request.url);
    const cache = await caches.open(CACHE);

    // Try the network first, but fall back to the cache if we're offline
    try {
      const response = await fetch(request);

      if (response.status === 200) {
        cache.put(request, response.clone());
      }

      return response;
    } catch {
      return cache.match(request);
    }
  }

  // @ts-ignore Types are wrong
  event.respondWith(respond());
});
