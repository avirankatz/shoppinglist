package com.shoppinglist.data

import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.buildJsonObject
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SupabaseTransportTest {
    @Test fun publishableKeyIsNotSentAsAnAuthenticationJwt(): Unit = runBlocking {
        val client = OkHttpClient.Builder().addInterceptor { chain ->
            val request = chain.request()
            assertEquals("sb_publishable_public-key", request.header("apikey"))
            if (request.url.encodedPath.startsWith("/auth/")) assertNull(request.header("Authorization"))
            else assertEquals("Bearer session-jwt", request.header("Authorization"))
            Response.Builder().request(request).protocol(Protocol.HTTP_1_1).code(200)
                .message("OK").body("{}".toResponseBody()).build()
        }.build()
        try {
            val api = SupabaseTransport("https://example.supabase.co", "sb_publishable_public-key", client)
            api.request("/auth/v1/signup", null, "POST", buildJsonObject {})
            api.request("/rest/v1/shopping_items", "session-jwt")
        } finally {
            client.dispatcher.executorService.shutdown()
            client.connectionPool.evictAll()
        }
    }
}
