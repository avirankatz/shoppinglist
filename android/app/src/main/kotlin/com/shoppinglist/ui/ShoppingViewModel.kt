package com.shoppinglist.ui

import android.app.Application
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.shoppinglist.BuildConfig
import com.shoppinglist.data.ShoppingRepository
import com.shoppinglist.data.ShoppingState
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ShoppingViewModel(application: Application) : ViewModel() {
    val configured = Uri.parse(BuildConfig.SUPABASE_URL).let {
        it.scheme == "https" && !it.host.isNullOrBlank() && BuildConfig.SUPABASE_ANON_KEY.isNotBlank()
    }
    private val initialization = runCatching {
        if (configured) ShoppingRepository(
            application.applicationContext, BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_ANON_KEY,
        ) else null
    }
    private val repository = initialization.getOrNull()
    val available = repository != null
    val state: StateFlow<ShoppingState> = repository?.state ?: MutableStateFlow(ShoppingState())
    private val mutableBusy = MutableStateFlow(false)
    val busy = mutableBusy.asStateFlow()
    private val mutableReady = MutableStateFlow(!configured || initialization.isFailure)
    val ready = mutableReady.asStateFlow()
    private val mutableError = MutableStateFlow(initialization.exceptionOrNull()?.let { it.message ?: "Could not initialize local storage" })
    val error = mutableError.asStateFlow()
    private var foregroundJob: Job? = null

    init {
        if (repository != null) viewModelScope.launch {
            state.first { it.syncing }
            mutableReady.value = true
        }
    }

    fun foreground() {
        if (foregroundJob?.isActive == true || repository == null) return
        val previous = foregroundJob
        foregroundJob = viewModelScope.launch(Dispatchers.IO) {
            previous?.join()
            try {
                repository.start()
                withContext(Dispatchers.Main.immediate) { mutableReady.value = true }
                while (true) {
                    delay(30_000)
                    repository.sync()
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                mutableError.value = e.message ?: "Could not start sync"
                mutableReady.value = true
            } finally {
                repository.stopRealtime()
            }
        }
    }

    fun background() {
        foregroundJob?.cancel()
        repository?.stopRealtime()
    }

    // Repository methods report errors in state. A committed local change is a success,
    // even when a concurrent network sync fails; never duplicate an offline add.
    private fun perform(
        accepted: (ShoppingState, ShoppingState) -> Boolean,
        done: () -> Unit = {},
        operation: suspend ShoppingRepository.() -> Unit,
    ) {
        val repo = repository ?: return
        if (mutableBusy.value) return
        mutableBusy.value = true
        mutableError.value = null
        viewModelScope.launch {
            try {
                val before = state.value
                withContext(Dispatchers.IO) { repo.operation() }
                if (accepted(before, state.value)) done()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                mutableError.value = e.message ?: "Could not save changes"
            } finally {
                mutableBusy.value = false
            }
        }
    }

    fun add(text: String, done: () -> Unit) = perform(
        { before, after -> after.items.any { item -> before.items.none { it.id == item.id } && item.text == text.trim() } },
        done,
    ) { addItem(text) }
    fun edit(id: String, text: String, done: () -> Unit) = perform(
        { before, after -> after.items.any { it.id == id && it.text == text.trim() } &&
                    (after.error == null || before.items != after.items) }, done,
    ) { editItem(id, text) }
    fun check(id: String, checked: Boolean) = perform({ _, after -> after.items.any { it.id == id && it.checked == checked } }) { setChecked(id, checked) }
    fun delete(id: String) = perform({ _, after -> after.items.none { it.id == id } }) { deleteItem(id) }
    fun reorder(ids: List<String>, done: () -> Unit) {
        if (mutableBusy.value || repository == null) { done(); return }
        perform({ _, _ -> true }, done) { reorderItems(ids) }
    }
    fun clear(done: () -> Unit) = perform({ before, after -> after.items.none { it.checked } && (after.error == null || before.items != after.items) }, done) { clearDone() }
    fun restore() = perform({ _, after -> after.items.none { it.checked } }) { restoreDone() }
    fun rename(name: String, done: () -> Unit) = perform({ before, after -> after.list?.name == name.trim() && (after.error == null || before.list != after.list) }, done) { renameList(name) }
    fun leave(done: () -> Unit) = perform({ _, after -> after.list == null }, done) { leaveList() }
    fun create(name: String, displayName: String, done: () -> Unit) = perform(
        { before, after -> after.list != null && after.list.id != before.list?.id }, done,
    ) { createList(name, displayName) }
    fun join(code: String, displayName: String, done: () -> Unit) = perform(
        { before, after ->
            after.list?.invite_code.equals(code.trim(), ignoreCase = true) &&
                (before.list?.id != after.list?.id || (after.error == null && after.userName == displayName.trim()))
        }, done,
    ) { joinList(code, displayName) }
    fun refresh() = perform({ _, _ -> true }) { sync() }
    fun dismissError() { mutableError.value = null; repository?.clearError() }


    override fun onCleared() { repository?.close() }

    class Factory(private val application: Application) : ViewModelProvider.Factory {
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(ShoppingViewModel::class.java))
            @Suppress("UNCHECKED_CAST")
            return ShoppingViewModel(application) as T
        }
    }
}

/** Only accept this app's invitation URLs, never unrelated VIEW intents. */
fun invitationCode(uri: Uri?, webAppUrl: String): String? {
    uri ?: return null
    val web = Uri.parse(webAppUrl)
    val custom = uri.scheme == "shoppinglist" && uri.host == "join"
    val website = uri.scheme == "https" && web.scheme == "https" &&
        !web.host.isNullOrBlank() && uri.host.equals(web.host, ignoreCase = true) &&
        uri.port == web.port && uri.path.orEmpty().trimEnd('/') == web.path.orEmpty().trimEnd('/')
    if (!custom && !website) return null
    return uri.getQueryParameter("join")?.trim()?.takeIf { it.isNotEmpty() && it.length <= 128 }
}
