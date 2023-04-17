export type KeyPredicate = (event: KeyboardEvent) => boolean;

export function createShortcutPredicate(shortcut: string): KeyPredicate {
  const shortcutParts = shortcut.split("+");
  const requestedCmd = shortcutParts.includes("cmd");
  if (requestedCmd) {
    console.warn("The 'cmd' shortcut modifier is deprecated. Please use 'meta' instead.");
  }

  const requestedOpt = shortcutParts.includes("option");
  if (requestedOpt) {
    console.warn("The 'option' shortcut modifier is deprecated. Please use 'alt' instead.");
  }

  const requiredCtrl = shortcutParts.includes("ctrl");
  const requiredShift = shortcutParts.includes("shift");
  const requiredMeta = shortcutParts.includes("meta") || requestedCmd;
  const requiredAlt = shortcutParts.includes("alt") || requestedOpt;
  const requiredKey = shortcutParts.find(
    (part) => !["ctrl", "shift", "meta", "alt", "cmd", "option"].includes(part)
  );

  return (event: KeyboardEvent): boolean => {
    return (
      event.ctrlKey === requiredCtrl &&
      event.shiftKey === requiredShift &&
      event.metaKey === requiredMeta &&
      event.altKey === requiredAlt &&
      event.key.toLowerCase() === requiredKey?.toLowerCase()
    );
  };
}

export function getShortcutFromEvent(event: KeyboardEvent): string {
  const modifierKeys = ["ctrl", "shift", "meta", "alt"];
  const pressedModifiers = modifierKeys
    .filter((modifier) => event[`${modifier}Key` as "ctrlKey" | "shiftKey" | "metaKey" | "altKey"])
    .join("+");

  return pressedModifiers
    ? `${pressedModifiers}+${event.key.toLowerCase()}`
    : event.key.toLowerCase();
}

export function mapKeysToMacSymbols(shortcut: string) {
  const keyMap: Record<string, string> = {
    ctrl: "⌃",
    alt: "⌥",
    shift: "⇧",
    cmd: "⌘",
    meta: "⌘",
    // "enter": "⌅",
    return: "↩",
    enter: "↩",
  };

  return shortcut
    .toLowerCase()
    .split("+")
    .map((key) => keyMap[key.trim()] ?? key.trim().toUpperCase());
}
