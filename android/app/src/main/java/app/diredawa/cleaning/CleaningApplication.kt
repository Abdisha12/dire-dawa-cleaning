package app.diredawa.cleaning

import android.app.Application
import app.diredawa.cleaning.data.offline.SyncScheduler

class CleaningApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        AppGraph.container = AppContainer(this)
        // Scheduled, connectivity-gated sync pass for the offline queue (§38).
        // The worker itself no-ops while unauthenticated and never deletes queued work (§42).
        SyncScheduler.schedulePeriodic(this)
    }
}