import { AnimatePresence, motion } from 'framer-motion'
import {
  Copy,
  Link2,
  LoaderCircle,
  Plus,
  Share2,
  Smartphone,
  Trash2,
  Users,
  Wifi,
} from 'lucide-react'
import { joinRoom } from 'trystero/torrent'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Checkbox } from './components/ui/checkbox'
import { Input } from './components/ui/input'

type AppMode = 'create' | 'join'

type ShoppingItem = {
  id: string
  text: string
  checked: boolean
  updatedAt: number
  updatedBy: string
}

type ShoppingDoc = {
  listId: string
  listName: string
  listNameUpdatedAt: number
  items: Record<string, ShoppingItem>
  tombstones: Record<string, number>
  updatedAt: number
}

type Session = {
  actorId: string
  userName: string
  listId: string
  listName: string
  inviteCode: string
  role: 'owner' | 'member'
}

type SyncOp =
  | {
      type: 'upsert'
      item: ShoppingItem
      ts: number
      opId: string
    }
  | {
      type: 'toggle'
      id: string
      checked: boolean
      ts: number
      opId: string
      actorId: string
    }
  | {
      type: 'remove'
      id: string
      ts: number
      opId: string
    }
  | {
      type: 'rename'
      listName: string
      ts: number
      opId: string
    }

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type Language = 'en' | 'he'

const STORAGE_SESSION = 'family-shopping:session'
const STORAGE_DOC_PREFIX = 'family-shopping:doc:'
const STORAGE_LANG = 'family-shopping:lang'
const ROOM_CONFIG = {
  appId: 'family-shopping-p2p-v1',
  relayUrls: [
    'wss://tracker.openwebtorrent.com',
    'wss://tracker.webtorrent.dev',
    'wss://tracker.files.fm:7073/announce',
  ],
  relayRedundancy: 2,
}

const DEFAULT_LIST_NAME: Record<Language, string> = {
  en: 'Our Family List',
  he: 'רשימת המשפחה שלנו',
}

const textByLanguage = {
  en: {
    appTitle: 'Family Shopping List',
    createDescription:
      'Create a family list or join with an invite code. Sync happens directly between family devices using peer-to-peer WebRTC.',
    createTab: 'Create',
    joinTab: 'Join',
    language: 'עברית',
    yourName: 'Your name',
    yourNamePlaceholder: 'e.g. Avi',
    familyListName: 'Family list name',
    listNameOptional: 'List name (optional)',
    listNamePlaceholder: 'e.g. Katz Family',
    inviteCode: 'Invite code',
    createButton: 'Create Family List',
    joinButton: 'Join Family List',
    joinFallbackListName: 'Family Shopping List',
    welcome: 'Welcome',
    syncDescription: 'This list syncs directly between family devices.',
    youOnly: 'You only',
    devicesConnected: 'devices connected',
    p2p: 'P2P',
    inviteCodePrefix: 'Invite code:',
    shareToJoin: 'Share to let family members join.',
    copied: 'Copied',
    copyCode: 'Copy code',
    copyLink: 'Copy link',
    addItemPlaceholder: 'Add an item (milk, eggs, bread...)',
    add: 'Add',
    noItems: 'No items yet. Add your first item.',
    deleteItem: 'Delete item',
    renamePlaceholder: 'Rename this list',
    rename: 'Rename',
    addToHomescreen: 'Add to homescreen',
    linkCopied: 'Link copied',
    share: 'Share',
    leaveList: 'Leave list',
    noBackend: 'No central backend. Data sync uses WebRTC peers in your family list room.',
  },
  he: {
    appTitle: 'רשימת קניות משפחתית',
    createDescription:
      'צרו רשימה משפחתית חדשה או הצטרפו עם קוד הזמנה. הסנכרון מתבצע ישירות בין המכשירים באמצעות WebRTC.',
    createTab: 'יצירה',
    joinTab: 'הצטרפות',
    language: 'English',
    yourName: 'השם שלך',
    yourNamePlaceholder: 'למשל: אבי',
    familyListName: 'שם הרשימה המשפחתית',
    listNameOptional: 'שם הרשימה (אופציונלי)',
    listNamePlaceholder: 'למשל: משפחת כץ',
    inviteCode: 'קוד הזמנה',
    createButton: 'יצירת רשימה משפחתית',
    joinButton: 'הצטרפות לרשימה משפחתית',
    joinFallbackListName: 'רשימת קניות משפחתית',
    welcome: 'שלום',
    syncDescription: 'הרשימה מסונכרנת ישירות בין מכשירי המשפחה.',
    youOnly: 'רק את/ה',
    devicesConnected: 'מכשירים מחוברים',
    p2p: 'עמית לעמית',
    inviteCodePrefix: 'קוד הזמנה:',
    shareToJoin: 'שתפו כדי לאפשר לבני המשפחה להצטרף.',
    copied: 'הועתק',
    copyCode: 'העתקת קוד',
    copyLink: 'העתקת קישור',
    addItemPlaceholder: 'הוסיפו פריט (חלב, ביצים, לחם...)',
    add: 'הוספה',
    noItems: 'עדיין אין פריטים. הוסיפו את הפריט הראשון.',
    deleteItem: 'מחיקת פריט',
    renamePlaceholder: 'שינוי שם הרשימה',
    rename: 'שינוי שם',
    addToHomescreen: 'הוספה למסך הבית',
    linkCopied: 'הקישור הועתק',
    share: 'שיתוף',
    leaveList: 'עזיבת הרשימה',
    noBackend: 'אין שרת מרכזי. הסנכרון מתבצע בין עמיתים בחדר הרשימה המשפחתי.',
  },
} as const

