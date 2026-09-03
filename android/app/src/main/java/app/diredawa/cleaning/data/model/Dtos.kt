package app.diredawa.cleaning.data.model

import kotlinx.serialization.Serializable

/**
 * DTOs matching the existing backend API responses (snake_case fields preserved).
 * Mirrors frontend-next/src/types/domain.ts. No invented fields.
 */

@Serializable
data class LoginRequest(
    val username: String,
    val password: String,
)

@Serializable
data class LoginResponse(
    val token: String,
    val user: UserDto,
)

@Serializable
data class MeResponse(
    val id: Long,
    val username: String,
    val fullName: String = "",
    val full_name: String? = null,
    val role: String,
    val phone: String? = null,
    val zone: ZoneDto? = null,
)

@Serializable
data class UserDto(
    val id: Long,
    val username: String,
    val fullName: String = "",
    val full_name: String? = null,
    val role: String,
    val phone: String? = null,
    val zone: ZoneDto? = null,
)

@Serializable
data class ZoneDto(
    val id: Long,
    val name: String,
    val kebele_id: Long? = null,
    val kebele_name: String? = null,
    val kebele_code: String? = null,
)

@Serializable
data class KebeleDto(
    val id: Long,
    val name: String,
    val code: String,
    val collector_id: Long? = null,
    val collector_name: String? = null,
    val zone_count: Int? = null,
)

@Serializable
data class SaferZoneDto(
    val id: Long,
    val name: String,
    val kebele_id: Long? = null,
    val kebele_name: String? = null,
    val kebele_code: String? = null,
    val leader_id: Long? = null,
    val leader_name: String? = null,
    val description: String? = null,
    val worker_count: Int? = null,
    val tool_count: Int? = null,
)

@Serializable
data class WorkerDto(
    val id: Long,
    val full_name: String,
    val contact: String? = null,
    val fayda_id: String? = null,
    val daily_wage: Double? = null,
    val safer_zone_id: Long? = null,
    val zone_name: String? = null,
    val kebele_name: String? = null,
    val is_active: Boolean = true,
)

@Serializable
data class NotificationDto(
    val id: Long,
    val user_id: Long,
    val type: String,
    val title: String,
    val message: String,
    val link: String? = null,
    val is_read: Boolean = false,
    val created_at: String? = null,
)

@Serializable
data class NotificationListResponse(
    val rows: List<NotificationDto> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val pages: Int = 1,
)

@Serializable
data class UnreadCountResponse(
    val unreadCount: Int = 0,
)

@Serializable
data class GenericMessage(
    val message: String? = null,
    val error: String? = null,
)

// ── Phase 11 field-operations DTOs ──────────────────────────────────────────
// Each mirrors the exact backend response/request contract (audit §2). No invented
// fields or statuses.

@Serializable
data class AttendanceRecordDto(
    val id: Long,
    val worker_id: Long,
    val date: String,
    val present: Boolean,
    val bonus: Double? = null,
    val notes: String? = null,
    val recorded_by: Long? = null,
    val created_at: String? = null,
    val updated_at: String? = null,
    val recorder_name: String? = null,
)

@Serializable
data class AttendanceBulkRecord(
    val workerId: Long,
    val present: Boolean,
    val bonus: Double? = null,
)

@Serializable
data class AttendanceBulkRequest(
    val date: String,
    val records: List<AttendanceBulkRecord>,
)

@Serializable
data class WorkerStatsDto(
    val id: Long,
    val full_name: String,
    val contact: String? = null,
    val fayda_id: String? = null,
    val daily_wage: Double? = null,
    val safer_zone_id: Long? = null,
    val is_active: Boolean = true,
    val zone_name: String? = null,
    val kebele_name: String? = null,
    val days_present: Int? = null,
    val days_absent: Int? = null,
    val total_bonus: Double? = null,
    val gross_wage: Double? = null,
)

