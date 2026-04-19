import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShoppingContext } from "../ShoppingContext";
import { ItemRow } from "../components/ItemRow";
import { makeVM, MOCK_ITEM } from "../../../test/mockVM";
import type { ShoppingItem } from "../types";

vi.mock("web-haptics/react", () => ({
  useWebHaptics: () => ({ trigger: vi.fn(), cancel: vi.fn(), isSupported: false }),
}));

function renderWithVM(item: ShoppingItem, vmOverrides = {}) {
  const vm = makeVM(vmOverrides);
  const result = render(
    <ShoppingContext.Provider value={vm}>
      <ItemRow item={item} />
    </ShoppingContext.Provider>,
  );
  return { vm, ...result };
}

beforeEach(() => {
  // framer-motion needs requestAnimationFrame
  globalThis.requestAnimationFrame = (cb) => {
    cb(0);
    return 0;
  };
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Rendering ────────────────────────────────────────────────────────────────

describe("ItemRow – rendering", () => {
  it("renders item text", () => {
    renderWithVM(MOCK_ITEM);
    expect(screen.getByText("Milk")).toBeInTheDocument();
  });

  it("renders checkbox as unchecked for unchecked item", () => {
    renderWithVM(MOCK_ITEM);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-checked", "false");
  });

  it("renders checkbox as checked for checked item", () => {
    renderWithVM({ ...MOCK_ITEM, checked: true });
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-checked", "true");
  });

  it("renders a delete button", () => {
    renderWithVM(MOCK_ITEM);
    expect(screen.getByLabelText("Delete item")).toBeInTheDocument();
  });

  it("syncs displayed text when item.text prop changes while not editing", () => {
    const vm = makeVM();
    const { rerender } = render(
      <ShoppingContext.Provider value={vm}>
        <ItemRow item={MOCK_ITEM} />
      </ShoppingContext.Provider>,
    );
    rerender(
      <ShoppingContext.Provider value={vm}>
        <ItemRow item={{ ...MOCK_ITEM, text: "Skimmed Milk" }} />
      </ShoppingContext.Provider>,
    );
    expect(screen.getByText("Skimmed Milk")).toBeInTheDocument();
  });
});

// ─── Toggle ───────────────────────────────────────────────────────────────────

describe("ItemRow – toggle", () => {
  it("calls onToggleItem when checkbox button is clicked", () => {
    const { vm } = renderWithVM(MOCK_ITEM);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(vm.onToggleItem).toHaveBeenCalledWith(MOCK_ITEM);
  });

  it("does NOT call onToggleItem when checking a checked item (no-op guard)", () => {
    const checkedItem = { ...MOCK_ITEM, checked: true };
    const { vm } = renderWithVM(checkedItem);
    fireEvent.click(screen.getByRole("checkbox"));
    // onToggleItem is still called, but no ripple animation is started
    expect(vm.onToggleItem).toHaveBeenCalledWith(checkedItem);
  });

  it("clears ripple state after 650 ms when unchecked item is toggled", () => {
    vi.useFakeTimers();
    const { vm } = renderWithVM(MOCK_ITEM);
    act(() => {
      fireEvent.click(screen.getByRole("checkbox"));
    });
    expect(vm.onToggleItem).toHaveBeenCalledOnce();
    // Advance past the 650 ms ripple timeout — should not throw
    act(() => {
      vi.advanceTimersByTime(700);
    });
    // Component should still be mounted and showing the item
    expect(screen.getByText("Milk")).toBeInTheDocument();
  });
});

// ─── Delete ───────────────────────────────────────────────────────────────────

describe("ItemRow – delete", () => {
  it("calls onRemoveItem with the item id when delete button is clicked", () => {
    const { vm } = renderWithVM(MOCK_ITEM);
    fireEvent.click(screen.getByLabelText("Delete item"));
    expect(vm.onRemoveItem).toHaveBeenCalledWith(MOCK_ITEM.id);
  });
});

// ─── Inline edit ──────────────────────────────────────────────────────────────

describe("ItemRow – inline edit", () => {
  it("enters edit mode when item text is clicked for unchecked item", async () => {
    const user = userEvent.setup();
    renderWithVM(MOCK_ITEM);

    // The text button wraps the item text – click anywhere on it
    await user.click(screen.getByText("Milk"));

    expect(screen.getByLabelText("Save")).toBeInTheDocument();
    expect(screen.getByLabelText("Cancel")).toBeInTheDocument();
  });

  it("does NOT enter edit mode when a checked item text is clicked", async () => {
    const user = userEvent.setup();
    renderWithVM({ ...MOCK_ITEM, checked: true });

    await user.click(screen.getByText("Milk"));

    expect(screen.queryByLabelText("Save")).not.toBeInTheDocument();
  });

  it("calls onEditItem with new text when save is clicked", async () => {
    const user = userEvent.setup();
    const { vm } = renderWithVM(MOCK_ITEM);

    await user.click(screen.getByText("Milk"));

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "Whole Milk");
    await user.click(screen.getByLabelText("Save"));

    expect(vm.onEditItem).toHaveBeenCalledWith(MOCK_ITEM.id, "Whole Milk");
  });

  it("calls onEditItem when Enter is pressed in edit input", async () => {
    const user = userEvent.setup();
    const { vm } = renderWithVM(MOCK_ITEM);

    await user.click(screen.getByText("Milk"));

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "Oat Milk");
    await user.keyboard("{Enter}");

    expect(vm.onEditItem).toHaveBeenCalledWith(MOCK_ITEM.id, "Oat Milk");
  });

  it("does NOT call onEditItem if the text is unchanged", async () => {
    const user = userEvent.setup();
    const { vm } = renderWithVM(MOCK_ITEM);

    await user.click(screen.getByText("Milk"));
    await user.click(screen.getByLabelText("Save"));

    expect(vm.onEditItem).not.toHaveBeenCalled();
  });

  it("cancels edit without calling onEditItem when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const { vm } = renderWithVM(MOCK_ITEM);

    await user.click(screen.getByText("Milk"));

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "Changed");
    await user.click(screen.getByLabelText("Cancel"));

    expect(vm.onEditItem).not.toHaveBeenCalled();
    // Back to normal view showing original text
    expect(screen.getByText("Milk")).toBeInTheDocument();
  });

  it("cancels edit when Escape is pressed", async () => {
    const user = userEvent.setup();
    const { vm } = renderWithVM(MOCK_ITEM);

    await user.click(screen.getByText("Milk"));
    await user.keyboard("{Escape}");

    expect(vm.onEditItem).not.toHaveBeenCalled();
    expect(screen.getByText("Milk")).toBeInTheDocument();
  });

  it("does NOT save if edit text is blank", async () => {
    const user = userEvent.setup();
    const { vm } = renderWithVM(MOCK_ITEM);

    await user.click(screen.getByText("Milk"));

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.keyboard("{Enter}");

    expect(vm.onEditItem).not.toHaveBeenCalled();
  });
});
