package app.diredawa.cleaning

import android.content.Context
import app.diredawa.cleaning.data.api.ApiClient
import app.diredawa.cleaning.data.api.ApiService
import app.diredawa.cleaning.data.auth.SecureTokenStore
import app.diredawa.cleaning.data.auth.SessionManager
import app.diredawa.cleaning.data.repository.AuthRepository
import app.diredawa.cleaning.data.repository.LocationRepository
import app.diredawa.cleaning.data.repository.OperationsRepository
import app.diredawa.cleaning.domain.usecase.ResolveScopeUseCase

/**
 * Hand-rolled service locator to keep the foundation free of a DI framework.
 * Responsible for wiring repositories/services once and exposing them.
 */
class AppContainer(context: Context) {

    private val appContext = context.applicationContext

    val secureTokenStore: SecureTokenStore by lazy { SecureTokenStore(appContext) }

    val sessionManager: SessionManager by lazy { SessionManager(secureTokenStore) }

    val apiService: ApiService by lazy {
        ApiClient.build(
            baseUrl = BuildConfig.DEFAULT_API_BASE_URL,
            tokenProvider = { secureTokenStore.token() },
        )
    }

    val authRepository: AuthRepository by lazy { AuthRepository(apiService, secureTokenStore, sessionManager) }
    val locationRepository: LocationRepository by lazy { LocationRepository(apiService) }
    val operationsRepository: OperationsRepository by lazy { OperationsRepository(apiService) }

    val resolveScopeUseCase: ResolveScopeUseCase by lazy { ResolveScopeUseCase() }
}

/** App-scoped container singleton accessor. */
object AppGraph {
    lateinit var container: AppContainer
}