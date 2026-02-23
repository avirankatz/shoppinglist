import { AnimatePresence, motion } from "framer-motion";
import { memo, useEffect, useState } from "react";
import { Check, GripVertical, X } from "lucide-react";
import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { Input } from "../../../components/ui/input";
import { useShoppingContext } from "../ShoppingContext";
import type { ShoppingItem } from "../types";

type ItemRowProps = {
  item: ShoppingItem;
  isDraggable?: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  isDragging?: boolean;
};

export const ItemRow = memo(function ItemRow({
  item,
  isDraggable = false,
  dragHandleProps,
  isDragging = false,
}: ItemRowProps) {
  const { t, onToggleItem, onEditItem, onRemoveItem } = useShoppingContext();
  const [ripple, setRipple] = useState(false);
  const [justChecked, setJustChecked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);

  useEffect(() => {
    if (!isEditing) setEditText(item.text);
  }, [isEditing, item.text]);

  const handleToggle = () => {
    if (isEditing) return;
    if (!item.checked) {
      setRipple(true);
      setJustChecked(true);
      if (navigator.vibrate) navigator.vibrate(30);
      setTimeout(() => {
        setRipple(false);
        setJustChecked(false);
      }, 650);
    }
    onToggleItem(item);
  };

  const handleSave = () => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    if (trimmed !== item.text) onEditItem(item.id, trimmed);
    setIsEditing(false);
  };

  return (
    <motion.div
      layout={isDragging ? false : "position"}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, x: -30 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`group relative flex items-center rounded-2xl transition-colors ${
        item.checked
          ? "bg-[var(--muted)]/60"
          : "bg-[var(--card)] shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      }${isDragging ? " shadow-[0_8px_24px_rgba(0,0,0,0.14)]" : ""}`}
    >
      {isEditing ? (
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5">
          <Input
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setEditText(item.text);
                setIsEditing(false);
              }
            }}
            className="h-10 rounded-xl bg-[var(--muted)]"
          />
          <motion.button
            type="button"
            onClick={handleSave}
            aria-label={t.saveItemEdit}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-all hover:bg-[var(--check-green)]/10 hover:text-[var(--check-green)]"
            whileTap={{ scale: 0.85 }}
            disabled={!editText.trim()}
          >
            <Check className="h-4 w-4" />
          </motion.button>
          <motion.button
            type="button"
            onClick={() => {
              setEditText(item.text);
              setIsEditing(false);
            }}
            aria-label={t.cancelItemEdit}
            className="mr-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-all hover:bg-[var(--muted)]"
            whileTap={{ scale: 0.85 }}
          >
            <X className="h-4 w-4" />
          </motion.button>
        </div>
      ) : (
        <>
          {isDraggable && (
            <div
              {...dragHandleProps}
              className="flex h-full flex-shrink-0 touch-none select-none cursor-grab items-center pl-3 pr-1 text-[var(--muted-foreground)]/30 active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" />
            </div>
          )}

          <button
            type="button"
            role="checkbox"
            aria-checked={item.checked}
            onClick={handleToggle}
            onContextMenu={(e) => e.preventDefault()}
            className={`flex flex-shrink-0 items-center justify-center py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] ${
              isDraggable ? "pl-2 pr-2" : "pl-4 pr-2"
            }`}
          >
            <div className="relative">
              <motion.span
                aria-hidden
                animate={justChecked ? { scale: [1, 1.35, 1] } : { scale: 1 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
                  item.checked
                    ? "border-[var(--check-green)] bg-[var(--check-green)]"
                    : "border-[var(--border)] bg-transparent group-hover:border-[var(--check-green)]/50"
                }`}
              >
                <AnimatePresence>
                  {item.checked && (
                    <motion.svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <motion.path
                        d="M5 12l5 5L20 7"
                        fill="none"
                        stroke="white"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                      />
                    </motion.svg>
                  )}
                </AnimatePresence>
              </motion.span>

              <AnimatePresence>
                {ripple && (
                  <motion.span
                    key="ripple"
                    className="pointer-events-none absolute inset-0 rounded-full border-2 border-[var(--check-green)]"
                    initial={{ scale: 1, opacity: 0.7 }}
                    animate={{ scale: 2.4, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                )}
              </AnimatePresence>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!item.checked) {
                setEditText(item.text);
                setIsEditing(true);
              }
            }}
            className={`flex min-w-0 flex-1 items-center py-3.5 pr-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] ${
              !item.checked
                ? "cursor-pointer active:opacity-60"
                : "cursor-default"
            }`}
          >
            <span className="relative min-w-0 flex-1 select-none text-[15px] leading-snug">
              <span
                className={
                  item.checked
                    ? "text-[var(--muted-foreground)]"
                    : "text-[var(--foreground)]"
                }
              >
                {item.text}
              </span>
              {item.checked && (
                <motion.span
                  className="absolute inset-y-0 left-0 flex items-center"
                  style={{ width: "100%" }}
                >
                  <span
                    className="block h-[1.5px] w-full bg-[var(--muted-foreground)]/40"
                    style={{
                      animation: "strikethrough-sweep 0.3s ease-out forwards",
                    }}
                  />
                </motion.span>
              )}
            </span>
          </button>

          <motion.button
            type="button"
            onClick={() => onRemoveItem(item.id)}
            aria-label={t.deleteItem}
            className="delete-btn mr-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[var(--muted-foreground)] opacity-0 transition-all hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] group-hover:opacity-100 focus-visible:opacity-100"
            whileTap={{ scale: 0.85 }}
          >
            <X className="h-4 w-4" />
          </motion.button>
        </>
      )}
    </motion.div>
  );
});
