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

## Google Play releases

The manual [Android release workflow](../.github/workflows/android-release.yml) builds a signed AAB, runs release unit tests and lint, and optionally uploads a **draft to internal testing**. It only runs from `main`; it never publishes directly to production. Complete/roll out the draft in Play Console after checking it. Existing debug CI is unchanged.

### One-time setup

1. Create/verify your Google Play developer account and create the app in Play Console. The package ID is `com.avirankatz.shoppinglist`; confirm this before the first upload because it cannot be changed for that app afterward. Complete the required listing, privacy policy, Data safety, content rating, app access, and audience declarations. Follow any testing/verification requirements shown for your account.
2. Generate an **upload key** locally (or reuse your existing upload key if this app has already been uploaded):

   ```sh
   keytool -genkeypair -v -keystore upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   base64 -i upload-keystore.jks | pbcopy
   ```

   The second command copies the base64-encoded keystore for the GitHub secret below. Keep an independent, secure backup of the keystore, alias, and passwords. Never commit them. With Play App Signing, this is the upload key, not Google's app-signing key.
3. In GitHub repository **Settings → Environments**, create `google-play`. Restrict deployment branches to `main`; add required reviewers if supported by your GitHub plan. Add the following environment secrets and variables:

   | Type | Name | Value |
   | --- | --- | --- |
   | Secret | `ANDROID_KEYSTORE_BASE64` | Base64-encoded upload keystore |
   | Secret | `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
   | Secret | `ANDROID_KEY_ALIAS` | `upload`, or the existing alias |
   | Secret | `ANDROID_KEY_PASSWORD` | Key password (often the same as the keystore password) |
   | Secret | `SUPABASE_ANON_KEY` | Production public/anon client key, never the service-role key |
   | Secret | `PLAY_SERVICE_ACCOUNT_JSON` | Entire Google service-account JSON key; only needed when publishing |
   | Variable | `SUPABASE_URL` | Production Supabase HTTPS URL |
   | Variable | `WEB_APP_URL` | Optional deployed web app URL |
   | Variable | `BUY_ME_COFFEE_URL` | Optional support URL |

   Backend values are embedded in the app; storing the anon key as a GitHub secret does not make it private on devices. RLS must protect the backend. Signing and publishing credentials are passed only to the trusted release workflow, not pull requests.
4. Run **Actions → Android release → Run workflow** on `main`, enter version code `1` (if unused) and version name `1.0.0`, and leave **Upload to Google Play** unchecked. Download the `android-release-1` artifact and extract `app-release.aab`.
5. Manually upload that AAB to an internal-testing release in Play Console and enroll in Play App Signing as prompted. Complete the required app setup. The first upload bootstraps the package for subsequent API uploads; it does not require a public production launch.
6. For automated uploads, create/select a Google Cloud project, enable the **Google Play Android Developer API**, and create a service account with a JSON key. Invite its email through Play Console **Users and permissions**, granting access only to this app and the permissions needed to view the app and manage testing releases. Do not grant account admin or production release access. Save the JSON as `PLAY_SERVICE_ACCOUNT_JSON` above, not in the repository. Account-to-Cloud-project linking is no longer required. See [Google's API setup guide](https://developers.google.com/android-publisher/getting_started).

### Subsequent releases

Run the workflow with a **version code greater than every previous Play upload**, a user-visible version name, and publishing checked. Re-running an already uploaded version code will be rejected by Play; choose a new code. The workflow saves the signed AAB and R8 mapping file for 30 days and uploads a draft to the `internal` track. Finish that draft in Play Console and distribute to testers; promote the tested release to production manually when eligible. Artifact expiry does not replace your own release/key backups.

The pipeline uses a service-account JSON key for straightforward setup. Rotate/revoke it if exposed; GitHub OIDC / Workload Identity Federation can replace this long-lived Google key later. CI providers and the upload action process release credentials, so review workflow changes before running a release.

For local signed builds, provide `VERSION_CODE`, `VERSION_NAME`, `ANDROID_KEYSTORE_PATH` (absolute path), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD` as environment variables, then run `./gradlew :app:bundleRelease`. Without a keystore path, local release builds remain unsigned as before. Never put passwords in command-line arguments or tracked files.

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
