import { motion } from 'framer-motion'
import { memo } from 'react'
import { ShoppingBag } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import type { AppMode } from './types'
import type { CopyText } from './copy'

type OnboardingScreenProps = {
  t: CopyText
  mode: AppMode
  setMode: (mode: AppMode) => void
  onToggleLanguage: () => void
  userName: string
  setUserName: (value: string) => void
  listName: string
  setListName: (value: string) => void
  joinCode: string
  setJoinCode: (value: string) => void
  errorText: string
  showRetryAuth?: boolean
  onRetryAuth?: () => void
  onSubmit: () => void
}

export const OnboardingScreen = memo(function OnboardingScreen({
  t,
  mode,
  setMode,
  onToggleLanguage,
  userName,
  setUserName,
  listName,
  setListName,
  joinCode,
  setJoinCode,
  errorText,
  showRetryAuth,
  onRetryAuth,
  onSubmit,
}: OnboardingScreenProps) {
  return (
    <motion.div
      key="onboarding"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="mx-auto w-full max-w-md"
    >
      <div className="rounded-3xl bg-[var(--card)] p-6 shadow-[0_2px_20px_rgba(0,0,0,0.06)] sm:p-8">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]"
          >
            <ShoppingBag className="h-8 w-8" />
          </motion.div>
          <h1 className="text-2xl font-bold tracking-tight">{t.appTitle}</h1>
          <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">{t.createDescription}</p>
        </div>

        <div className="space-y-5">
          {/* Tab toggle + language */}
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex rounded-2xl bg-[var(--muted)] p-1">
              <button
                type="button"
                onClick={() => setMode('create')}
                className={`rounded-xl px-5 py-2 text-sm font-medium transition-all ${
                  mode === 'create'
                    ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                {t.createTab}
              </button>
              <button
                type="button"
                onClick={() => setMode('join')}
                className={`rounded-xl px-5 py-2 text-sm font-medium transition-all ${
                  mode === 'join'
                    ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                {t.joinTab}
              </button>
            </div>
            <button
              type="button"
              onClick={onToggleLanguage}
              className="rounded-xl bg-[var(--muted)] px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              {t.language}
            </button>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t.yourName}</label>
            <Input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder={t.yourNamePlaceholder}
              className="h-11 rounded-xl"
            />
          </div>

          {/* List name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {mode === 'create' ? t.familyListName : t.listNameOptional}
            </label>
            <Input
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder={t.listNamePlaceholder}
              className="h-11 rounded-xl"
            />
          </div>

          {/* Join code */}
          {mode === 'join' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-1.5"
            >
              <label className="text-sm font-medium">{t.inviteCode}</label>
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX"
                dir="ltr"
                className="h-11 rounded-xl font-mono tracking-wider"
              />
            </motion.div>
          )}

          {errorText && <p className="text-sm text-[var(--destructive)]">{errorText}</p>}

          {showRetryAuth && onRetryAuth && (
            <Button variant="outline" className="w-full rounded-xl" onClick={onRetryAuth}>
              {t.retryAuth}
            </Button>
          )}

          <motion.div whileTap={{ scale: 0.98 }}>
            <Button
              className="h-12 w-full rounded-2xl bg-[var(--primary)] text-base font-semibold text-white shadow-md hover:opacity-90"
              onClick={onSubmit}
              disabled={mode === 'join' ? !joinCode.trim() : !listName.trim()}
            >
              {mode === 'create' ? t.createButton : t.joinButton}
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
})
