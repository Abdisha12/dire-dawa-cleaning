package app.diredawa.cleaning.ui.screens.attendance

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.diredawa.cleaning.data.api.ApiResult
import app.diredawa.cleaning.data.repository.FieldRepository
import app.diredawa.cleaning.domain.model.AttendanceRecord
import app.diredawa.cleaning.domain.model.Worker
import app.diredawa.cleaning.domain.util.DatePolicy
import app.diredawa.cleaning.data.repository.FieldSubmitResult
import java.time.LocalDate
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Attendance workflow (§9–§14). Backend scoping is authoritative: the worker list
 * comes from the backend (or the limited offline cache), and the bulk submit goes
 * to the existing `/api/workers/attendance/bulk` endpoint. Submission state is
 * explicit — queued offline is NEVER presented as server-confirmed (§14).
 */
class AttendanceViewModel(
    private val fieldRepository: FieldRepository,
) : ViewModel() {

    data class WorkerPresence(
        val worker: Worker,
        val present: Boolean = true,
    )

    /** Submission lifecycle shown to the user (§14). */
    sealed interface SubmissionState {
        data object NotSubmitted : SubmissionState
        data object Submitting : SubmissionState
        data object ServerConfirmed : SubmissionState
        data class Queued(val localId: Long) : SubmissionState
        data class Failed(val message: String) : SubmissionState
    }

    data class AttendanceUiState(
        val date: LocalDate = DatePolicy.today(),
        val workers: List<WorkerPresence> = emptyList(),
        val loading: Boolean = true,
        val error: String? = null,
        val submission: SubmissionState = SubmissionState.NotSubmitted,
        val offlineReading: Boolean = false,
    ) {
        val total: Int get() = workers.size
        val presentCount: Int get() = workers.count { it.present }
        val absentCount: Int get() = workers.count { !it.present }
    }

    private val _state = MutableStateFlow(AttendanceUiState())
    val state: StateFlow<AttendanceUiState> = _state.asStateFlow()

    init {
        loadWorkers()
    }

    fun loadWorkers() {
        _state.value = _state.value.copy(loading = true, error = null)
        viewModelScope.launch {
            when (val result = fieldRepository.attendanceWorkers()) {
                is ApiResult.Success -> _state.value = _state.value.copy(
                    workers = result.data.map { WorkerPresence(it) },
                    loading = false,
                )
                is ApiResult.Failure -> _state.value = _state.value.copy(
                    error = result.error.message,
                    loading = false,
                )
            }
        }
    }

    fun setDate(date: LocalDate) {
        _state.value = _state.value.copy(
            date = date,
            submission = SubmissionState.NotSubmitted,
            workers = _state.value.workers.map { it.copy(present = true) },
        )
    }

    fun toggle(workerId: Long) {
        val updated = _state.value.workers.map {
            if (it.worker.id == workerId) it.copy(present = !it.present) else it
        }
        _state.value = _state.value.copy(workers = updated, submission = SubmissionState.NotSubmitted)
    }

    fun markAll(present: Boolean) {
        _state.value = _state.value.copy(
            workers = _state.value.workers.map { it.copy(present = present) },
            submission = SubmissionState.NotSubmitted,
        )
    }

    fun resetAfterSubmit() {}

    fun submit() {
        val current = _state.value
        if (current.workers.isEmpty() || current.submission == SubmissionState.Submitting) return
        _state.value = current.copy(submission = SubmissionState.Submitting)

        val dateIso = DatePolicy.format(current.date)
        val records = current.workers.map { AttendanceRecord(workerId = it.worker.id, date = dateIso, present = it.present) }

        viewModelScope.launch {
            when (val result = fieldRepository.saveAttendanceBulk(dateIso, records)) {
                FieldSubmitResult.ServerConfirmed ->
                    _state.value = _state.value.copy(submission = SubmissionState.ServerConfirmed)
                is FieldSubmitResult.Queued ->
                    _state.value = _state.value.copy(submission = SubmissionState.Queued(result.localId))
                is FieldSubmitResult.Failed ->
                    _state.value = _state.value.copy(submission = SubmissionState.Failed(result.error.message))
            }
        }
    }
}