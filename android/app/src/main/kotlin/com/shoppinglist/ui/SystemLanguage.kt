package com.shoppinglist.ui

fun systemLanguage(languageCode: String): String =
    if (languageCode.equals("he", ignoreCase = true) || languageCode.equals("iw", ignoreCase = true)) "he" else "en"