@Serializable
data class WorkerDetailDto(
    val id: Long,
    val full_name: String,
    val contact: String? = null,
    val fayda_id: String? = null,
    val daily_wage: Double? = null,
    val safer_zone_id: Long? = null,
    val is_active: Boolean = true,
    val zone_name: String? = null,
    val kebele_name: String? = null,
)

@Serializable
data class InspectionPhotoDto(
    val id: Long,
    val inspection_id: Long,
    val file_path: String? = null,
    val uploaded_at: String? = null,
)

@Serializable
data class InspectionDto(
    val id: Long,
    val kebele_id: Long,
    val safer_zone_id: Long? = null,
    val date: String,
    val status: String,
    val notes: String? = null,
    val inspected_by: Long? = null,
    val kebele_name: String? = null,
    val kebele_code: String? = null,
    val zone_name: String? = null,
    val inspector_name: String? = null,
    val photos: List<InspectionPhotoDto> = emptyList(),
)

@Serializable
data class InspectionListResponse(
    val data: List<InspectionDto> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val pages: Int = 1,
)

@Serializable
data class ZoneReportDto(
    val id: Long,
    val safer_zone_id: Long,
    val report_date: String,
    val report_month: Int,
    val report_year: Int,
    val submitted_by: Long? = null,
    val status: String,
    val workers_present: Int? = null,
    val workers_absent: Int? = null,
    val collection_total: Double? = null,
    val issues_reported: String? = null,
    val actions_taken: String? = null,
    val tools_status: String? = null,
    val reviewed_by: Long? = null,
    val reviewed_at: String? = null,
    val reviewer_notes: String? = null,
    val created_at: String? = null,
    val updated_at: String? = null,
    val zone_name: String? = null,
    val kebele_name: String? = null,
    val leader_name: String? = null,
    val reviewer_name: String? = null,
)

@Serializable
data class ZoneReportListResponse(
    val data: List<ZoneReportDto> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val pages: Int = 1,
)

@Serializable
data class ZoneReportCreateRequest(
    val saferZoneId: Long,
    val reportDate: String,
    val reportMonth: Int? = null,
    val reportYear: Int? = null,
    val workersPresent: Int? = null,
    val workersAbsent: Int? = null,
    val collectionTotal: Double? = null,
    val issuesReported: String? = null,
    val actionsTaken: String? = null,
    val toolsStatus: String? = null,
)

@Serializable
data class ZoneReportUpdateRequest(
    val workersPresent: Int? = null,
    val workersAbsent: Int? = null,
    val collectionTotal: Double? = null,
    val issuesReported: String? = null,
    val actionsTaken: String? = null,
    val toolsStatus: String? = null,
    val status: String? = null,
)

@Serializable
data class ZoneReportReviewRequest(
    val status: String,
    val reviewerNotes: String? = null,
)

@Serializable
data class CreateIdResponse(
    val id: Long,
    val status: String? = null,
)

@Serializable
data class BusinessDto(
    val id: Long,
    val name: String,
    val owner_name: String? = null,
    val owner_fayda_id: String? = null,
    val owner_phone: String? = null,
    val type: String? = null,
    val monthly_target: Double? = null,
    val safer_zone_id: Long? = null,
    val is_active: Boolean = true,
    val safer_zone_name: String? = null,
    val kebele_name: String? = null,
    val kebele_id: Long? = null,
)

@Serializable
data class BusinessListResponse(
    val data: List<BusinessDto> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val pages: Int = 1,
)

/** Request for POST /api/inspections multipart fields (converted to form-data). */
@Serializable
data class InspectionCreateFields(
    val kebeleId: Long,
    val saferZoneId: Long? = null,
    val date: String,
    val status: String,
    val notes: String? = null,
)

/** Request body for PUT /api/inspections/:id multipart fields. */
@Serializable
data class InspectionUpdateFields(
    val status: String,
    val notes: String? = null,
)