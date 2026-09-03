package app.diredawa.cleaning.data.offline

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.OutOfQuotaPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/**
 * Schedules the controlled [SyncWorker] (§38). Two triggers:
 *  1. a periodic pass that only runs when the device is connected, and
 *  2. an expedited one-shot used when connectivity is restored or after
 *     reauthentication (§42).
 *
 * WorkRequests are keyed by unique names so we never spawn uncontrolled background
 * loops. Pending operations that hit a session-expiry are deliberately left in the
 * queue (never auto-deleted) and require reauthentication (§42).
 */
object SyncScheduler {

    private const val PERIODIC = "field_sync_periodic"
    private const val CATCHUP = "field_sync_catchup"

    /** Period begins only when Connectivity satisfies the Constraints (network connected). */
    fun schedulePeriodic(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = PeriodicWorkRequestBuilder<SyncWorker>(30, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()

        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    /** An expedited one-shot catch-up pass (connectivity restored / reauthenticated). */
    fun requestCatchUp(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(constraints)
            .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
            .build()

        WorkManager.getInstance(context)
            .enqueueUniqueWork(CATCHUP, ExistingWorkPolicy.REPLACE, request)
    }
}