package app.diredawa.cleaning.data.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import app.diredawa.cleaning.domain.model.AuthenticatedUser
import app.diredawa.cleaning.domain.model.Role
import app.diredawa.cleaning.domain.model.Zone

/**
 * Storage abstraction so repository/logic tests don't need the Android framework.
 * Production implementation: [SecureTokenStore] (EncryptedSharedPreferences).
 */
interface SessionStorage {
    fun token(): String?
    fun user(): AuthenticatedUser?
    fun saveSession(token: String, user: AuthenticatedUser)
    fun clear()
}

/**
 * Stores the session token and a minimal user snapshot for offline session restore.
 *
 * Security (§9, §28):
 *  - Token is stored via EncryptedSharedPreferences (AES/GCM-backed), NOT plaintext
 *    SharedPreferences, logs, or analytics.
 *  - Passwords are never persisted.
 *  - The stored user snapshot is minimal (no sensitive fields).
 */
class SecureTokenStore(context: Context) : SessionStorage {

    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    override fun saveSession(token: String, user: AuthenticatedUser) {
        prefs.edit()
            .putString(KEY_TOKEN, token)
            .putLong(KEY_USER_ID, user.id)
            .putString(KEY_USERNAME, user.username)
            .putString(KEY_FULL_NAME, user.fullName)
            .putString(KEY_ROLE, user.role.apiValue)
            .putString(KEY_PHONE, user.phone)
            .putLong(KEY_ZONE_ID, user.zone?.id ?: -1L)
            .putString(KEY_ZONE_NAME, user.zone?.name)
            .putLong(KEY_ZONE_KEBELE_ID, user.zone?.kebeleId ?: -1L)
            .putString(KEY_ZONE_KEBELE_NAME, user.zone?.kebeleName)
            .apply()
    }

    override fun token(): String? = prefs.getString(KEY_TOKEN, null)

    override fun user(): AuthenticatedUser? {
        val token = token() ?: return null
        val role = Role.fromApi(prefs.getString(KEY_ROLE, null))
        val zoneId = prefs.getLong(KEY_ZONE_ID, -1L)
        val zone = if (zoneId > 0) {
            Zone(
                id = zoneId,
                name = prefs.getString(KEY_ZONE_NAME, "").orEmpty(),
                kebeleId = prefs.getLong(KEY_ZONE_KEBELE_ID, -1L).takeIf { it > 0 },
                kebeleName = prefs.getString(KEY_ZONE_KEBELE_NAME, null),
            )
        } else {
            null
        }
        // Presence of a token does not guarantee a valid session — backend is authority.
        return AuthenticatedUser(
            id = prefs.getLong(KEY_USER_ID, -1L),
            username = prefs.getString(KEY_USERNAME, "").orEmpty(),
            fullName = prefs.getString(KEY_FULL_NAME, "").orEmpty(),
            role = role,
            phone = prefs.getString(KEY_PHONE, null),
            zone = zone,
        )
    }

    override fun clear() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val FILE_NAME = "secure_session"
        private const val KEY_TOKEN = "session_token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USERNAME = "username"
        private const val KEY_FULL_NAME = "full_name"
        private const val KEY_ROLE = "role"
        private const val KEY_PHONE = "phone"
        private const val KEY_ZONE_ID = "zone_id"
        private const val KEY_ZONE_NAME = "zone_name"
        private const val KEY_ZONE_KEBELE_ID = "zone_kebele_id"
        private const val KEY_ZONE_KEBELE_NAME = "zone_kebele_name"
    }
}