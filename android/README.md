# Native Android app

Kotlin + Jetpack Compose, using Material 3 with **Material You wallpaper colors on Android 12+**, system light/dark mode, and a Material fallback on Android 8–11. No WebView or JavaScript runtime.

## Setup

1. Open this `android/` directory in Android Studio. Use JDK 17 and install Android SDK 36. The Gradle wrapper is included.
2. Copy `supabase.properties.example` to `supabase.properties` (gitignored).
3. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the same public client configuration as the web app's `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. **Never use a service-role/secret key.** Client configuration is embedded in the APK; Supabase row-level security protects the data.
4. Enable **Anonymous sign-ins** in Supabase Auth. Use the existing [`../supabase/schema.sql`](../supabase/schema.sql) backend, with its RPC functions, RLS policies, and Realtime publication. No Android-specific database migration is needed. Do not blindly rerun the schema on an existing database; its publication statements are not idempotent.
5. Optionally set `WEB_APP_URL` to the deployed web app's exact HTTPS URL, including any path (e.g. `https://example.com/shoppinglist/`). Shared invitations then work in browsers too. Without it, links use `shoppinglist://join?join=CODE`, which requires the Android app.
6. Optionally set `BUY_ME_COFFEE_URL` to enable the support link.

Configuration can also come from environment variables or `-P` Gradle properties with the same names (Gradle property > environment > file).

Run the `app` configuration in Android Studio, or:

```sh
./gradlew :app:assembleDebug
./gradlew :app:testDebugUnitTest :app:lintDebug
# Requires a running emulator or connected Android device:
./gradlew :app:connectedDebugAndroidTest
```

Set `ANDROID_HOME` to your SDK directory for command-line builds, or let Android Studio generate `local.properties` with `sdk.dir`. The debug APK is `app/build/outputs/apk/debug/app-debug.apk`.

Without backend configuration, the app shows setup instructions rather than crashing. Release builds enable shrinking; configure your own signing key before distribution.

## Features

- Create or join a family list using the existing Supabase anonymous-auth identity and RPCs.
- Add, edit, check off, delete, clear completed, and restore completed items.
- Live shared updates via Supabase Realtime; manual refresh and foreground fallback sync every 30 seconds.
- Durable offline cache and an ordered mutation queue. New items use stable UUIDs, so edits/checks/deletes made before their first upload remain associated with the correct item. Retry does not duplicate adds or drop the unsent queue tail.
- Drag unchecked items by their handle to reorder, with edge auto-scrolling and animated feedback. Order is persisted only on release and remains personal to this device. TalkBack exposes reorder actions; a focused handle also supports keyboard up/down arrows.
- Native clipboard and Android share sheet for invitations. Invitations prefill a confirmation form; they never silently replace a list.
- Follows the primary device language: Hebrew uses Hebrew text and RTL; other languages use English and LTR. Device-language changes apply automatically. Old manual language preferences are ignored without clearing saved lists, identities, or offline edits.
- Owner-only list rename. Leaving clears the local active list, matching the web app; it does not delete the shared list or membership. Pending edits must sync before leaving or switching lists.

## Persistence and lifecycle

The session, cached list, queue, and ordering are stored atomically in an AES-GCM encrypted file using an Android Keystore key, in `noBackupFilesDir`. Backups are disabled. Uninstalling or clearing app data loses the anonymous identity, so keep an invitation code for rejoining. A failed token refresh does **not** silently create a new identity or discard queued changes.

Sync/realtime runs while the activity is foregrounded. Offline changes survive process death and replay when the app is reopened with connectivity. There is deliberately no background service or WorkManager sync. Loss of access keeps pending operations for safety rather than silently discarding them; re-establish access using the existing identity before switching lists.

The app declares a custom invitation scheme and an HTTPS intent filter for the configured web host/path. HTTPS links still normally open in the browser on Android 12+ unless the user explicitly allows this app to open them. Verified Android App Links would additionally require a hosted `/.well-known/assetlinks.json` and a release signing certificate; that domain-side setup is not included.

## Tests

JVM regression tests cover offline operation application, stable IDs, retry tail retention, idempotent uploads, personal ordering, concurrent deletes, session identity preservation, storage failures, and list-switch cancellation. Compose instrumentation tests cover checkbox semantics, drag ordering and TalkBack actions, system-language/RTL changes, invitation validation, optional display names, encrypted storage, and the unconfigured startup screen.

Backend-free tests do not replace testing real create/join, Realtime, token rotation, and offline reconnection against your configured Supabase project on a device.