const getInitialLanguage = (): Language => {
  const saved = localStorage.getItem(STORAGE_LANG)
  if (saved === 'en' || saved === 'he') {
    return saved
  }

  return navigator.language.toLowerCase().startsWith('he') ? 'he' : 'en'
}

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

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

const createInviteCode = () =>
  Array.from(crypto.getRandomValues(new Uint32Array(3)))
    .map((value) => value.toString(36).toUpperCase().slice(0, 4))
    .join('-')

const roomIdFromInvite = (inviteCode: string) => `family-list-${inviteCode.toLowerCase()}`
const listIdFromInvite = (inviteCode: string) => roomIdFromInvite(inviteCode)

const baseDoc = (listId: string, listName: string): ShoppingDoc => ({
  listId,
  listName,
  listNameUpdatedAt: Date.now(),
  items: {},
  tombstones: {},
  updatedAt: Date.now(),
})

const parseSession = (): Session | null => {
  const raw = localStorage.getItem(STORAGE_SESSION)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Session
    if (!parsed.actorId || !parsed.inviteCode || !parsed.listId || !parsed.userName) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

const parseDoc = (listId: string): ShoppingDoc | null => {
  const raw = localStorage.getItem(`${STORAGE_DOC_PREFIX}${listId}`)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as ShoppingDoc
  } catch {
    return null
  }
}

const mergeDocs = (incoming: ShoppingDoc, current: ShoppingDoc): ShoppingDoc => {
  const tombstones: Record<string, number> = { ...current.tombstones }

  for (const [id, ts] of Object.entries(incoming.tombstones)) {
    const currentTs = tombstones[id] ?? 0
    if (ts > currentTs) {
      tombstones[id] = ts
    }
  }

  const mergedItems: Record<string, ShoppingItem> = { ...current.items }

  for (const [id, item] of Object.entries(incoming.items)) {
    const tombstoneTs = tombstones[id] ?? 0
    if (tombstoneTs >= item.updatedAt) {
      continue
    }

    const existing = mergedItems[id]
    if (!existing || item.updatedAt >= existing.updatedAt) {
      mergedItems[id] = item
    }
  }

  for (const [id, item] of Object.entries(mergedItems)) {
    const tombstoneTs = tombstones[id] ?? 0
    if (tombstoneTs >= item.updatedAt) {
      delete mergedItems[id]
    }
  }

  return {
    listId: current.listId,
    listName:
      incoming.listNameUpdatedAt >= current.listNameUpdatedAt
        ? incoming.listName
        : current.listName,
    listNameUpdatedAt: Math.max(incoming.listNameUpdatedAt, current.listNameUpdatedAt),
    tombstones,
    items: mergedItems,
    updatedAt: Math.max(incoming.updatedAt, current.updatedAt),
  }
}

