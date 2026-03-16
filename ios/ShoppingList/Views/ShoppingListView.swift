import SwiftUI

struct ShoppingListView: View {
    @EnvironmentObject var viewModel: ShoppingViewModel
    @State private var showSettings = false
    @State private var newItemText: String = ""
    @FocusState private var isAddFieldFocused: Bool

    var body: some View {
        NavigationStack {
            List {
                if !viewModel.uncheckedItems.isEmpty {
                    Section {
                        ForEach(viewModel.uncheckedItems) { item in
                            ItemRowView(item: item,
                                        onToggle: { await viewModel.toggleItem(item) },
                                        onDelete: { await viewModel.removeItem(item) },
                                        onEdit:   { await viewModel.editItem(item, newText: $0) })
                                .transition(.asymmetric(
                                    insertion: .move(edge: .top).combined(with: .opacity),
                                    removal: .move(edge: .bottom).combined(with: .opacity)
                                ))
                                .deleteDisabled(true)
                        }
                        .onMove { viewModel.moveUncheckedItem(from: $0, to: $1) }
                    } header: {
                        Text("Items")
                            .textCase(nil)
                            .font(.subheadline.weight(.medium))
                    }
                }

                if !viewModel.checkedItems.isEmpty {
                    Section {
                        ForEach(viewModel.checkedItems) { item in
                            ItemRowView(item: item,
                                        onToggle: { await viewModel.toggleItem(item) },
                                        onDelete: { await viewModel.removeItem(item) },
                                        onEdit:   { await viewModel.editItem(item, newText: $0) })
                                .transition(.asymmetric(
                                    insertion: .move(edge: .top).combined(with: .opacity),
                                    removal: .move(edge: .top).combined(with: .opacity)
                                ))
                                .deleteDisabled(true)
                                .moveDisabled(true)
                        }
                    } header: {
                        Text("Completed")
                            .textCase(nil)
                            .font(.subheadline.weight(.medium))
                    }
                }

                if viewModel.items.isEmpty {
                    Section {
                        VStack(spacing: 12) {
                            Image(systemName: "basket")
                                .font(.largeTitle)
                                .foregroundStyle(.secondary)
                                .symbolEffect(.pulse, options: .nonRepeating, value: viewModel.items.isEmpty)
                            Text("No items yet.\nType below to add your first item.")
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
            .scrollDismissesKeyboard(.immediately)
            .environment(\.editMode, .constant(.active))
            .refreshable {
                await viewModel.refreshData()
            }
            .animation(.spring(response: 0.38, dampingFraction: 0.72), value: viewModel.uncheckedItems.map(\.id))
            .animation(.spring(response: 0.38, dampingFraction: 0.72), value: viewModel.checkedItems.map(\.id))
            .safeAreaInset(edge: .bottom, spacing: 0) {
                addItemBar
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
                    Menu {
                        if !viewModel.checkedItems.isEmpty {
                            Button(role: .destructive) {
                                Task { await viewModel.clearCompleted() }
                            } label: {
                                Label("Clear Completed", systemImage: "trash")
                            }
                            Button {
                                Task { await viewModel.uncheckAll() }
                            } label: {
                                Label("Uncheck All", systemImage: "arrow.counterclockwise")
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    .disabled(viewModel.checkedItems.isEmpty)
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
        HStack(spacing: 10) {
            TextField("Add an item...", text: $newItemText)
                .focused($isAddFieldFocused)
                .submitLabel(.done)
                .onSubmit {
                    let text = newItemText
                    newItemText = ""
                    Task { await viewModel.addItem(text: text) }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 9)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Color(UIColor.systemBackground).opacity(0.6))
                        .stroke(Color(UIColor.separator).opacity(0.3), lineWidth: 0.5)
                )

            Button {
                let text = newItemText
                newItemText = ""
                Task { await viewModel.addItem(text: text) }
                isAddFieldFocused = true
            } label: {
                let isEmpty = newItemText.trimmingCharacters(in: .whitespaces).isEmpty
                Image(systemName: "plus")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(Color.green.opacity(isEmpty ? 0.3 : 1.0))
                            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isEmpty)
                    )
            }
            .buttonStyle(.plain)
            .disabled(newItemText.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
        .background(
            UnevenRoundedRectangle(
                topLeadingRadius: 20, bottomLeadingRadius: 0,
                bottomTrailingRadius: 0, topTrailingRadius: 20,
                style: .continuous
            )
            .fill(Color(UIColor.systemBackground).opacity(0.45))
        )
        .overlay(alignment: .top) {
            RoundedRectangle(cornerRadius: 0.5)
                .fill(Color(UIColor.separator).opacity(0.4))
                .frame(height: 0.5)
        }
        .shadow(color: .black.opacity(0.06), radius: 16, y: -4)
    }
}
