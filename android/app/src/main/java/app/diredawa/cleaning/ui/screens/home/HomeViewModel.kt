package app.diredawa.cleaning.ui.screens.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.diredawa.cleaning.data.api.ApiResult
import app.diredawa.cleaning.data.auth.SessionManager
import app.diredawa.cleaning.data.repository.AuthRepository
import app.diredawa.cleaning.domain.model.OperationalScope
import app.diredawa.cleaning.domain.usecase.ResolveScopeUseCase
import app.diredawa.cleaning.ui.components.UiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Home/Auth-root state for the authenticated user's operational context (§17–19). */
data class HomeState(val scope: OperationalScope? = null)

class HomeViewModel(
    private val authRepository: AuthRepository,
    private val session: SessionManager,
    private val resolveScope: ResolveScopeUseCase,
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<HomeState>>(UiState.Loading)
    val state: StateFlow<UiState<HomeState>> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        val cached = session.cachedUser()
        if (cached == null) {
            // No session — the nav graph will route to login.
            _state.value = UiState.Content(HomeState(scope = null))
            return
        }
        _state.value = UiState.Loading
        viewModelScope.launch {
            when (val me = authRepository.me()) {
                is ApiResult.Success -> {
                    val scope = resolveScope(me.data)
                    _state.value = UiState.Content(HomeState(scope = scope))
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