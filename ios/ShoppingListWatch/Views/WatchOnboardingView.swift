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

                    HStack(spacing: 0) {
                        ForEach([Mode.create, Mode.join], id: \.self) { m in
                            Button {
                                withAnimation(.easeInOut(duration: 0.2)) { mode = m }
                            } label: {
                                Text(m == .create ? "Create" : "Join")
                                    .font(.footnote.weight(.semibold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 8)
                                    .background(mode == m ? Color.green : Color.clear)
                                    .foregroundStyle(mode == m ? .black : .secondary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .background(Color.white.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 10))

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
                            Text(LocalizedStringKey(mode == .create ? "Create" : "Join"))
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
