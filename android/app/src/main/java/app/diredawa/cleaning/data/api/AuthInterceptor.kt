package app.diredawa.cleaning.data.api

import java.io.IOException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Attaches the stored session token to every request using the exact header the
 * backend expects: `x-session-token`. The backend also accepts
 * `Authorization: Bearer` (auth middleware), but `x-session-token` is canonical here.
 *
 * Tokens are read from secure storage via [tokenProvider]; they are never logged.
 *
 * On 401 the session is considered expired/invalid; the observer flow is signalled
 * so the app can redirect to login without exposing token values.
 */
class AuthInterceptor(
    private val tokenProvider: () -> String?,
) : Interceptor {

    private val _sessionExpired = MutableStateFlow(false)
    val sessionExpired: StateFlow<Boolean> = _sessionExpired.asStateFlow()

    override fun intercept(chain: Interceptor.Chain): Response {
        val requestBuilder = chain.request().newBuilder()
        val token = tokenProvider()

        // Never send an empty/blank token header.
        if (!token.isNullOrBlank()) {
            requestBuilder.header("X-Session-Token", token)
            requestBuilder.header("Authorization", "Bearer $token")
        }

        val response = try {
            chain.proceed(requestBuilder.build())
        } catch (io: IOException) {
            // Transport error — network offline/unreachable. Re-throw as ISE? No:
            // map to a typed failure upstream. We signal via exception type instead.
            throw NetworkIOException(io)
        }

        if (response.code == 401) {
            _sessionExpired.value = true
        }
        return response
    }

    /** Marks the session as expired externally (e.g., explicit logout). */
    fun clearSessionState() {
        _sessionExpired.value = false
    }
}

/** Wraps an [IOException] so the repository can classify it as a network error. */
class NetworkIOException(cause: IOException) : IOException("Network error", cause)