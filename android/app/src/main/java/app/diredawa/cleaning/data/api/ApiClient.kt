package app.diredawa.cleaning.data.api

import app.diredawa.cleaning.BuildConfig
import java.util.concurrent.TimeUnit
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit

/**
 * Builds the single ApiService instance (§10). Responsible for:
 *  - Base URL selection from [BuildConfig.DEFAULT_API_BASE_URL] (config, not hardcoded).
 *  - [AuthInterceptor] for request auth + session-expiry signalling.
 *  - Strict JSON (ignore unknown keys to stay resilient to backend additions).
 *  - Timeouts. Debug-only HTTP body logging; release builds disable it (§33).
 */
object ApiClient {

    private var json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
    }

    fun build(
        baseUrl: String = BuildConfig.DEFAULT_API_BASE_URL,
        tokenProvider: () -> String?,
        sessionExpiredSink: (() -> Unit)? = null,
        enableLogging: Boolean = BuildConfig.DEBUG,
    ): ApiService {
        val interceptor = AuthInterceptor(tokenProvider)
        val builder = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(interceptor)

        // Debug-only logging; never log Authorization/token values (interceptor adds
        // header only, and HTTP logging here is body/status only in debug).
        if (enableLogging && BuildConfig.DEBUG) {
            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
            }
            builder.addInterceptor(logging)
        }

        val client = builder.build()

        return Retrofit.Builder()
            .baseUrl(normalizeBaseUrl(baseUrl))
            .client(client)
            .addConverterFactory(KotlinxSerializationConverterFactory(json))
            .build()
            .create(ApiService::class.java)
    }

    /** Ensures the base URL ends with a slash as Retrofit requires. */
    private fun normalizeBaseUrl(url: String): String = if (url.endsWith("/")) url else "$url/"
}