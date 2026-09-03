package app.diredawa.cleaning.data.api

/**
 * Sealed result type for all API calls (§10). `ApiResult` carries a typed success
 * value, or an [NetworkError] on failure. Never exposes backend stack traces to the UI.
 */
sealed interface ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>
    data class Failure(val error: NetworkError) : ApiResult<Nothing>
}

/**
 * Consistent error classification (§12). Maps HTTP statuses and transport failures
 * to user-safe messages. Backend stack traces are never surfaced.
 */
enum class ErrorKind {
    NETWORK,
    TIMEOUT,
    UNAUTHORIZED, // 401
    FORBIDDEN,    // 403
    NOT_FOUND,    // 404
    CONFLICT,     // 409
    VALIDATION,   // 422
    RATE_LIMITED, // 429
    SERVER,       // 5xx
    UNKNOWN,
}

data class NetworkError(
    val kind: ErrorKind,
    val statusCode: Int = 0,
    val message: String,
    /** True when the session is invalid/expired and the user must re-authenticate. */
    val sessionExpired: Boolean = false,
) {
    companion object {
        fun unauthorized(message: String = "Session expired — please sign in again.") =
            NetworkError(ErrorKind.UNAUTHORIZED, 401, message, sessionExpired = true)

        fun network(message: String = "Unable to reach the server. Check your connection.") =
            NetworkError(ErrorKind.NETWORK, 0, message)

        fun timeout(message: String = "Request timed out. Please try again.") =
            NetworkError(ErrorKind.TIMEOUT, 0, message)
    }
}