package com.shoppinglist.data

import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.json.JsonElement
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

internal class ApiException(val status: Int, message: String) : IOException(message)

internal class SupabaseTransport(
    val url: String,
    val key: String,
    val client: OkHttpClient = OkHttpClient.Builder().followRedirects(false).followSslRedirects(false)
        .callTimeout(java.time.Duration.ofSeconds(30)).build(),
) {

    suspend fun request(path: String, token: String?, method: String = "GET", body: JsonElement? = null, prefer: String? = null): String {
        require(url.startsWith("https://") && key.isNotBlank()) { "A valid HTTPS Supabase URL and anonymous key are required" }
        val request = Request.Builder().url("$url$path")
            .header("apikey", key)
            .apply {
                // Publishable API keys are not JWTs; only sessions belong in Authorization.
                if (token != null) header("Authorization", "Bearer $token")
                if (prefer != null) header("Prefer", prefer)
            }
            .method(method, if (method == "GET" || method == "DELETE") null else
                (body?.toString() ?: "{}").toRequestBody("application/json".toMediaType())).build()
        return suspendCancellableCoroutine { continuation ->
            val call = client.newCall(request)
            continuation.invokeOnCancellation { call.cancel() }
            call.enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    if (!continuation.isCancelled) continuation.resumeWithException(e)
                }
                override fun onResponse(call: Call, response: Response) {
                    try {
                        response.use {
                            val text = it.body?.string().orEmpty()
                            if (!it.isSuccessful) throw ApiException(it.code, "Supabase request failed (${it.code}): ${text.take(400)}")
                            continuation.resume(text)
                        }
                    } catch (e: Exception) {
                        if (!continuation.isCancelled) continuation.resumeWithException(e)
                    }
                }
            })
        }
    }
}
