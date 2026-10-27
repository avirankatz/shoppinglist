package com.shoppinglist.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import kotlinx.serialization.json.Json
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

internal val dataJson = Json { ignoreUnknownKeys = true; encodeDefaults = true }

internal class SecureStore(context: Context, namespace: String) {
    private val file = AtomicFile(File(context.noBackupFilesDir, "shopping-$namespace.enc"))
    private val alias = "shopping-session-$namespace"

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        check(!file.baseFile.exists() && !File(file.baseFile.path + ".bak").exists()) {
            "Session encryption key is missing; existing identity cannot be recovered"
        }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }

    fun read(): Snapshot {
        if (!file.baseFile.exists() && !File(file.baseFile.path + ".bak").exists()) return Snapshot()
        val bytes = file.readFully()
        require(bytes.size > 12) { "Invalid encrypted session" }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
        cipher.updateAAD(alias.toByteArray())
        return dataJson.decodeFromString(cipher.doFinal(bytes.copyOfRange(12, bytes.size)).decodeToString())
    }

    fun write(value: Snapshot) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        cipher.updateAAD(alias.toByteArray())
        val bytes = cipher.iv + cipher.doFinal(dataJson.encodeToString(Snapshot.serializer(), value).toByteArray())
        val stream = file.startWrite()
        try {
            stream.write(bytes)
            file.finishWrite(stream)
        } catch (e: Exception) {
            file.failWrite(stream)
            throw e
        }
    }
}
