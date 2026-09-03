package app.diredawa.cleaning.ui.screens.zonereports

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.diredawa.cleaning.data.api.ApiResult
import app.diredawa.cleaning.data.model.ZoneReportCreateRequest
import app.diredawa.cleaning.data.repository.FieldRepository
import app.diredawa.cleaning.data.repository.FieldSubmitResult
import app.diredawa.cleaning.domain.model.ZoneReport
import app.diredawa.cleaning.domain.model.ZoneReportStatus
import app.diredawa.cleaning.domain.util.DatePolicy
import java.time.LocalDate
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Zone Reports mobile workflow (§28–§30). Preserves the exact backend state machine
 * draft → submitted → reviewed → approved. Reporting metrics/DB fields unchanged.
 * Creating a draft may be queued offline (§36); status transitions (submit/review)
 * are ONLINE-ONLY because the backend must validate each transition live (§29, §40).
 */
class ZoneReportsViewModel(
    private val fieldRepository: FieldRepository,
) : ViewModel() {

    sealed interface ReportSubmitState {
        data object Idle : ReportSubmitState
        data object Submitting : ReportSubmitState
        data object ServerConfirmed : ReportSubmitState
        data class Queued(val localId: Long) : ReportSubmitState
        data class Failed(val message: String) : ReportSubmitState
    }

    /** A draft being authored (before it has a server id). */
    data class DraftForm(
        val saferZoneId: Long? = null,
        val reportDate: LocalDate = DatePolicy.today(),
        val workersPresent: String = "",
        val workersAbsent: String = "",
        val collectionTotal: String = "",
        val issuesReported: String = "",
        val actionsTaken: String = "",
        val toolsStatus: String = "",
    )

    data class ZoneReportsUiState(
        val reports: List<ZoneReport> = emptyList(),
        val loading: Boolean = true,
        val error: String? = null,
        val draft: DraftForm = DraftForm(),
        val editTarget: ZoneReport? = null,
        val submitState: ReportSubmitState = ReportSubmitState.Idle,
        val validationError: String? = null,
    )

    private val _state = MutableStateFlow(ZoneReportsUiState())
    val state: StateFlow<ZoneReportsUiState> = _state.asStateFlow()

    init { load() }

    fun load() {
        _state.value = _state.value.copy(loading = true, error = null)
        viewModelScope.launch {
            when (val r = fieldRepository.zoneReports()) {
                is ApiResult.Success -> _state.value = _state.value.copy(reports = r.data, loading = false)
                is ApiResult.Failure -> _state.value = _state.value.copy(error = r.error.message, loading = false)
            }
        }
    }

    fun setSaferZone(id: Long?) = _state.value.let { _state.value = it.copy(draft = it.draft.copy(saferZoneId = id)) }
    fun setDate(date: LocalDate) = _state.value.let { _state.value = it.copy(draft = it.draft.copy(reportDate = date)) }
    fun setWorkersPresent(v: String) = _state.value.let { _state.value = it.copy(draft = it.draft.copy(workersPresent = v)) }
    fun setWorkersAbsent(v: String) = _state.value.let { _state.value = it.copy(draft = it.draft.copy(workersAbsent = v)) }
    fun setCollectionTotal(v: String) = _state.value.let { _state.value = it.copy(draft = it.draft.copy(collectionTotal = v)) }
    fun setIssues(v: String) = _state.value.let { _state.value = it.copy(draft = it.draft.copy(issuesReported = v)) }
    fun setActions(v: String) = _state.value.let { _state.value = it.copy(draft = it.draft.copy(actionsTaken = v)) }
    fun setTools(v: String) = _state.value.let { _state.value = it.copy(draft = it.draft.copy(toolsStatus = v)) }

    fun edit(report: ZoneReport) {
        _state.value = _state.value.copy(
            editTarget = report,
            draft = DraftForm(
                saferZoneId = report.saferZoneId,
                reportDate = DatePolicy.parse(report.reportDate) ?: DatePolicy.today(),
                workersPresent = report.workersPresent?.toString() ?: "",
                workersAbsent = report.workersAbsent?.toString() ?: "",
                collectionTotal = report.collectionTotal?.toString() ?: "0",
                issuesReported = report.issuesReported.orEmpty(),
                actionsTaken = report.actionsTaken.orEmpty(),
                toolsStatus = report.toolsStatus.orEmpty(),
            ),
        )
    }

    fun clearEditor() {
        _state.value = _state.value.copy(editTarget = null, draft = DraftForm(), submitState = ReportSubmitState.Idle)
    }

    private fun parseDraft(d: DraftForm): ZoneReportCreateRequest? {
        if (d.saferZoneId == null) return null
        val present = d.workersPresent.toIntOrNull()
        val absent = d.workersAbsent.toIntOrNull()
        val total = d.collectionTotal.toDoubleOrNull()
        val date = DatePolicy.parse(DatePolicy.format(d.reportDate))
        return ZoneReportCreateRequest(
            saferZoneId = d.saferZoneId,
            reportDate = DatePolicy.format(d.reportDate),
            reportMonth = date?.monthValue,
            reportYear = date?.year,
            workersPresent = present,
            workersAbsent = absent,
            collectionTotal = total,
            issuesReported = d.issuesReported.ifBlank { null },
            actionsTaken = d.actionsTaken.ifBlank { null },
            toolsStatus = d.toolsStatus.ifBlank { null },
        )
    }

    /** Saves/submits the draft. [transition] indicates whether to also advance the state. */
    fun saveDraft() {
        val current = _state.value
        val request = parseDraft(current.draft)
        if (request == null) {
            _state.value = current.copy(validationError = "Choose the safer zone for this report.")
            return
        }
        _state.value = current.copy(validationError = null, submitState = ReportSubmitState.Submitting)
        viewModelScope.launch {
            when (val result = fieldRepository.createZoneReport(request)) {
                FieldSubmitResult.ServerConfirmed ->
                    _state.value = _state.value.copy(submitState = ReportSubmitState.ServerConfirmed)
                is FieldSubmitResult.Queued ->
                    _state.value = _state.value.copy(submitState = ReportSubmitState.Queued(result.localId))
                is FieldSubmitResult.Failed ->
                    _state.value = _state.value.copy(submitState = ReportSubmitState.Failed(result.error.message))
            }
        }
    }

    /** Submits (draft → submitted). ONLINE-ONLY; backend validates the transition (§29, §40). */
    fun submitExisting(reportId: Long) {
        _state.value = _state.value.copy(submitState = ReportSubmitState.Submitting)
        viewModelScope.launch {
            val result = fieldRepository.updateZoneReport(
                reportId,
                app.diredawa.cleaning.data.repository.ZoneReportUpdateFields(status = ZoneReportStatus.SUBMITTED.apiValue),
            )
            when (result) {
                is ApiResult.Success -> {
                    _state.value = _state.value.copy(submitState = ReportSubmitState.ServerConfirmed)
                    load()
                }
                is ApiResult.Failure ->
                    _state.value = _state.value.copy(submitState = ReportSubmitState.Failed(result.error.message))
            }
        }
    }
}