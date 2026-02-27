import SwiftUI

@main
struct ShoppingListApp: App {
    @StateObject private var viewModel = ShoppingViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(viewModel)
        }
    }
}
