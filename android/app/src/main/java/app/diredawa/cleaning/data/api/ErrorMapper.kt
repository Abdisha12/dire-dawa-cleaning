package app.diredawa.cleaning.data.api

import java.io.IOException
import retrofit2.HttpException

/**
 * Central mapping from low-level exceptions to user-safe [NetworkError] values (§12).
 * Backend stack traces are never exposed.
 */
object ErrorMapper {
    fun map(e: Throwable): NetworkError = when (e) {
        is HttpException -> {
            when (e.code()) {
                401 -> NetworkError.unauthorized()
                403 -> NetworkError(ErrorKind.FORBIDDEN, 403, "Access denied.")
                404 -> NetworkError(ErrorKind.NOT_FOUND, 404, "Not found.")
                409 -> NetworkError(ErrorKind.CONFLICT, 409, "Conflict.")
                // 400 is the backend's validation / bad-request status (errorHandler + inline checks).
                400, 422 -> NetworkError(ErrorKind.VALIDATION, e.code(), "Invalid input.")
                429 -> NetworkError(ErrorKind.RATE_LIMITED, 429, "Too many requests. Try again later.")
                in 500..599 -> NetworkError(ErrorKind.SERVER, e.code(), "Server error. Please try again.")
                else -> NetworkError(ErrorKind.SERVER, e.code(), "Server error.")
            }
        }
        is NetworkIOException -> NetworkError.network()
        is IOException -> NetworkError.network()
        else -> NetworkError(ErrorKind.UNKNOWN, 0, "Unexpected error.")
    }
}