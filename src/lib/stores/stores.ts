import type { Configuration } from "openai";
import { writable } from "svelte/store";
import type { SQLite3, DB } from "@vlcn.io/crsqlite-wasm";

export const openAiConfig = writable<Partial<Configuration>>({
  apiKey: "",
});

export const sqlite = writable<SQLite3 | null>(null);
export const db = writable<DB | null>(null);
