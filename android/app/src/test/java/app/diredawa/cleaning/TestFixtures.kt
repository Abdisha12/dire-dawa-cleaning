package app.diredawa.cleaning

import app.diredawa.cleaning.data.auth.SessionStorage
import app.diredawa.cleaning.data.auth.SessionManager
import app.diredawa.cleaning.domain.model.AuthenticatedUser
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.StateFlow

/** In-memory [SessionStorage] for unit tests (no Android framework). */
class FakeSessionStorage : SessionStorage {
    var storedToken: String? = null
    var storedUser: AuthenticatedUser? = null

    override fun token(): String? = storedToken
    override fun user(): AuthenticatedUser? = storedUser
    override fun saveSession(token: String, user: AuthenticatedUser) {
        storedToken = token
        storedUser = user
    }
    override fun clear() {
        storedToken = null
        storedUser = null
    }
}

fun fakeSessionManager(storage: FakeSessionStorage): SessionManager = SessionManager(storage)

/**
 * Polls a [StateFlow] until [predicate] holds or the timeout elapses. Used by
 * ViewModel tests that drive a real (MockWebServer) network call on OkHttp's
 * background thread, which resumes the coroutine off the test dispatcher.
 */
suspend fun <T> awaitState(
    flow: StateFlow<T>,
    timeoutMs: Long = 5_000,
    predicate: (T) -> Boolean,
): T {
    val deadline = System.currentTimeMillis() + timeoutMs
    while (System.currentTimeMillis() < deadline) {
        val value = flow.value
        if (predicate(value)) return value
        delay(10)
    }
    throw AssertionError("Expected state never reached. Current: ${flow.value}")
}