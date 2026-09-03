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