const applyOp = (doc: ShoppingDoc, op: SyncOp): ShoppingDoc => {
  if (op.type === 'upsert') {
    const tombstoneTs = doc.tombstones[op.item.id] ?? 0
    if (tombstoneTs >= op.item.updatedAt) {
      return doc
    }

    const existing = doc.items[op.item.id]
    if (existing && existing.updatedAt > op.item.updatedAt) {
      return doc
    }

    return {
      ...doc,
      items: { ...doc.items, [op.item.id]: op.item },
      updatedAt: Math.max(doc.updatedAt, op.ts),
    }
  }

  if (op.type === 'toggle') {
    const existing = doc.items[op.id]
    const tombstoneTs = doc.tombstones[op.id] ?? 0
    if (!existing || tombstoneTs >= op.ts || existing.updatedAt > op.ts) {
      return doc
    }

    return {
      ...doc,
      items: {
        ...doc.items,
        [op.id]: {
          ...existing,
          checked: op.checked,
          updatedAt: op.ts,
          updatedBy: op.actorId,
        },
      },
      updatedAt: Math.max(doc.updatedAt, op.ts),
    }
  }

  if (op.type === 'remove') {
    const existingTombstone = doc.tombstones[op.id] ?? 0
    if (existingTombstone >= op.ts) {
      return doc
    }

    const items = { ...doc.items }
    delete items[op.id]

    return {
      ...doc,
      items,
      tombstones: { ...doc.tombstones, [op.id]: op.ts },
      updatedAt: Math.max(doc.updatedAt, op.ts),
    }
  }

  if (op.type === 'rename') {
    if (op.ts < doc.listNameUpdatedAt) {
      return doc
    }

    return {
      ...doc,
      listName: op.listName,
      listNameUpdatedAt: op.ts,
      updatedAt: Math.max(doc.updatedAt, op.ts),
    }
  }

  return doc
}

