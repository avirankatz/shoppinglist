import { motion } from 'framer-motion'
import { memo } from 'react'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="mx-auto w-full max-w-xl"
    >
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl">{t.appTitle}</CardTitle>
          <CardDescription>{t.createDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-[var(--radius)] border bg-[var(--muted)] p-1">
              <button
                type="button"
                onClick={() => setMode('create')}
                className={`rounded-[calc(var(--radius)-4px)] px-4 py-1.5 text-sm transition ${
                  mode === 'create'
                    ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                    : 'text-[var(--muted-foreground)]'
                }`}
              >
                {t.createTab}
              </button>
              <button
                type="button"
                onClick={() => setMode('join')}
                className={`rounded-[calc(var(--radius)-4px)] px-4 py-1.5 text-sm transition ${
                  mode === 'join'
                    ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                    : 'text-[var(--muted-foreground)]'
                }`}
              >
                {t.joinTab}
              </button>
            </div>
            <button
              type="button"
              onClick={onToggleLanguage}
              className="rounded-[calc(var(--radius)-2px)] border bg-[var(--card)] px-3 py-1.5 text-sm"
            >
              {t.language}
            </button>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">{t.yourName}</label>
            <Input
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              placeholder={t.yourNamePlaceholder}
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">
              {mode === 'create' ? t.familyListName : t.listNameOptional}
            </label>
            <Input
              value={listName}
              onChange={(event) => setListName(event.target.value)}
              placeholder={t.listNamePlaceholder}
            />
          </div>

          {mode === 'join' ? (
            <div className="space-y-3">
              <label className="text-sm font-medium">{t.inviteCode}</label>
              <Input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX"
                dir="ltr"
              />
            </div>
          ) : null}

          {errorText ? <p className="text-sm text-[var(--destructive)]">{errorText}</p> : null}

          {showRetryAuth && onRetryAuth ? (
            <Button variant="outline" className="w-full" onClick={onRetryAuth}>
              {t.retryAuth}
            </Button>
          ) : null}

          <Button
            className="w-full"
            onClick={onSubmit}
            disabled={mode === 'join' ? !joinCode.trim() : !listName.trim()}
          >
            {mode === 'create' ? t.createButton : t.joinButton}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
})
