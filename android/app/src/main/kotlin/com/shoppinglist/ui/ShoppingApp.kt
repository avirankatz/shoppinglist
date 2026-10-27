package com.shoppinglist.ui

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn


import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons

import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.LiveRegionMode

import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction

import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.shoppinglist.BuildConfig
import com.shoppinglist.R

import com.shoppinglist.data.ShoppingState
import com.shoppinglist.ui.theme.ShoppingTheme
import kotlinx.coroutines.launch
import java.util.Locale

@Composable
internal fun text(id: Int, vararg args: Any): String = LocalContext.current.getString(id, *args)

@Composable
fun ShoppingApp(model: ShoppingViewModel, invitation: String?, consumeInvitation: () -> Unit) {
    val state by model.state.collectAsStateWithLifecycle()

    val busy by model.busy.collectAsStateWithLifecycle()
    val ready by model.ready.collectAsStateWithLifecycle()
    val operationError by model.error.collectAsStateWithLifecycle()
    val owner = LocalLifecycleOwner.current
    DisposableEffect(owner, model) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> model.foreground()
                Lifecycle.Event.ON_STOP -> model.background()
                else -> Unit
            }
        }
        owner.lifecycle.addObserver(observer)
        if (owner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) model.foreground()
        onDispose { owner.lifecycle.removeObserver(observer); model.background() }
    }
    ShoppingLocale {
        ShoppingTheme {
            AppContent(model, state, busy, ready, operationError ?: state.error, invitation, consumeInvitation)
        }
    }
}

@Composable
internal fun ShoppingLocale(content: @Composable () -> Unit) {
    val base = LocalContext.current
    val originalConfiguration = LocalConfiguration.current
    val language = systemLanguage(originalConfiguration.locales[0]?.language.orEmpty())
    val configuration = remember(originalConfiguration, language) {
        Configuration(originalConfiguration).apply {
            val locale = Locale.forLanguageTag(language)
            setLocale(locale)
            setLayoutDirection(locale)
        }
    }
    val localized = remember(base, configuration) { base.createConfigurationContext(configuration) }
    CompositionLocalProvider(
        LocalContext provides localized,
        LocalConfiguration provides configuration,
        LocalLayoutDirection provides if (language == "he") LayoutDirection.Rtl else LayoutDirection.Ltr,
        content = content,
    )
}

