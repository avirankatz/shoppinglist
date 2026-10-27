package com.shoppinglist

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModelProvider
import com.shoppinglist.ui.ShoppingApp
import com.shoppinglist.ui.ShoppingViewModel
import com.shoppinglist.ui.invitationCode

class MainActivity : ComponentActivity() {
    private var invitation by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        invitation = if (savedInstanceState != null) savedInstanceState.getString("invitation")
            else invitationCode(intent?.data, BuildConfig.WEB_APP_URL)
        val model = ViewModelProvider(this, ShoppingViewModel.Factory(application))[ShoppingViewModel::class.java]
        setContent { ShoppingApp(model, invitation) { invitation = null } }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        invitationCode(intent.data, BuildConfig.WEB_APP_URL)?.let { invitation = it }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putString("invitation", invitation)
        super.onSaveInstanceState(outState)
    }
}
