import Foundation

struct ShoppingList: Identifiable, Codable, Equatable {
    let id: String
    let inviteCode: String
    var name: String
    let ownerId: String

    enum CodingKeys: String, CodingKey {
        case id
        case inviteCode = "invite_code"
        case name
        case ownerId = "owner_id"
    }
}
