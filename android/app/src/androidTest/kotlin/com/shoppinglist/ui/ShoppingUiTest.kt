package com.shoppinglist.ui

import android.app.Application
import android.content.res.Configuration
import android.net.Uri
import android.os.LocaleList
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.LayoutDirection
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.shoppinglist.BuildConfig
import com.shoppinglist.R
import com.shoppinglist.data.ShoppingItem
import com.shoppinglist.data.ShoppingList
import com.shoppinglist.data.ShoppingState
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.Locale

@Composable
private fun DeviceLanguage(language: String, content: @Composable () -> Unit) {
    val base = LocalContext.current
    val original = LocalConfiguration.current
    val config = remember(original, language) {
        Configuration(original).apply {
            val locale = Locale.forLanguageTag(language)
            setLocales(LocaleList(locale))
            setLayoutDirection(locale)
        }
    }
    val context = remember(base, config) { base.createConfigurationContext(config) }
    CompositionLocalProvider(LocalContext provides context, LocalConfiguration provides config, content = content)
}

@RunWith(AndroidJUnit4::class)
class ShoppingUiTest {
    @get:Rule val compose = createComposeRule()

    @Test fun missingConfigurationStartupIsReadyAndSurvivesForegroundChanges() {
        assumeTrue(BuildConfig.SUPABASE_URL.isBlank() && BuildConfig.SUPABASE_ANON_KEY.isBlank())
        val application = ApplicationProvider.getApplicationContext<Application>()
        val store = ViewModelStore()
        lateinit var model: ShoppingViewModel
        compose.runOnIdle {
            model = ViewModelProvider(store, ShoppingViewModel.Factory(application))[ShoppingViewModel::class.java]
            assertTrue(model.ready.value)
            model.foreground(); model.background(); model.foreground()
        }
        try {
            compose.setContent { DeviceLanguage("en") { ShoppingApp(model, null) {} } }
            compose.onNodeWithText("Set up cloud sync").assertIsDisplayed()
            compose.onNodeWithText("Connecting...").assertDoesNotExist()
            compose.onNodeWithText("Create Family List").assertDoesNotExist()
        } finally {
            compose.runOnIdle { store.clear() }
        }
    }

    @Test fun oldLanguageOverrideIsIgnoredAndDeviceLanguageChangesApply() {
        assumeTrue(BuildConfig.SUPABASE_URL.isBlank() && BuildConfig.SUPABASE_ANON_KEY.isBlank())
        val application = ApplicationProvider.getApplicationContext<Application>()
        val preferences = application.getSharedPreferences("shopping-ui", Application.MODE_PRIVATE)
        val previous = preferences.getString("language", null)
        assertTrue(preferences.edit().putString("language", "he").commit())
        val deviceLanguage = mutableStateOf("en")
        val store = ViewModelStore()
        lateinit var model: ShoppingViewModel
        try {
            compose.runOnIdle {
                model = ViewModelProvider(store, ShoppingViewModel.Factory(application))[ShoppingViewModel::class.java]
            }
            compose.setContent { DeviceLanguage(deviceLanguage.value) { ShoppingApp(model, null) {} } }
            compose.onNodeWithText("Set up cloud sync").assertIsDisplayed()
            compose.runOnIdle { deviceLanguage.value = "he" }
            compose.onNodeWithText("הגדרת סנכרון ענן").assertIsDisplayed()
            compose.runOnIdle { model.background(); model.foreground(); deviceLanguage.value = "en" }
            compose.onNodeWithText("Set up cloud sync").assertIsDisplayed()
        } finally {
            compose.runOnIdle { store.clear() }
            assertTrue(preferences.edit().putString("language", previous).commit())
        }
    }

