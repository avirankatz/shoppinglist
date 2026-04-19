import { AnimatePresence, motion } from "framer-motion";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import type { DragUpdate } from "@hello-pangea/dnd";
import {
  Check,
  Coffee,
  Download,
  MoreHorizontal,
  Plus,
  RotateCcw,
  ShoppingBag,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useShoppingContext } from "./ShoppingContext";
import { ItemRow } from "./components/ItemRow";
import { SettingsPanel } from "./components/SettingsPanel";
import { usePullToRefresh } from "./hooks/usePullToRefresh";
import { useWebHaptics } from "web-haptics/react";

const SUPPORT_PROMPT_STORAGE_PREFIX = "family-shopping:support-prompt:";

export const ListScreen = memo(function ListScreen() {
  const {
    t,
    activeList,
    userName,
    peerLabel,
    sortedItems,
    newItemText,
    setNewItemText,
    installVisible,
    onAddItem,
    onInstall,
    onReorderItems,
    onRemoveAllDoneItems,
    onRestoreAllDoneItems,
    onRefresh,
  } = useShoppingContext();
  const { trigger: haptic } = useWebHaptics();
  const { scrollRef, pullY, pullThreshold, isRefreshing, handleTouchStart, handleTouchMove, handleTouchEnd } =
    usePullToRefresh(onRefresh);

  const dragDestinationIndexRef = useRef<number | null>(null);

  const handleDragUpdate = useCallback(
    (update: DragUpdate) => {
      const newIndex = update.destination?.index ?? null;
      if (newIndex !== null && newIndex !== dragDestinationIndexRef.current) {
        dragDestinationIndexRef.current = newIndex;
        void haptic("selection");
      }
    },
    [haptic],
  );

  const buyMeCoffeeUrl =
    import.meta.env.VITE_BUY_ME_COFFEE_URL || "https://buymeacoffee.com";
  const [showSettings, setShowSettings] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [supportPromptDismissed, setSupportPromptDismissed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const supportPromptStorageKey = useMemo(
    () =>
      activeList ? `${SUPPORT_PROMPT_STORAGE_PREFIX}${activeList.id}` : "",
    [activeList],
  );

  const handleAddItem = useCallback(() => {
    if (!newItemText.trim()) return;
    onAddItem();
    void haptic("light");
    inputRef.current?.blur();
  }, [newItemText, onAddItem, haptic]);

  const uncheckedCount = sortedItems.filter((i) => !i.checked).length;
  const checkedCount = sortedItems.length - uncheckedCount;
  const shouldPromptForSupport =
    sortedItems.length >= 5 && checkedCount >= 3 && !supportPromptDismissed;

  const dismissSupportPrompt = useCallback(() => {
    setSupportPromptDismissed(true);
    if (supportPromptStorageKey)
      localStorage.setItem(supportPromptStorageKey, "dismissed");
  }, [supportPromptStorageKey]);

  const supportWithCoffee = useCallback(() => {
    setSupportPromptDismissed(true);
    if (supportPromptStorageKey)
      localStorage.setItem(supportPromptStorageKey, "supported");
    window.open(buyMeCoffeeUrl, "_blank", "noopener,noreferrer");
  }, [buyMeCoffeeUrl, supportPromptStorageKey]);

  if (!activeList) return null;

  return (
    <motion.div
      key="list"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex h-[100dvh] flex-col"
    >
      {/* ───── Header ───── */}
      <header
        className="relative z-10 border-b bg-[var(--card)] shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
        style={{ paddingTop: "var(--safe-area-top)" }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight tracking-tight">
                {activeList.name || t.joinFallbackListName}
              </h1>
              <p className="truncate text-xs text-[var(--muted-foreground)]">
                {t.welcome}, {userName || "Family"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-full bg-[var(--muted)] px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)]">
              <Users className="h-3.5 w-3.5" />
              {peerLabel}
            </div>
            <motion.button
              type="button"
              onClick={() => setShowSettings((s) => !s)}
              className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-[var(--muted)]"
              animate={{ rotate: showSettings ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              aria-label="Settings"
            >
              {showSettings ? (
                <X className="h-5 w-5" />
              ) : (
                <MoreHorizontal className="h-5 w-5" />
              )}
            </motion.button>
          </div>
        </div>
      </header>

      <AnimatePresence>{showSettings && <SettingsPanel />}</AnimatePresence>

      {/* ───── Item list (scrollable middle) ───── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        <div
          className="flex items-center justify-center overflow-hidden"
          style={{
            height: isRefreshing ? 52 : pullY,
            transition: pullY === 0 ? "height 0.25s ease" : "none",
          }}
        >
          {(pullY > 0 || isRefreshing) && (
            <div
              style={{
                transform: !isRefreshing
                  ? `rotate(${Math.min((pullY / pullThreshold) * 180, 180)}deg)`
                  : undefined,
              }}
              className={isRefreshing ? "animate-spin" : ""}
            >
              <RotateCcw
                className={`h-5 w-5 ${
                  pullY >= pullThreshold || isRefreshing
                    ? "text-[var(--primary)]"
                    : "text-[var(--muted-foreground)]"
                }`}
              />
            </div>
          )}
        </div>

        <div className="mx-auto max-w-2xl px-4 py-4">
          {/* Install banner */}
          <AnimatePresence>
            {installVisible && !installDismissed && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-3 rounded-2xl bg-[var(--primary)]/5 border border-[var(--primary)]/15 px-4 py-3.5">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                    <Download className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">
                      {t.installBannerTitle}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)] leading-snug mt-0.5">
                      {t.installBannerDescription}
                    </p>
                  </div>
                  <motion.button
                    type="button"
                    onClick={onInstall}
                    whileTap={{ scale: 0.93 }}
                    className="flex-shrink-0 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm"
                  >
                    {t.installBannerAction}
                  </motion.button>
                  <button
                    type="button"
                    onClick={() => setInstallDismissed(true)}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
                    aria-label="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Support prompt */}
          <AnimatePresence>
            {shouldPromptForSupport && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                className="overflow-hidden"
              >
                <div className="flex items-start gap-3 rounded-2xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 px-4 py-3.5">
                  <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                    <Coffee className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">
                      {t.coffeePromptTitle}
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-[var(--muted-foreground)]">
                      {t.coffeePromptDescription}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="rounded-xl"
                        onClick={supportWithCoffee}
                      >
                        {t.buyMeCoffee}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={dismissSupportPrompt}
                      >
                        {t.coffeePromptLater}
                      </Button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={dismissSupportPrompt}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]"
                    aria-label="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {sortedItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--muted)]">
                <ShoppingBag className="h-8 w-8 text-[var(--muted-foreground)]/60" />
              </div>
              <p className="text-sm font-medium text-[var(--muted-foreground)]">
                {t.noItems}
              </p>
            </motion.div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Unchecked items — draggable */}
              <DragDropContext
                onDragStart={(start) => {
                  dragDestinationIndexRef.current = start.source.index;
                  void haptic("selection");
                }}
                onDragUpdate={handleDragUpdate}
                onDragEnd={(result: DropResult) => {
                  dragDestinationIndexRef.current = null;
                  if (!result.destination) return;
                  onReorderItems(result.source.index, result.destination.index);
                }}
              >
                <Droppable droppableId="shopping-items">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex flex-col gap-2"
                    >
                      {sortedItems
                        .filter((i) => !i.checked)
                        .map((item, index) => (
                          <Draggable
                            key={item.id}
                            draggableId={item.id}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                              >
                                <ItemRow
                                  item={item}
                                  isDraggable
                                  dragHandleProps={provided.dragHandleProps}
                                  isDragging={snapshot.isDragging}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              {/* Checked section divider */}
              <AnimatePresence>
                {checkedCount > 0 && (
                  <motion.div
                    key="__checked-divider"
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="flex items-center gap-2 px-1 pt-2 pb-0.5"
                  >
                    <div className="h-px flex-1 bg-[var(--border)]" />
                    <span className="flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
                      <Check className="h-3 w-3" />
                      {checkedCount}
                    </span>
                    <div className="h-px flex-1 bg-[var(--border)]" />
                    <button
                      type="button"
                      title={t.restoreDoneItemsTitle}
                      onClick={() => {
                        void haptic("success");
                        void onRestoreAllDoneItems();
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title={t.clearDoneItemsTitle}
                      onClick={() => {
                        void haptic("medium");
                        void onRemoveAllDoneItems();
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Checked items */}
              <AnimatePresence mode="popLayout">
                {sortedItems
                  .filter((i) => i.checked)
                  .map((item) => (
                    <ItemRow key={item.id} item={item} />
                  ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* ───── Bottom input bar ───── */}
      <div className="border-t bg-[var(--card)] shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
        <div
          className="mx-auto flex max-w-2xl items-center gap-2 px-4 pt-3"
          style={{
            paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)",
          }}
        >
          <Input
            ref={inputRef}
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddItem();
            }}
            placeholder={t.addItemPlaceholder}
            className="h-12 flex-1 rounded-2xl border-[var(--border)] bg-[var(--muted)] px-4 placeholder:text-[var(--muted-foreground)]/60"
          />
          <motion.button
            type="button"
            onClick={handleAddItem}
            disabled={!newItemText.trim()}
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.05 }}
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)] text-white shadow-md transition-opacity disabled:opacity-30"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
});