function App() {
  const [language, setLanguage] = useState<Language>(() => getInitialLanguage())
  const [mode, setMode] = useState<AppMode>('create')
  const [session, setSession] = useState<Session | null>(() => parseSession())
  const [doc, setDoc] = useState<ShoppingDoc | null>(() => {
    const restored = parseSession()
    if (!restored) {
      return null
    }

    return parseDoc(restored.listId) ?? baseDoc(restored.listId, restored.listName)
  })

  const [userName, setUserName] = useState('')
  const [listName, setListName] = useState(() => DEFAULT_LIST_NAME[getInitialLanguage()])
  const [joinCode, setJoinCode] = useState('')
  const [newItemText, setNewItemText] = useState('')
  const [listRename, setListRename] = useState('')
  const [onlinePeers, setOnlinePeers] = useState(1)
  const [copied, setCopied] = useState('')
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isPending, startTransition] = useTransition()

  const opCounterRef = useRef(0)
  const seenOpsRef = useRef(new Set<string>())
  const docRef = useRef(doc)
  const previousLanguageRef = useRef(language)
  const peersRef = useRef(new Set<string>())
  const sendOpRef = useRef<((op: SyncOp, peerId?: string) => Promise<void[]>) | null>(null)
  const sendStateRef = useRef<
    ((state: ShoppingDoc, peerId?: string) => Promise<void[]>) | null
  >(null)

  const t = textByLanguage[language]
  const isRtl = language === 'he'

  useEffect(() => {
    docRef.current = doc
  }, [doc])

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr'
    localStorage.setItem(STORAGE_LANG, language)
  }, [isRtl, language])

  useEffect(() => {
    if (previousLanguageRef.current === language) {
      return
    }

    setListName((current) => {
      const previousDefault = DEFAULT_LIST_NAME[previousLanguageRef.current]
      if (current.trim() && current !== previousDefault) {
        return current
      }
      return DEFAULT_LIST_NAME[language]
    })

    previousLanguageRef.current = language
  }, [language])

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const prefixedJoin = query.get('join')
    if (!prefixedJoin) {
      return
    }

    setMode('join')
    setJoinCode(prefixedJoin.toUpperCase())
  }, [])

  useEffect(() => {
    if (!session) {
      return
    }

    localStorage.setItem(STORAGE_SESSION, JSON.stringify(session))
  }, [session])

  useEffect(() => {
    if (!session) {
      return
    }

    const canonicalListId = listIdFromInvite(session.inviteCode)
    if (session.listId !== canonicalListId) {
      const oldKey = `${STORAGE_DOC_PREFIX}${session.listId}`
      const newKey = `${STORAGE_DOC_PREFIX}${canonicalListId}`
      const oldDoc = localStorage.getItem(oldKey)
      if (oldDoc && !localStorage.getItem(newKey)) {
        localStorage.setItem(newKey, oldDoc)
      }
      localStorage.removeItem(oldKey)

      setSession((current) =>
        current ? { ...current, listId: canonicalListId } : current,
      )
    }

    setDoc((current) => {
      if (!current || current.listId === canonicalListId) {
        return current
      }
      return { ...current, listId: canonicalListId }
    })
  }, [session])

  useEffect(() => {
    if (!doc || !session) {
      return
    }

    localStorage.setItem(`${STORAGE_DOC_PREFIX}${session.listId}`, JSON.stringify(doc))
  }, [doc, session])

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  useEffect(() => {
    if (!session) {
      return
    }

    peersRef.current.clear()
    setOnlinePeers(1)

    const room = joinRoom(ROOM_CONFIG, roomIdFromInvite(session.inviteCode))
    const [sendOp, getOp] = room.makeAction('op')
    const [sendState, getState] = room.makeAction('state')
    sendOpRef.current = sendOp
    sendStateRef.current = sendState

    getOp((message) => {
      const op = message as SyncOp
      if (seenOpsRef.current.has(op.opId)) {
        return
      }

      seenOpsRef.current.add(op.opId)
      setDoc((current) => {
        if (!current) {
          return current
        }
        return applyOp(current, op)
      })
    })

    getState((message) => {
      const incoming = message as ShoppingDoc
      setDoc((current) => {
        if (!current || current.listId !== incoming.listId) {
          return current
        }
        return mergeDocs(incoming, current)
      })
    })

    room.onPeerJoin((peerId) => {
      peersRef.current.add(peerId)
      setOnlinePeers(1 + peersRef.current.size)
      if (docRef.current) {
        void sendState(docRef.current, peerId).catch((error) => {
          console.warn('P2P state sync to peer failed:', error)
        })
      }
    })

    room.onPeerLeave((peerId) => {
      peersRef.current.delete(peerId)
      setOnlinePeers(1 + peersRef.current.size)
    })

    if (docRef.current) {
      void sendState(docRef.current, undefined).catch((error) => {
        console.warn('Initial P2P state broadcast failed:', error)
      })
    }

    const clear = setInterval(() => {
      seenOpsRef.current.clear()
    }, 120_000)

    return () => {
      clearInterval(clear)
      sendOpRef.current = null
      sendStateRef.current = null
      peersRef.current.clear()
      room.leave()
      setOnlinePeers(1)
    }
  }, [session])

  const emitOp = useCallback((op: SyncOp) => {
    const sender = sendOpRef.current
    if (sender) {
      seenOpsRef.current.add(op.opId)
      void sender(op, undefined).catch((error) => {
        console.warn('P2P operation broadcast failed:', error)
      })
    }
  }, [])

  const sortedItems = useMemo(() => {
    if (!doc) {
      return [] as ShoppingItem[]
    }

    return [...Object.values(doc.items)].sort((left, right) => {
      if (left.checked !== right.checked) {
        return Number(left.checked) - Number(right.checked)
      }
      return right.updatedAt - left.updatedAt
    })
  }, [doc])

  const inviteLink = useMemo(() => {
    if (!session) {
      return ''
    }
    const inviteUrl = new URL(window.location.href)
    inviteUrl.searchParams.set('join', session.inviteCode)
    inviteUrl.hash = ''
    return inviteUrl.toString()
  }, [session])

  const peerLabel = onlinePeers === 1 ? t.youOnly : `${onlinePeers} ${t.devicesConnected}`

  const createOperationId = useCallback(() => {
    opCounterRef.current += 1
    return `${session?.actorId ?? 'anon'}-${opCounterRef.current}`
  }, [session?.actorId])

  const handleCreate = () => {
    const trimmedUser = userName.trim()
    const trimmedList = listName.trim()
    if (!trimmedUser || !trimmedList) {
      return
    }

    const inviteCode = createInviteCode()
    const listId = listIdFromInvite(inviteCode)
    const actorId = createId()

    const nextSession: Session = {
      actorId,
      userName: trimmedUser,
      listId,
      listName: trimmedList,
      inviteCode,
      role: 'owner',
    }

    setSession(nextSession)
    setDoc(baseDoc(listId, trimmedList))
  }

  const handleJoin = () => {
    const trimmedUser = userName.trim()
    const trimmedCode = joinCode.trim().toUpperCase()
    const trimmedList = listName.trim() || t.joinFallbackListName
    if (!trimmedUser || !trimmedCode) {
      return
    }

    const listId = listIdFromInvite(trimmedCode)
    const actorId = createId()

    const nextSession: Session = {
      actorId,
      userName: trimmedUser,
      listId,
      listName: trimmedList,
      inviteCode: trimmedCode,
      role: 'member',
    }

    setSession(nextSession)
    setDoc(parseDoc(listId) ?? baseDoc(listId, trimmedList))
  }

  const addItem = () => {
    if (!doc || !session) {
      return
    }

    const trimmed = newItemText.trim()
    if (!trimmed) {
      return
    }

    const now = Date.now()
    const item: ShoppingItem = {
      id: createId(),
      text: trimmed,
      checked: false,
      updatedAt: now,
      updatedBy: session.actorId,
    }

    const op: SyncOp = { type: 'upsert', item, ts: now, opId: createOperationId() }
    setDoc((current) => (current ? applyOp(current, op) : current))
    emitOp(op)
    setNewItemText('')
  }

  const toggleItem = (id: string, checked: boolean) => {
    if (!session) {
      return
    }
    const now = Date.now()
    const op: SyncOp = {
      type: 'toggle',
      id,
      checked,
      ts: now,
      opId: createOperationId(),
      actorId: session.actorId,
    }
    setDoc((current) => (current ? applyOp(current, op) : current))
    emitOp(op)
  }

  const removeItem = (id: string) => {
    const now = Date.now()
    const op: SyncOp = { type: 'remove', id, ts: now, opId: createOperationId() }
    setDoc((current) => (current ? applyOp(current, op) : current))
    emitOp(op)
  }

  const renameList = () => {
    const trimmed = listRename.trim()
    if (!trimmed) {
      return
    }
    const now = Date.now()
    const op: SyncOp = {
      type: 'rename',
      listName: trimmed,
      ts: now,
      opId: createOperationId(),
    }
    setDoc((current) => (current ? applyOp(current, op) : current))
    setSession((current) => (current ? { ...current, listName: trimmed } : current))
    emitOp(op)
    setListRename('')
  }

  const resetApp = () => {
    startTransition(() => {
      setSession(null)
      setDoc(null)
      setNewItemText('')
      localStorage.removeItem(STORAGE_SESSION)
    })
  }

  const copyToClipboard = async (value: string, key: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        const ok = copyWithFallback(value)
        if (!ok) {
          return
        }
      }
    } catch {
      const ok = copyWithFallback(value)
      if (!ok) {
        return
      }
    }

    setCopied(key)
    setTimeout(() => setCopied(''), 1400)
  }

  const requestInstall = async () => {
    if (!installPrompt) {
      return
    }

    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  const onboarding = (
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
          <CardDescription>
            {t.createDescription}
          </CardDescription>
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
              onClick={() => setLanguage((current) => (current === 'en' ? 'he' : 'en'))}
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

          <Button
            className="w-full"
            onClick={mode === 'create' ? handleCreate : handleJoin}
            disabled={!userName.trim() || (mode === 'join' && !joinCode.trim())}
          >
            {mode === 'create' ? t.createButton : t.joinButton}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )

  const app = (
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
              <CardTitle>{doc?.listName}</CardTitle>
              <CardDescription>
                {t.welcome}, {session?.userName}. {t.syncDescription}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3.5 w-3.5" />
                {peerLabel}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Wifi className="h-3.5 w-3.5" />
                {t.p2p}
              </Badge>
            </div>
          </div>

          <div className="grid gap-2 rounded-[var(--radius)] border bg-[var(--muted)] p-3 text-sm md:grid-cols-[1fr_auto_auto] md:items-center">
            <div>
              <p className="font-medium">
                {t.inviteCodePrefix} <span dir="ltr">{session?.inviteCode}</span>
              </p>
              <p className="text-[var(--muted-foreground)]">{t.shareToJoin}</p>
            </div>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => copyToClipboard(session?.inviteCode ?? '', 'code')}
            >
              <Copy className="h-4 w-4" />
              {copied === 'code' ? t.copied : t.copyCode}
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => copyToClipboard(inviteLink, 'link')}
            >
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
                  addItem()
                }
              }}
              placeholder={t.addItemPlaceholder}
            />
            <Button onClick={addItem} className="gap-2 sm:w-36">
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
                    <Checkbox
                      checked={item.checked}
                      onClick={() => toggleItem(item.id, !item.checked)}
                    />
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
                    onClick={() => removeItem(item.id)}
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
            <Button variant="secondary" onClick={renameList} disabled={!listRename.trim()}>
              {t.rename}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {installPrompt ? (
              <Button variant="outline" onClick={requestInstall} className="gap-2">
                <Smartphone className="h-4 w-4" />
                {t.addToHomescreen}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              className="gap-2 text-[var(--muted-foreground)]"
              onClick={() => copyToClipboard(inviteLink, 'share')}
            >
              <Share2 className="h-4 w-4" />
              {copied === 'share' ? t.linkCopied : t.share}
            </Button>
            <Button variant="destructive" className="gap-2" onClick={resetApp}>
              {isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {t.leaveList}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )

  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen px-4 py-8 md:px-6">
      <div className="mx-auto mb-6 max-w-2xl text-sm text-[var(--muted-foreground)]">
        {t.noBackend}
      </div>
      <AnimatePresence mode="wait">{session && doc ? app : onboarding}</AnimatePresence>
    </main>
  )
}

export default App
