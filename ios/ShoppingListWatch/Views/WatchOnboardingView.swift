import SwiftUI

struct WatchOnboardingView: View {
    @EnvironmentObject var viewModel: ShoppingViewModel
    @State private var mode: Mode = .create

    enum Mode {
        case create, join
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    Image(systemName: "cart.fill")
                        .font(.title2)
                        .foregroundStyle(.green)

                    Picker("Mode", selection: $mode) {
                        Text("Create").tag(Mode.create)
                        Text("Join").tag(Mode.join)
                    }
                    .pickerStyle(.segmented)

                    if mode == .create {
                        TextField("List name", text: $viewModel.listName)
                    } else {
                        TextField("Invite code", text: $viewModel.joinCode)
                            .textContentType(.oneTimeCode)
                    }

                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(.caption2)
                            .foregroundStyle(.red)
                    }

                    Button {
                        Task {
                            if mode == .create {
                                await viewModel.createList()
                            } else {
                                await viewModel.joinList()
                            }
                        }
                    } label: {
                        if viewModel.isLoading {
                            ProgressView()
                        } else {
                            Text(mode == .create ? "Create" : "Join")
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.green)
                    .disabled(viewModel.isLoading)
                }
            }
            .navigationTitle("Shopping List")
        }
    }
}
