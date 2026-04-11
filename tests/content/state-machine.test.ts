import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHoverStateMachine } from "../../src/content/state-machine";

describe("hover state machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("opens only after the hover delay", () => {
    const events: string[] = [];
    const machine = createHoverStateMachine({
      hoverDelayMs: 250,
      closeDelayMs: 150,
      onOpen: () => events.push("open"),
      onClose: () => events.push("close")
    });

    machine.pointerEntered("card-a");
    vi.advanceTimersByTime(249);
    expect(events).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(events).toEqual(["open"]);
    expect(machine.getSnapshot().mode).toBe("open");
  });

  it("cancels close when pointer re-enters during grace time", () => {
    const events: string[] = [];
    const machine = createHoverStateMachine({
      hoverDelayMs: 0,
      closeDelayMs: 150,
      onOpen: () => events.push("open"),
      onClose: () => events.push("close")
    });

    machine.pointerEntered("card-a");
    machine.pointerLeft();
    vi.advanceTimersByTime(100);
    machine.pointerEntered("card-a");
    vi.advanceTimersByTime(100);

    expect(events).toEqual(["open"]);
    expect(machine.getSnapshot().mode).toBe("open");
  });
});
