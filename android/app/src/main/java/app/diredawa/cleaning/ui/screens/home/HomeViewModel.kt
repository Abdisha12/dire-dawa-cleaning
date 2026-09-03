package app.diredawa.cleaning.ui.screens.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.diredawa.cleaning.data.api.ApiResult
import app.diredawa.cleaning.data.auth.SessionManager
import app.diredawa.cleaning.data.repository.AuthRepository
import app.diredawa.cleaning.data.repository.OperationsRepository
import app.diredawa.cleaning.domain.model.OperationalScope
import app.diredawa.cleaning.domain.model.WorkerSummary
import app.diredawa.cleaning.domain.usecase.ResolveScopeUseCase
import app.diredawa.cleaning.ui.components.UiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Home state: operational context + real backend KPIs (§5). Counts are never invented. */
data class HomeState(
    val scope: OperationalScope? = null,
    val unreadNotifications: Int? = null,
    val workerStats: List<WorkerSummary> = emptyList(),
)

class HomeViewModel(
    private val authRepository: AuthRepository,
    private val session: SessionManager,
    private val resolveScope: ResolveScopeUseCase,
    private val operationsRepository: OperationsRepository,
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<HomeState>>(UiState.Loading)
    val state: StateFlow<UiState<HomeState>> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        val cached = session.cachedUser()
        if (cached == null) {
            _state.value = UiState.Content(HomeState(scope = null))
            return
        }
        _state.value = UiState.Loading
        viewModelScope.launch {
            val me = authRepository.me()
            when (me) {
                is ApiResult.Success -> {
                    val scope = resolveScope(me.data)
                    // Load secondary KPIs best-effort; a failure downgrades them, never blocks the home.
                    val stats = (operationsRepository.workerStats() as? ApiResult.Success)
                        ?.data ?: emptyList()
                    val unread = (operationsRepository.unreadCount() as? ApiResult.Success)
                        ?.data
                    _state.value = UiState.Content(
                        HomeState(
                            scope = scope,
                            unreadNotifications = unread,
                            workerStats = stats,
                        ),
                    )
                }
                is ApiResult.Failure -> {
                    if (me.error.sessionExpired) {
                        session.invalidate()
                        _state.value = UiState.Content(HomeState(scope = null))
                    } else {
                        _state.value = UiState.Error(me.error)
                    }
                }
            }
        }
    }
}