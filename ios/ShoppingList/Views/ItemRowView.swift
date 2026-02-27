import SwiftUI

struct ItemRowView: View {
    @EnvironmentObject var viewModel: ShoppingViewModel
    let item: ShoppingItem
    @State private var isEditing = false
    @State private var editText: String = ""

    var body: some View {
        Group {
            if isEditing {
                editView
                    .transition(.opacity.combined(with: .scale(scale: 0.98)))
            } else {
                displayView
                    .transition(.opacity.combined(with: .scale(scale: 0.98)))
            }
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isEditing)
    }

    private var displayView: some View {
        HStack(spacing: 12) {
            Button {
                Task { await viewModel.toggleItem(item) }
            } label: {
                Image(systemName: item.checked ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(item.checked ? .green : .secondary)
                    .scaleEffect(item.checked ? 1.1 : 1.0)
                    .animation(.spring(response: 0.2, dampingFraction: 0.5), value: item.checked)
            }
            .buttonStyle(.plain)
            .sensoryFeedback(.success, trigger: item.checked)

            Text(item.text)
                .strikethrough(item.checked)
                .foregroundStyle(item.checked ? .secondary : .primary)
                .animation(.easeOut(duration: 0.2), value: item.checked)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
                .onTapGesture {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        editText = item.text
                        isEditing = true
                    }
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

            Button("Cancel") { 
                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                    isEditing = false 
                }
            }
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private func saveEdit() {
        let trimmed = editText.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        Task { await viewModel.editItem(item, newText: trimmed) }
        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
            isEditing = false
        }
    }
}
