package app.diredawa.cleaning.ui.screens.sync

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import app.diredawa.cleaning.ui.navigation.AppViewModelFactory

/**
 * Sync status screen (§43–§44). Shows pending queue count, connectivity indicator,
 * and provides manual-expedite. No token counts, no usernames, no schemas exposed.
 */
@Composable
fun SyncScreen(
    viewModelFactory: AppViewModelFactory,
) {
    val viewModel: SyncStatusViewModel = viewModel(factory = viewModelFactory)
    val state by viewModel.state.collectAsState()

    Column(
        Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Sync", style = MaterialTheme.typography.headlineMedium)

        // ── Connectivity banner (§43) ──
        Card(Modifier.fillMaxWidth()) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                val color = if (state.isOnline) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.error
                androidx.compose.foundation.Canvas(
                    Modifier
                        .size(12.dp)
                        .clip(androidx.compose.foundation.shape.CircleShape),
                    onDraw = { drawCircle(color) },
                )
                Text(
                    if (state.isOnline) "Online" else "Offline — no connection",
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
        }

        // ── Queue status (§44) ──
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Pending operations: ${state.pendingCount}", style = MaterialTheme.typography.titleMedium)
                Text(
                    if (state.pendingCount == 0L) "All operations confirmed by the server."
                    else "${state.pendingCount} operation(s) queued (no tokens stored).",
                    style = MaterialTheme.typography.bodyLarge,
                )
                OutlinedButton(
                    onClick = { viewModel.expediteSync() },
                    enabled = state.isOnline && state.pendingCount > 0,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Sync now")
                }
            }
        }

        // ── Schedule info (§44-§45) ──
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp)) {
                Text("Schedule", style = MaterialTheme.typography.titleMedium)
                Text(
                    "Background sync runs every 30 minutes (§44) and expedites on connectivity restoration (§45). " +
                    "You can also tap Sync now above.",
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
        }
    }
}