package app.diredawa.cleaning.data.repository

import app.diredawa.cleaning.data.api.ApiResult
import app.diredawa.cleaning.data.api.ApiService
import app.diredawa.cleaning.data.api.ErrorMapper
import app.diredawa.cleaning.domain.model.AppNotification
import app.diredawa.cleaning.domain.model.Worker
import app.diredawa.cleaning.domain.model.WorkerSummary

/**
 * Read operations for field-work domains (Workers, Notifications) surfaced to the
 * mobile foundation (§21, §25). All scoping is backend-authoritative; these calls
 * simply return whatever the authenticated backend account is entitled to see.
 */
class OperationsRepository(private val api: ApiService) {

    suspend fun workers(zoneId: Long? = null, search: String? = null): ApiResult<List<Worker>> = try {
        val filters = buildMap {
            zoneId?.let { put("zoneId", it.toString()) }
            search?.takeIf { it.isNotBlank() }?.let { put("search", it) }
        }
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

    /** Worker summary stats for Home KPIs (§5) — backed by the real stats endpoint. */
    suspend fun workerStats(): ApiResult<List<WorkerSummary>> = try {
        ApiResult.Success(api.workerStats().map {
            WorkerSummary(
                id = it.id,
                fullName = it.full_name,
                dailyWage = it.daily_wage,
                saferZoneId = it.safer_zone_id,
                isActive = it.is_active,
                zoneName = it.zone_name,
                kebeleName = it.kebele_name,
                daysPresent = it.days_present,
                daysAbsent = it.days_absent,
                grossWage = it.gross_wage,
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

    /** Marks a single notification read (PUT — matches backend route). */
    suspend fun markRead(notificationId: Long): ApiResult<Unit> = try {
        api.markNotificationRead(notificationId)
        ApiResult.Success(Unit)
    } catch (e: Exception) {
        ApiResult.Failure(ErrorMapper.map(e))
    }

    /** Marks all the current user's notifications read. */
    suspend fun markAllRead(): ApiResult<Unit> = try {
        api.markAllNotificationsRead()
        ApiResult.Success(Unit)
    } catch (e: Exception) {
        ApiResult.Failure(ErrorMapper.map(e))
    }
}