@Composable
internal fun InvitationEffect(invitation: String?, ready: Boolean, busy: Boolean, onInvitation: (String) -> Unit) {
    LaunchedEffect(invitation, ready, busy) {
        if (invitation != null && ready && !busy) onInvitation(invitation)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AppContent(
    model: ShoppingViewModel,
    state: ShoppingState,
    busy: Boolean,
    ready: Boolean,
    error: String?,
    invitation: String?,
    consumeInvitation: () -> Unit,
) {
    var settings by rememberSaveable { mutableStateOf(false) }
    var privacyMenu by rememberSaveable { mutableStateOf(false) }
    var confirmation by rememberSaveable { mutableStateOf<String?>(null) }
    var editingId by rememberSaveable { mutableStateOf<String?>(null) }
    var editDraft by rememberSaveable { mutableStateOf("") }
    var renameDraft by rememberSaveable { mutableStateOf("") }
    var addDraft by rememberSaveable(state.list?.id) { mutableStateOf("") }
    var joining by rememberSaveable { mutableStateOf(false) }
    var incomingCode by rememberSaveable { mutableStateOf("") }
    var incomingName by rememberSaveable { mutableStateOf("") }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var externalError by rememberSaveable { mutableStateOf(false) }
    val disabled = busy || !ready
    val switchingBlocked = busy || state.syncing || state.pendingCount > 0

    InvitationEffect(invitation, ready, busy) { code ->
        incomingCode = code
        incomingName = state.userName
        joining = true
        settings = false
        confirmation = null
        editingId = null
        consumeInvitation()
    }
    fun openLink(url: String) {
        try {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (_: ActivityNotFoundException) { externalError = true }
    }
    fun copy(value: String, message: String) {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText(context.getString(R.string.invite_code), value))
        scope.launch { snackbar.showSnackbar(message) }
    }
    val add = { if (addDraft.isNotBlank() && !disabled) model.add(addDraft) { addDraft = "" } }
    Scaffold(
        modifier = Modifier.fillMaxSize().imePadding(),
        topBar = {
            TopAppBar(
                title = { Text(state.list?.name ?: text(R.string.app_name), maxLines = 2) },
                actions = {
                    Box {
                        TextButton(onClick = { privacyMenu = true }) { Text(text(R.string.privacy_menu)) }
                        DropdownMenu(expanded = privacyMenu, onDismissRequest = { privacyMenu = false }) {
                            DropdownMenuItem(text = { Text(text(R.string.privacy_policy)) }, onClick = {
                                privacyMenu = false
                                openLink("https://avirankatz.github.io/shoppinglist/privacy.html")
                            })
                            DropdownMenuItem(text = { Text(text(R.string.request_account_deletion)) }, onClick = {
                                privacyMenu = false
                                val body = "Please delete my Shopping List account and associated data.\nAccount ID: ${state.userId.ifBlank { "unknown" }}\nI understand owned lists will be deleted for all members."
                                openLink("mailto:aviran.katz@gmail.com?subject=Shopping%20List%20account%20deletion&body=${Uri.encode(body)}")
                            })
                            DropdownMenuItem(text = { Text(text(R.string.deletion_details)) }, onClick = {
                                privacyMenu = false
                                openLink("https://avirankatz.github.io/shoppinglist/delete-account.html")
                            })
                        }
                    }
                    if (state.list != null) {
                        IconButton(onClick = model::refresh, enabled = !disabled && !state.syncing) {
                            Icon(Icons.Default.Refresh, text(R.string.refresh))
                        }
                        IconButton(onClick = { settings = true }) { Icon(Icons.Default.Settings, text(R.string.settings)) }
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            if (ready && state.list != null) {
                Surface(tonalElevation = 3.dp) {
                    Row(
                        Modifier.fillMaxWidth().navigationBarsPadding().padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        OutlinedTextField(
                            value = addDraft, onValueChange = { addDraft = it },
                            modifier = Modifier.weight(1f), label = { Text(text(R.string.add_item)) },
                            enabled = !busy, singleLine = true,
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                            keyboardActions = KeyboardActions(onDone = { add() }),
                        )
                        Button(onClick = { add() }, enabled = !disabled && addDraft.isNotBlank()) { Text(text(R.string.add)) }
                    }
                }
            }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            if (state.syncing || busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            if (error != null) ErrorBanner(error, model.available && !busy && !state.syncing, model::refresh, model::dismissError)
            if (externalError) {
                ErrorBanner(text(R.string.no_link_handler), true, { externalError = false }, { externalError = false })
            }
            when {
                !model.configured -> ConfigurationHelp()
                !model.available -> Text(text(R.string.startup_failed), Modifier.padding(24.dp).semantics { heading() })
                !ready -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator()
                        Text(text(R.string.loading), Modifier.padding(16.dp).semantics { liveRegion = LiveRegionMode.Polite })
                    }
                }
                state.list == null -> Onboarding(state, busy || state.syncing, model)
                else -> ShoppingItems(
                    state = state, busy = busy,
                    onCheck = { model.check(it.id, !it.checked) },
                    onEdit = { editingId = it.id; editDraft = it.text },
                    onDelete = { model.delete(it.id) },
                    onReorder = model::reorder,
                    onClear = { confirmation = "clear" },
                    onRestore = model::restore,
                )
            }
        }
    }

    if (settings && state.list != null) {
        val list = state.list
        val link = invitationLink(BuildConfig.WEB_APP_URL, list.invite_code)
        val copied = text(R.string.copied)
        val linkCopied = text(R.string.link_copied)
        val shareTitle = text(R.string.share)
        ModalBottomSheet(onDismissRequest = { settings = false }) {
            LazyColumn(
                Modifier.fillMaxWidth().navigationBarsPadding(),
                contentPadding = PaddingValues(start = 24.dp, end = 24.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                item { SectionTitle(text(R.string.settings)) }
                item { Text(text(R.string.share_to_join)) }
                item { Text(text(R.string.invite_code_value, list.invite_code), style = MaterialTheme.typography.titleMedium) }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(onClick = { copy(list.invite_code, copied) }) { Text(text(R.string.copy_code)) }
                        TextButton(onClick = { copy(link, linkCopied) }) { Text(text(R.string.copy_link)) }
                    }
                }
                item {
                    Button(onClick = {
                        val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, link)
                        try {
                            context.startActivity(Intent.createChooser(send, shareTitle).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                        } catch (_: ActivityNotFoundException) { externalError = true; settings = false }
                    }) { Text(text(R.string.share)) }
                }

                if (list.owner_id == state.userId) item {
                    TextButton(onClick = { renameDraft = list.name; confirmation = "rename"; settings = false }, enabled = !busy) {
                        Text(text(R.string.rename))
                    }
                }
                item {
                    TextButton(onClick = {
                        incomingCode = ""; incomingName = state.userName; joining = true; settings = false
                    }, enabled = !busy) { Text(text(R.string.join_another)) }
                }
                item {
                    TextButton(onClick = { confirmation = "leave"; settings = false }, enabled = !busy) {
                        Text(text(R.string.leave_list), color = MaterialTheme.colorScheme.error)
                    }
                }
                if (safeWebLink(BuildConfig.BUY_ME_COFFEE_URL)) item {
                    TextButton(onClick = { openLink(BuildConfig.BUY_ME_COFFEE_URL) }) { Text(text(R.string.buy_me_coffee)) }
                }
            }
        }
    }
    if (joining && model.configured) {
        AlertDialog(
            onDismissRequest = { if (!busy) joining = false },
            title = { Text(text(if (state.list == null) R.string.join_button else R.string.switch_list)) },
            text = {
                Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (state.list != null) Text(text(R.string.switch_warning))
                    OutlinedTextField(incomingName, { incomingName = it }, label = { Text(text(R.string.your_name)) }, enabled = !busy, singleLine = true)
                    OutlinedTextField(incomingCode, { incomingCode = it }, label = { Text(text(R.string.invite_code)) }, enabled = !busy, singleLine = true)
                    if (state.pendingCount > 0) Text(text(R.string.pending_switch), color = MaterialTheme.colorScheme.error)
                    else if (state.syncing) Text(text(R.string.wait_sync))
                    DialogError(error)
                }
            },
            confirmButton = {
                TextButton(onClick = { model.join(incomingCode, incomingName) { joining = false } },
                    enabled = !switchingBlocked && incomingCode.isNotBlank()) { Text(text(R.string.join_button)) }
            },
            dismissButton = { TextButton(onClick = { joining = false }, enabled = !busy) { Text(text(R.string.cancel)) } },
        )
    }
    if (editingId != null) {
        val id = editingId!!
        val exists = state.items.any { it.id == id }
        AlertDialog(
            onDismissRequest = { if (!busy) editingId = null },
            title = { Text(text(R.string.edit_item)) },
            text = {
                Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(editDraft, { editDraft = it }, enabled = !busy, label = { Text(text(R.string.item_name)) }, singleLine = true)
                    if (!exists) Text(text(R.string.item_unavailable))
                    DialogError(error)
                }
            },
            confirmButton = { TextButton(onClick = { model.edit(id, editDraft) { editingId = null } }, enabled = !busy && exists && editDraft.isNotBlank()) { Text(text(R.string.save)) } },
            dismissButton = { TextButton(onClick = { editingId = null }, enabled = !busy) { Text(text(R.string.cancel)) } },
        )
    }
    if (confirmation != null) {
        val action = confirmation
        val title = when (action) { "rename" -> R.string.rename; "clear" -> R.string.clear_done_title; else -> R.string.leave_list }
        AlertDialog(
            onDismissRequest = { if (!busy) confirmation = null },
            title = { Text(text(title)) },
            text = {
                Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    when (action) {
                        "rename" -> OutlinedTextField(renameDraft, { renameDraft = it }, enabled = !busy, label = { Text(text(R.string.family_list_name)) }, singleLine = true)
                        "clear" -> Text(text(R.string.clear_warning))
                        else -> {
                            Text(text(R.string.leave_warning))
                            if (state.pendingCount > 0) Text(text(R.string.pending_leave), color = MaterialTheme.colorScheme.error)
                            else if (state.syncing) Text(text(R.string.wait_sync))
                        }
                    }
                    DialogError(error)
                }
            },
            confirmButton = {
                val enabled = !busy && when (action) {
                    "rename" -> renameDraft.isNotBlank() && state.list?.owner_id == state.userId
                    "leave" -> !state.syncing && state.pendingCount == 0
                    else -> true
                }
                TextButton(onClick = {
                    when (action) {
                        "rename" -> model.rename(renameDraft) { confirmation = null }
                        "clear" -> model.clear { confirmation = null }
                        else -> model.leave { confirmation = null }
                    }
                }, enabled = enabled) { Text(text(if (action == "rename") R.string.save else R.string.confirm)) }
            },
            dismissButton = { TextButton(onClick = { confirmation = null }, enabled = !busy) { Text(text(R.string.cancel)) } },
        )
    }
}

