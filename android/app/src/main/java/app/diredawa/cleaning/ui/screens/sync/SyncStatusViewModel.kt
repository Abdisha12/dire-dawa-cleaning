package app.diredawa.cleaning.ui.screens.sync

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.diredawa.cleaning.data.offline.NetworkMonitor
import app.diredawa.cleaning.data.offline.QueueStatus
import app.diredawa.cleaning.data.offline.SyncQueue
import app.diredawa.cleaning.data.offline.SyncScheduler
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

/**
 * Sync/connectivity status (§43–§44). Distinguishes online/offline, pending
 * changes, syncing, and failures — and NEVER presents queued work as confirmed.
 */
class SyncStatusViewModel(
    private val networkMonitor: NetworkMonitor,
    private val queue: SyncQueue,
    private val appContext: Context,
) : ViewModel() {

    data class SyncUiState(
        val isOnline: Boolean = true,
        val pendingCount: Long = 0,
        val failedCount: Long = 0,
        val needsAuthCount: Long = 0,
    )

    private val _state = MutableStateFlow(SyncUiState())
    val state: StateFlow<SyncUiState> = _state.asStateFlow()

    private val pendingFlow = MutableStateFlow(0L)
    private val failedFlow = MutableStateFlow(0L)
    private val needsAuthFlow = MutableStateFlow(0L)

    init {
        refreshQueue()
        viewModelScope.launch {
            combine(
                networkMonitor.isOnline,
                pendingFlow,
                failedFlow,
                needsAuthFlow,
            ) { online, pending, failed, needsAuth ->
                SyncUiState(online, pending, failed, needsAuth)
            }.collect { _state.value = it }
        }
    }

    fun refreshQueue() {
        viewModelScope.launch {
            val cached = queue.all()
            pendingFlow.value = cached.count { it.status == QueueStatus.PENDING || it.status == QueueStatus.SYNCING }.toLong()
            failedFlow.value = cached.count { it.status == QueueStatus.FAILED }.toLong()
            needsAuthFlow.value = cached.count { it.status == QueueStatus.NEEDS_AUTH }.toLong()
        }
    }

    fun expediteSync() {
        viewModelScope.launch {
            SyncScheduler.requestCatchUp(appContext)
            refreshQueue()
        }
    }
}