import { motion } from 'framer-motion'
import { memo } from 'react'
import {
  Cloud,
  Copy,
  Link2,
  LoaderCircle,
  Plus,
  Share2,
  Smartphone,
  Trash2,
  Users,
} from 'lucide-react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Checkbox } from '../../components/ui/checkbox'
import { Input } from '../../components/ui/input'
import type { CopyText } from './copy'
import type { ShoppingItem, ShoppingList } from './types'

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
  return (
    <motion.div
      key="list"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="mx-auto w-full max-w-2xl space-y-4"
    >
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{activeList.name || t.joinFallbackListName}</CardTitle>
              <CardDescription>
                {t.welcome}, {userName || 'Family'}. {t.syncDescription}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3.5 w-3.5" />
                {peerLabel}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Cloud className="h-3.5 w-3.5" />
                {t.cloud}
              </Badge>
            </div>
          </div>

          <div className="grid gap-2 rounded-[var(--radius)] border bg-[var(--muted)] p-3 text-sm md:grid-cols-[1fr_auto_auto] md:items-center">
            <div>
              <p className="font-medium">
                {t.inviteCodePrefix} <span dir="ltr">{activeList.invite_code}</span>
              </p>
              <p className="text-[var(--muted-foreground)]">{t.shareToJoin}</p>
            </div>
            <Button variant="outline" className="gap-2" onClick={() => onCopy(activeList.invite_code, 'code')}>
              <Copy className="h-4 w-4" />
              {copied === 'code' ? t.copied : t.copyCode}
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => onCopy(inviteLink, 'link')}>
              <Link2 className="h-4 w-4" />
              {copied === 'link' ? t.copied : t.copyLink}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={newItemText}
              onChange={(event) => setNewItemText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  onAddItem()
                }
              }}
              placeholder={t.addItemPlaceholder}
            />
            <Button onClick={onAddItem} className="gap-2 sm:w-36">
              <Plus className="h-4 w-4" />
              {t.add}
            </Button>
          </div>

          <div className="max-h-[45vh] space-y-2 overflow-auto pr-1 [content-visibility:auto]">
            {sortedItems.length === 0 ? (
              <p className="rounded-[var(--radius)] border border-dashed p-6 text-center text-sm text-[var(--muted-foreground)]">
                {t.noItems}
              </p>
            ) : (
              sortedItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.2), duration: 0.2 }}
                  className="flex items-center justify-between rounded-[var(--radius)] border bg-[var(--card)] px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox checked={item.checked} onClick={() => onToggleItem(item)} />
                    <span
                      className={`text-sm ${
                        item.checked ? 'text-[var(--muted-foreground)] line-through' : ''
                      }`}
                    >
                      {item.text}
                    </span>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onRemoveItem(item.id)}
                    aria-label={t.deleteItem}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </motion.div>
              ))
            )}
          </div>

          <div className="grid gap-2 rounded-[var(--radius)] border bg-[var(--muted)] p-3 md:grid-cols-[1fr_auto]">
            <Input
              value={listRename}
              onChange={(event) => setListRename(event.target.value)}
              placeholder={t.renamePlaceholder}
            />
            <Button variant="secondary" onClick={onRenameList} disabled={!listRename.trim()}>
              {t.rename}
            </Button>
          </div>

          {errorText ? <p className="text-sm text-[var(--destructive)]">{errorText}</p> : null}

          <div className="flex flex-wrap gap-2">
            {installVisible ? (
              <Button variant="outline" onClick={onInstall} className="gap-2">
                <Smartphone className="h-4 w-4" />
                {t.addToHomescreen}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              className="gap-2 text-[var(--muted-foreground)]"
              onClick={() => onCopy(inviteLink, 'share')}
            >
              <Share2 className="h-4 w-4" />
              {copied === 'share' ? t.linkCopied : t.share}
            </Button>
            <Button variant="destructive" className="gap-2" onClick={onLeaveList}>
              {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t.leaveList}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
})
