import SwiftUI

struct WatchItemRowView: View {
    let item: ShoppingItem
    let onToggle: () async -> Void
    let onDelete: () async -> Void

    var body: some View {
        Button {
            Task { await onToggle() }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: item.checked ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(item.checked ? .green : .secondary)
                    .font(.body)

                Text(item.text)
                    .strikethrough(item.checked)
                    .foregroundStyle(item.checked ? .secondary : .primary)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .buttonStyle(.plain)
        .swipeActions(edge: .trailing) {
            Button(role: .destructive) {
                Task { await onDelete() }
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }
}
