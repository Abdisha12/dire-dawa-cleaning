package app.diredawa.cleaning.data.offline

import app.diredawa.cleaning.data.offline.local.CachedWorkerEntity
import app.diredawa.cleaning.data.offline.local.PendingOperationDao
import app.diredawa.cleaning.data.offline.local.PendingOperationEntity
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * Abstraction over the Room queue that keeps the [SyncEngine] testable in a plain
 * JVM environment (Room DAOs require instrumentation). The production
 * implementation delegates to [PendingOperationDao]; tests substitute an in-memory
 * fake.
 */
interface SyncQueue {

    suspend fun enqueue(operationType: QueueOperationType, payload: Any?): Long
    suspend fun drainable(): List<PendingOperation>
    suspend fun all(): List<PendingOperation>
    suspend fun markSyncing(localId: Long)
    suspend fun markFailed(localId: Long, error: String)
    suspend fun markNeedsAuth(localId: Long)
    suspend fun incrementAttempt(localId: Long, error: String?)
    suspend fun confirm(localId: Long)
    suspend fun pendingCount(): Int
}

/** Production [SyncQueue] backed by [PendingOperationDao] and a [QueuePayloadCodec]. */
class RoomSyncQueue(
    private val dao: PendingOperationDao,
    private val codec: QueuePayloadCodec,
) : SyncQueue {

    override suspend fun enqueue(operationType: QueueOperationType, payload: Any?): Long =
        dao.insert(
            PendingOperationEntity(
                operationType = operationType.apiValue,
                payloadJson = codec.encode(operationType, payload),
                createdAt = System.currentTimeMillis(),
                status = QueueStatus.PENDING.name,
            ),
        )

    override suspend fun drainable(): List<PendingOperation> =
        dao.drainable().map { it.toDomain(codec) }

    override suspend fun all(): List<PendingOperation> =
        dao.all().map { it.toDomain(codec) }

    override suspend fun markSyncing(localId: Long) = dao.setStatus(localId, QueueStatus.SYNCING.name)

    override suspend fun markFailed(localId: Long, error: String) {
        dao.incrementAttempt(localId, error)
        dao.setStatus(localId, QueueStatus.FAILED.name)
    }

    override suspend fun markNeedsAuth(localId: Long) {
        dao.incrementAttempt(localId, "session expired")
        dao.setStatus(localId, QueueStatus.NEEDS_AUTH.name)
    }

    override suspend fun incrementAttempt(localId: Long, error: String?) =
        dao.incrementAttempt(localId, error)

    override suspend fun confirm(localId: Long) = dao.delete(localId)

    override suspend fun pendingCount(): Int = dao.countPending()

    private fun PendingOperationEntity.toDomain(codec: QueuePayloadCodec): PendingOperation =
        PendingOperation(
            localId = localId,
            operationType = QueueOperationType.fromApi(operationType) ?: QueueOperationType.ATTENDANCE_BULK,
            payload = codec.decode(operationType, payloadJson),
            createdAt = createdAt,
            attemptCount = attemptCount,
            status = runCatching { QueueStatus.valueOf(status) }.getOrDefault(QueueStatus.PENDING),
            lastError = lastError,
        )
}

/** Serializes/deserializes queue payload JSON (§37, §41). No tokens stored. */
interface QueuePayloadCodec {
    fun encode(type: QueueOperationType, payload: Any?): String
    fun decode(type: String, json: String): Any?
}

class JsonQueuePayloadCodec(
    private val json: Json = Json { ignoreUnknownKeys = true },
) : QueuePayloadCodec {

    override fun encode(type: QueueOperationType, payload: Any?): String = when (type) {
        QueueOperationType.ATTENDANCE_BULK ->
            json.encodeToString<AttendanceBulkPayload>(payload as AttendanceBulkPayload)
        QueueOperationType.INSPECTION_CREATE ->
            json.encodeToString<InspectionCreatePayload>(payload as InspectionCreatePayload)
        QueueOperationType.ZONE_REPORT_CREATE ->
            json.encodeToString<ZoneReportCreatePayload>(payload as ZoneReportCreatePayload)
        QueueOperationType.ZONE_REPORT_UPDATE ->
            json.encodeToString<ZoneReportUpdatePayload>(payload as ZoneReportUpdatePayload)
    }

    override fun decode(type: String, jsonStr: String): Any? = when (type) {
        QueueOperationType.ATTENDANCE_BULK.apiValue ->
            json.decodeFromString<AttendanceBulkPayload>(jsonStr)
        QueueOperationType.INSPECTION_CREATE.apiValue ->
            json.decodeFromString<InspectionCreatePayload>(jsonStr)
        QueueOperationType.ZONE_REPORT_CREATE.apiValue ->
            json.decodeFromString<ZoneReportCreatePayload>(jsonStr)
        QueueOperationType.ZONE_REPORT_UPDATE.apiValue ->
            json.decodeFromString<ZoneReportUpdatePayload>(jsonStr)
        else -> null
    }
}

/** Keeps CachedWorkerEntity out of domain; a tiny Mapper helper for tests. */
fun CachedWorkerEntity.toDomain(): app.diredawa.cleaning.domain.model.Worker =
    app.diredawa.cleaning.domain.model.Worker(
        id = workerId,
        fullName = fullName,
        zoneName = zoneName,
        isActive = isActive,
    )