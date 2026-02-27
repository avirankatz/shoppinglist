import SwiftUI

struct ContentView: View {
    @EnvironmentObject var viewModel: ShoppingViewModel

    var body: some View {
        Group {
            if viewModel.activeList != nil {
                ShoppingListView()
                    .transition(.opacity.combined(with: .scale(scale: 0.95)))
            } else {
                OnboardingView()
                    .transition(.opacity.combined(with: .scale(scale: 1.05)))
            }
        }
        .animation(.spring(response: 0.5, dampingFraction: 0.8), value: viewModel.activeList != nil)
        .task {
            await viewModel.onAppear()
        }
    }
}
