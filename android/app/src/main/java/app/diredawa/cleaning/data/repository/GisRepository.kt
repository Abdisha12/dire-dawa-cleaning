package app.diredawa.cleaning.data.repository

import app.diredawa.cleaning.data.api.ApiResult
import app.diredawa.cleaning.data.api.ApiService
import app.diredawa.cleaning.data.api.ErrorMapper
import app.diredawa.cleaning.data.model.GisFeature
import app.diredawa.cleaning.domain.model.GisEntityItem
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

/**
 * Phase 12 GIS repository. Consumes the backend gis GeoJSON endpoints
 * ("/api/gis/...", same auth/session as everything else). Backend scope is authoritative; this
 * layer only parses what the server returns — no fabricated coordinates.
 */
class GisRepository(private val api: ApiService) {

    suspend fun kebeles(): ApiResult<GisLayer> = layer("Kebele") { api.gisKebeles() }

    suspend fun saferZones(): ApiResult<GisLayer> = layer("SaferZone") { api.gisSaferZones() }

    suspend fun businesses(): ApiResult<GisLayer> = layer("Business") { api.gisBusinesses() }

    suspend fun workers(): ApiResult<GisLayer> = layer("Worker") { api.gisWorkers() }

    suspend fun inspections(): ApiResult<GisLayer> = layer("Inspection") { api.gisInspections() }

    private suspend fun layer(
        entityType: String,
        fetch: suspend () -> app.diredawa.cleaning.data.model.GisFeatureCollection,
    ): ApiResult<GisLayer> = try {
        val collection = fetch()
        val items = collection.features.mapNotNull { it.toItem(entityType) }
        ApiResult.Success(
            GisLayer(
                entityType = entityType,
                total = collection.total ?: items.size,
                withGeometry = items.count { it.hasGeometry },
                withoutGeometry = items.count { !it.hasGeometry },
                items = items,
            ),
        )
    } catch (e: Exception) {
        ApiResult.Failure(ErrorMapper.map(e))
    }

    private fun GisFeature.toItem(fallbackType: String): GisEntityItem? {
        val props = properties ?: return null
        fun str(vararg keys: String): String? =
            keys.firstNotNullOfOrNull { props[it]?.jsonPrimitive?.contentOrNull }
        val id = (props["id"]?.jsonPrimitive?.contentOrNull?.toLongOrNull()) ?: this.id ?: return null
        val entityType = str("entityType") ?: fallbackType
        val label = str("name", "fullName", "code") ?: "#$id"
        return GisEntityItem(
            id = id,
            label = label,
            entityType = entityType,
            kebeleName = str("kebeleName"),
            zoneName = str("saferZoneName", "zoneName"),
            status = str("status", "type"),
            hasGeometry = geometry != null,
            locationUnavailable = props["locationUnavailable"]?.jsonPrimitive?.booleanOrNull ?: (geometry == null),
        )
    }
}

/** Parsed GIS layer with honest geometry counts (no fake points). */
data class GisLayer(
    val entityType: String,
    val total: Int,
    val withGeometry: Int,
    val withoutGeometry: Int,
    val items: List<GisEntityItem>,
)
