package app.diredawa.cleaning.ui.screens.workers

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
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import app.diredawa.cleaning.domain.model.Worker
import app.diredawa.cleaning.ui.components.EmptyState
import app.diredawa.cleaning.ui.components.ErrorState
import app.diredawa.cleaning.ui.components.LoadingState
import app.diredawa.cleaning.ui.navigation.AppViewModelFactory

/**
 * Field-friendly worker list (§7, §8). Search is debounced for minimal typing (§52).
 * Only operational fields are shown (name, zone, active status) — no salary, Fayda,
 * or internal DB values, preserving worker privacy on field devices (§8).
 */
@Composable
fun WorkersScreen(
    viewModelFactory: AppViewModelFactory,
    onWorkerClick: (workerId: Long, name: String, role: String?) -> Unit,
) {
    val viewModel: WorkersViewModel = viewModel(factory = viewModelFactory)
    val state by viewModel.state.collectAsState()
    var query by remember { mutableStateOf("") }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("Workers", style = MaterialTheme.typography.headlineMedium)
        OutlinedTextField(
            value = query,
            onValueChange = {
                query = it
                viewModel.search(it)
            },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Search workers") },
            singleLine = true,
            placeholder = { Text("Name or contact") },
        )

        when {
            state.loading -> LoadingState("Loading workers…")
            state.error != null -> ErrorState(state.error ?: "", onRetry = { viewModel.load() })
            state.list.isEmpty() -> EmptyState(message = "No workers found.")
            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(state.list, key = { it.id }) { worker ->
                    WorkerRow(worker, onClick = { onWorkerClick(worker.id, worker.fullName, null) })
                }
            }
        }
    }
}

@Composable
private fun WorkerRow(worker: Worker, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column {
                Text(worker.fullName, style = MaterialTheme.typography.titleMedium)
                worker.zoneName?.let {
                    Text(it, style = MaterialTheme.typography.bodyLarge)
                }
            }
            Text(
                if (worker.isActive) "Active" else "Inactive",
                style = MaterialTheme.typography.bodyMedium,
                color = if (worker.isActive) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error,
            )
        }
    }
}