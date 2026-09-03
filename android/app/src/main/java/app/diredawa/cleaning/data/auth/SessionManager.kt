package app.diredawa.cleaning.data.auth

import app.diredawa.cleaning.domain.model.AuthenticatedUser
import app.diredawa.cleaning.domain.model.Role
import app.diredawa.cleaning.domain.model.Zone
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Owns the authentication/session state for the app (observable via StateFlow).
 *  - Restores a cached session from secure storage on start (presentation only;
 *    backend stays authority).
 *  - Provides observers for the navigation layer to react to session expiry.
 *  - Never logs credentials, tokens, or headers (§9).
 *
 * This is a plain app-scoped class (not a ViewModel) so both repositories and
 * ViewModels can observe it without coupling repositories to the Android
 * ViewModel lifecycle.
 */
class SessionManager(
    private val tokenStore: SessionStorage,
) {

    private val _isAuthenticated = MutableStateFlow(tokenStore.user() != null)
    val isAuthenticated: StateFlow<Boolean> = _isAuthenticated.asStateFlow()

    private val _currentUser = MutableStateFlow<AuthenticatedUser?>(tokenStore.user())
    val currentUser: StateFlow<AuthenticatedUser?> = _currentUser.asStateFlow()

    fun cachedUser(): AuthenticatedUser? = tokenStore.user()

    fun persistSession(token: String, user: AuthenticatedUser) {
        tokenStore.saveSession(token, user)
        _currentUser.value = user
        _isAuthenticated.value = true
    }

    fun invalidate() {
        tokenStore.clear()
        _currentUser.value = null
        _isAuthenticated.value = false
    }

    fun updateUserFromMe(id: Long, username: String, fullName: String, role: String, phone: String?, zone: Zone?) {
        val user = AuthenticatedUser(id, username, fullName, Role.fromApi(role), phone, zone)
        val token = tokenStore.token() ?: return
        tokenStore.saveSession(token, user)
        _currentUser.value = user
    }
}