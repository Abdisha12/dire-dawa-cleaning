package app.diredawa.cleaning.data.offline

/**
 * Offline queue domain model (§33, §37).
 *
 * A queued operation is NEVER treated as a server record. It only leaves the
 * queue after the backend confirms with a 2xx, at which point it is deleted and
 * reported as CONFIRMED (§14, §41).
 */
enum class QueueStatus {
    /** Waiting to be sent (or retried). */
    PENDING,
    /** Being sent right now. */
    SYNCING,
    /** Backend needs (re)authentication — payload is preserved, not discarded (§42). */
    NEEDS_AUTH,
    /** A permanent error (400/401/403/409) stopped automatic retries (§41). */
    FAILED,
}

/** The mutation types the queue is allowed to hold (§36 — only carefully-designed-for-retry ops). */
enum class QueueOperationType(val apiValue: String) {
    ATTENDANCE_BULK("attendance_bulk"),
    INSPECTION_CREATE("inspection_create"),
    ZONE_REPORT_CREATE("zone_report_create"),
    ZONE_REPORT_UPDATE("zone_report_update"),
    ;

    companion object {
        fun fromApi(value: String?): QueueOperationType? =
            entries.firstOrNull { it.apiValue == value }
    }
}

/**
 * A pending mutation in the sync queue. Fields mirror §37: local_id, operation_type,
 * created_at, attempt_count, status, payload/reference. No auth token is stored here.
 */
data class PendingOperation(
    val localId: Long,
    val operationType: QueueOperationType,
    val payload: Any?,
    val createdAt: Long,
    val attemptCount: Int,
    val status: QueueStatus,
    val lastError: String? = null,
)