package app.diredawa.cleaning.data.offline

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Serializable payloads stored as JSON inside each queue record (§37).
 *
 * These carry only the minimum information required to replay the mutation after
 * connectivity returns. They never contain auth tokens, raw headers, passwords,
 * or Fayda identifiers beyond what the underlying mutation itself requires.
 */

@Serializable
data class AttendanceBulkPayload(
    val date: String,
    val records: List<AttendancePayloadRecord>,
)

@Serializable
data class AttendancePayloadRecord(
    val workerId: Long,
    val present: Boolean,
    val bonus: Double? = null,
)

@Serializable
data class InspectionCreatePayload(
    val kebeleId: Long,
    val saferZoneId: Long? = null,
    val date: String,
    val status: String,
    val notes: String? = null,
    /** Local file references to captured/prepared photos (only names, never absolute internal paths shown to users). */
    val photoFileNames: List<String> = emptyList(),
)

@Serializable
data class ZoneReportCreatePayload(
    val saferZoneId: Long,
    val reportDate: String,
    val reportMonth: Int,
    val reportYear: Int,
    val workersPresent: Int? = null,
    val workersAbsent: Int? = null,
    val collectionTotal: Double? = null,
    val issuesReported: String? = null,
    val actionsTaken: String? = null,
    val toolsStatus: String? = null,
)

@Serializable
data class ZoneReportUpdatePayload(
    val reportId: Long,
    val workersPresent: Int? = null,
    val workersAbsent: Int? = null,
    val collectionTotal: Double? = null,
    val issuesReported: String? = null,
    val actionsTaken: String? = null,
    val toolsStatus: String? = null,
    val status: String? = null,
)

/** Wrapper stored in the queue record so the codec can dispatch on [type]. */
@Serializable
data class QueuePayloadEnvelope(
    val type: String,
    @SerialName("payload")
    val json: String,
)