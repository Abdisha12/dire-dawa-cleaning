package app.diredawa.cleaning.ui.screens.inspections

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.diredawa.cleaning.data.api.ApiResult
import app.diredawa.cleaning.data.repository.FieldRepository
import app.diredawa.cleaning.data.repository.FieldSubmitResult
import app.diredawa.cleaning.data.repository.LocationRepository
import app.diredawa.cleaning.domain.model.CapturedLocation
import app.diredawa.cleaning.domain.model.InspectionStatus
import app.diredawa.cleaning.domain.model.Kebele
import app.diredawa.cleaning.domain.model.SaferZone
import app.diredawa.cleaning.domain.util.DatePolicy
import app.diredawa.cleaning.field.LocationCaptureOutcome
import app.diredawa.cleaning.field.PreparedPhoto
import java.time.LocalDate
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Inspection field form (§15–§22). The site is a Safer Zone selected from the
 * backend-scoped zone list — kebele is derived from the zone (never trusted from a
 * client-supplied id, §4). GPS is captured on demand and stored in the draft, but
 * the backend inspections API does not currently accept a location column, so it is
 * shown to the user and retained locally, not grafted into the payload (§20–§21).
 * Photos are captured/prepared and uploaded with the multipart create (§23–§27).
 */
class InspectionCreateViewModel(
    private val fieldRepository: FieldRepository,
    private val locationRepository: LocationRepository,
) : ViewModel() {

    sealed interface InspectionSubmitState {
        data object Idle : InspectionSubmitState
        data object Submitting : InspectionSubmitState
        data object ServerConfirmed : InspectionSubmitState
        data class Queued(val localId: Long) : InspectionSubmitState
        data class Failed(val message: String) : InspectionSubmitState
    }

    data class InspectionDraft(
        val zones: List<SaferZone> = emptyList(),
        val kebeles: List<Kebele> = emptyList(),
        val selectedZone: SaferZone? = null,
        val date: LocalDate = DatePolicy.today(),
        val status: InspectionStatus = InspectionStatus.ACTIVE,
        val notes: String = "",
        val photos: List<PreparedPhoto> = emptyList(),
        // On-device GPS (permission handled in the UI). Not sent to the backend
        // inspections API today (§20); kept in the draft and documented.
        val location: CapturedLocation? = null,
        val locationMessage: String? = null,
        val locationBusy: Boolean = false,
        val loadingContext: Boolean = true,
        val contextError: String? = null,
        val submission: InspectionSubmitState = InspectionSubmitState.Idle,
        val validationError: String? = null,
    ) {
        val kebeleId: Long? get() = selectedZone?.kebeleId
        val saferZoneId: Long? get() = selectedZone?.id
        val valid: Boolean get() = selectedZone != null
    }

    private val _state = MutableStateFlow(InspectionDraft())
    val state: StateFlow<InspectionDraft> = _state.asStateFlow()

    init {
        loadContext()
    }

    fun loadContext() {
        _state.value = _state.value.copy(loadingContext = true, contextError = null)
        viewModelScope.launch {
            val zones = when (val r = locationRepository.saferZones()) {
                is ApiResult.Success -> r.data
                is ApiResult.Failure -> {
                    _state.value = _state.value.copy(contextError = r.error.message, loadingContext = false)
                    return@launch
                }
            }
            val kebeles = when (val r = locationRepository.kebeles()) {
                is ApiResult.Success -> r.data
                is ApiResult.Failure -> emptyList()
            }
            // Default selection: the single zone a leader owns (backend-scoped).
            val initial = zones.singleOrNull()
            _state.value = _state.value.copy(
                zones = zones,
                kebeles = kebeles,
                selectedZone = initial,
                loadingContext = false,
            )
        }
    }

    fun selectZone(zone: SaferZone?) {
        _state.value = _state.value.copy(selectedZone = zone, validationError = null)
    }

    fun setDate(date: LocalDate) = _state.value.let { _state.value = it.copy(date = date) }

    fun setStatus(status: InspectionStatus) = _state.value.let { _state.value = it.copy(status = status) }

    fun setNotes(notes: String) {
        _state.value = _state.value.copy(notes = notes.take(5000))
    }

    /** Called by the UI with the prepared photo after capture/selection. */
    fun addPhoto(photo: PreparedPhoto) {
        // PreparedPhoto files live in app-private storage; only their descriptors are retained.
        _state.value = _state.value.copy(photos = _state.value.photos + photo)
    }

    fun removePhotoAt(index: Int) {
        val photos = _state.value.photos.toMutableList()
        if (index in photos.indices) photos.removeAt(index)
        _state.value = _state.value.copy(photos = photos)
    }

    // ── GPS (§18–§20) ──────────────────────────────────────────────────────

    /** Requests capture through the injected provider. Called after permission granted. */
    fun captureLocation(provider: app.diredawa.cleaning.field.LocationProvider) {
        _state.value = _state.value.copy(locationBusy = true, locationMessage = null)
        viewModelScope.launch {
            when (val outcome = provider.capture()) {
                is LocationCaptureOutcome.Success -> _state.value = _state.value.copy(
                    location = outcome.location,
                    locationMessage = null,
                    locationBusy = false,
                )
                is LocationCaptureOutcome.Unavailable -> _state.value = _state.value.copy(
                    locationMessage = outcome.reason,
                    locationBusy = false,
                )
            }
        }
    }

    fun clearLocation() = _state.value.let { _state.value = it.copy(location = null) }

    // ── Submit (§15, §26) ──────────────────────────────────────────────────

    fun submit() {
        val d = _state.value
        if (!d.valid) {
            _state.value = d.copy(validationError = "Select the inspection site first.")
            return
        }
        if (d.submission == InspectionSubmitState.Submitting) return
        _state.value = d.copy(validationError = null, submission = InspectionSubmitState.Submitting)

        viewModelScope.launch {
            val result = fieldRepository.createInspection(
                kebeleId = d.kebeleId ?: -1L,
                saferZoneId = d.saferZoneId,
                date = DatePolicy.format(d.date),
                status = d.status,
                notes = d.notes.ifBlank { null },
                photos = d.photos,
            )
            _state.value = when (result) {
                is FieldSubmitResult.ServerConfirmed ->
                    _state.value.copy(submission = InspectionSubmitState.ServerConfirmed)
                is FieldSubmitResult.Queued ->
                    _state.value.copy(submission = InspectionSubmitState.Queued(result.localId))
                is FieldSubmitResult.Failed ->
                    _state.value.copy(submission = InspectionSubmitState.Failed(result.error.message))
            }
        }
    }
}