import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShoppingContext } from "../ShoppingContext";
import { SettingsPanel } from "../components/SettingsPanel";
import { makeVM, MOCK_LIST } from "../../../test/mockVM";
import type { ShoppingAppVM } from "../useShoppingApp";

function renderSettings(overrides: Partial<ShoppingAppVM> = {}) {
  const vm = makeVM(overrides);
  render(
    <ShoppingContext.Provider value={vm}>
      <SettingsPanel />
    </ShoppingContext.Provider>,
  );
  return vm;
}

// ─── Rendering ────────────────────────────────────────────────────────────────

describe("SettingsPanel – rendering", () => {
  it("renders the invite code", () => {
    renderSettings();
    expect(screen.getByText("ABCD-EFGH-IJKL")).toBeInTheDocument();
  });

  it("renders Copy code and Copy link buttons", () => {
    renderSettings();
    expect(
      screen.getByRole("button", { name: /copy code/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy link/i }),
    ).toBeInTheDocument();
  });

  it("renders rename input with placeholder", () => {
    renderSettings();
    expect(screen.getByPlaceholderText("Rename this list")).toBeInTheDocument();
  });

  it("renders Rename button disabled when rename field is empty", () => {
    renderSettings();
    expect(screen.getByRole("button", { name: /rename/i })).toBeDisabled();
  });

  it("renders Leave list button", () => {
    renderSettings();
    expect(
      screen.getByRole("button", { name: /leave list/i }),
    ).toBeInTheDocument();
  });

  it("renders nothing when activeList is null", () => {
    const { container } = render(
      <ShoppingContext.Provider value={makeVM({ activeList: null })}>
        <SettingsPanel />
      </ShoppingContext.Provider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows error text when errorText is set", () => {
    renderSettings({ errorText: "Something went wrong" });
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows Buy me coffee button", () => {
    renderSettings();
    expect(
      screen.getByRole("button", { name: /buy me coffee/i }),
    ).toBeInTheDocument();
  });

  it("does NOT show Add to homescreen button when installVisible is false", () => {
    renderSettings({ installVisible: false });
    expect(
      screen.queryByRole("button", { name: /add to homescreen/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Add to homescreen button when installVisible is true", () => {
    renderSettings({ installVisible: true });
    expect(
      screen.getByRole("button", { name: /add to homescreen/i }),
    ).toBeInTheDocument();
  });
});

// ─── Copied state ─────────────────────────────────────────────────────────────

describe("SettingsPanel – copied feedback", () => {
  it('shows "Copied" label on Copy code button when copied === "code"', () => {
    renderSettings({ copied: "code" });
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();
    // Copy link should still show its normal label
    expect(
      screen.getByRole("button", { name: /copy link/i }),
    ).toBeInTheDocument();
  });

  it('shows "Copied" label on Copy link button when copied === "link"', () => {
    renderSettings({ copied: "link" });
    // Copy code button should still show its normal label
    expect(
      screen.getByRole("button", { name: /copy code/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();
  });
});

// ─── Copy ─────────────────────────────────────────────────────────────────────

describe("SettingsPanel – copy actions", () => {
  it('calls onCopy with invite code and "code" when Copy code is clicked', () => {
    const vm = renderSettings();
    fireEvent.click(screen.getByRole("button", { name: /copy code/i }));
    expect(vm.onCopy).toHaveBeenCalledWith(MOCK_LIST.invite_code, "code");
  });

  it('calls onCopy with invite link and "link" when Copy link is clicked', () => {
    const vm = renderSettings({
      inviteLink: "http://localhost/?join=ABCD-EFGH-IJKL",
    });
    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));
    expect(vm.onCopy).toHaveBeenCalledWith(
      "http://localhost/?join=ABCD-EFGH-IJKL",
      "link",
    );
  });
});

// ─── Buy Me Coffee ────────────────────────────────────────────────────────────

describe("SettingsPanel – buy me coffee", () => {
  it("opens the Buy Me Coffee URL in a new tab when the button is clicked", () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    renderSettings();
    fireEvent.click(screen.getByRole("button", { name: /buy me coffee/i }));
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("buymeacoffee"),
      "_blank",
      "noopener,noreferrer",
    );
    openSpy.mockRestore();
  });
});

// ─── Rename ───────────────────────────────────────────────────────────────────

describe("SettingsPanel – rename", () => {
  it("enables Rename button when rename input has text", () => {
    const vm = renderSettings({ listRename: "New Name" });
    expect(screen.getByRole("button", { name: /rename/i })).not.toBeDisabled();
    void vm;
  });

  it("calls onRenameList when Rename button is clicked", () => {
    const vm = renderSettings({ listRename: "New Name" });
    fireEvent.click(screen.getByRole("button", { name: /rename/i }));
    expect(vm.onRenameList).toHaveBeenCalledOnce();
  });

  it("calls setListRename when user types in rename input", async () => {
    const user = userEvent.setup();
    const vm = renderSettings();
    const input = screen.getByPlaceholderText("Rename this list");
    await user.type(input, "A");
    expect(vm.setListRename).toHaveBeenCalled();
  });

  it("calls onRenameList when Enter is pressed in rename input", () => {
    const vm = renderSettings({ listRename: "New Name" });
    const input = screen.getByPlaceholderText("Rename this list");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(vm.onRenameList).toHaveBeenCalledOnce();
  });

  it("does NOT call onRenameList when Enter is pressed with blank rename", () => {
    const vm = renderSettings({ listRename: "" });
    const input = screen.getByPlaceholderText("Rename this list");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(vm.onRenameList).not.toHaveBeenCalled();
  });
});

// ─── Leave list ───────────────────────────────────────────────────────────────

describe("SettingsPanel – leave list", () => {
  it("calls onLeaveList when the button is clicked", () => {
    const vm = renderSettings();
    fireEvent.click(screen.getByRole("button", { name: /leave list/i }));
    expect(vm.onLeaveList).toHaveBeenCalledOnce();
  });

  it("renders a spinner inside the Leave list button when isPending is true", () => {
    renderSettings({ isPending: true });
    // The button should still be present even while pending
    expect(
      screen.getByRole("button", { name: /leave list/i }),
    ).toBeInTheDocument();
  });
});

// ─── Install ──────────────────────────────────────────────────────────────────

describe("SettingsPanel – install", () => {
  it("calls onInstall when Add to homescreen button is clicked", () => {
    const vm = renderSettings({ installVisible: true });
    fireEvent.click(screen.getByRole("button", { name: /add to homescreen/i }));
    expect(vm.onInstall).toHaveBeenCalledOnce();
  });
});
