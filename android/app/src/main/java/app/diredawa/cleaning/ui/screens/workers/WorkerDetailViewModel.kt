package app.diredawa.cleaning.ui.screens.workers

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.diredawa.cleaning.data.api.ApiResult
import app.diredawa.cleaning.data.repository.FieldRepository
import app.diredawa.cleaning.data.repository.OperationsRepository
import app.diredawa.cleaning.domain.model.AttendanceRecord
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class WorkerDetailViewModel(
    private val workerId: Long,
    private val workerName: String,
    private val workerRole: String?,
    private val operationsRepository: OperationsRepository,
    private val fieldRepository: FieldRepository,
) : ViewModel() {

    data class WorkerDetailUiState(
        val workerId: Long = -1,
        val workerName: String = "",
        val workerRole: String? = null,
        val loadingAttendance: Boolean = true,
        val attendanceError: String? = null,
        val attendance: List<AttendanceRecord> = emptyList(),
    )

    private val _state = MutableStateFlow(WorkerDetailUiState(workerId = workerId, workerName = workerName, workerRole = workerRole))
    val state: StateFlow<WorkerDetailUiState> = _state

    init {
        loadAttendance()
    }

    fun loadAttendance() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loadingAttendance = true, attendanceError = null)
            when (val r = fieldRepository.workerAttendance(workerId)) {
                is ApiResult.Success -> _state.value = _state.value.copy(
                    loadingAttendance = false,
                    attendance = r.data,
                )
                is ApiResult.Failure -> _state.value = _state.value.copy(
                    loadingAttendance = false,
                    attendanceError = "Attendance unavailable",
                )
            }
        }
    }
}