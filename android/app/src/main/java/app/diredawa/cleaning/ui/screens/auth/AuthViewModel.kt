package app.diredawa.cleaning.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.diredawa.cleaning.data.api.NetworkError
import app.diredawa.cleaning.data.auth.SessionManager
import app.diredawa.cleaning.data.repository.AuthRepository
import app.diredawa.cleaning.domain.model.AuthenticatedUser
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Auth screen state. */
sealed interface AuthUiState {
    data object Idle : AuthUiState
    data object Loading : AuthUiState
    data class Success(val user: AuthenticatedUser) : AuthUiState
    data class Error(val message: String) : AuthUiState
}

class AuthViewModel(
    private val authRepository: AuthRepository,
    private val session: SessionManager,
) : ViewModel() {

    private val _state = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    fun login(username: String, password: String) {
        if (username.isBlank() || password.isBlank()) {
            _state.value = AuthUiState.Error("Enter both username and password.")
            return
        }
        _state.value = AuthUiState.Loading
        viewModelScope.launch {
            when (val result = authRepository.login(username.trim(), password)) {
                is app.diredawa.cleaning.data.api.ApiResult.Success -> {
                    _state.value = AuthUiState.Success(result.data)
                }
                is app.diredawa.cleaning.data.api.ApiResult.Failure -> {
                    _state.value = AuthUiState.Error(result.error.message)
                }
            }
        }
    }

    fun logout() {
        viewModelScope.launch { authRepository.logout() }
    }
}