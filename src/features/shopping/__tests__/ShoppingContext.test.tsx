import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShoppingContext, useShoppingContext } from "../ShoppingContext";
import { makeVM } from "../../../test/mockVM";

function Consumer() {
  const vm = useShoppingContext();
  return <span data-testid="name">{vm.userName}</span>;
}

describe("ShoppingContext", () => {
  it("provides the VM to consumers", () => {
    const vm = makeVM({ userName: "Alice" });
    render(
      <ShoppingContext.Provider value={vm}>
        <Consumer />
      </ShoppingContext.Provider>,
    );
    expect(screen.getByTestId("name").textContent).toBe("Alice");
  });

  it("throws when useShoppingContext is used outside provider", () => {
    // Suppress React error boundary noise in test output
    const consoleError = console.error;
    console.error = () => {};
    expect(() => render(<Consumer />)).toThrow(
      "useShoppingContext must be used inside ShoppingProvider",
    );
    console.error = consoleError;
  });

  it("re-renders consumers when VM value changes", () => {
    const vmV1 = makeVM({ userName: "Alice" });
    const vmV2 = makeVM({ userName: "Bob" });

    const { rerender } = render(
      <ShoppingContext.Provider value={vmV1}>
        <Consumer />
      </ShoppingContext.Provider>,
    );
    expect(screen.getByTestId("name").textContent).toBe("Alice");

    rerender(
      <ShoppingContext.Provider value={vmV2}>
        <Consumer />
      </ShoppingContext.Provider>,
    );
    expect(screen.getByTestId("name").textContent).toBe("Bob");
  });
});
