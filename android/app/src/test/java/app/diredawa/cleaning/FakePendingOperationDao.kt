package app.diredawa.cleaning

import app.diredawa.cleaning.data.offline.QueueStatus
import app.diredawa.cleaning.data.offline.local.PendingOperationDao
import app.diredawa.cleaning.data.offline.local.PendingOperationEntity

/**
 * In-memory [PendingOperationDao] for JVM tests (Room requires instrumentation).
 * Shared across sync/field tests so offline queue behaviour can be asserted
 * without an Android runtime.
 */
class FakePendingOperationDao : PendingOperationDao {
    private val store = LinkedHashMap<Long, PendingOperationEntity?>()
    private var nextId = 1L

    override suspend fun insert(entity: PendingOperationEntity): Long {
        val id = if (entity.localId == 0L) nextId++ else entity.localId
        store[id] = entity.copy(localId = id)
        return id
    }

    override suspend fun drainable(): List<PendingOperationEntity> =
        store.values.filterNotNull()
            .filter { it.status in setOf(QueueStatus.PENDING.name, QueueStatus.SYNCING.name, QueueStatus.NEEDS_AUTH.name) }
            .sortedBy { it.createdAt }

    override suspend fun all(): List<PendingOperationEntity> =
        store.values.filterNotNull().sortedByDescending { it.createdAt }

    override suspend fun setStatus(id: Long, status: String) {
        store[id] = store[id]?.copy(status = status)
    }

    override suspend fun incrementAttempt(id: Long, error: String?) {
        store[id] = store[id]?.let { it.copy(attemptCount = it.attemptCount + 1, lastError = error) }
    }

    override suspend fun delete(id: Long) {
        store.remove(id)
    }

    override suspend fun countAll(): Int = store.size

    override suspend fun countPending(): Int =
        store.values.filterNotNull().count { it.status in setOf(QueueStatus.PENDING.name, QueueStatus.SYNCING.name, QueueStatus.NEEDS_AUTH.name) }
}