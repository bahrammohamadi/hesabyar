import { describe, expect, it } from "vitest";
import { dedupeConsecutivePanelStack, dedupePanelStackByIdentity, getNextPanelStack, isSamePanelIdentity, serializePanels } from "../src/core/panel-manager/panel-manager.store";
import type { PanelInstance } from "../src/core/panel-manager/types";

function panel(id: string, type: PanelInstance["type"], mode: PanelInstance["mode"], entityId?: string): PanelInstance {
  return { id, type, mode, entityId, stackIndex: 0 };
}

describe("panel manager duplicate protection", () => {
  it("does not grow the stack when the same entity panel is opened repeatedly", () => {
    let stack: PanelInstance[] = [];
    const requested = { id: "p1", type: "contact" as const, mode: "create" as const, entityId: undefined };

    const first = getNextPanelStack(stack, requested, false);
    stack = first.stack;
    const second = getNextPanelStack(stack, { ...requested, id: "p2" }, false);
    stack = second.stack;
    const third = getNextPanelStack(stack, { ...requested, id: "p3" }, false);
    stack = third.stack;

    expect(first.didPush).toBe(true);
    expect(second.didPush).toBe(false);
    expect(third.didPush).toBe(false);
    expect(third.didChange).toBe(false);
    expect(stack).toHaveLength(1);
    expect(stack[0].id).toBe("p1");
  });

  it("dedupes consecutive duplicate URL panels", () => {
    const input = [panel("a", "contact", "create"), panel("b", "contact", "create"), panel("c", "product", "create"), panel("d", "product", "create")];
    const deduped = dedupeConsecutivePanelStack(input);
    expect(deduped.map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("dedupes duplicate URL panels even when they are not adjacent", () => {
    const input = [panel("a", "contact", "create"), panel("b", "product", "create"), panel("c", "contact", "create")];
    const deduped = dedupePanelStackByIdentity(input);
    expect(deduped.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("keeps create-for-result panels separate from normal create panels", () => {
    const normal = { ...panel("a", "contact", "create"), props: {} };
    const forResult = { ...panel("b", "contact", "create"), props: { resultRequestId: "r1" } };
    expect(isSamePanelIdentity(normal, forResult)).toBe(false);
  });

  it("compares only panel identity fields", () => {
    expect(isSamePanelIdentity(panel("a", "invoice", "view", "11111111-1111-1111-1111-111111111111"), panel("b", "invoice", "view", "11111111-1111-1111-1111-111111111111"))).toBe(true);
  });

  it("serializes a single create panel once", () => {
    const stack = [panel("a", "contact", "create")];
    expect(serializePanels(stack)).toBe("contact:create:new");
  });
});
