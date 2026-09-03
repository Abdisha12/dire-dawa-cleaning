package app.diredawa.cleaning.ui.screens.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import app.diredawa.cleaning.AppContainer
import app.diredawa.cleaning.domain.model.OperationalScope
import app.diredawa.cleaning.ui.components.ErrorState
import app.diredawa.cleaning.ui.components.LoadingState
import app.diredawa.cleaning.ui.components.UiState
import app.diredawa.cleaning.ui.components.displayLabel
import app.diredawa.cleaning.ui.components.scopeSubtitle
import app.diredawa.cleaning.ui.navigation.AppViewModelFactory
import app.diredawa.cleaning.ui.navigation.Destinations
import kotlinx.coroutines.flow.collect

/**
 * Operational Home (§5–§6). Shows real backend context (scope, worker stats,
 * unread notifications) and role-appropriate quick actions. KPIs are only what the
 * existing APIs expose — nothing is invented. Backend authorization remains the
 * gate; quick actions are a UX convenience only (§6).
 */
@Composable
fun HomeScreen(
    viewModelFactory: AppViewModelFactory,
    navController: NavHostController,
    container: AppContainer,
) {
    val viewModel: HomeViewModel = viewModel(factory = viewModelFactory)
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) {
        container.sessionManager.isAuthenticated.collect { authed ->
            if (!authed) {
                navController.navigate(Destinations.LOGIN) {
                    popUpTo(Destinations.HOME) { inclusive = true }
                }
            }
        }
    }

    when (val s = state) {
        is UiState.Loading -> LoadingState("Loading your workspace…")
        is UiState.Error -> ErrorState(s.error.message, onRetry = { viewModel.load() })
        is UiState.Content -> {
            val scope = s.data.scope
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (scope == null) {
                    Text("No active session", style = MaterialTheme.typography.titleLarge)
                } else {
                    scope.WelcomeHeader()
                    Spacer(Modifier.height(4.dp))
                    ScopeDetails(scope)
                    Spacer(Modifier.height(4.dp))
                    if (scope.user.role.isMutable) {
                        QuickActions(scope.user.role) { action ->
                            navigateQuickAction(action, navController)
                        }
                    }
                    KpiSection(s.data.workerStats.size, s.data.unreadNotifications)
                }
            }
        }
    }
}

private fun navigateQuickAction(action: QuickAction, navController: NavHostController) {
    when (action) {
        QuickAction.RECORD_ATTENDANCE -> navController.navigate(Destinations.ATTENDANCE)
        QuickAction.NEW_INSPECTION -> navController.navigate(Destinations.INSPECTION_CREATE)
        QuickAction.ZONE_REPORTS -> navController.navigate(Destinations.ZONE_REPORTS)
        QuickAction.NOTIFICATIONS -> navController.navigate(Destinations.NOTIFICATIONS)
    }
}

private enum class QuickAction {
    RECORD_ATTENDANCE, NEW_INSPECTION, ZONE_REPORTS, NOTIFICATIONS,
}

@Composable
private fun QuickActions(role: app.diredawa.cleaning.domain.model.Role, onAction: (QuickAction) -> Unit) {
    Card {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Quick Actions", style = MaterialTheme.typography.titleMedium)

            val actions = when (role) {
                app.diredawa.cleaning.domain.model.Role.VIEWER -> listOf(QuickAction.NOTIFICATIONS)
                else -> listOf(
                    QuickAction.RECORD_ATTENDANCE,
                    QuickAction.NEW_INSPECTION,
                    QuickAction.ZONE_REPORTS,
                    QuickAction.NOTIFICATIONS,
                )
            }
            // Large touch targets for field use (§51, §52).
            actions.forEach { action ->
                Button(onClick = { onAction(action) }, Modifier.fillMaxWidth()) {
                    Text(action.label(), style = MaterialTheme.typography.titleMedium)
                }
            }
        }
    }
}

private fun QuickAction.label(): String = when (this) {
    QuickAction.RECORD_ATTENDANCE -> "Record Attendance"
    QuickAction.NEW_INSPECTION -> "New Inspection"
    QuickAction.ZONE_REPORTS -> "Zone Reports"
    QuickAction.NOTIFICATIONS -> "Notifications"
}

@Composable
private fun KpiSection(workerCount: Int, unread: Int?) {
    Card {
        Column(Modifier.padding(16.dp)) {
            Text("Summary", style = MaterialTheme.typography.titleMedium)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                KpiBox("Workers", workerCount.toString(), Modifier.weight(1f))
                KpiBox("Unread", unread?.toString() ?: "–", Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun KpiBox(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier) {
        Column(Modifier.padding(12.dp)) {
            Text(value, style = MaterialTheme.typography.headlineSmall)
            Text(label, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun OperationalScope.WelcomeHeader() {
    Card {
        Column(Modifier.padding(16.dp)) {
            Text("Welcome", style = MaterialTheme.typography.titleMedium)
            Text(user.fullName, style = MaterialTheme.typography.titleLarge)
            Text(scopeSubtitle(), style = MaterialTheme.typography.bodyLarge)
        }
    }
}

@Composable
private fun ScopeDetails(scope: OperationalScope) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Your Role", style = MaterialTheme.typography.titleMedium)
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Text(scope.user.role.displayLabel(), style = MaterialTheme.typography.titleMedium)
                Text("Role", style = MaterialTheme.typography.bodyLarge)
            }
        }
        when (scope) {
            is OperationalScope.CityWide -> {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Access: City-wide", style = MaterialTheme.typography.titleMedium)
                        Text("Administrative privileges apply.", style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }
            is OperationalScope.Kebele -> {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text("My Kebele", style = MaterialTheme.typography.titleMedium)
                        Text(scope.kebele.name, style = MaterialTheme.typography.bodyLarge)
                        Text(scope.kebele.code, style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }
            is OperationalScope.Zone -> {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text("My Safer Zone", style = MaterialTheme.typography.titleMedium)
                        Text(scope.zone.name, style = MaterialTheme.typography.bodyLarge)
                        scope.zone.kebeleName?.let {
                            Text(it, style = MaterialTheme.typography.bodyLarge)
                        }
                    }
                }
            }
        }
    }
}