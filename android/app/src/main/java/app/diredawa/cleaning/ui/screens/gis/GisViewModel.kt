package app.diredawa.cleaning.ui.screens.gis

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.diredawa.cleaning.data.api.ApiResult
import app.diredawa.cleaning.data.offline.NetworkMonitor
import app.diredawa.cleaning.data.repository.GisLayer
import app.diredawa.cleaning.data.repository.GisRepository
import app.diredawa.cleaning.domain.model.CapturedLocation
import app.diredawa.cleaning.field.LocationCaptureOutcome
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Phase 12 Android GIS (§36–§38). Backend GeoJSON is the only spatial source;
 * null geometry is shown as "Location unavailable". Offline shows an explicit
 * "Map data unavailable offline" state instead of stale geometry. No continuous
 * tracking — locate-me is a single on-demand capture.
 */
class GisViewModel(
    private val gisRepository: GisRepository,
    private val networkMonitor: NetworkMonitor,
) : ViewModel() {

    data class GisUiState(
        val isOnline: Boolean = true,
        val loadingBase: Boolean = true,
        val baseError: String? = null,
        val kebeles: GisLayer? = null,
        val zones: GisLayer? = null,
        val businesses: GisLayer? = null,
        val workers: GisLayer? = null,
        val inspections: GisLayer? = null,
        val enabledLayers: Set<String> = setOf("Kebele", "SaferZone"),
        val myLocation: CapturedLocation? = null,
        val locationMessage: String? = null,
        val locating: Boolean = false,
    )

    private val _state = MutableStateFlow(GisUiState())
    val state: StateFlow<GisUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            networkMonitor.isOnline.collect { online ->
                _state.value = _state.value.copy(isOnline = online)
            }
        }
        loadBase()
    }

    fun loadBase() {
        _state.value = _state.value.copy(loadingBase = true, baseError = null)
        viewModelScope.launch {
            val kebeles = gisRepository.kebeles()
            val zones = gisRepository.saferZones()
            if (kebeles is ApiResult.Failure && zones is ApiResult.Failure) {
                _state.value = _state.value.copy(
                    loadingBase = false,
                    baseError = kebeles.error.message,
                )
                return@launch
            }
            _state.value = _state.value.copy(
                loadingBase = false,
                kebeles = (kebeles as? ApiResult.Success)?.data,
                zones = (zones as? ApiResult.Success)?.data,
            )
        }
    }

    fun toggleLayer(entityType: String) {
        val enabled = _state.value.enabledLayers.toMutableSet()
        if (!enabled.add(entityType)) enabled.remove(entityType)
        _state.value = _state.value.copy(enabledLayers = enabled)
        if (entityType in enabled) loadLayer(entityType)
    }

    private fun loadLayer(entityType: String) {
        viewModelScope.launch {
            val result = when (entityType) {
                "Business" -> gisRepository.businesses()
                "Worker" -> gisRepository.workers()
                "Inspection" -> gisRepository.inspections()
                else -> return@launch
            }
            val data = (result as? ApiResult.Success)?.data ?: return@launch
            _state.value = when (entityType) {
                "Business" -> _state.value.copy(businesses = data)
                "Worker" -> _state.value.copy(workers = data)
                else -> _state.value.copy(inspections = data)
            }
        }
    }

    fun locateMe(provider: app.diredawa.cleaning.field.LocationProvider) {
        _state.value = _state.value.copy(locating = true, locationMessage = null)
        viewModelScope.launch {
            when (val outcome = provider.capture()) {
                is LocationCaptureOutcome.Success ->
                    _state.value = _state.value.copy(myLocation = outcome.location, locating = false)
                is LocationCaptureOutcome.Unavailable ->
                    _state.value = _state.value.copy(locationMessage = outcome.reason, locating = false)
            }
        }
    }
}
