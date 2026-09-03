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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import app.diredawa.cleaning.AppContainer
import app.diredawa.cleaning.ui.components.EmptyState
import app.diredawa.cleaning.ui.components.LoadingState

@Composable
fun WorkerDetailScreen(
    workerId: Long,
    workerName: String,
    workerRole: String?,
    container: AppContainer,
) {
    val factory = rememberWorkerDetailFactory(workerId, workerName, workerRole, container)
    val viewModel: WorkerDetailViewModel = viewModel(key = "worker-$workerId", factory = factory)
    val state by viewModel.state.collectAsState()

    Column(
        Modifier
            .fillMaxSize()
            .padding(16.dp),
    ) {
        Text("Worker detail", style = MaterialTheme.typography.headlineMedium)
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp)) {
                Text(state.workerName, style = MaterialTheme.typography.titleLarge)
                Text(state.workerRole ?: "Collector", style = MaterialTheme.typography.bodyLarge)
            }
        }
        Text("Recent attendance", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 12.dp))
        when {
            state.loadingAttendance -> LoadingState("Loading attendance…")
            state.attendanceError != null -> Text(
                state.attendanceError ?: "",
                color = MaterialTheme.colorScheme.error,
            )
            state.attendance.isEmpty() -> EmptyState(message = "No attendance recorded.")
            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(state.attendance, key = { it.date }) { record ->
                    Card(Modifier.fillMaxWidth()) {
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(record.date, style = MaterialTheme.typography.bodyLarge)
                            Text(
                                if (record.present) "Present" else "Absent",
                                color = MaterialTheme.colorScheme.primary,
                                style = MaterialTheme.typography.bodyLarge,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun rememberWorkerDetailFactory(
    workerId: Long,
    workerName: String,
    workerRole: String?,
    container: AppContainer,
): ViewModelProvider.Factory = remember(workerId, workerName, workerRole) {
    object : ViewModelProvider.Factory {
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            @Suppress("UNCHECKED_CAST")
            return WorkerDetailViewModel(
                workerId, workerName, workerRole,
                container.operationsRepository,
                container.fieldRepository,
            ) as T
        }
    }
}