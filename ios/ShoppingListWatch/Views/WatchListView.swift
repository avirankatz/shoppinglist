import SwiftUI

struct WatchListView: View {
    @EnvironmentObject var viewModel: ShoppingViewModel
    @State private var showAddItem = false

    var body: some View {
        NavigationStack {
            List {
                if viewModel.items.isEmpty {
                    Text("No items yet")
                        .foregroundStyle(.secondary)
                        .font(.footnote)
                } else {
                    ForEach(viewModel.uncheckedItems) { item in
                        WatchItemRowView(item: item)
                    }

                    if !viewModel.checkedItems.isEmpty {
                        Section("Done") {
                            ForEach(viewModel.checkedItems) { item in
                                WatchItemRowView(item: item)
                            }
                        }
                    }
                }
            }
            .navigationTitle(viewModel.activeList?.name ?? "List")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showAddItem = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }

                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        Button(role: .destructive) {
                            viewModel.leaveList()
                        } label: {
                            Label("Leave List", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .sheet(isPresented: $showAddItem) {
                WatchAddItemView()
            }
        }
    }
}

struct WatchAddItemView: View {
    @EnvironmentObject var viewModel: ShoppingViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 12) {
            TextField("New item", text: $viewModel.newItemText)

            Button("Add") {
                Task {
                    await viewModel.addItem()
                    dismiss()
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
            .disabled(viewModel.newItemText.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .navigationTitle("Add Item")
    }
}
