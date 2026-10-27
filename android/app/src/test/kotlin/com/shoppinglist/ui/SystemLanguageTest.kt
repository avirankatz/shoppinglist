package com.shoppinglist.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class SystemLanguageTest {
    @Test fun hebrewAndLegacyAliasUseHebrew() {
        for (code in listOf("he", "iw", "HE", "IW")) assertEquals("he", systemLanguage(code))
    }

    @Test fun otherLanguagesUseEnglish() {
        for (code in listOf("en", "ar", "fa", "fr", "ru", "", "unknown")) {
            assertEquals("en", systemLanguage(code))
        }
    }

    @Test fun languageChangesAreResolvedOnEachCall() {
        assertEquals("he", systemLanguage("he"))
        assertEquals("en", systemLanguage("fr"))
        assertEquals("he", systemLanguage("iw"))
    }
}
