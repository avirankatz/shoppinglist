import SwiftUI

struct ShoppingListView: View {
    @EnvironmentObject var viewModel: ShoppingViewModel
    @State private var showSettings = false
    @FocusState private var isAddFieldFocused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Add item bar
                addItemBar

                // Item list
                List {
                    if !viewModel.uncheckedItems.isEmpty {
                        Section {
                            ForEach(viewModel.uncheckedItems) { item in
                                ItemRowView(item: item)
                            }
                        }
                    }

                    if !viewModel.checkedItems.isEmpty {
                        Section {
                            ForEach(viewModel.checkedItems) { item in
                                ItemRowView(item: item)
                            }
                        } header: {
                            Text("Completed")
                        }
                    }

                    if viewModel.items.isEmpty {
                        Section {
                            VStack(spacing: 12) {
                                Image(systemName: "basket")
                                    .font(.largeTitle)
                                    .foregroundStyle(.secondary)
                                    .symbolEffect(.pulse, options: .nonRepeating, value: viewModel.items.isEmpty)
                                Text("No items yet.\nAdd your first item above.")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                    .multilineTextAlignment(.center)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 32)
                            .listRowBackground(Color.clear)
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .refreshable {
                    await viewModel.refreshData()
                }
                .animation(.spring(response: 0.4, dampingFraction: 0.75), value: viewModel.items)
            }
            .navigationTitle(viewModel.activeList?.name ?? "Shopping List")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Text(viewModel.memberLabel)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .sheet(isPresented: $showSettings) {
                SettingsView()
            }
            .alert("Error", isPresented: .init(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.errorMessage = nil } }
            )) {
                Button("OK") { viewModel.errorMessage = nil }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
        }
    }

    private var addItemBar: some View {
        HStack(spacing: 8) {
            TextField("Add an item...", text: $viewModel.newItemText)
                .textFieldStyle(.roundedBorder)
                .focused($isAddFieldFocused)
                .submitLabel(.done)
                .onSubmit {
                    Task { await viewModel.addItem() }
                }

            Button {
                Task { await viewModel.addItem() }
                isAddFieldFocused = true
            } label: {
                Image(systemName: "plus.circle.fill")
                    .font(.title2)
                    .foregroundStyle(.green)
                    .scaleEffect(viewModel.newItemText.trimmingCharacters(in: .whitespaces).isEmpty ? 1.0 : 1.1)
                    .animation(.spring(response: 0.3, dampingFraction: 0.6), value: viewModel.newItemText.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .disabled(viewModel.newItemText.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.bar)
    }
}
