package app.diredawa.cleaning.domain.model

/**
 * Domain models consumed by the UI layer.
 * Backend role string `collector` is displayed as "Kebele Admin" (§6) — mapping
 * happens in the [Role] domain type, never by renaming the backend role.
 */

enum class Role(val apiValue: String, val displayName: String) {
    ADMIN("admin", "Admin"),
    COLLECTOR("collector", "Kebele Admin"),
    LEADER("leader", "Zone Leader"),
    VIEWER("viewer", "Viewer"),
    UNKNOWN("", "Unknown");

    val isMutable: Boolean get() = this == ADMIN || this == COLLECTOR || this == LEADER
    val isReadOnly: Boolean get() = this == VIEWER

    companion object {
        fun fromApi(value: String?): Role =
            entries.firstOrNull { it.apiValue == value } ?: UNKNOWN
    }
}

data class Zone(
    val id: Long,
    val name: String,
    val kebeleId: Long? = null,
    val kebeleName: String? = null,
    val kebeleCode: String? = null,
)

data class AuthenticatedUser(
    val id: Long,
    val username: String,
    val fullName: String,
    val role: Role,
    val phone: String? = null,
    val zone: Zone? = null,
)

data class Kebele(
    val id: Long,
    val name: String,
    val code: String,
    val zoneCount: Int? = null,
)

data class SaferZone(
    val id: Long,
    val name: String,
    val kebeleId: Long? = null,
    val kebeleName: String? = null,
    val kebeleCode: String? = null,
)

/**
 * A GIS entity surfaced from a gis FeatureCollection ("/api/gis/...", Phase 12).
 * Geometry presence is recorded as [hasGeometry]; null geometry surfaces as
 * "Location unavailable" — never fabricated.
 */
data class GisEntityItem(
    val id: Long,
    val label: String,
    val entityType: String,
    val kebeleName: String? = null,
    val zoneName: String? = null,
    val status: String? = null,
    val hasGeometry: Boolean = false,
    val locationUnavailable: Boolean = false,
)

data class Worker(
    val id: Long,
    val fullName: String,
    val contact: String? = null,
    val dailyWage: Double? = null,
    val zoneName: String? = null,
    val isActive: Boolean = true,
)

data class AppNotification(
    val id: Long,
    val type: String,
    val title: String,
    val message: String,
    val isRead: Boolean,
    val createdAt: String? = null,
)

/** Represents the authenticated user's operational scope (kept minimal; backend is authority). */
sealed interface OperationalScope {
    val user: AuthenticatedUser
    data class CityWide(override val user: AuthenticatedUser) : OperationalScope
    data class Kebele(override val user: AuthenticatedUser, val kebele: app.diredawa.cleaning.domain.model.Kebele) : OperationalScope
    data class Zone(override val user: AuthenticatedUser, val zone: app.diredawa.cleaning.domain.model.Zone) : OperationalScope
}

// ── Phase 11 field-operations domain models ────────────────────────────────
// Backend remains the authority; these mirror the audited contracts exactly.

/**
 * Daily attendance for one worker. `present` is boolean — the backend attendance
 * table uses `BOOLEAN` (§9). No invented Late/Excused/Half Day statuses.
 */
data class AttendanceRecord(
    val workerId: Long,
    val date: String,
    val present: Boolean,
    val bonus: Double? = null,
    val id: Long? = null,
)

/** Inspection status — exact backend enum (`inspection_status`). */
enum class InspectionStatus(val apiValue: String) {
    ACTIVE("active"),
    WARNING("warning"),
    DANGER("danger");

    companion object {
        fun fromApi(value: String?): InspectionStatus? =
            entries.firstOrNull { it.apiValue == value }
    }
}

data class InspectionPhoto(
    val id: Long,
    val filePath: String? = null,
    val uploadedAt: String? = null,
)

data class Inspection(
    val id: Long,
    val kebeleId: Long,
    val saferZoneId: Long? = null,
    val date: String,
    val status: InspectionStatus,
    val notes: String? = null,
    val kebeleName: String? = null,
    val zoneName: String? = null,
    val inspectorName: String? = null,
    val photos: List<InspectionPhoto> = emptyList(),
)

/** Zone report status — exact backend state machine (`report_status`). */
enum class ZoneReportStatus(val apiValue: String) {
    DRAFT("draft"),
    SUBMITTED("submitted"),
    REVIEWED("reviewed"),
    APPROVED("approved");

    companion object {
        fun fromApi(value: String?): ZoneReportStatus? =
            entries.firstOrNull { it.apiValue == value }
    }
}

data class ZoneReport(
    val id: Long,
    val saferZoneId: Long,
    val reportDate: String,
    val reportMonth: Int,
    val reportYear: Int,
    val status: ZoneReportStatus?,
    val workersPresent: Int? = null,
    val workersAbsent: Int? = null,
    val collectionTotal: Double? = null,
    val issuesReported: String? = null,
    val actionsTaken: String? = null,
    val toolsStatus: String? = null,
    val reviewedAt: String? = null,
    val reviewerNotes: String? = null,
    val zoneName: String? = null,
    val kebeleName: String? = null,
)

data class Business(
    val id: Long,
    val name: String,
    val ownerName: String? = null,
    val type: String? = null,
    val saferZoneId: Long? = null,
    val isActive: Boolean = true,
    val saferZoneName: String? = null,
    val kebeleName: String? = null,
    val kebeleId: Long? = null,
)

data class WorkerSummary(
    val id: Long,
    val fullName: String,
    val dailyWage: Double? = null,
    val saferZoneId: Long? = null,
    val isActive: Boolean = true,
    val zoneName: String? = null,
    val kebeleName: String? = null,
    val daysPresent: Int? = null,
    val daysAbsent: Int? = null,
    val grossWage: Double? = null,
)

/** A location captured on-device. Coordinates are real GPS only — never fabricated (§5, §18). */
data class CapturedLocation(
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float? = null,
    val capturedAt: Long? = null,
)