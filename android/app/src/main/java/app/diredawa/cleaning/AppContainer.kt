package app.diredawa.cleaning

import android.content.Context
import app.diredawa.cleaning.data.api.ApiClient
import app.diredawa.cleaning.data.api.ApiService
import app.diredawa.cleaning.data.auth.SecureTokenStore
import app.diredawa.cleaning.data.auth.SessionManager
import app.diredawa.cleaning.data.offline.JsonQueuePayloadCodec
import app.diredawa.cleaning.data.offline.NetworkMonitor
import app.diredawa.cleaning.data.offline.RealNetworkMonitor
import app.diredawa.cleaning.data.offline.RoomSyncQueue
import app.diredawa.cleaning.data.offline.SyncEngine
import app.diredawa.cleaning.data.offline.SyncQueue
import app.diredawa.cleaning.data.offline.local.FieldDatabase
import app.diredawa.cleaning.data.repository.AuthRepository
import app.diredawa.cleaning.data.repository.FieldRepository
import app.diredawa.cleaning.data.repository.LocationRepository
import app.diredawa.cleaning.data.repository.OperationsRepository
import app.diredawa.cleaning.domain.usecase.ResolveScopeUseCase
import app.diredawa.cleaning.field.LocationProvider
import app.diredawa.cleaning.field.PhotoProcessor

/**
 * Hand-rolled service locator (no DI framework) wiring repositories, offline
 * queue/sync, and field helpers once and exposing them (§10, §34, §56).
 */
class AppContainer(context: Context) {

    val appContext = context.applicationContext

    val secureTokenStore: SecureTokenStore by lazy { SecureTokenStore(appContext) }

    val sessionManager: SessionManager by lazy { SessionManager(secureTokenStore) }

    val apiService: ApiService by lazy {
        ApiClient.build(
            baseUrl = BuildConfig.DEFAULT_API_BASE_URL,
            tokenProvider = { secureTokenStore.token() },
        )
    }

    // ── Offline (Room queue + WorkManager sync) ─────────────────────────────
    val fieldDatabase: FieldDatabase by lazy { FieldDatabase.get(appContext) }

    val syncQueue: SyncQueue by lazy {
        RoomSyncQueue(fieldDatabase.pendingOperationDao(), JsonQueuePayloadCodec())
    }

    val photoWorkDir: java.io.File by lazy {
        java.io.File(appContext.cacheDir, "field_photos").apply { mkdirs() }
    }

    private val providePhotoDir: () -> java.io.File = { photoWorkDir }

    val syncEngine: SyncEngine by lazy {
        SyncEngine(
            queue = syncQueue,
            api = apiService,
            photoDir = providePhotoDir,
        )
    }

    val networkMonitor: NetworkMonitor by lazy { RealNetworkMonitor(appContext) }

    // ── Repositories ────────────────────────────────────────────────────────
    val authRepository: AuthRepository by lazy { AuthRepository(apiService, secureTokenStore, sessionManager) }
    val locationRepository: LocationRepository by lazy { LocationRepository(apiService) }
    val operationsRepository: OperationsRepository by lazy { OperationsRepository(apiService) }
    val fieldRepository: FieldRepository by lazy {
        FieldRepository(
            api = apiService,
            queue = syncQueue,
            photoDir = providePhotoDir,
            workerCache = fieldDatabase.cachedWorkerDao(),
        )
    }

    // ── Field helpers ───────────────────────────────────────────────────────
    val locationProvider: LocationProvider by lazy { LocationProvider(appContext) }
    val photoProcessor: PhotoProcessor by lazy { PhotoProcessor(appContext) }

    val resolveScopeUseCase: ResolveScopeUseCase by lazy { ResolveScopeUseCase() }
}

/** App-scoped container singleton accessor. */
object AppGraph {
    lateinit var container: AppContainer
}