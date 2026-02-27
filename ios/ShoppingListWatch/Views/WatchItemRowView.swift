import SwiftUI

struct WatchItemRowView: View {
    @EnvironmentObject var viewModel: ShoppingViewModel
    let item: ShoppingItem

    var body: some View {
        Button {
            Task { await viewModel.toggleItem(item) }
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
                Task { await viewModel.removeItem(item) }
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }
}
