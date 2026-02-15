export type AppMode = 'create' | 'join'

export type ShoppingItem = {
  id: string
  list_id: string
  text: string
  checked: boolean
  updated_at: string
}

export type ShoppingList = {
  id: string
  invite_code: string
  name: string
  owner_id: string
}