@Composable
internal fun Onboarding(state: ShoppingState, busy: Boolean, model: ShoppingViewModel) {
    var join by rememberSaveable { mutableStateOf(false) }
    var name by rememberSaveable { mutableStateOf(state.userName) }
    var listName by rememberSaveable { mutableStateOf("") }
    var code by rememberSaveable { mutableStateOf("") }
    val defaultName = text(R.string.default_list_name)
    LazyColumn(
        Modifier.fillMaxSize(), contentPadding = PaddingValues(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item { Text(text(R.string.create_description), style = MaterialTheme.typography.bodyLarge) }
        item { Text(text(R.string.privacy_notice), style = MaterialTheme.typography.bodySmall) }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                FilterChip(selected = !join, onClick = { join = false }, enabled = !busy, label = { Text(text(R.string.create_tab)) })
                FilterChip(selected = join, onClick = { join = true }, enabled = !busy, label = { Text(text(R.string.join_tab)) })
            }
        }
        item {
            OutlinedTextField(name, { name = it }, Modifier.fillMaxWidth(), enabled = !busy,
                label = { Text(text(R.string.your_name)) }, placeholder = { Text(text(R.string.your_name_placeholder)) }, singleLine = true)
        }
        item {
            if (join) OutlinedTextField(code, { code = it }, Modifier.fillMaxWidth(), enabled = !busy, label = { Text(text(R.string.invite_code)) }, singleLine = true)
            else OutlinedTextField(listName, { listName = it }, Modifier.fillMaxWidth(), enabled = !busy,
                label = { Text(text(R.string.list_name_optional)) }, placeholder = { Text(defaultName) }, singleLine = true)
        }
        item {
            Button(onClick = {
                if (join) model.join(code, name) {} else model.create(listName.ifBlank { defaultName }, name) {}
            }, enabled = !busy && (!join || code.isNotBlank()), modifier = Modifier.fillMaxWidth()) {
                Text(text(if (join) R.string.join_button else R.string.create_button))
            }
        }
    }
}


