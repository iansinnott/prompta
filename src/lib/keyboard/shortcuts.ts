export type KeyPredicate = (event: KeyboardEvent) => boolean;

export function createShortcutPredicate(shortcut: string): KeyPredicate {
  const shortcutParts = shortcut.split("+");
  const requiredCtrl = shortcutParts.includes("ctrl");
  const requiredShift = shortcutParts.includes("shift");
  const requiredMeta = shortcutParts.includes("meta");
  const requiredAlt = shortcutParts.includes("alt");
  const requiredKey = shortcutParts.find(
    (part) => !["ctrl", "shift", "meta", "alt"].includes(part)
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
