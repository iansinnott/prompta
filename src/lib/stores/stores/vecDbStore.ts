import type { VecDB } from "$lib/vecDb";
import { writable } from "svelte/store";

export const vecDbStore = (() => {
  const store = writable({
    loading: false,
    progress: 0,
    total: 0,
    error: null,
    vecDb: null,
  });

  let vecDb: VecDB | null = null;

  const handleIngestStart = (e: CustomEvent<{ remaining: number }>) => {
    store.update((x) => ({ ...x, loading: true, progress: 0, total: e.detail.remaining }));
  };

  const handleProgress = (e: CustomEvent<{ remaining: number }>) => {
    store.update((x) => ({ ...x, progress: x.total - e.detail.remaining }));
  };

  const handleIngestEnd = () => {
    store.update((x) => ({ ...x, loading: false, progress: 0, total: 0 }));
  };

  return {
    subscribe: store.subscribe,

    ingest() {
      if (vecDb) {
        vecDb.ingestFragments();
      }
    },

    init(x: VecDB) {
      if (vecDb) {
        console.warn("VecDB already initialized");
        return;
      }

      // @ts-ignore
      x.events.addEventListener("ingest-start", handleIngestStart);
      // @ts-ignore
      x.events.addEventListener("ingest-progress", handleProgress);
      x.events.addEventListener("ingest-end", handleIngestEnd);

      vecDb = x;
    },

    dispose() {
      if (vecDb) {
        // @ts-ignore
        vecDb.events.removeEventListener("ingest-start", handleIngestStart);
        // @ts-ignore
        vecDb.events.removeEventListener("ingest-progress", handleProgress);
        vecDb.events.removeEventListener("ingest-end", handleIngestEnd);
      }
    },
  };
})();