@Composable
internal fun SectionTitle(value: String) {
    Text(value, Modifier.padding(top = 8.dp).semantics { heading() }, style = MaterialTheme.typography.titleMedium)
}

@Composable
private fun DialogError(error: String?) {
    if (error != null) Text(text(R.string.request_failed) + "\n" + error,
        Modifier.semantics { liveRegion = LiveRegionMode.Polite }, color = MaterialTheme.colorScheme.error)
}

@Composable
private fun ErrorBanner(error: String, enabled: Boolean, retry: () -> Unit, dismiss: () -> Unit) {
    Surface(color = MaterialTheme.colorScheme.errorContainer) {
        Column(Modifier.fillMaxWidth().padding(12.dp).semantics { liveRegion = LiveRegionMode.Polite }) {
            Text(text(R.string.request_failed), style = MaterialTheme.typography.titleSmall)
            Text(error, style = MaterialTheme.typography.bodySmall)
            Row {
                TextButton(onClick = retry, enabled = enabled) { Text(text(R.string.retry)) }
                TextButton(onClick = dismiss) { Text(text(R.string.dismiss)) }
            }
        }
    }
}

@Composable
internal fun ConfigurationHelp() {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { SectionTitle(text(R.string.config_title)) }
        item { Text(text(R.string.missing_config)) }
        item { Text(text(R.string.auth_setup)) }
    }
}

fun invitationLink(webAppUrl: String, code: String): String {
    val base = if (safeWebLink(webAppUrl)) Uri.parse(webAppUrl) else Uri.parse("shoppinglist://join")
    // Preserve deployment paths and unrelated URL parameters, replace any old invitation.
    val builder = base.buildUpon().clearQuery().fragment(null)
    if (base.scheme == "https" && base.path.isNullOrEmpty()) builder.path("/")
    base.queryParameterNames.filterNot { it == "join" }.forEach { name ->
        base.getQueryParameters(name).forEach { builder.appendQueryParameter(name, it) }
    }
    return builder.appendQueryParameter("join", code).build().toString()
}

private fun safeWebLink(value: String): Boolean = Uri.parse(value).let { it.scheme == "https" && !it.host.isNullOrBlank() }
