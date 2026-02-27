import SwiftUI

@main
struct ShoppingListWatchApp: App {
    @StateObject private var viewModel = ShoppingViewModel()

    var body: some Scene {
        WindowGroup {
            WatchContentView()
                .environmentObject(viewModel)
        }
    }
}
