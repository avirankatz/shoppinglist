package com.shoppinglist.data

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.io.IOException
import java.security.KeyStore
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class SecureStoreTest {
    @Test fun offlineEditsSurviveRepositoryRecreationInEncryptedStorage() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val namespace = UUID.randomUUID().toString()
        val file = File(context.noBackupFilesDir, "shopping-$namespace.enc")
        val store = SecureStore(context, namespace)
        val client = OkHttpClient.Builder().addInterceptor { throw IOException("Offline for test") }.build()
        fun repository() = ShoppingRepository(
            SupabaseTransport("https://example.supabase.co", "public-key", client), store::read, store::write,
        )
        var repo: ShoppingRepository? = null
        try {
            val list = ShoppingList(UUID.randomUUID().toString(), "ABCD-EFGH-IJKL", "Family", "owner")
            store.write(Snapshot(session = Session("access-token", "refresh-token", "owner", Long.MAX_VALUE), list = list))
            repo = repository()
            repo.sync()
            repo.addItem("Milk")
            val id = repo.state.value.items.single().id
            repo.editItem(id, "Oat milk")
            repo.setChecked(id, true)

            assertEquals(3, repo.state.value.pendingCount)
            repo.close()
            repo = repository()
            repo.sync()
            val state = repo.state.value
            assertEquals(list, state.list)
            assertEquals("owner", state.userId)

            assertEquals(id, state.items.single().id)
            assertEquals("Oat milk", state.items.single().text)
            assertTrue(state.items.single().checked)
            assertEquals(3, state.pendingCount)
            assertNotNull(state.error)
            val bytes = file.readBytes().toString(Charsets.ISO_8859_1)
            assertFalse(bytes.contains("refresh-token"))
            assertFalse(bytes.contains("Oat milk"))
            assertEquals("refresh-token", SecureStore(context, namespace).read().session?.refresh)
        } finally {
            repo?.close()
            client.dispatcher.executorService.shutdown()
            file.delete()
            KeyStore.getInstance("AndroidKeyStore").apply { load(null); deleteEntry("shopping-session-$namespace") }
        }
    }

    @Test fun lostEncryptionKeyNeverSilentlyReplacesAnExistingSession() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val namespace = UUID.randomUUID().toString()
        val file = File(context.noBackupFilesDir, "shopping-$namespace.enc")
        val alias = "shopping-session-$namespace"
        val keys = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        try {
            SecureStore(context, namespace).write(Snapshot(session = Session("access", "refresh", "owner", 123)))
            val before = file.readBytes()
            keys.deleteEntry(alias)
            try {
                SecureStore(context, namespace).read()
                fail("Missing encryption key must fail, not create a new identity")
            } catch (expected: IllegalStateException) {
                assertTrue(expected.message.orEmpty().contains("cannot be recovered"))
            }
            assertArrayEquals(before, file.readBytes())
            assertFalse(keys.containsAlias(alias))
        } finally {
            file.delete()
            keys.deleteEntry(alias)
        }
    }
}
