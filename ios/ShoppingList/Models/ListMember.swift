import Foundation

struct ListMember: Codable {
    let listId: String
    let userId: String
    let role: String
    let displayName: String?

    enum CodingKeys: String, CodingKey {
        case listId = "list_id"
        case userId = "user_id"
        case role
        case displayName = "display_name"
    }
}
