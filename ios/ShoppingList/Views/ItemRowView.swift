import SwiftUI

struct ItemRowView: View {
    @EnvironmentObject var viewModel: ShoppingViewModel
    let item: ShoppingItem
    @State private var isEditing = false
    @State private var editText: String = ""

    var body: some View {
        if isEditing {
            editView
        } else {
            displayView
        }
    }

    private var displayView: some View {
        HStack(spacing: 12) {
            Button {
                Task { await viewModel.toggleItem(item) }
            } label: {
                Image(systemName: item.checked ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(item.checked ? .green : .secondary)
            }
            .buttonStyle(.plain)

            Text(item.text)
                .strikethrough(item.checked)
                .foregroundStyle(item.checked ? .secondary : .primary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
                .onTapGesture {
                    editText = item.text
                    isEditing = true
                }
        }
        .swipeActions(edge: .trailing) {
            Button(role: .destructive) {
                Task { await viewModel.removeItem(item) }
            } label: {
                Label("Delete", systemImage: "trash")
            }

            Button {
                editText = item.text
                isEditing = true
            } label: {
                Label("Edit", systemImage: "pencil")
            }
            .tint(.orange)
        }
    }

    private var editView: some View {
        HStack(spacing: 8) {
            TextField("Item name", text: $editText)
                .textFieldStyle(.roundedBorder)
                .submitLabel(.done)
                .onSubmit { saveEdit() }

            Button("Save") { saveEdit() }
                .font(.subheadline.bold())
                .foregroundStyle(.green)

            Button("Cancel") { isEditing = false }
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private func saveEdit() {
        let trimmed = editText.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        Task { await viewModel.editItem(item, newText: trimmed) }
        isEditing = false
    }
}
