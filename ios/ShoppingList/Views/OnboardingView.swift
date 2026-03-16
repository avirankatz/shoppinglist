import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject var viewModel: ShoppingViewModel
    @State private var mode: OnboardingMode = .create
    @State private var isAnimatingCart = false
    @State private var heroVisible = false
    @State private var formVisible = false

    enum OnboardingMode {
        case create, join
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    // Hero section
                    VStack(spacing: 16) {
                        ZStack {
                            Circle()
                                .fill(Color.green.opacity(0.12))
                                .frame(width: 100, height: 100)
                            Circle()
                                .fill(Color.green.opacity(0.07))
                                .frame(width: 130, height: 130)
                            Image(systemName: "cart.fill")
                                .font(.system(size: 44, weight: .medium))
                                .foregroundStyle(.green)
                                .symbolEffect(.bounce, options: .nonRepeating, value: isAnimatingCart)
                        }
                        .onAppear { isAnimatingCart = true }
                        .opacity(heroVisible ? 1 : 0)
                        .scaleEffect(heroVisible ? 1 : 0.8)
                        .animation(.spring(response: 0.6, dampingFraction: 0.7).delay(0.1), value: heroVisible)

                        VStack(spacing: 6) {
                            Text("Family Shopping List")
                                .font(.title.bold())

                            Text("Create a shared list or join with an invite code.\nEverything syncs in real time.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                                .lineSpacing(3)
                        }
                        .opacity(heroVisible ? 1 : 0)
                        .offset(y: heroVisible ? 0 : 10)
                        .animation(.spring(response: 0.6, dampingFraction: 0.8).delay(0.2), value: heroVisible)
                    }
                    .padding(.top, 48)
                    .padding(.bottom, 36)
                    .padding(.horizontal)

                    // Mode picker
                    Picker("Mode", selection: $mode) {
                        Text("Create").tag(OnboardingMode.create)
                        Text("Join").tag(OnboardingMode.join)
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal, 24)
                    .opacity(formVisible ? 1 : 0)
                    .offset(y: formVisible ? 0 : 12)
                    .animation(.spring(response: 0.5, dampingFraction: 0.8).delay(0.35), value: formVisible)

                    // Form
                    VStack(spacing: 12) {
                        fieldView(
                            placeholder: "Your name (optional)",
                            text: $viewModel.userName,
                            contentType: .name
                        )

                        if mode == .create {
                            fieldView(
                                placeholder: "Family list name",
                                text: $viewModel.listName
                            )
                            .transition(.asymmetric(
                                insertion: .move(edge: .leading).combined(with: .opacity),
                                removal: .move(edge: .leading).combined(with: .opacity)
                            ))
                        } else {
                            fieldView(
                                placeholder: "Invite code",
                                text: $viewModel.joinCode,
                                contentType: .oneTimeCode,
                                caps: true
                            )
                            .transition(.asymmetric(
                                insertion: .move(edge: .trailing).combined(with: .opacity),
                                removal: .move(edge: .trailing).combined(with: .opacity)
                            ))
                        }
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 16)
                    .animation(.spring(response: 0.4, dampingFraction: 0.8), value: mode)
                    .opacity(formVisible ? 1 : 0)
                    .offset(y: formVisible ? 0 : 12)
                    .animation(.spring(response: 0.5, dampingFraction: 0.8).delay(0.45), value: formVisible)

                    // Error message
                    if let error = viewModel.errorMessage {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.circle.fill")
                                .font(.footnote)
                            Text(error)
                                .font(.footnote)
                        }
                        .foregroundStyle(.red)
                        .padding(.horizontal, 24)
                        .padding(.top, 8)
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
                                Text(LocalizedStringKey(mode == .create ? "Create Family List" : "Join Family List"))
                                    .font(.headline)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(
                            LinearGradient(
                                colors: [Color(hue: 0.38, saturation: 0.85, brightness: 0.62),
                                         Color(hue: 0.38, saturation: 0.9, brightness: 0.52)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                        .shadow(color: .green.opacity(0.35), radius: 10, y: 4)
                    }
                    .disabled(viewModel.isLoading)
                    .padding(.horizontal, 24)
                    .padding(.top, 24)
                    .opacity(formVisible ? 1 : 0)
                    .offset(y: formVisible ? 0 : 12)
                    .animation(.spring(response: 0.5, dampingFraction: 0.8).delay(0.55), value: formVisible)
                }
                .padding(.bottom, 40)
            }
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                heroVisible = true
                formVisible = true
            }
        }
    }

    @ViewBuilder
    private func fieldView(
        placeholder: String,
        text: Binding<String>,
        contentType: UITextContentType? = nil,
        caps: Bool = false
    ) -> some View {
        TextField(placeholder, text: text)
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .textContentType(contentType)
            .autocorrectionDisabled()
            .textInputAutocapitalization(caps ? .characters : .never)
    }
}

