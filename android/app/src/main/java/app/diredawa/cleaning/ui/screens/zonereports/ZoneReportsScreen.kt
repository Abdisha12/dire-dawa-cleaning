package app.diredawa.cleaning.ui.screens.zonereports

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import app.diredawa.cleaning.domain.model.ZoneReport
import app.diredawa.cleaning.domain.model.ZoneReportStatus
import app.diredawa.cleaning.ui.components.EmptyState
import app.diredawa.cleaning.ui.components.ErrorState
import app.diredawa.cleaning.ui.components.LoadingState
import app.diredawa.cleaning.ui.navigation.AppViewModelFactory

/**
 * Zone Reports mobile workflow (§28–§30). Lists real reports; shows statuses with
 * the exact backend state machine. Submitting a draft (draft → submitted) is
 * ONLINE-ONLY and backend-validated. Preserves the exact state names.
 */
@Composable
fun ZoneReportsScreen(
    viewModelFactory: AppViewModelFactory,
) {
    val viewModel: ZoneReportsViewModel = viewModel(factory = viewModelFactory)
    val state by viewModel.state.collectAsState()

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Zone Reports", style = MaterialTheme.typography.headlineMedium)
        }

        // Draft / new-report form toggle handled inline via a simple editor section.
        Text(state.submitState.reportLabel(), style = MaterialTheme.typography.bodyLarge)

        when {
            state.loading -> LoadingState("Loading reports…")
            state.error != null -> ErrorState(state.error ?: "", onRetry = { viewModel.load() })
            state.reports.isEmpty() -> EmptyState(message = "No zone reports yet.")
            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(state.reports, key = { it.id }) { report ->
                    ReportRow(report, onSubmit = { viewModel.submitExisting(report.id) })
                }
            }
        }
    }
}

@Composable
private fun ReportRow(report: ZoneReport, onSubmit: () -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            Text(report.zoneName ?: "Zone #${report.saferZoneId}", style = MaterialTheme.typography.titleMedium)
            Text(
                "${report.reportYear}-${report.reportMonth}  •  ${report.status?.apiValue ?: "unknown"}",
                style = MaterialTheme.typography.bodyLarge,
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (report.status == ZoneReportStatus.DRAFT) {
                    OutlinedButton(onClick = onSubmit, modifier = Modifier.weight(1f)) {
                        Text("Submit")
                    }
                }
            }
        }
    }
}

private fun ZoneReportsViewModel.ReportSubmitState.reportLabel(): String = when (this) {
    is ZoneReportsViewModel.ReportSubmitState.Submitting -> "Submitting…"
    ZoneReportsViewModel.ReportSubmitState.ServerConfirmed -> "Changes saved by the server."
    is ZoneReportsViewModel.ReportSubmitState.Queued -> "Draft queued for offline sync (not yet confirmed)."
    is ZoneReportsViewModel.ReportSubmitState.Failed -> "Failed: $message"
    ZoneReportsViewModel.ReportSubmitState.Idle -> "Draft→submitted→reviewed→approved"
}