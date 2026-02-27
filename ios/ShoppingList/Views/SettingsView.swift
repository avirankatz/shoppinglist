import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var viewModel: ShoppingViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var newListName: String = ""
    @State private var codeCopied = false
    @State private var linkCopied = false

    var body: some View {
        NavigationStack {
            List {
                // Invite code section
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Invite Code")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        Text(viewModel.inviteCode)
                            .font(.title3.monospaced().bold())

                        Text("Share this code with family members so they can join your list.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)

                    Button {
                        UIPasteboard.general.string = viewModel.inviteCode
                        codeCopied = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                            codeCopied = false
                        }
                    } label: {
                        Label(
                            codeCopied ? "Copied!" : "Copy Code",
                            systemImage: codeCopied ? "checkmark" : "doc.on.doc"
                        )
                    }

                    if let list = viewModel.activeList {
                        ShareLink(
                            item: "Join my shopping list \"\(list.name)\" with code: \(list.inviteCode)"
                        ) {
                            Label("Share Invite", systemImage: "square.and.arrow.up")
                        }
                    }
                } header: {
                    Text("Sharing")
                }

                // Rename section
                Section {
                    HStack {
                        TextField("New list name", text: $newListName)
                            .submitLabel(.done)
                            .onSubmit { renameList() }

                        Button("Rename") { renameList() }
                            .disabled(newListName.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                } header: {
                    Text("Rename List")
                }

                // Info section
                Section {
                    HStack {
                        Label("Members", systemImage: "person.2")
                        Spacer()
                        Text(viewModel.memberLabel)
                            .foregroundStyle(.secondary)
                    }

                    HStack {
                        Label("Sync", systemImage: "icloud")
                        Spacer()
                        Text("Real-time")
                            .foregroundStyle(.secondary)
                    }
                } header: {
                    Text("Info")
                }

                // Leave list
                Section {
                    Button(role: .destructive) {
                        viewModel.leaveList()
                        dismiss()
                    } label: {
                        Label("Leave List", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .onAppear {
                newListName = viewModel.activeList?.name ?? ""
            }
        }
    }

    private func renameList() {
        let trimmed = newListName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        Task { await viewModel.renameList(trimmed) }
    }
}
