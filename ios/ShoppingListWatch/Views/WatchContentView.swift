import SwiftUI

struct WatchContentView: View {
    @EnvironmentObject var viewModel: ShoppingViewModel

    var body: some View {
        Group {
            if viewModel.activeList != nil {
                WatchListView()
            } else {
                WatchOnboardingView()
            }
        }
        .task {
            await viewModel.onAppear()
        }
    }
}
