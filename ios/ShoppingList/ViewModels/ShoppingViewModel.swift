import Foundation
import Supabase

/// Shared view model for both iOS and watchOS targets.
/// Manages shopping list state, authentication, and Supabase sync.
@MainActor
final class ShoppingViewModel: ObservableObject {
    // MARK: - Published State

    @Published var activeList: ShoppingList?
    @Published var items: [ShoppingItem] = []
    @Published var memberCount: Int = 1
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?

    // Onboarding
    @Published var userName: String = ""
    @Published var listName: String = "Our Family List"
    @Published var joinCode: String = ""

    // Item input
    @Published var newItemText: String = ""

    private let service = SupabaseService.shared
    private var realtimeChannel: RealtimeChannelV2?

    // MARK: - Computed Properties

    var hasValidConfig: Bool { service.hasValidConfig }

    var sortedItems: [ShoppingItem] {
        let unchecked = items
            .filter { !$0.checked }
            .sorted { $0.updatedAt > $1.updatedAt }
        let checked = items
            .filter { $0.checked }
            .sorted { $0.updatedAt > $1.updatedAt }
        return unchecked + checked
    }

    var uncheckedItems: [ShoppingItem] {
        items.filter { !$0.checked }
    }

    var checkedItems: [ShoppingItem] {
        items.filter { $0.checked }.sorted { $0.updatedAt > $1.updatedAt }
    }

    var memberLabel: String {
        memberCount <= 1 ? "You only" : "\(memberCount) members"
    }

    var inviteCode: String {
        activeList?.inviteCode ?? ""
    }

    // MARK: - Persistence

    private let listIdKey = "shoppinglist.activeListId"
    private let listNameKey = "shoppinglist.activeListName"
    private let inviteCodeKey = "shoppinglist.activeInviteCode"
    private let userNameKey = "shoppinglist.userName"

    func restoreSession() {
        userName = UserDefaults.standard.string(forKey: userNameKey) ?? ""

        guard let listId = UserDefaults.standard.string(forKey: listIdKey),
              let name = UserDefaults.standard.string(forKey: listNameKey),
              let code = UserDefaults.standard.string(forKey: inviteCodeKey) else {
            return
        }
        activeList = ShoppingList(id: listId, inviteCode: code, name: name, ownerId: "")
    }

    private func saveSession() {
        guard let list = activeList else { return }
        UserDefaults.standard.set(list.id, forKey: listIdKey)
        UserDefaults.standard.set(list.name, forKey: listNameKey)
        UserDefaults.standard.set(list.inviteCode, forKey: inviteCodeKey)
        UserDefaults.standard.set(userName, forKey: userNameKey)
    }

    private func clearSession() {
        UserDefaults.standard.removeObject(forKey: listIdKey)
        UserDefaults.standard.removeObject(forKey: listNameKey)
        UserDefaults.standard.removeObject(forKey: inviteCodeKey)
    }

    // MARK: - Authentication & List Creation

    func createList() async {
        let trimmedName = listName.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty else { return }

        isLoading = true
        errorMessage = nil

        do {
            _ = try await service.ensureAuthenticated()

            var lastError: Error?
            for _ in 0..<4 {
                let code = SupabaseService.createInviteCode()
                do {
                    let list = try await service.createList(
                        inviteCode: code,
                        name: trimmedName,
                        displayName: userName.isEmpty ? nil : userName
                    )
                    activeList = list
                    saveSession()
                    await loadListData()
                    await subscribeToChanges()
                    isLoading = false
                    return
                } catch {
                    lastError = error
                    continue
                }
            }
            errorMessage = lastError?.localizedDescription ?? "Could not create list."
        } catch {
            errorMessage = "Authentication failed. Please try again."
        }

        isLoading = false
    }

    func joinList() async {
        let trimmedCode = joinCode.trimmingCharacters(in: .whitespaces).uppercased()
        guard !trimmedCode.isEmpty else { return }

        isLoading = true
        errorMessage = nil

        do {
            _ = try await service.ensureAuthenticated()
            let list = try await service.joinList(
                inviteCode: trimmedCode,
                displayName: userName.isEmpty ? nil : userName
            )
            activeList = list
            saveSession()
            await loadListData()
            await subscribeToChanges()
        } catch {
            errorMessage = "Could not join list. Check the invite code."
        }

        isLoading = false
    }

    func leaveList() {
        unsubscribe()
        activeList = nil
        items = []
        memberCount = 1
        clearSession()
    }

    // MARK: - Data Loading

    func loadListData() async {
        guard let listId = activeList?.id else { return }

        do {
            async let fetchedItems = service.fetchItems(listId: listId)
            async let fetchedCount = service.fetchMemberCount(listId: listId)
            async let fetchedList = service.fetchList(id: listId)

            let (newItems, count, list) = try await (fetchedItems, fetchedCount, fetchedList)
            items = newItems
            memberCount = count
            activeList = list
            saveSession()
        } catch {
            // Keep existing data on error
        }
    }

