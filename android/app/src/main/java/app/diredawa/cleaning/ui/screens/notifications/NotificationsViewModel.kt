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
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Notifications (§31–§32): list, mark read, mark all. Backend stays authoritative. */
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

    fun markRead(id: Long) {
        viewModelScope.launch {
            when (val result = repository.markRead(id)) {
                is ApiResult.Success -> _state.value = (state.value as? UiState.Content)?.let {
                    UiState.Content(it.data.map { n -> if (n.id == id) n.copy(isRead = true) else n })
                } ?: state.value
                is ApiResult.Failure -> Unit // non-blocking; unchanged
            }
        }
    }

    fun markAllRead() {
        viewModelScope.launch {
            when (val result = repository.markAllRead()) {
                is ApiResult.Success -> _state.value = (state.value as? UiState.Content)?.let {
                    UiState.Content(it.data.map { n -> n.copy(isRead = true) })
                } ?: state.value
                is ApiResult.Failure -> Unit
            }
        }
    }
}