    @Test fun onboardingAllowsAnOptionalDisplayName() {
        val application = ApplicationProvider.getApplicationContext<Application>()
        val store = ViewModelStore()
        lateinit var model: ShoppingViewModel
        compose.runOnIdle {
            model = ViewModelProvider(store, ShoppingViewModel.Factory(application))[ShoppingViewModel::class.java]
        }
        try {
            compose.setContent {
                DeviceLanguage("en") { ShoppingLocale { MaterialTheme { Onboarding(ShoppingState(), false, model) } } }
            }
            compose.onNodeWithText("Create Family List").assertIsEnabled()
            compose.onNodeWithText("Join").performClick()
            compose.onNodeWithText("Join Family List").assertIsNotEnabled()
            compose.onNodeWithText("Invite code").performTextInput("ABCD-EFGH-IJKL")
            compose.onNodeWithText("Join Family List").assertIsEnabled()
        } finally {
            compose.runOnIdle { store.clear() }
        }
    }

    @Test fun itemCheckboxWorksAndMoveMenuItemsAreGone() {
        val checked = mutableStateOf(false)
        compose.setContent {
            DeviceLanguage("en") { ShoppingLocale { MaterialTheme {
                ItemRow(ShoppingItem("milk", "family", "Milk", checked.value), true,
                    onCheck = { checked.value = !checked.value }, onEdit = {}, onDelete = {})
            } } }
        }
        val checkbox = compose.onNode(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Checkbox))
        checkbox.assertIsOff().performClick().assertIsOn()
        compose.onNodeWithContentDescription("Actions for Milk").performClick()
        compose.onNodeWithText("Edit item").assertIsDisplayed()
        compose.onNodeWithText("Delete item").assertIsDisplayed()
        compose.onNodeWithText("Move up").assertDoesNotExist()
        compose.onNodeWithText("Move down").assertDoesNotExist()
    }

    @Test fun systemLanguageChangesResourcesAndDirectionWithoutRecreatingContent() {
        val language = mutableStateOf("en")
        var direction = LayoutDirection.Ltr
        compose.setContent {
            DeviceLanguage(language.value) { ShoppingLocale {
                direction = LocalLayoutDirection.current
                Text(LocalContext.current.getString(R.string.app_name))
            } }
        }
        compose.onNodeWithText("Family Shopping List").assertTextEquals("Family Shopping List")
        compose.runOnIdle { language.value = "he" }
        compose.onNodeWithText("רשימת קניות משפחתית").assertTextEquals("רשימת קניות משפחתית")
        compose.runOnIdle { assertEquals(LayoutDirection.Rtl, direction); language.value = "ar" }
        compose.onNodeWithText("Family Shopping List").assertTextEquals("Family Shopping List")
        compose.runOnIdle { assertEquals(LayoutDirection.Ltr, direction) }
    }

    private fun itemsState() = ShoppingState(
        list = ShoppingList("family", "CODE", "Family", "owner"),
        items = listOf(ShoppingItem("milk", "family", "Milk"), ShoppingItem("bread", "family", "Bread"), ShoppingItem("eggs", "family", "Eggs", checked = true)),
    )

    private fun dragItem(language: String, milkHandle: String, breadHandle: String) {
        val state = mutableStateOf(itemsState())
        var commits = 0
        var savedOrder = emptyList<String>()
        compose.setContent {
            DeviceLanguage(language) { ShoppingLocale { MaterialTheme {
                ShoppingItems(state.value, false, {}, {}, {}, onReorder = { ids, done ->
                    commits++
                    savedOrder = ids
                    state.value = state.value.copy(items = ids.map { id -> state.value.items.single { it.id == id } } + state.value.items.filter { it.checked })
                    done()
                }, onClear = {}, onRestore = {})
            } } }
        }
        val milk = compose.onNodeWithContentDescription(milkHandle)
        val distance = compose.onNodeWithContentDescription(breadHandle).fetchSemanticsNode().boundsInRoot.center.y - milk.fetchSemanticsNode().boundsInRoot.center.y
        milk.performTouchInput { swipe(center, Offset(center.x, center.y + distance + 12f), durationMillis = 1_000) }
        compose.waitForIdle()
        compose.runOnIdle {
            assertEquals(listOf("bread", "milk"), savedOrder)
            assertEquals(1, commits)
            assertEquals(listOf("bread", "milk", "eggs"), state.value.items.map { it.id })
        }
        val milkY = compose.onNodeWithText("Milk").fetchSemanticsNode().boundsInRoot.center.y
        val breadY = compose.onNodeWithText("Bread").fetchSemanticsNode().boundsInRoot.center.y
        assertTrue(breadY < milkY)
        val doneHandle = if (language == "he") "שינוי הסדר של Eggs" else "Reorder Eggs"
        compose.onNodeWithContentDescription(doneHandle).assertDoesNotExist()
    }

    @Test fun draggingPersistsOnceAndNeverMovesDoneItems() = dragItem("en", "Reorder Milk", "Reorder Bread")
    @Test fun draggingAlsoWorksInHebrewRtl() = dragItem("he", "שינוי הסדר של Milk", "שינוי הסדר של Bread")

    @Test fun talkBackCanReorderWithoutVisibleMoveMenuItems() {
        val state = mutableStateOf(itemsState())
        compose.setContent {
            DeviceLanguage("en") { ShoppingLocale { MaterialTheme {
                ShoppingItems(state.value, false, {}, {}, {}, onReorder = { ids, done ->
                    state.value = state.value.copy(items = ids.map { id -> state.value.items.single { it.id == id } } + state.value.items.filter { it.checked })
                    done()
                }, onClear = {}, onRestore = {})
            } } }
        }
        val actions = compose.onNodeWithContentDescription("Reorder Milk").fetchSemanticsNode().config[SemanticsActions.CustomActions]
        assertEquals(listOf("Move down"), actions.map { it.label })
        compose.runOnIdle { assertTrue(actions.single().action()) }
        val updated = compose.onNodeWithContentDescription("Reorder Milk").fetchSemanticsNode().config[SemanticsActions.CustomActions]
        assertEquals(listOf("Move up"), updated.map { it.label })
        compose.onNodeWithContentDescription("Actions for Milk").performClick()
        compose.onNodeWithText("Move up").assertDoesNotExist()
        compose.onNodeWithText("Move down").assertDoesNotExist()
    }

    @Test fun invitationsAcceptOnlyConfiguredWebsiteOrCustomJoinScheme() {
        val web = "https://example.com/family"
        assertEquals("ABCD-EFGH-IJKL", invitationCode(Uri.parse("shoppinglist://join?join=ABCD-EFGH-IJKL"), web))
        assertEquals("A B", invitationCode(Uri.parse("https://example.com/family/?join=A%20B"), web))
        assertNull(invitationCode(Uri.parse("https://example.com.evil/family?join=CODE"), web))
        assertNull(invitationCode(Uri.parse("https://example.com/other?join=CODE"), web))
        assertNull(invitationCode(Uri.parse("http://example.com/family?join=CODE"), web))
        assertNull(invitationCode(Uri.parse("shoppinglist://other?join=CODE"), web))
        assertNull(invitationCode(Uri.parse("shoppinglist://join?join="), web))
    }

    @Test fun sharedLinkReplacesOldCodeAndPreservesDeploymentPath() {
        val link = invitationLink("https://example.com/family?source=android&join=OLD#ignored", "NEW CODE")
        assertEquals("/family", Uri.parse(link).path)
        assertEquals("android", Uri.parse(link).getQueryParameter("source"))
        assertEquals(listOf("NEW CODE"), Uri.parse(link).getQueryParameters("join"))
        assertNull(Uri.parse(link).fragment)
        assertEquals("NEW CODE", invitationCode(Uri.parse(link), "https://example.com/family"))
        assertEquals("CODE", invitationCode(Uri.parse(invitationLink("", "CODE")), ""))
        val rootLink = Uri.parse(invitationLink("https://example.com", "ROOT"))
        assertEquals("/", rootLink.path)
        assertEquals("ROOT", invitationCode(rootLink, "https://example.com"))
    }
}
