# Privacy implementation and operator review

Reviewed 27 October 2026 against repository main `1c22da1e1877a975f4a67e00276b0b9f55f3d50a`.

## Public resources and Play Console

- Privacy policy: https://avirankatz.github.io/shoppinglist/privacy.html
- External deletion resource: https://avirankatz.github.io/shoppinglist/delete-account.html
- Source: `public/privacy.html` and `public/delete-account.html`. Vite copies these to the Pages deployment. They require no app login, database configuration, JavaScript, external fonts or analytics. The PWA navigation fallback excludes these paths.
- Android's always-visible Privacy menu provides policy, deletion request and deletion instructions. Web has the same links; iOS links to the resources. Publish a new Android build to include these controls.
- The request path opens email; it does not perform instant deletion. A working, monitored mailbox and the manual procedure below are essential.

## Code evidence

| Data or behavior | Evidence |
| --- | --- |
| Persistent guest identity / session | `src/features/shopping/hooks/useAuth.ts`, Android `data/ShoppingRepository.kt`, iOS `Services/SupabaseService.swift` |
| Optional display name, membership, list owner and invite code, item text/status/timestamps | `supabase/schema.sql` |
| Browser local storage / offline queues / cached lists / ordering | `src/features/shopping/storageUtils.ts`, `hooks/useListSync.ts` |
| Android encrypted snapshot (tokens, name, list, items, queue, ordering); backups excluded | Android `data/SecureStore.kt`, `data/ShoppingModels.kt`, manifest and `res/xml/data_extraction_rules.xml` |
| Android Internet only, cleartext disabled | `android/app/src/main/AndroidManifest.xml` |
| Leaving a list does not remove the server membership or auth account | Web `hooks/useListActions.ts`; Android `ShoppingRepository.leaveList` |
| No app-side automatic inactivity cleanup, advertising / analytics / crash-reporting SDK | Checked schema, app dependencies and networking code; provider-side configuration is not in this repository |
| Google Fonts request on web; external donation link | `src/index.css`; `SettingsPanel.tsx`, `ListScreen.tsx`; Android configurable donation URL |
| Owner deletion cascades to owned lists and all their items/memberships | `supabase/schema.sql`: `owner_id -> auth.users ON DELETE CASCADE`; list foreign keys also cascade |
| Items have no author column | `supabase/schema.sql`: `shopping_items` |

## Required production verification — policy text alone is not compliance

The controller was confirmed as Aviran Katz; the contact email was verified from the connected GitHub profile and existing commit metadata. Confirm this is the mailbox to publish and monitor.

Before relying on these pages for legal/Play compliance:

1. Confirm the deployed Supabase schema matches the repository, anonymous authentication is configured as described, and no additional SDK, logging, CAPTCHA or integration changes the data inventory.
2. Record the actual Supabase project region, current log/backups retention and any separate backups. Update section 4/5 and the equivalent Hebrew text with concrete locations, retention periods or specific criteria once confirmed. The current page deliberately does not invent a region, expiry, or deletion guarantee for provider backups.
3. Verify the applicable Supabase DPA/transfer terms, subprocessors and Israeli overseas-transfer conditions for the actual deployment; assess GDPR territorial scope under Article 3, EU representative under Article 27 if applicable, and whether a DPO is required. Simply being available in Europe does not settle GDPR territorial scope.
4. Classify the Israeli database/security level and implement applicable 2017 security regulations: database definition, access reviews, provider oversight, incident response, necessary records and retention. Check Amendment 13 registration/notification/DPO thresholds against real scale and activities. Do not infer exemption solely from a small codebase.
5. Adopt and test the rights/deletion workflow below using a disposable account. Decide operational retention for request correspondence and backups; respect applicable mandatory security-record retention rather than promising blanket immediate deletion.
6. Complete Play Data safety using the actual shipped bundle and provider configuration: consider optional name, user ID, user-generated list content and operational technical data. Do not select “no data collected” because authentication is anonymous. Evaluate Play's service-provider / user-initiated-sharing exceptions separately from legal disclosure of recipients. Verify encrypted transit and the deletion answers.
7. Confirm the Play listing's developer/app identity, target audience and child-related obligations. The policy names both Shopping List and Family Shopping List and identifies the Android package.

