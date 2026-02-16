import { AnimatePresence, motion } from 'framer-motion'
import { memo, useCallback, useRef, useState } from 'react'
import {
  Check,
  Copy,
  Download,
  Link2,
  LogOut,
  MoreHorizontal,
  Plus,
  PenLine,
  Smartphone,
  Users,
  X,
  ShoppingBag,
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import type { CopyText } from './copy'
import type { ShoppingItem, ShoppingList } from './types'

/* ---------- Single item row ---------- */

function ItemRow({
  item,
  onToggle,
  onRemove,
  deleteLabel,
}: {
  item: ShoppingItem
  onToggle: (item: ShoppingItem) => void
  onRemove: (id: string) => void
  deleteLabel: string
}) {
  const [ripple, setRipple] = useState(false)
  const [justChecked, setJustChecked] = useState(false)

  const handleToggle = () => {
    if (!item.checked) {
      setRipple(true)
      setJustChecked(true)
      if (navigator.vibrate) navigator.vibrate(30)
      setTimeout(() => {
        setRipple(false)
        setJustChecked(false)
      }, 650)
    }
    onToggle(item)
  }

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, x: -30 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`group relative flex items-center rounded-2xl transition-colors ${
        item.checked
          ? 'bg-[var(--muted)]/60'
          : 'bg-[var(--card)] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
      }`}
    >
      {/* Tappable area: checkbox + text */}
      <button
        type="button"
        role="checkbox"
        aria-checked={item.checked}
        onClick={handleToggle}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-2xl px-4 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        {/* Checkbox visual */}
        <div className="relative flex-shrink-0">
          <motion.span
            aria-hidden
            animate={justChecked ? { scale: [1, 1.35, 1] } : { scale: 1 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
              item.checked
                ? 'border-[var(--check-green)] bg-[var(--check-green)]'
                : 'border-[var(--border)] bg-transparent group-hover:border-[var(--check-green)]/50'
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
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                </motion.svg>
              )}
            </AnimatePresence>
          </motion.span>

          {/* Ripple ring */}
          <AnimatePresence>
            {ripple && (
              <motion.span
                key="ripple"
                className="pointer-events-none absolute inset-0 rounded-full border-2 border-[var(--check-green)]"
                initial={{ scale: 1, opacity: 0.7 }}
                animate={{ scale: 2.4, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Item text */}
        <span className="relative min-w-0 flex-1 select-none text-start text-[15px] leading-snug">
          <span className={item.checked ? 'text-[var(--muted-foreground)]' : 'text-[var(--foreground)]'}>
            {item.text}
          </span>
          {item.checked && (
            <motion.span
              className="absolute inset-y-0 left-0 flex items-center"
              style={{ width: '100%' }}
            >
              <span
                className="block h-[1.5px] w-full bg-[var(--muted-foreground)]/40"
                style={{ animation: 'strikethrough-sweep 0.3s ease-out forwards' }}
              />
            </motion.span>
          )}
        </span>
      </button>

      {/* Delete button */}
      <motion.button
        type="button"
        onClick={() => onRemove(item.id)}
        aria-label={deleteLabel}
        className="delete-btn mr-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[var(--muted-foreground)] opacity-0 transition-all hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] group-hover:opacity-100 focus-visible:opacity-100"
        whileTap={{ scale: 0.85 }}
      >
        <X className="h-4 w-4" />
      </motion.button>
    </motion.div>
  )
}

/* ---------- Settings panel ---------- */

function SettingsPanel({
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
}: {
  t: CopyText
  activeList: ShoppingList
  copied: string
  inviteLink: string
  listRename: string
  setListRename: (v: string) => void
  errorText: string
  installVisible: boolean
  isPending: boolean
  onCopy: (v: string, k: string) => void
  onRenameList: () => void
  onInstall: () => void
  onLeaveList: () => void
}) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="overflow-hidden border-b bg-[var(--card)]"
    >
      <div className="mx-auto max-w-2xl space-y-4 px-4 pb-5 pt-2">
        {/* Invite section */}
        <div className="rounded-2xl bg-[var(--muted)] p-4">
          <p className="mb-1 text-sm font-semibold text-[var(--foreground)]">
            {t.inviteCodePrefix}{' '}
            <span dir="ltr" className="font-mono tracking-wide text-[var(--primary)]">
              {activeList.invite_code}
            </span>
          </p>
          <p className="mb-3 text-xs text-[var(--muted-foreground)]">{t.shareToJoin}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => onCopy(activeList.invite_code, 'code')}>
              <Copy className="h-3.5 w-3.5" />
              {copied === 'code' ? t.copied : t.copyCode}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => onCopy(inviteLink, 'link')}>
              <Link2 className="h-3.5 w-3.5" />
              {copied === 'link' ? t.copied : t.copyLink}
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
              if (e.key === 'Enter' && listRename.trim()) onRenameList()
            }}
          />
          <Button variant="secondary" className="gap-1.5 rounded-xl" onClick={onRenameList} disabled={!listRename.trim()}>
            <PenLine className="h-3.5 w-3.5" />
            {t.rename}
          </Button>
        </div>

        {errorText && <p className="text-sm text-[var(--destructive)]">{errorText}</p>}

        {/* Actions row */}
        <div className="flex flex-wrap gap-2">
          {installVisible && (
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={onInstall}>
              <Smartphone className="h-3.5 w-3.5" />
              {t.addToHomescreen}
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-[var(--destructive)] hover:bg-[var(--destructive)]/10" onClick={onLeaveList}>
            {isPending ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><LogOut className="h-3.5 w-3.5" /></motion.div> : <LogOut className="h-3.5 w-3.5" />}
            {t.leaveList}
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

/* ---------- Main list screen ---------- */

type ListScreenProps = {
  t: CopyText
  activeList: ShoppingList
  userName: string
  peerLabel: string
  copied: string
  inviteLink: string
  sortedItems: ShoppingItem[]
  newItemText: string
  setNewItemText: (value: string) => void
  listRename: string
  setListRename: (value: string) => void
  errorText: string
  installVisible: boolean
  isPending: boolean
  onCopy: (value: string, key: string) => void
  onAddItem: () => void
  onToggleItem: (item: ShoppingItem) => void
  onRemoveItem: (id: string) => void
  onRenameList: () => void
  onInstall: () => void
  onLeaveList: () => void
}

export const ListScreen = memo(function ListScreen({
  t,
  activeList,
  userName,
  peerLabel,
  copied,
  inviteLink,
  sortedItems,
  newItemText,
  setNewItemText,
  listRename,
  setListRename,
  errorText,
  installVisible,
  isPending,
  onCopy,
  onAddItem,
  onToggleItem,
  onRemoveItem,
  onRenameList,
  onInstall,
  onLeaveList,
}: ListScreenProps) {
  const [showSettings, setShowSettings] = useState(false)
  const [installDismissed, setInstallDismissed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleAddItem = useCallback(() => {
    if (!newItemText.trim()) return
    onAddItem()
    if (navigator.vibrate) navigator.vibrate(15)
    // Dismiss keyboard on mobile after adding
    inputRef.current?.blur()
  }, [newItemText, onAddItem])

  const uncheckedCount = sortedItems.filter((i) => !i.checked).length
  const checkedCount = sortedItems.length - uncheckedCount

  return (
    <motion.div
      key="list"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex h-[100dvh] flex-col"
    >
      {/* ───── Header ───── */}
      <header className="relative z-10 border-b bg-[var(--card)] shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          {/* List icon + name */}
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight tracking-tight">
                {activeList.name || t.joinFallbackListName}
              </h1>
              <p className="truncate text-xs text-[var(--muted-foreground)]">
                {t.welcome}, {userName || 'Family'}
              </p>
            </div>
          </div>

          {/* Right actions */}
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
              {showSettings ? <X className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}
            </motion.button>
          </div>
        </div>
      </header>

      {/* ───── Collapsible settings panel ───── */}
      <AnimatePresence>
        {showSettings && (
          <SettingsPanel
            t={t}
            activeList={activeList}
            copied={copied}
            inviteLink={inviteLink}
            listRename={listRename}
            setListRename={setListRename}
            errorText={errorText}
            installVisible={installVisible}
            isPending={isPending}
            onCopy={onCopy}
            onRenameList={onRenameList}
            onInstall={onInstall}
            onLeaveList={onLeaveList}
          />
        )}
      </AnimatePresence>

      {/* ───── Item list (scrollable middle) ───── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-2xl px-4 py-4">
          {/* Install banner */}
          <AnimatePresence>
            {installVisible && !installDismissed && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-3 rounded-2xl bg-[var(--primary)]/5 border border-[var(--primary)]/15 px-4 py-3.5">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                    <Download className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">{t.installBannerTitle}</p>
                    <p className="text-xs text-[var(--muted-foreground)] leading-snug mt-0.5">{t.installBannerDescription}</p>
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

          {sortedItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--muted)]">
                <ShoppingBag className="h-8 w-8 text-[var(--muted-foreground)]/60" />
              </div>
              <p className="text-sm font-medium text-[var(--muted-foreground)]">{t.noItems}</p>
            </motion.div>
          ) : (
            <motion.div layout className="flex flex-col gap-2">
              <AnimatePresence mode="popLayout">
                {sortedItems
                  .filter((i) => !i.checked)
                  .map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onToggle={onToggleItem}
                      onRemove={onRemoveItem}
                      deleteLabel={t.deleteItem}
                    />
                  ))}

                {/* Checked section divider */}
                {checkedCount > 0 && (
                  <motion.div
                    key="__checked-divider"
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="flex items-center gap-2 px-1 pt-2 pb-0.5"
                  >
                    <div className="h-px flex-1 bg-[var(--border)]" />
                    <span className="flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
                      <Check className="h-3 w-3" />
                      {checkedCount}
                    </span>
                    <div className="h-px flex-1 bg-[var(--border)]" />
                  </motion.div>
                )}

                {sortedItems
                  .filter((i) => i.checked)
                  .map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onToggle={onToggleItem}
                      onRemove={onRemoveItem}
                      deleteLabel={t.deleteItem}
                    />
                  ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>

      {/* ───── Bottom input bar ───── */}
      <div className="border-t bg-[var(--card)] shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
        <div 
          className="mx-auto flex max-w-2xl items-center gap-2 px-4 pt-3 pb-3"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
        >
          <Input
            ref={inputRef}
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddItem()
            }}
            placeholder={t.addItemPlaceholder}
            className="h-12 flex-1 rounded-2xl border-[var(--border)] bg-[var(--muted)] px-4 text-[15px] placeholder:text-[var(--muted-foreground)]/60"
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
  )
})

