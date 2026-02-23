import { createContext, useContext } from "react";
import type { ShoppingAppVM } from "./useShoppingApp";

export const ShoppingContext = createContext<ShoppingAppVM | null>(null);

export function useShoppingContext(): ShoppingAppVM {
  const ctx = useContext(ShoppingContext);
  if (!ctx)
    throw new Error("useShoppingContext must be used inside ShoppingProvider");
  return ctx;
}
