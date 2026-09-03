package app.diredawa.cleaning.data.model

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

/**
 * Minimal GeoJSON DTOs for the Phase 12 gis endpoints ("/api/gis/...").
 * Geometry is kept as [JsonObject] (or null) — the app never fabricates
 * coordinates; null geometry surfaces as "Location unavailable".
 */
@Serializable
data class GisFeatureCollection(
    val type: String = "FeatureCollection",
    val features: List<GisFeature> = emptyList(),
    val total: Int? = null,
    val page: Int? = null,
    val pages: Int? = null,
)

@Serializable
data class GisFeature(
    val type: String = "Feature",
    val id: Long? = null,
    val geometry: JsonObject? = null,
    val properties: JsonObject? = null,
)
