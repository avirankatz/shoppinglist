import { AnimatePresence } from 'framer-motion'
import { ListScreen } from './features/shopping/ListScreen'
import { OnboardingScreen } from './features/shopping/OnboardingScreen'
import { useShoppingApp } from './features/shopping/useShoppingApp'

function App() {
  const vm = useShoppingApp()

  if (!vm.hasSupabaseConfig) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl bg-[var(--card)] p-8 text-center shadow-[0_2px_20px_rgba(0,0,0,0.06)]">
          <h1 className="text-xl font-bold">{vm.t.appTitle}</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">{vm.t.missingEnv}</p>
        </div>
      </main>
    )
  }

  if (vm.authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
          <p className="text-sm font-medium text-[var(--muted-foreground)]">{vm.t.loading}</p>
        </div>
      </main>
    )
  }

  return (
    <main dir={vm.isRtl ? 'rtl' : 'ltr'}>
      <AnimatePresence mode="wait">
        {vm.activeList ? (
          <ListScreen
            t={vm.t}
            activeList={vm.activeList}
            userName={vm.userName}
            peerLabel={vm.peerLabel}
            copied={vm.copied}
            inviteLink={vm.inviteLink}
            sortedItems={vm.sortedItems}
            newItemText={vm.newItemText}
            setNewItemText={vm.setNewItemText}
            listRename={vm.listRename}
            setListRename={vm.setListRename}
            errorText={vm.errorText}
            installVisible={vm.installVisible}
            isPending={vm.isPending}
            onCopy={vm.onCopy}
            onAddItem={vm.onAddItem}
            onToggleItem={vm.onToggleItem}
            onRemoveItem={vm.onRemoveItem}
            onRenameList={vm.onRenameList}
            onInstall={vm.onInstall}
            onLeaveList={vm.onLeaveList}
          />
        ) : (
          <div className="flex min-h-[100dvh] items-center justify-center px-4 py-8">
            <OnboardingScreen
              t={vm.t}
              mode={vm.mode}
              setMode={vm.setMode}
              onToggleLanguage={vm.onToggleLanguage}
              userName={vm.userName}
              setUserName={vm.setUserName}
              listName={vm.listName}
              setListName={vm.setListName}
              joinCode={vm.joinCode}
              setJoinCode={vm.setJoinCode}
              errorText={vm.errorText}
              showRetryAuth={vm.showAuthRetry}
              onRetryAuth={vm.onRetryAuth}
              onSubmit={vm.onSubmitOnboarding}
            />
          </div>
        )}
      </AnimatePresence>
    </main>
  )
}

export default App
