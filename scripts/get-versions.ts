import * as fs from "fs";

// Read pnpm-lock.yaml
const lockFile = fs.readFileSync("./pnpm-lock.yaml", "utf8");

// Extract Tauri version
const tauriMatch = lockFile.match(/@tauri-apps\/api@\^?(\d+\.\d+\.\d+)/);
const tauriVersion = tauriMatch ? tauriMatch[1] : "unknown";

// Extract Svelte version
const svelteMatch = lockFile.match(/svelte@\^?(\d+\.\d+\.\d+)/);
const svelteVersion = svelteMatch ? svelteMatch[1] : "unknown";

console.log(`PUBLIC_TAURI_VERSION=${tauriVersion}`);
console.log(`PUBLIC_SVELTE_VERSION=${svelteVersion}`);
