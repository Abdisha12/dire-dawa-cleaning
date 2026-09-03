package app.diredawa.cleaning.data.offline

import android.content.Context
import androidx.work.ListenableWorker
import androidx.work.WorkerParameters
import androidx.work.CoroutineWorker
import app.diredawa.cleaning.AppGraph

/**
 * Thin WorkManager wrapper around [SyncEngine] (§38). Workers only do the
 * scheduling; the retry/conflict logic lives in the testable [SyncEngine].
 *
 * Skips work entirely when there is no authenticated session (the backend would
 * reject every queued mutation with 401 anyway). Queued records are never deleted
 * by this worker — only a confirmed 2xx removes them.
 */
class SyncWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val container = AppGraph.container.runCatching { this }.getOrNull() ?: return Result.retry()
        if (container.sessionManager.isAuthenticated.value.not()) {
            // Preserve queued work; wait until reauthentication restores a session (§42).
            return Result.retry()
        }

        val summary = container.syncEngine.processPendingOps()
        // Anything still pending (retryable / needs-auth) → schedule another pass.
        return if (summary.needsAuth > 0 || summary.retryable > 0) {
            Result.retry()
        } else {
            Result.success()
        }
    }
}