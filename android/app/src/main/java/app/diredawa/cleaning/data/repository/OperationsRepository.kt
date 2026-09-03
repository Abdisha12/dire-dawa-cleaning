package app.diredawa.cleaning.data.repository

import app.diredawa.cleaning.data.api.ApiResult
import app.diredawa.cleaning.data.api.ApiService
import app.diredawa.cleaning.data.api.ErrorMapper
import app.diredawa.cleaning.domain.model.AppNotification
import app.diredawa.cleaning.domain.model.Worker

/**
 * Read operations for field-work domains (Workers, Notifications) surfaced to the
 * mobile foundation (§21, §25). All scoping is backend-authoritative; these calls
 * simply return whatever the authenticated backend account is entitled to see.
 */
class OperationsRepository(private val api: ApiService) {

    suspend fun workers(zoneId: Long? = null): ApiResult<List<Worker>> = try {
        val filters = zoneId?.let { mapOf("zoneId" to it.toString()) } ?: emptyMap()
        ApiResult.Success(api.workers(filters).map {
            Worker(
                id = it.id,
                fullName = it.full_name,
                contact = it.contact,
                dailyWage = it.daily_wage,
                zoneName = it.zone_name,
                isActive = it.is_active,
            )
        })
    } catch (e: Exception) {
        ApiResult.Failure(ErrorMapper.map(e))
    }

    suspend fun notifications(): ApiResult<List<AppNotification>> = try {
        ApiResult.Success(api.notifications().rows.map {
            AppNotification(
                id = it.id,
                type = it.type,
                title = it.title,
                message = it.message,
                isRead = it.is_read,
                createdAt = it.created_at,
            )
        })
    } catch (e: Exception) {
        ApiResult.Failure(ErrorMapper.map(e))
    }

    suspend fun unreadCount(): ApiResult<Int> = try {
        ApiResult.Success(api.unreadCount().unreadCount)
    } catch (e: Exception) {
        ApiResult.Failure(ErrorMapper.map(e))
    }
}