package app.diredawa.cleaning.ui.navigation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import app.diredawa.cleaning.AppContainer

/**
 * Creates ViewModels with their repository dependencies, given the [AppContainer].
 * Keeps the foundation free of a DI framework while preserving the
 * UI → ViewModel → Repository → API layering.
 */
class AppViewModelFactory(private val container: AppContainer) :
    ViewModelProvider.Factory {

    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return when {
            modelClass.isAssignableFrom(app.diredawa.cleaning.ui.screens.auth.AuthViewModel::class.java) ->
                app.diredawa.cleaning.ui.screens.auth.AuthViewModel(
                    container.authRepository,
                    container.sessionManager,
                ) as T
            modelClass.isAssignableFrom(app.diredawa.cleaning.ui.screens.home.HomeViewModel::class.java) ->
                app.diredawa.cleaning.ui.screens.home.HomeViewModel(
                    container.authRepository,
                    container.sessionManager,
                    container.resolveScopeUseCase,
                ) as T
            modelClass.isAssignableFrom(app.diredawa.cleaning.ui.screens.notifications.NotificationsViewModel::class.java) ->
                app.diredawa.cleaning.ui.screens.notifications.NotificationsViewModel(
                    container.operationsRepository,
                ) as T
            else -> throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
        }
    }
}