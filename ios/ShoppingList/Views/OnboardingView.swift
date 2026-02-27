import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject var viewModel: ShoppingViewModel
    @State private var mode: OnboardingMode = .create
    @State private var isAnimatingCart = false

    enum OnboardingMode {
        case create, join
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    VStack(spacing: 8) {
                        Image(systemName: "cart.fill")
                            .font(.system(size: 48))
                            .foregroundStyle(.green)
                            .symbolEffect(.bounce, options: .nonRepeating, value: isAnimatingCart)
                            .onAppear { isAnimatingCart = true }

                        Text("Family Shopping List")
                            .font(.title.bold())

                        Text("Create a family list or join with an invite code. Syncs in real time.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }
                    .padding(.top, 32)

                    // Mode picker
                    Picker("Mode", selection: $mode) {
                        Text("Create").tag(OnboardingMode.create)
                        Text("Join").tag(OnboardingMode.join)
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)

                    // Form
                    VStack(spacing: 16) {
                        TextField("Your name (optional)", text: $viewModel.userName)
                            .textFieldStyle(.roundedBorder)
                            .textContentType(.name)
                            .autocorrectionDisabled()

                        if mode == .create {
                            TextField("Family list name", text: $viewModel.listName)
                                .textFieldStyle(.roundedBorder)
                                .autocorrectionDisabled()
                                .transition(.move(edge: .leading).combined(with: .opacity))
                        } else {
                            TextField("Invite code", text: $viewModel.joinCode)
                                .textFieldStyle(.roundedBorder)
                                .textContentType(.oneTimeCode)
                                .autocapitalization(.allCharacters)
                                .autocorrectionDisabled()
                                .transition(.move(edge: .trailing).combined(with: .opacity))
                        }
                    }
                    .padding(.horizontal)
                    .animation(.spring(response: 0.4, dampingFraction: 0.8), value: mode)

                    // Error message
                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .padding(.horizontal)
                    }

                    // Submit button
                    Button {
                        Task {
                            if mode == .create {
                                await viewModel.createList()
                            } else {
                                await viewModel.joinList()
                            }
                        }
                    } label: {
                        Group {
                            if viewModel.isLoading {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Text(mode == .create ? "Create Family List" : "Join Family List")
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(.green)
                        .foregroundStyle(.white)
                        .font(.headline)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(viewModel.isLoading)
                    .padding(.horizontal)
                }
                .padding(.bottom, 32)
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
