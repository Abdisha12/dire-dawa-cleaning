package app.diredawa.cleaning.ui.screens.workers

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.diredawa.cleaning.data.api.ApiResult
import app.diredawa.cleaning.data.repository.OperationsRepository
import app.diredawa.cleaning.domain.model.Worker
import app.diredawa.cleaning.ui.components.UiState
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Workers list state (§7). Backend-authoritative scoping. */
class WorkersViewModel(
    private val operationsRepository: OperationsRepository,
) : ViewModel() {

    data class WorkersState(
        val list: List<Worker> = emptyList(),
        val loading: Boolean = true,
        val error: String? = null,
    )

    private val _state = MutableStateFlow(WorkersState())
    val state: StateFlow<WorkersState> = _state.asStateFlow()

    private var searchJob: Job? = null

    init {
        load()
    }

    fun load() {
        searchJob?.cancel()
        _state.value = _state.value.copy(loading = true, error = null)
        searchJob = viewModelScope.launch {
            when (val result = operationsRepository.workers()) {
                is ApiResult.Success -> _state.value = WorkersState(list = result.data, loading = false)
                is ApiResult.Failure -> _state.value = WorkersState(error = result.error.message, loading = false)
            }
        }
    }

    /** Debounced search for field use (minimal typing, §52). */
    fun search(query: String) {
        searchJob?.cancel()
        _state.value = _state.value.copy(loading = true, error = null)
        searchJob = viewModelScope.launch {
            delay(300)
            when (val result = operationsRepository.workers(search = query)) {
                is ApiResult.Success -> _state.value = WorkersState(list = result.data, loading = false)
                is ApiResult.Failure -> _state.value = WorkersState(error = result.error.message, loading = false)
            }
        }
    }
}