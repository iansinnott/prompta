import { spawnSync } from "child_process";

// Run `bun pm ls` and capture output
const result = spawnSync("bun", ["pm", "ls"], {
  encoding: "utf-8",
});

if (result.error || result.status !== 0) {
  console.error("Failed to get package versions");
  process.exit(1);
}

// Parse the text output using regex
const lines = result.stdout.split("\n");

// Find package versions using regex
const findVersion = (packageName: string): string => {
  const line = lines.find((l) => l.includes(" " + packageName + "@"));
  console.log(line);
  const match = line?.match(new RegExp(`${packageName}@(\\d+\\.\\d+\\.\\d+)`));
  return match?.[1] || "unknown";
};

const tauriVersion = findVersion("@tauri-apps/api");
const svelteVersion = findVersion("svelte");

console.log(`PUBLIC_TAURI_VERSION=${tauriVersion}`);
console.log(`PUBLIC_SVELTE_VERSION=${svelteVersion}`);
