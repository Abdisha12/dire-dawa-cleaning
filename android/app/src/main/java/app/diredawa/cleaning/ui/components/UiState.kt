package app.diredawa.cleaning.ui.components

import app.diredawa.cleaning.data.api.ApiResult
import app.diredawa.cleaning.data.api.NetworkError
import app.diredawa.cleaning.domain.model.OperationalScope
import app.diredawa.cleaning.domain.model.Role

/**
 * Screen UI state (loading / content / error) consumed by composables.
 * Content is rendered only on [UiState.Content]; error/empty handled via
 * [LoadingState]/[ErrorState]/[EmptyState] helpers.
 */
sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Content<T>(val data: T) : UiState<T>
    data class Error(val error: NetworkError) : UiState<Nothing>

    companion object {
        fun <T> from(api: ApiResult<T>): UiState<T> = when (api) {
            is ApiResult.Success -> Content(api.data)
            is ApiResult.Failure -> Error(api.error)
        }
    }
}

/** Human label for a role, shown to the user (§6 display mapping: collector → Kebele Admin). */
fun Role.displayLabel(): String = displayName

/** Short scope subtitle for the Home screen using the operational scope model. */
fun OperationalScope.scopeSubtitle(): String = when (this) {
    is OperationalScope.CityWide -> "City-wide access"
    is OperationalScope.Kebele -> "My Kebele: ${kebele.name}"
    is OperationalScope.Zone -> "My Safer Zone: ${zone.name}"
}