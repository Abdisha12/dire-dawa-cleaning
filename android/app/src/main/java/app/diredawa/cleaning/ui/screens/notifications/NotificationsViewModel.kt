package app.diredawa.cleaning.ui.screens.notifications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.diredawa.cleaning.data.api.ApiResult
import app.diredawa.cleaning.data.repository.OperationsRepository
import app.diredawa.cleaning.domain.model.AppNotification
import app.diredawa.cleaning.ui.components.UiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class NotificationsViewModel(
    private val repository: OperationsRepository,
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<List<AppNotification>>>(UiState.Loading)
    val state: StateFlow<UiState<List<AppNotification>>> = _state.asStateFlow()

    init { load() }

    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            when (val result = repository.notifications()) {
                is ApiResult.Success -> _state.value = UiState.Content(result.data)
                is ApiResult.Failure -> _state.value = UiState.Error(result.error)
            }
        }
    }
}