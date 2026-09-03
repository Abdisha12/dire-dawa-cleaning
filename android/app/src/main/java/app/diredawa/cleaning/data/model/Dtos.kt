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