## Manual deletion / rights procedure

Do not ask people to post personal data in this public repository. Never request an access/refresh token, service-role key or invite code by email. An emailed UUID alone does NOT prove ownership.

1. Record receipt and respond without undue delay within the applicable deadline. GDPR normally requires a response within one month of receipt; any permitted extension must be explained within that initial month. Do not silently restart the clock on verification. Israeli rights/deadlines also apply where relevant.
2. Identify the account using the provided ID, or assist without insisting on an ID. Proportionate proof can be a private, one-time random challenge: ask the requester to create a temporary list in their existing session named with the challenge. As administrator verify that this new list's `owner_id` is the exact account targeted. Knowledge of a shared list name/code or ability to edit an existing shared list is insufficient. If the session is lost, investigate other proportionate evidence; do not expose other members' information or delete based on a guess.
3. Explain to an owner that all owned lists disappear for every member. Identify personal content in other people's lists: there is no per-item author field. Scope and resolve this explicitly; do not claim every item authored by a user can be found. Respect other people's data in access/export requests.
4. Using a privileged server-side Supabase Admin context (not a mobile/browser client), export the scoped data if requested, correct relevant records, or permanently delete the verified auth user. Use hard deletion, not a ban or soft delete. The schema cascades owned lists/items and all the user's memberships. Delete the temporary challenge list as part of this operation.
5. Verify no auth user, owned list or membership remains. Resolve the identified personal content in other lists, and other associated data found in the production inventory. Address refresh/session revocation and any still-valid access token behavior; membership removal should remove data access, but test the actual deployment.
6. Record and communicate any lawful exception with a specific purpose and duration. Follow configured log/backup lifecycle, restrict residual copies, and reapply deletions after restoration. Never retain everything under a generic “security” exception.
7. Confirm completion privately; explain how to clear local data on every device. Another device or a later launch may create a new independent guest account. Explain this rather than promising a perpetual block on new accounts. Keep only the necessary request audit record under the adopted retention schedule.

## Security issue outside this policy change

The supplied `list_members_insert_self` policy checks only `user_id = auth.uid()`, not knowledge of an invite code. An authenticated client that knows a list UUID can insert its own membership directly, bypassing the intended join RPC. Review/restrict direct membership inserts and use the invitation RPC as the controlled entry point. The privacy page avoids claiming invitation-only authorization is guaranteed. Also review security-definer function grants and default PUBLIC execution before production.

## Official sources

- Israeli PPA, notification duty (Section 11; updated controller identity/contact and access/correction disclosures): https://www.gov.il/he/pages/duty_to_notify
- Israeli PPA, Amendment 13: https://www.gov.il/he/pages/tikun13_qa
- Israeli PPA, 2017 Data Security Regulations guide: https://www.gov.il/he/pages/data_security_guide
- GDPR, especially Articles 3, 5–6, 12–22, 27–28, 32–34, 37, 44–49: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
- Play User Data / privacy and deletion requirements: https://support.google.com/googleplay/android-developer/answer/10144311?hl=en
- Play deletion guidance: https://support.google.com/googleplay/android-developer/answer/13327111?hl=en
- Supabase DPA, including international transfer provisions: https://supabase.com/legal/dpa
- GitHub Pages visitor IP logging: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- Native symbol guidance: https://developer.android.com/build/include-native-symbols

## Native debug-symbol warning

This is separate from a privacy policy. Release builds request FULL native symbols; the release workflow preserves `native-debug-symbols.zip` when produced. AGP can embed available symbols in the App Bundle; a separately generated ZIP can be uploaded in Play Console for the matching release. Dependencies may ship stripped binaries, in which case requesting FULL cannot recreate missing vendor symbols. Inspect build logs/the actual AAB before claiming the warning is resolved. Java/Kotlin R8 `mapping.txt` is a separate artifact and is already retained.
