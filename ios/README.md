# Shopping List — iOS & watchOS App

A native SwiftUI shopping list app for **iPhone** and **Apple Watch** that syncs in real time with the same Supabase backend as the web app.

## Features

### iOS (iPhone & iPad)
- **Create** a new shopping list with a unique invite code
- **Join** an existing list via invite code
- **Add, edit, delete** items with swipe actions
- **Check off** items — completed items move to a separate section
- **Real-time sync** — changes from any device appear instantly
- **Pull to refresh** — manual refresh support
- **Settings** — rename list, copy invite code, share invite, leave list
- **Optimistic updates** — UI responds instantly, syncs in background

### watchOS (Apple Watch)
- **View** your shopping list on your wrist
- **Check off** items with a tap
- **Add** new items via the add button
- **Delete** items with swipe-to-delete
- **Real-time sync** — stays in sync with iPhone and web

## Project Structure

```
ios/
├── project.yml                              # XcodeGen project specification
├── ShoppingList/                            # iOS app + shared code
│   ├── ShoppingListApp.swift                # iOS app entry point
│   ├── Models/
│   │   ├── ShoppingItem.swift               # Shopping item model
│   │   ├── ShoppingList.swift               # Shopping list model
│   │   └── ListMember.swift                 # List member model
│   ├── Services/
│   │   └── SupabaseService.swift            # Supabase API service
│   ├── ViewModels/
│   │   └── ShoppingViewModel.swift          # Shared view model (iOS + watchOS)
│   ├── Views/
│   │   ├── ContentView.swift                # Root navigation view
│   │   ├── OnboardingView.swift             # Create/Join list screen
│   │   ├── ShoppingListView.swift           # Main list view
│   │   ├── ItemRowView.swift                # Item row with edit/delete
│   │   └── SettingsView.swift               # List settings & sharing
│   └── Resources/
│       └── Assets.xcassets/                 # App icon & colors
├── ShoppingListWatch/                       # watchOS app
│   ├── ShoppingListWatchApp.swift           # Watch app entry point
│   └── Views/
│       ├── WatchContentView.swift           # Root navigation view
│       ├── WatchOnboardingView.swift        # Create/Join on watch
│       ├── WatchListView.swift              # Watch list + add item
│       └── WatchItemRowView.swift           # Watch item row
└── README.md                                # This file
```

## Prerequisites

- **Xcode 15+** (with Swift 5.9+)
- **macOS Sonoma** or later
- **[XcodeGen](https://github.com/yonaskolb/XcodeGen)** for project generation
- A configured **Supabase** project (same as the web app)

## Setup

### 1. Install XcodeGen

```bash
brew install xcodegen
```

### 2. Configure Supabase credentials

Create a file at `ios/Configs/Supabase.xcconfig` (or set environment variables):

```
SUPABASE_URL = https://your-project.supabase.co
SUPABASE_ANON_KEY = your-anon-key-here
```

Alternatively, set the environment variables before generating the project:

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key-here"
```

### 3. Generate the Xcode project

```bash
cd ios
xcodegen generate
```

This creates `ShoppingList.xcodeproj` from `project.yml`.

### 4. Open in Xcode

```bash
open ShoppingList.xcodeproj
```

### 5. Build & Run

- Select the **ShoppingList** scheme for iOS
- Select the **ShoppingListWatch** scheme for watchOS
- Run on a simulator or physical device

## Architecture

### Shared Code
The `Models/`, `Services/`, and `ViewModels/` directories contain code shared between both iOS and watchOS targets. The `ShoppingViewModel` is the single source of truth for all state management.

### Supabase Integration
- **Anonymous authentication** — same as the web app
- **RPC functions** — `create_list` and `join_list_by_code` for list operations
- **Real-time subscriptions** — listens for changes on `shopping_items`, `shopping_lists`, and `list_members` tables
- **Optimistic updates** — UI updates immediately, reverts on server errors

### State Management
The `ShoppingViewModel` uses `@Published` properties with `@MainActor` isolation. Both iOS and watchOS targets share the same view model, with platform-specific views.

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| [supabase-swift](https://github.com/supabase/supabase-swift) | 2.0+ | Supabase client SDK (auth, database, realtime) |

## Compatibility

| Platform | Minimum Version |
|----------|----------------|
| iOS | 17.0 |
| watchOS | 10.0 |
| Xcode | 15.0 |
| Swift | 5.9 |
