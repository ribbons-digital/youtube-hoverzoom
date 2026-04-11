Object.defineProperty(window, "scrollX", { value: 0, writable: true });
Object.defineProperty(window, "scrollY", { value: 0, writable: true });

if (!("PointerEvent" in window)) {
  // JSDOM does not expose PointerEvent by default.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).PointerEvent = MouseEvent;
}

const cryptoValue = globalThis.crypto as (Crypto & { randomUUID?: () => string }) | undefined;
if (!cryptoValue || typeof cryptoValue.randomUUID !== "function") {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      ...(cryptoValue ?? {}),
      randomUUID: () => "00000000-0000-4000-8000-000000000000"
    }
  });
}
