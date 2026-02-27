import Foundation
import Supabase

/// Central service for all Supabase interactions including authentication,
/// CRUD operations, and real-time subscriptions.
final class SupabaseService {
    static let shared = SupabaseService()

    let client: SupabaseClient

    private init() {
        let url = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String ?? ""
        let key = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String ?? ""

        client = SupabaseClient(
            supabaseURL: URL(string: url) ?? URL(string: "https://placeholder.supabase.co")!,
            supabaseKey: key
        )
    }

    var hasValidConfig: Bool {
        let url = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String ?? ""
        let key = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String ?? ""
        return !url.isEmpty && !key.isEmpty && url != "https://change-me.supabase.co"
    }

    // MARK: - Authentication

    func signInAnonymously() async throws -> String {
        let session = try await client.auth.signInAnonymously()
        return session.user.id.uuidString
    }

    func currentUserId() async -> String? {
        try? await client.auth.session.user.id.uuidString
    }

    func ensureAuthenticated() async throws -> String {
        if let userId = await currentUserId() {
            return userId
        }
        return try await signInAnonymously()
    }

    // MARK: - List Operations

    func createList(inviteCode: String, name: String, displayName: String?) async throws -> ShoppingList {
        let params: [String: String?] = [
            "invite_code_input": inviteCode,
            "name_input": name,
            "display_name_input": displayName
        ]

        let response: [ShoppingList] = try await client
            .rpc("create_list", params: params)
            .execute()
            .value

        guard let list = response.first else {
            throw SupabaseServiceError.noData
        }
        return list
    }

    func joinList(inviteCode: String, displayName: String?) async throws -> ShoppingList {
        let params: [String: String?] = [
            "invite_code_input": inviteCode.uppercased().trimmingCharacters(in: .whitespaces),
            "display_name_input": displayName
        ]

        let response: [ShoppingList] = try await client
            .rpc("join_list_by_code", params: params)
            .execute()
            .value

        guard let list = response.first else {
            throw SupabaseServiceError.listNotFound
        }
        return list
    }

    func renameList(id: String, name: String) async throws {
        try await client
            .from("shopping_lists")
            .update(["name": name])
            .eq("id", value: id)
            .execute()
    }

    // MARK: - Item Operations

    private struct NewItem: Encodable {
        let list_id: String
        let text: String
        let checked: Bool
    }

    private struct CheckedUpdate: Encodable {
        let checked: Bool
    }

    func fetchItems(listId: String) async throws -> [ShoppingItem] {
        try await client
            .from("shopping_items")
            .select("id, list_id, text, checked, updated_at")
            .eq("list_id", value: listId)
            .order("updated_at", ascending: false)
            .execute()
            .value
    }

    func addItem(listId: String, text: String) async throws -> ShoppingItem {
        let item: [ShoppingItem] = try await client
            .from("shopping_items")
            .insert(NewItem(list_id: listId, text: text, checked: false))
            .select()
            .execute()
            .value

        guard let newItem = item.first else {
            throw SupabaseServiceError.noData
        }
        return newItem
    }

    func toggleItem(id: String, checked: Bool) async throws {
        try await client
            .from("shopping_items")
            .update(CheckedUpdate(checked: checked))
            .eq("id", value: id)
            .execute()
    }

    func editItem(id: String, text: String) async throws {
        try await client
            .from("shopping_items")
            .update(["text": text])
            .eq("id", value: id)
            .execute()
    }

    func removeItem(id: String) async throws {
        try await client
            .from("shopping_items")
            .delete()
            .eq("id", value: id)
            .execute()
    }

    // MARK: - Members

    func fetchMemberCount(listId: String) async throws -> Int {
        let members: [ListMember] = try await client
            .from("list_members")
            .select("user_id, list_id, role, display_name")
            .eq("list_id", value: listId)
            .execute()
            .value
        return max(1, members.count)
    }

    func fetchList(id: String) async throws -> ShoppingList {
        try await client
            .from("shopping_lists")
            .select("id, invite_code, name, owner_id")
            .eq("id", value: id)
            .single()
            .execute()
            .value
    }
}

// MARK: - Invite Code Generation

extension SupabaseService {
    static func createInviteCode() -> String {
        let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        func randomSegment() -> String {
            String((0..<4).map { _ in chars.randomElement()! })
        }
        return "\(randomSegment())-\(randomSegment())-\(randomSegment())"
    }
}

// MARK: - Errors

enum SupabaseServiceError: LocalizedError {
    case noData
    case listNotFound
    case notAuthenticated

    var errorDescription: String? {
        switch self {
        case .noData: return "No data returned from the server."
        case .listNotFound: return "List not found. Check the invite code."
        case .notAuthenticated: return "Not authenticated."
        }
    }
}