    func refreshData() async {
        await loadListData()
    }

    // MARK: - Item Actions

    func addItem() async {
        guard let listId = activeList?.id else { return }
        let trimmed = newItemText.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }

        // Optimistic update
        let localItem = ShoppingItem(
            id: "local-\(UUID().uuidString)",
            listId: listId,
            text: trimmed,
            checked: false,
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )
        items.insert(localItem, at: 0)
        newItemText = ""

        do {
            let serverItem = try await service.addItem(listId: listId, text: trimmed)
            if let index = items.firstIndex(where: { $0.id == localItem.id }) {
                items[index] = serverItem
            }
        } catch {
            items.removeAll { $0.id == localItem.id }
            errorMessage = "Could not add item."
        }
    }

    func toggleItem(_ item: ShoppingItem) async {
        guard activeList != nil else { return }
        let newChecked = !item.checked

        // Optimistic update
        if let index = items.firstIndex(where: { $0.id == item.id }) {
            items[index].checked = newChecked
        }

        do {
            try await service.toggleItem(id: item.id, checked: newChecked)
        } catch {
            // Revert on failure
            if let index = items.firstIndex(where: { $0.id == item.id }) {
                items[index].checked = item.checked
            }
            errorMessage = "Could not update item."
        }
    }

    func editItem(_ item: ShoppingItem, newText: String) async {
        let trimmed = newText.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, activeList != nil else { return }

        // Optimistic update
        if let index = items.firstIndex(where: { $0.id == item.id }) {
            items[index].text = trimmed
        }

        do {
            try await service.editItem(id: item.id, text: trimmed)
        } catch {
            // Revert on failure
            if let index = items.firstIndex(where: { $0.id == item.id }) {
                items[index].text = item.text
            }
            errorMessage = "Could not edit item."
        }
    }

    func removeItem(_ item: ShoppingItem) async {
        guard activeList != nil else { return }

        // Optimistic update
        let removedItem = item
        items.removeAll { $0.id == item.id }

        do {
            try await service.removeItem(id: item.id)
        } catch {
            // Revert on failure
            items.append(removedItem)
            errorMessage = "Could not delete item."
        }
    }

    func clearCompleted() async {
        guard let listId = activeList?.id else { return }
        let removed = items.filter { $0.checked }
        items.removeAll { $0.checked }
        do {
            try await service.clearCheckedItems(listId: listId)
        } catch {
            items.append(contentsOf: removed)
            errorMessage = "Could not clear completed items."
        }
    }

    func uncheckAll() async {
        guard activeList != nil else { return }
        let previous = items
        for i in items.indices { items[i].checked = false }
        do {
            try await service.uncheckAllItems(listId: activeList!.id)
        } catch {
            items = previous
            errorMessage = "Could not reset list."
        }
    }

    func moveUncheckedItem(from source: IndexSet, to destination: Int) {
        var unchecked = items.filter { !$0.checked }
        let checked = items.filter { $0.checked }
        unchecked.move(fromOffsets: source, toOffset: destination)
        items = unchecked + checked
    }

    func renameList(_ newName: String) async {
        let trimmed = newName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, let list = activeList else { return }

        activeList?.name = trimmed

        do {
            try await service.renameList(id: list.id, name: trimmed)
            saveSession()
        } catch {
            activeList?.name = list.name
            errorMessage = "Could not rename list."
        }
    }

    // MARK: - Real-time Subscriptions

    func subscribeToChanges() async {
        guard let listId = activeList?.id else { return }
        unsubscribe()

        let channel = service.client.realtimeV2.channel("list-\(listId)")

        let itemChanges = channel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "shopping_items",
            filter: "list_id=eq.\(listId)"
        )

        let listChanges = channel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "shopping_lists",
            filter: "id=eq.\(listId)"
        )

        let memberChanges = channel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "list_members",
            filter: "list_id=eq.\(listId)"
        )

        await channel.subscribe()
        realtimeChannel = channel

        // Listen for changes in background tasks
        Task { [weak self] in
            for await _ in itemChanges {
                await self?.loadListData()
            }
        }

        Task { [weak self] in
            for await _ in listChanges {
                await self?.loadListData()
            }
        }

        Task { [weak self] in
            for await _ in memberChanges {
                await self?.loadListData()
            }
        }
    }

    func unsubscribe() {
        if let channel = realtimeChannel {
            Task {
                await service.client.realtimeV2.removeChannel(channel)
            }
            realtimeChannel = nil
        }
    }

    // MARK: - Lifecycle

    func onAppear() async {
        restoreSession()
        if activeList != nil {
            await loadListData()
            await subscribeToChanges()
        }
    }
}
