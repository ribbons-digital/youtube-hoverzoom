export function debugLog(enabled: boolean, ...args: unknown[]) {
  if (!enabled) return;
  console.debug("[yhp]", ...args);
}
