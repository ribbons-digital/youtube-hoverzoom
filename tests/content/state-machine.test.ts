import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHoverStateMachine } from "../../src/content/state-machine";

describe("hover state machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  const createMachine = (overrides: { hoverDelayMs?: number; closeDelayMs?: number; canOpen?: () => boolean } = {}) => {
    const events: string[] = [];
    const machine = createHoverStateMachine({
      hoverDelayMs: overrides.hoverDelayMs ?? 250,
      closeDelayMs: overrides.closeDelayMs ?? 150,
      onOpen: (cardId) => {
        events.push(`open:${cardId}`);
        return overrides.canOpen?.() ?? true;
      },
      onClose: () => {
        events.push("close");
      }
    });
    return { machine, events };
  };

  it("opens only after the hover delay", () => {
    const { machine, events } = createMachine();

    machine.pointerEntered("card-a");
    vi.advanceTimersByTime(249);
    expect(events).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(events).toEqual(["open:card-a"]);
    expect(machine.getSnapshot().mode).toBe("open");
  });

  it("keeps the hover delay when the pointer moves between parts of the same card", () => {
    const { machine, events } = createMachine();

    machine.pointerEntered("card-a");
    vi.advanceTimersByTime(200);
    machine.pointerEntered("card-a");
    vi.advanceTimersByTime(50);

    expect(events).toEqual(["open:card-a"]);
  });

  it("cancels close without reopening when the pointer re-enters during grace time", () => {
    const { machine, events } = createMachine({ hoverDelayMs: 0 });

    machine.pointerEntered("card-a");
    vi.advanceTimersByTime(0);
    machine.pointerLeft();
    vi.advanceTimersByTime(100);
    machine.pointerEntered("card-a");
    vi.advanceTimersByTime(500);

    expect(events).toEqual(["open:card-a"]);
    expect(machine.getSnapshot().mode).toBe("open");
  });

  it("closes the old overlay when a hover on another card is abandoned", () => {
    const { machine, events } = createMachine();

    machine.pointerEntered("card-a");
    vi.advanceTimersByTime(250);
    machine.pointerLeft();
    machine.pointerEntered("card-b");
    machine.pointerLeft();
    vi.advanceTimersByTime(150);

    expect(events).toEqual(["open:card-a", "close"]);
    expect(machine.getSnapshot().mode).toBe("idle");
  });

  it("switches cards: closes the old overlay, then opens the new one", () => {
    const { machine, events } = createMachine();

    machine.pointerEntered("card-a");
    vi.advanceTimersByTime(250);
    machine.pointerEntered("card-b");
    vi.advanceTimersByTime(250);

    expect(events).toEqual(["open:card-a", "close", "open:card-b"]);
    expect(machine.getSnapshot()).toMatchObject({ mode: "open", currentCardId: "card-b" });
  });

  it("returns to idle when the card cannot be opened, so the next card still opens", () => {
    let canOpen = false;
    const { machine, events } = createMachine({ canOpen: () => canOpen });

    machine.pointerEntered("card-a");
    vi.advanceTimersByTime(250);
    expect(machine.getSnapshot().mode).toBe("idle");

    canOpen = true;
    machine.pointerEntered("card-b");
    vi.advanceTimersByTime(250);

    expect(events).toEqual(["open:card-a", "open:card-b"]);
    expect(machine.getSnapshot().mode).toBe("open");
  });

  it("uses new delays after setDelays", () => {
    const { machine, events } = createMachine();

    machine.setDelays({ hoverDelayMs: 1000, closeDelayMs: 150 });
    machine.pointerEntered("card-a");
    vi.advanceTimersByTime(999);
    expect(events).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(events).toEqual(["open:card-a"]);
  });
});
