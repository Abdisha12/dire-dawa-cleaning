package app.diredawa.cleaning.data.repository

import app.diredawa.cleaning.data.api.ApiResult
import app.diredawa.cleaning.data.api.ApiService
import app.diredawa.cleaning.data.api.ErrorMapper
import app.diredawa.cleaning.domain.model.Kebele
import app.diredawa.cleaning.domain.model.SaferZone

/**
 * Reads real kebele / safer-zone records from the backend (§7). Never hardcodes
 * IDs — records are fetched from `/api/kebeles` and `/api/safer-zones`.
 * Kebele Admin and Leader scoping is enforced by the backend; this repository
 * simply surfaces the records the API returns for the authenticated user.
 */
class LocationRepository(private val api: ApiService) {

    suspend fun kebeles(): ApiResult<List<Kebele>> = try {
        ApiResult.Success(api.kebeles().map {
            Kebele(id = it.id, name = it.name, code = it.code, zoneCount = it.zone_count)
        })
    } catch (e: Exception) {
        ApiResult.Failure(ErrorMapper.map(e))
    }

    suspend fun saferZones(kebeleId: Long? = null): ApiResult<List<SaferZone>> = try {
        val filters = kebeleId?.let { mapOf("kebeleId" to it.toString()) } ?: emptyMap()
        ApiResult.Success(api.saferZones(filters).map {
            SaferZone(
                id = it.id,
                name = it.name,
                kebeleId = it.kebele_id,
                kebeleName = it.kebele_name,
                kebeleCode = it.kebele_code,
            )
        })
    } catch (e: Exception) {
        ApiResult.Failure(ErrorMapper.map(e))
    }
}