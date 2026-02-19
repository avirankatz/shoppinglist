import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { RealtimeChannel, User } from '@supabase/supabase-js'
import { DEFAULT_LIST_NAME, textByLanguage, type Language } from './copy'
import type { AppMode, ShoppingItem, ShoppingList } from './types'
import { hasSupabaseConfig, supabase } from '../../lib/supabase'

type CachedListState = {
  list: ShoppingList
  items: ShoppingItem[]
  memberCount: number
}

type PendingOperation =
  | { type: 'add'; text: string; checked: boolean }
  | { type: 'toggle'; itemId: string; checked: boolean }
  | { type: 'edit'; itemId: string; text: string }
  | { type: 'remove'; itemId: string }
  | { type: 'rename'; name: string }

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const STORAGE_SESSION = 'family-shopping:session'
const STORAGE_LANG = 'family-shopping:lang'
const STORAGE_NAME = 'family-shopping:name'
const STORAGE_CACHE_PREFIX = 'family-shopping:cache:'
const STORAGE_QUEUE_PREFIX = 'family-shopping:queue:'

const parseJson = <T,>(raw: string | null): T | null => {
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

const getInitialLanguage = (): Language => {
  const saved = localStorage.getItem(STORAGE_LANG)
  if (saved === 'en' || saved === 'he') {
    return saved
  }

  return navigator.language.toLowerCase().startsWith('he') ? 'he' : 'en'
}

const createInviteCode = () =>
  Array.from(crypto.getRandomValues(new Uint32Array(3)))
    .map((value) => value.toString(36).toUpperCase().slice(0, 4))
    .join('-')

const createLocalId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `local-${crypto.randomUUID()}`
    : `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

const copyWithFallback = (value: string): boolean => {
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)
  return copied
}

const parseStoredSession = (): { listId: string; listName: string; inviteCode: string } | null =>
  parseJson<{ listId: string; listName: string; inviteCode: string }>(
    localStorage.getItem(STORAGE_SESSION),
  )

const getQueueKey = (listId: string) => `${STORAGE_QUEUE_PREFIX}${listId}`
const getCacheKey = (listId: string) => `${STORAGE_CACHE_PREFIX}${listId}`

const getPendingQueue = (listId: string): PendingOperation[] =>
  parseJson<PendingOperation[]>(localStorage.getItem(getQueueKey(listId))) ?? []

const setPendingQueue = (listId: string, queue: PendingOperation[]) => {
  localStorage.setItem(getQueueKey(listId), JSON.stringify(queue))
}

const enqueueOperation = (listId: string, operation: PendingOperation) => {
  const queue = getPendingQueue(listId)
  queue.push(operation)
  setPendingQueue(listId, queue)
}

const setCachedState = (state: CachedListState) => {
  localStorage.setItem(getCacheKey(state.list.id), JSON.stringify(state))
}

const getCachedState = (listId: string): CachedListState | null =>
  parseJson<CachedListState>(localStorage.getItem(getCacheKey(listId)))

export function useShoppingApp() {
  const [language, setLanguage] = useState<Language>(() => getInitialLanguage())
  const [mode, setMode] = useState<AppMode>('create')
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const urlJoinCode = useMemo(() => {
    const query = new URLSearchParams(window.location.search)
    return query.get('join')?.toUpperCase() || ''
  }, [])

  const restoredSession = useMemo(() => parseStoredSession(), [])
  const [activeList, setActiveList] = useState<ShoppingList | null>(() => {
    // If URL has a join code that differs from current session, don't restore — let user join the new list
    if (urlJoinCode && restoredSession && restoredSession.inviteCode.toUpperCase() !== urlJoinCode) {
      return null
    }
    return restoredSession
      ? {
          id: restoredSession.listId,
          name: restoredSession.listName,
          invite_code: restoredSession.inviteCode,
          owner_id: '',
        }
      : null
  })
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [memberCount, setMemberCount] = useState(1)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  const [userName, setUserName] = useState(() => localStorage.getItem(STORAGE_NAME) ?? '')
  const [listName, setListName] = useState(() =>
    urlJoinCode ? '' : DEFAULT_LIST_NAME[getInitialLanguage()],
  )
  const [joinCode, setJoinCode] = useState('')
  const [newItemText, setNewItemText] = useState('')
  const [listRename, setListRename] = useState('')
  const [copied, setCopied] = useState('')
  const [errorText, setErrorText] = useState('')
  const [showAuthRetry, setShowAuthRetry] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isPending, startTransition] = useTransition()
  const [authRetryTick, setAuthRetryTick] = useState(0)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const t = textByLanguage[language]
  const isRtl = language === 'he'

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr'
    localStorage.setItem(STORAGE_LANG, language)
  }, [isRtl, language])

  useEffect(() => {
    localStorage.setItem(STORAGE_NAME, userName)
  }, [userName])

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // Pre-fill join code from URL
  useEffect(() => {
    if (!urlJoinCode) {
      return
    }
    setMode('join')
    setJoinCode(urlJoinCode)
    // Clean the URL so refreshing won't re-trigger
    const cleanUrl = new URL(window.location.href)
    cleanUrl.searchParams.delete('join')
    window.history.replaceState({}, '', cleanUrl.toString())
  }, [urlJoinCode])

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  const loadListState = useCallback(async (listId: string) => {
    if (!supabase) {
      return
    }

    const [listResult, itemsResult, membersResult] = await Promise.all([
      supabase
        .from('shopping_lists')
        .select('id, invite_code, name, owner_id')
        .eq('id', listId)
        .single(),
      supabase
        .from('shopping_items')
        .select('id, list_id, text, checked, updated_at')
        .eq('list_id', listId)
        .order('updated_at', { ascending: false }),
      supabase.from('list_members').select('user_id').eq('list_id', listId),
    ])

    if (listResult.error || !listResult.data || itemsResult.error || !itemsResult.data) {
      const cached = getCachedState(listId)
      if (cached) {
        setActiveList(cached.list)
        setItems(cached.items)
        setMemberCount(cached.memberCount)
      }
      return
    }

    const nextList = listResult.data as ShoppingList
    const nextItems = itemsResult.data as ShoppingItem[]
    const nextMemberCount =
      !membersResult.error && membersResult.data ? Math.max(1, membersResult.data.length) : 1

    setActiveList(nextList)
    setItems(nextItems)
    setMemberCount(nextMemberCount)
    localStorage.setItem(
      STORAGE_SESSION,
      JSON.stringify({
        listId: nextList.id,
        listName: nextList.name,
        inviteCode: nextList.invite_code,
      }),
    )
    setCachedState({ list: nextList, items: nextItems, memberCount: nextMemberCount })
  }, [])

  const flushPendingOperations = useCallback(async () => {
    if (!supabase || !activeList || !isOnline) {
      return
    }

    const queue = getPendingQueue(activeList.id)
    if (queue.length === 0) {
      return
    }

    const remaining: PendingOperation[] = []

    for (const operation of queue) {
      if (operation.type === 'add') {
        const { error } = await supabase.from('shopping_items').insert({
          list_id: activeList.id,
          text: operation.text,
          checked: operation.checked,
        })
        if (error) {
          remaining.push(operation)
          break
        }
      }

      if (operation.type === 'toggle') {
        if (operation.itemId.startsWith('local-')) {
          continue
        }
        const { error } = await supabase
          .from('shopping_items')
          .update({ checked: operation.checked })
          .eq('id', operation.itemId)
        if (error) {
          remaining.push(operation)
          break
        }
      }

      if (operation.type === 'remove') {
        if (operation.itemId.startsWith('local-')) {
          continue
        }
        const { error } = await supabase.from('shopping_items').delete().eq('id', operation.itemId)
        if (error) {
          remaining.push(operation)
          break
        }
      }

      if (operation.type === 'edit') {
        if (operation.itemId.startsWith('local-')) {
          continue
        }
        const { error } = await supabase
          .from('shopping_items')
          .update({ text: operation.text })
          .eq('id', operation.itemId)
        if (error) {
          remaining.push(operation)
          break
        }
      }

      if (operation.type === 'rename') {
        const { error } = await supabase
          .from('shopping_lists')
          .update({ name: operation.name })
          .eq('id', activeList.id)
        if (error) {
          remaining.push(operation)
          break
        }
      }
    }

    setPendingQueue(activeList.id, remaining)
    await loadListState(activeList.id)
  }, [activeList, isOnline, loadListState])

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setAuthLoading(false)
      return
    }

    const client = supabase

    let cancelled = false

    const initAuth = async () => {
      const { data: sessionData } = await client.auth.getSession()

      if (!sessionData.session) {
        const anonymousSignInResult = await client.auth.signInAnonymously()
        if (anonymousSignInResult.error && !cancelled) {
          setErrorText(textByLanguage[language].authSetup)
          setShowAuthRetry(true)
          setAuthLoading(false)
          return
        }
      }

      const { data } = await client.auth.getUser()
      if (!cancelled) {
        setAuthUser(data.user)
        if (!data.user) {
          setErrorText(textByLanguage[language].authSetup)
          setShowAuthRetry(true)
        } else {
          setErrorText('')
          setShowAuthRetry(false)
        }
        setAuthLoading(false)
      }
    }

    void initAuth()

    const { data: authSubscription } = client.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null)
    })

    return () => {
      cancelled = true
      authSubscription.subscription.unsubscribe()
    }
  }, [authRetryTick, language])

  useEffect(() => {
    if (!activeList?.id) {
      return
    }
    const cached = getCachedState(activeList.id)
    if (cached) {
      setItems(cached.items)
      setMemberCount(cached.memberCount)
      setActiveList(cached.list)
    }
  }, [activeList?.id])

  useEffect(() => {
    if (!supabase || !activeList?.id) {
      if (channelRef.current) {
        const client = supabase
        if (client) {
          void client.removeChannel(channelRef.current)
        }
        channelRef.current = null
      }
      return
    }

    const client = supabase

    const channel = client
      .channel(`list-${activeList.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shopping_items',
          filter: `list_id=eq.${activeList.id}`,
        },
        () => {
          void loadListState(activeList.id)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_lists', filter: `id=eq.${activeList.id}` },
        () => {
          void loadListState(activeList.id)
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'list_members',
          filter: `list_id=eq.${activeList.id}`,
        },
        () => {
          void loadListState(activeList.id)
        },
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        void client.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [activeList?.id, loadListState])

  useEffect(() => {
    if (!activeList?.id) {
      return
    }
    void loadListState(activeList.id)
  }, [activeList?.id, loadListState])

  useEffect(() => {
    void flushPendingOperations()
  }, [flushPendingOperations, isOnline])

  const sortedItems = useMemo(
    () =>
      [...items].sort((left, right) => {
        if (left.checked !== right.checked) {
          return Number(left.checked) - Number(right.checked)
        }
        return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
      }),
    [items],
  )

  const inviteLink = useMemo(() => {
    if (!activeList) {
      return ''
    }
    const inviteUrl = new URL(window.location.href)
    inviteUrl.searchParams.set('join', activeList.invite_code)
    inviteUrl.hash = ''
    return inviteUrl.toString()
  }, [activeList])

  const peerLabel = useMemo(
    () => (memberCount <= 1 ? t.youOnly : `${memberCount} ${t.membersConnected}`),
    [memberCount, t],
  )

  const copyToClipboard = useCallback(async (value: string, key: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else if (!copyWithFallback(value)) {
        return
      }
    } catch {
      if (!copyWithFallback(value)) {
        return
      }
    }

    setCopied(key)
    setTimeout(() => setCopied(''), 1400)
  }, [])

  const handleCreate = useCallback(async () => {
    if (!supabase) {
      return
    }

    const trimmedList = listName.trim()
    if (!trimmedList) {
      return
    }

    if (!isOnline) {
      setErrorText(t.saveFailed)
      return
    }

    setErrorText('')

    let currentUser = authUser
    if (!currentUser) {
      const { data } = await supabase.auth.getUser()
      currentUser = data.user
    }

    if (!currentUser) {
      const anonymousSignInResult = await supabase.auth.signInAnonymously()
      if (anonymousSignInResult.error || !anonymousSignInResult.data.user) {
        setErrorText(t.authSetup)
        setShowAuthRetry(true)
        return
      }
      currentUser = anonymousSignInResult.data.user
      setAuthUser(currentUser)
    }

    let inviteCode = createInviteCode()

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { data, error } = await supabase.rpc('create_list', {
        invite_code_input: inviteCode,
        name_input: trimmedList,
        display_name_input: userName.trim() || null,
      })

      if (!error && data && Array.isArray(data) && data.length > 0) {
        setActiveList(data[0] as ShoppingList)
        return
      }

      if (error?.code && error.code !== '23505') {
        break
      }

      inviteCode = createInviteCode()
    }

    setErrorText(t.saveFailed)
  }, [authUser, isOnline, listName, t, userName])

  const handleJoin = useCallback(async () => {
    if (!supabase) {
      return
    }

    const trimmedCode = joinCode.trim().toUpperCase()
    if (!trimmedCode) {
      return
    }

    if (!isOnline) {
      setErrorText(t.joinFailed)
      return
    }

    setErrorText('')

    const { data, error } = await supabase.rpc('join_list_by_code', {
      invite_code_input: trimmedCode,
      display_name_input: userName.trim() || null,
    })

    if (error || !data || !Array.isArray(data) || data.length === 0) {
      setErrorText(t.joinFailed)
      return
    }

    const joined = data[0] as ShoppingList
    setActiveList(joined)
  }, [isOnline, joinCode, t, userName])

  const addItem = useCallback(async () => {
    if (!supabase || !activeList) {
      return
    }

    const trimmed = newItemText.trim()
    if (!trimmed) {
      return
    }

    setErrorText('')

    if (!isOnline) {
      const now = new Date().toISOString()
      const localItem: ShoppingItem = {
        id: createLocalId(),
        list_id: activeList.id,
        text: trimmed,
        checked: false,
        updated_at: now,
      }
      setItems((current) => [localItem, ...current])
      enqueueOperation(activeList.id, { type: 'add', text: trimmed, checked: false })
      setNewItemText('')
      setErrorText(t.offlineQueued)
      return
    }

    const { error, data } = await supabase
      .from('shopping_items')
      .insert({
        list_id: activeList.id,
        text: trimmed,
        checked: false,
      })
      .select()

    if (!error && data && data.length > 0) {
      const serverItem = data[0] as ShoppingItem
      setItems((current) => {
        // Avoid duplicate if realtime already delivered it
        if (current.some((i) => i.id === serverItem.id)) {
          return current
        }
        return [serverItem, ...current]
      })
      setNewItemText('')
      return
    }

    if (!error) {
      // Insert succeeded but no data returned — force refetch
      void loadListState(activeList.id)
      setNewItemText('')
      return
    }

    setErrorText(t.saveFailed)
  }, [activeList, isOnline, newItemText, t, loadListState])

  const toggleItem = useCallback(
    async (item: ShoppingItem) => {
      if (!supabase || !activeList) {
        return
      }

      const nextChecked = !item.checked
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, checked: nextChecked } : entry)),
      )

      if (!isOnline || item.id.startsWith('local-')) {
        enqueueOperation(activeList.id, { type: 'toggle', itemId: item.id, checked: nextChecked })
        setErrorText(t.offlineQueued)
        return
      }

      const { error } = await supabase
        .from('shopping_items')
        .update({ checked: nextChecked })
        .eq('id', item.id)

      if (error) {
        setErrorText(t.saveFailed)
        await loadListState(activeList.id)
      }
    },
    [activeList, isOnline, loadListState, t],
  )

  const removeItem = useCallback(
    async (id: string) => {
      if (!supabase || !activeList) {
        return
      }

      setItems((current) => current.filter((item) => item.id !== id))

      if (!isOnline || id.startsWith('local-')) {
        enqueueOperation(activeList.id, { type: 'remove', itemId: id })
        setErrorText(t.offlineQueued)
        return
      }

      const { error } = await supabase.from('shopping_items').delete().eq('id', id)
      if (error) {
        setErrorText(t.saveFailed)
        await loadListState(activeList.id)
      }
    },
    [activeList, isOnline, loadListState, t],
  )

  const editItem = useCallback(
    async (id: string, text: string) => {
      if (!supabase || !activeList) {
        return
      }

      const trimmed = text.trim()
      if (!trimmed) {
        return
      }

      const now = new Date().toISOString()
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                text: trimmed,
                updated_at: now,
              }
            : item,
        ),
      )

      if (!isOnline || id.startsWith('local-')) {
        enqueueOperation(activeList.id, { type: 'edit', itemId: id, text: trimmed })
        setErrorText(t.offlineQueued)
        return
      }

      const { error } = await supabase.from('shopping_items').update({ text: trimmed }).eq('id', id)
      if (error) {
        setErrorText(t.saveFailed)
        await loadListState(activeList.id)
      }
    },
    [activeList, isOnline, loadListState, t],
  )

  const renameList = useCallback(async () => {
    if (!supabase || !activeList) {
      return
    }

    const trimmed = listRename.trim()
    if (!trimmed) {
      return
    }

    setActiveList((current) => (current ? { ...current, name: trimmed } : current))

    if (!isOnline) {
      enqueueOperation(activeList.id, { type: 'rename', name: trimmed })
      setListRename('')
      setErrorText(t.offlineQueued)
      return
    }

    const { error } = await supabase.from('shopping_lists').update({ name: trimmed }).eq('id', activeList.id)

    if (!error) {
      setListRename('')
      return
    }

    setErrorText(t.saveFailed)
    await loadListState(activeList.id)
  }, [activeList, isOnline, listRename, loadListState, t])

  const resetApp = useCallback(() => {
    startTransition(() => {
      setActiveList(null)
      setItems([])
      setNewItemText('')
      localStorage.removeItem(STORAGE_SESSION)
    })
  }, [])

  const requestInstall = useCallback(async () => {
    if (!installPrompt) {
      return
    }

    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }, [installPrompt])

  const handleSubmitOnboarding = useCallback(() => {
    if (mode === 'create') {
      void handleCreate()
      return
    }
    void handleJoin()
  }, [handleCreate, handleJoin, mode])

  const retryAuth = useCallback(() => {
    setErrorText('')
    setShowAuthRetry(false)
    setAuthLoading(true)
    setAuthUser(null)
    setAuthRetryTick((value) => value + 1)
  }, [])

  const toggleLanguage = useCallback(() => {
    setLanguage((current) => (current === 'en' ? 'he' : 'en'))
  }, [])

  return {
    hasSupabaseConfig,
    t,
    isRtl,
    mode,
    setMode,
    userName,
    setUserName,
    listName,
    setListName,
    joinCode,
    setJoinCode,
    errorText,
    showAuthRetry,
    activeList,
    peerLabel,
    copied,
    inviteLink,
    sortedItems,
    newItemText,
    setNewItemText,
    listRename,
    setListRename,
    installVisible: Boolean(installPrompt),
    isPending,
    authLoading,
    onToggleLanguage: toggleLanguage,
    onRetryAuth: retryAuth,
    onSubmitOnboarding: handleSubmitOnboarding,
    onCopy: copyToClipboard,
    onAddItem: addItem,
    onToggleItem: toggleItem,
    onEditItem: editItem,
    onRemoveItem: removeItem,
    onRenameList: renameList,
    onInstall: requestInstall,
    onLeaveList: resetApp,
  }
}
