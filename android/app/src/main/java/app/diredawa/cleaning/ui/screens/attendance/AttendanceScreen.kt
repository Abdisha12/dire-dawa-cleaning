package app.diredawa.cleaning.ui.screens.attendance

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
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
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/**
 * Attendance workflow screen (§9–§14). Large touch controls for bulk marking (§10),
 * a concise review summary (§13), and an explicit submission state that never
 * masks queued-as-confirmed (§14). Date is a LocalDate; serialized centrally (§12).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AttendanceScreen(
    viewModelFactory: AppViewModelFactory,
) {
    val viewModel: AttendanceViewModel = viewModel(factory = viewModelFactory)
    val state by viewModel.state.collectAsState()
    var showDatePicker by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("Attendance", style = MaterialTheme.typography.headlineMedium)

        // Date row (§12).
        Card(Modifier.fillMaxWidth()) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column {
                    Text("Date", style = MaterialTheme.typography.bodyMedium)
                    Text(
                        state.date.format(DateTimeFormatter.ISO_LOCAL_DATE),
                        style = MaterialTheme.typography.titleMedium,
                    )
                }
                OutlinedButton(onClick = { showDatePicker = true }) {
                    Text("Change")
                }
            }
        }

        // Review summary (§13, actual selected data).
        ReviewSummary(
            total = state.total,
            present = state.presentCount,
            absent = state.absentCount,
        )

        SubmitBar(state, onSubmit = { viewModel.submit() })

        if (showDatePicker) {
            val pickerState = rememberDatePickerState(
                // local date → UTC millis for the picker; on confirm we read back UTC millis → local date.
                initialSelectedDateMillis = state.date.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
            )
            DatePickerDialog(
                onDismissRequest = { showDatePicker = false },
                confirmButton = {
                    TextButton(onClick = {
                        val millis = pickerState.selectedDateMillis
                        millis?.let {
                            val date = Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate()
                            viewModel.setDate(date)
                        }
                        showDatePicker = false
                    }) { Text("OK") }
                },
                dismissButton = {
                    TextButton(onClick = { showDatePicker = false }) { Text("Cancel") }
                },
            ) {
                DatePicker(state = pickerState)
            }
        }

        when {
            state.loading -> LoadingState("Loading authorized workers…")
            state.error != null -> ErrorState(state.error ?: "", onRetry = { viewModel.loadWorkers() })
            state.workers.isEmpty() -> EmptyState(message = "No workers assigned to you.")
            else -> WorkerAttendanceList(
                state = state,
                viewModel = viewModel,
            )
        }
    }
}

@Composable
private fun ReviewSummary(total: Int, present: Int, absent: Int) {
    Card(Modifier.fillMaxWidth().padding(top = 8.dp)) {
        Column(Modifier.padding(12.dp)) {
            Text("Review", style = MaterialTheme.typography.titleMedium)
            Text("Workers: $total     Present: $present     Absent: $absent", style = MaterialTheme.typography.bodyLarge)
        }
    }
}

@Composable
private fun SubmitBar(
    state: AttendanceViewModel.AttendanceUiState,
    onSubmit: () -> Unit,
) {
    Card(Modifier.fillMaxWidth().padding(top = 8.dp)) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(submissionLabel(state), style = MaterialTheme.typography.bodyLarge)
            Button(onClick = onSubmit, enabled = state.workers.isNotEmpty() && state.submission != AttendanceViewModel.SubmissionState.Submitting, modifier = Modifier.fillMaxWidth()) {
                Text("Submit Attendance")
            }
        }
    }
}

@Composable
private fun submissionLabel(state: AttendanceViewModel.AttendanceUiState): String = when (state.submission) {
    is AttendanceViewModel.SubmissionState.NotSubmitted -> "Not submitted yet."
    AttendanceViewModel.SubmissionState.Submitting -> "Submitting…"
    AttendanceViewModel.SubmissionState.ServerConfirmed -> "Confirmed by the server."
    is AttendanceViewModel.SubmissionState.Queued -> "Saved for offline sync (not yet confirmed)."
    is AttendanceViewModel.SubmissionState.Failed -> "Submission failed: ${state.submission.message}"
}

@Composable
private fun WorkerAttendanceList(
    state: AttendanceViewModel.AttendanceUiState,
    viewModel: AttendanceViewModel,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { viewModel.markAll(true) }, Modifier.weight(1f)) {
                    Text("All Present")
                }
                OutlinedButton(onClick = { viewModel.markAll(false) }, Modifier.weight(1f)) {
                    Text("All Absent")
                }
            }
        }
        items(state.workers, key = { it.worker.id }) { presence ->
            AttendanceWorkerRow(presence, onToggle = { viewModel.toggle(presence.worker.id) })
        }
    }
}

@Composable
private fun AttendanceWorkerRow(presence: AttendanceViewModel.WorkerPresence, onToggle: () -> Unit) {
    val worker: Worker = presence.worker
    // Large touch target; shows present/absent as full-width buttons (§10, §52).
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(worker.fullName, style = MaterialTheme.typography.titleSmall)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = onToggle,
                enabled = presence.present.not(),
                modifier = Modifier.weight(1f),
            ) { Text("Present") }
            Button(
                onClick = onToggle,
                enabled = presence.present,
                modifier = Modifier.weight(1f),
            ) { Text("Absent") }
        }
    }
}