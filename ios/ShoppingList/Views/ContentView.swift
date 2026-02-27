import SwiftUI

struct ContentView: View {
    @EnvironmentObject var viewModel: ShoppingViewModel

    var body: some View {
        Group {
            if viewModel.activeList != nil {
                ShoppingListView()
            } else {
                OnboardingView()
            }
        }
        .task {
            await viewModel.onAppear()
        }
    }
}
