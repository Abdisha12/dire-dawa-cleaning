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
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
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

/**
 * Home/Dashboard foundation (§17). Shows the authenticated user's operational
 * context (role, kebele, zone) from real backend `/me` data. It intentionally does
 * NOT invent statistics — KPI endpooints are optional for the web dashboard; the
 * mobile foundation stays minimal rather than fabricating metrics.
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
        // If not authenticated after load, route to login.
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
            ) {
                if (scope == null) {
                    Text(
                        "No active session",
                        style = MaterialTheme.typography.titleLarge,
                    )
                } else {
                    scope.WelcomeHeader()
                    Spacer(Modifier.height(16.dp))
                    ScopeDetails(scope)
                }
            }
        }
    }
}

@Composable
private fun OperationalScope.WelcomeHeader() {
    Card {
        Column(Modifier.padding(16.dp)) {
            Text("Welcome", style = MaterialTheme.typography.titleMedium)
            Text(
                user.fullName,
                style = MaterialTheme.typography.titleLarge,
            )
            Text(
                scopeSubtitle(),
                style = MaterialTheme.typography.bodyLarge,
            )
        }
    }
}

@Composable
private fun ScopeDetails(scope: OperationalScope) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Your Role", style = MaterialTheme.typography.titleMedium)
        Row(Modifier.fillMaxWidth()) {
            Card(Modifier.weight(1f)) {
                Column(Modifier.padding(16.dp)) {
                    Text(scope.user.role.displayLabel(), style = MaterialTheme.typography.titleMedium)
                    Text("Role", style = MaterialTheme.typography.bodyLarge)
                }
            }
        }
        when (scope) {
            is OperationalScope.CityWide -> {
                Card {
                    Column(Modifier.padding(16.dp)) {
                        Text("Access: City-wide", style = MaterialTheme.typography.titleMedium)
                        Text("Administrative privileges apply.", style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }
            is OperationalScope.Kebele -> {
                Card {
                    Column(Modifier.padding(16.dp)) {
                        Text("My Kebele", style = MaterialTheme.typography.titleMedium)
                        Text(scope.kebele.name, style = MaterialTheme.typography.bodyLarge)
                        Text(scope.kebele.code, style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }
            is OperationalScope.Zone -> {
                Card {
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