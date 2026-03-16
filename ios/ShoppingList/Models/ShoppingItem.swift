import Foundation

struct ShoppingItem: Identifiable, Codable, Equatable {
    let id: String
    let listId: String
    var text: String
    var checked: Bool
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case listId = "list_id"
        case text
        case checked
        case updatedAt = "updated_at"
    }
}
