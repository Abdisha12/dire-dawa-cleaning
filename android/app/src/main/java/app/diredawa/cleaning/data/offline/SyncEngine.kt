package app.diredawa.cleaning.data.offline

import app.diredawa.cleaning.data.api.ApiService
import app.diredawa.cleaning.data.api.ErrorKind
import app.diredawa.cleaning.data.api.ErrorMapper
import app.diredawa.cleaning.data.api.NetworkError
import app.diredawa.cleaning.data.model.AttendanceBulkRecord
import app.diredawa.cleaning.data.model.AttendanceBulkRequest
import app.diredawa.cleaning.data.model.ZoneReportCreateRequest
import app.diredawa.cleaning.data.model.ZoneReportUpdateRequest
import java.io.File
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Drains the offline queue against the authoritative backend (§38–§42).
 *
 * The [SyncEngine] is intentionally framework-free (no Room, no WorkManager) so
 * its retry/idempotency/conflict logic is unit-testable on the JVM. A thin
 * WorkManager worker and the Web-view call into this class.
 *
 * Classification (§41):
 *  - RETRYABLE  -> NETWORK, TIMEOUT, SERVER (5xx), RATE_LIMITED (429): increment
 *                 attempt count, keep PENDING, allow a later sync pass.
 *  - PERMANENT  -> VALIDATION (400), CONFLICT (409), FORBIDDEN (403), NOT_FOUND:
 *                 mark FAILED, stop automatic retries, surface to the user.
 *  - NEEDS_AUTH -> UNAUTHORIZED (401): keep the payload, mark NEEDS_AUTH, require
 *                 reauthentication before retrying (§42). The payload is NOT discarded.
 */
class SyncEngine(
    private val queue: SyncQueue,
    private val api: ApiService,
    private val photoDir: () -> File? = { null },
    private val maxAttempts: Int = 5,
) {

    /** Processes one drain pass. Once per call, the worker can mark timings. */
    suspend fun processPendingOps(): SyncSummary {
        val summary = SyncSummary()
        val items = queue.drainable()
        for (item in items) {
            if (item.status == QueueStatus.NEEDS_AUTH) {
                // Guard: if the session is now valid again the caller clears NEEDS_AUTH;
                // otherwise skip (reauthentication required).
                continue
            }
            if (item.attemptCount >= maxAttempts) {
                queue.markFailed(item.localId, "Too many attempts. Please retry manually.")
                summary.permanentlyFailed += 1
                continue
            }
            queue.markSyncing(item.localId)
            try {
                when (item.operationType) {
                    QueueOperationType.ATTENDANCE_BULK -> replayAttendance(item)
                    QueueOperationType.INSPECTION_CREATE -> replayInspectionCreate(item)
                    QueueOperationType.ZONE_REPORT_CREATE -> replayZoneReportCreate(item)
                    QueueOperationType.ZONE_REPORT_UPDATE -> replayZoneReportUpdate(item)
                }
                queue.confirm(item.localId)
                summary.confirmed += 1
            } catch (e: Exception) {
                handleError(item, e, summary)
            }
        }
        return summary
    }

    private suspend fun replayAttendance(item: PendingOperation) {
        val payload = item.payload as AttendanceBulkPayload
        api.saveAttendanceBulk(
            AttendanceBulkRequest(
                date = payload.date,
                records = payload.records.map {
                    AttendanceBulkRecord(workerId = it.workerId, present = it.present, bonus = it.bonus)
                },
            ),
        )
    }

    private suspend fun replayInspectionCreate(item: PendingOperation) {
        val payload = item.payload as InspectionCreatePayload
        val part = fun(name: String, value: String) = value.toRequestBody("text/plain".toMediaType())
        val photos = payload.photoFileNames.mapNotNull { fileName ->
            val dir = photoDir() ?: return@mapNotNull null
            val file = File(dir, fileName)
            if (file.exists()) {
                MultipartBody.Part.createFormData(
                    "photos",
                    fileName,
                    file.asRequestBody("image/jpeg".toMediaType()),
                )
            } else null
        }
        api.createInspection(
            kebeleId = part("kebeleId", payload.kebeleId.toString()),
            saferZoneId = part("saferZoneId", payload.saferZoneId?.toString() ?: "null"),
            date = part("date", payload.date),
            status = part("status", payload.status),
            notes = part("notes", payload.notes ?: ""),
            photos = photos,
        )
    }

    private suspend fun replayZoneReportCreate(item: PendingOperation) {
        val payload = item.payload as ZoneReportCreatePayload
        api.createZoneReport(
            ZoneReportCreateRequest(
                saferZoneId = payload.saferZoneId,
                reportDate = payload.reportDate,
                reportMonth = payload.reportMonth,
                reportYear = payload.reportYear,
                workersPresent = payload.workersPresent,
                workersAbsent = payload.workersAbsent,
                collectionTotal = payload.collectionTotal,
                issuesReported = payload.issuesReported,
                actionsTaken = payload.actionsTaken,
                toolsStatus = payload.toolsStatus,
            ),
        )
    }

    private suspend fun replayZoneReportUpdate(item: PendingOperation) {
        val payload = item.payload as ZoneReportUpdatePayload
        api.updateZoneReport(
            payload.reportId,
            ZoneReportUpdateRequest(
                workersPresent = payload.workersPresent,
                workersAbsent = payload.workersAbsent,
                collectionTotal = payload.collectionTotal,
                issuesReported = payload.issuesReported,
                actionsTaken = payload.actionsTaken,
                toolsStatus = payload.toolsStatus,
                status = payload.status,
            ),
        )
    }

    private suspend fun handleError(item: PendingOperation, e: Exception, summary: SyncSummary) {
        val error = ErrorMapper.map(e)
        when {
            error.sessionExpired || error.kind == ErrorKind.UNAUTHORIZED -> {
                // Session invalid while offline: preserve the payload, require reauth (§42).
                queue.markNeedsAuth(item.localId)
                summary.needsAuth += 1
            }
            isPermanent(error) -> {
                queue.markFailed(item.localId, friendlyError(error, item.operationType))
                summary.permanentlyFailed += 1
            }
            else -> {
                queue.incrementAttempt(item.localId, error.message)
                summary.retryable += 1
            }
        }
    }

    private fun isPermanent(error: NetworkError): Boolean = when (error.kind) {
        ErrorKind.VALIDATION, ErrorKind.CONFLICT, ErrorKind.FORBIDDEN, ErrorKind.NOT_FOUND -> true
        else -> false
    }

    private fun friendlyError(error: NetworkError, type: QueueOperationType): String = when (error.kind) {
        ErrorKind.CONFLICT -> when (type) {
            QueueOperationType.INSPECTION_CREATE -> "This inspection already exists for that date/zone."
            QueueOperationType.ZONE_REPORT_CREATE, QueueOperationType.ZONE_REPORT_UPDATE ->
                "This report already exists or is out of its allowed state."
            else -> "Conflict. Please check the current server state."
        }
        ErrorKind.FORBIDDEN -> "You no longer have permission for this operation."
        ErrorKind.VALIDATION -> "The server rejected this input. Please correct it and retry."
        ErrorKind.NOT_FOUND -> "The item no longer exists on the server."
        else -> error.message
    }
}

/** Counts from a single queue-drain pass. */
class SyncSummary(
    var confirmed: Int = 0,
    var retryable: Int = 0,
    var permanentlyFailed: Int = 0,
    var needsAuth: Int = 0,
)