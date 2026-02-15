import { AnimatePresence } from 'framer-motion'
import { Card, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { ListScreen } from './features/shopping/ListScreen'
import { OnboardingScreen } from './features/shopping/OnboardingScreen'
import { useShoppingApp } from './features/shopping/useShoppingApp'

function App() {
  const vm = useShoppingApp()

  if (!vm.hasSupabaseConfig) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>{vm.t.appTitle}</CardTitle>
            <CardDescription>{vm.t.missingEnv}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  if (vm.authLoading) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>{vm.t.loading}</CardTitle>
          </CardHeader>
        </Card>
      </main>
    )
  }

  return (
    <main dir={vm.isRtl ? 'rtl' : 'ltr'} className="min-h-screen px-4 py-8 md:px-6">
      <div className="mx-auto mb-6 max-w-2xl text-sm text-[var(--muted-foreground)]">{vm.t.noBackend}</div>
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
        )}
      </AnimatePresence>
    </main>
  )
}

export default App
