import { motion } from "framer-motion";
import { Coffee, Copy, Link2, LogOut, PenLine, Smartphone } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { useShoppingContext } from "../ShoppingContext";

export function SettingsPanel() {
  const {
    t,
    activeList,
    copied,
    inviteLink,
    listRename,
    setListRename,
    errorText,
    installVisible,
    isPending,
    onCopy,
    onRenameList,
    onInstall,
    onLeaveList,
  } = useShoppingContext();

  const buyMeCoffeeUrl =
    import.meta.env.VITE_BUY_ME_COFFEE_URL || "https://buymeacoffee.com";

  if (!activeList) return null;

  const handleBuyMeCoffee = () =>
    window.open(buyMeCoffeeUrl, "_blank", "noopener,noreferrer");

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="overflow-hidden border-b bg-[var(--card)]"
    >
      <div className="mx-auto max-w-2xl space-y-4 px-4 pb-5 pt-2">
        {/* Invite section */}
        <div className="rounded-2xl bg-[var(--muted)] p-4">
          <p className="mb-1 text-sm font-semibold text-[var(--foreground)]">
            {t.inviteCodePrefix}{" "}
            <span
              dir="ltr"
              className="font-mono tracking-wide text-[var(--primary)]"
            >
              {activeList.invite_code}
            </span>
          </p>
          <p className="mb-3 text-xs text-[var(--muted-foreground)]">
            {t.shareToJoin}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-xl"
              onClick={() => onCopy(activeList.invite_code, "code")}
            >
              <Copy className="h-3.5 w-3.5" />
              {copied === "code" ? t.copied : t.copyCode}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-xl"
              onClick={() => onCopy(inviteLink, "link")}
            >
              <Link2 className="h-3.5 w-3.5" />
              {copied === "link" ? t.copied : t.copyLink}
            </Button>
          </div>
        </div>

        {/* Rename */}
        <div className="flex gap-2">
          <Input
            value={listRename}
            onChange={(e) => setListRename(e.target.value)}
            placeholder={t.renamePlaceholder}
            className="rounded-xl"
            onKeyDown={(e) => {
              if (e.key === "Enter" && listRename.trim()) onRenameList();
            }}
          />
          <Button
            variant="secondary"
            className="gap-1.5 rounded-xl"
            onClick={onRenameList}
            disabled={!listRename.trim()}
          >
            <PenLine className="h-3.5 w-3.5" />
            {t.rename}
          </Button>
        </div>

        {errorText && (
          <p className="text-sm text-[var(--destructive)]">{errorText}</p>
        )}

        {/* Actions row */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl"
            onClick={handleBuyMeCoffee}
          >
            <Coffee className="h-3.5 w-3.5" />
            {t.buyMeCoffee}
          </Button>
          {installVisible && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-xl"
              onClick={onInstall}
            >
              <Smartphone className="h-3.5 w-3.5" />
              {t.addToHomescreen}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
            onClick={onLeaveList}
          >
            {isPending ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              >
                <LogOut className="h-3.5 w-3.5" />
              </motion.div>
            ) : (
              <LogOut className="h-3.5 w-3.5" />
            )}
            {t.leaveList}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
