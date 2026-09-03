package app.diredawa.cleaning.ui.screens.notifications

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import app.diredawa.cleaning.domain.model.AppNotification
import app.diredawa.cleaning.ui.components.EmptyState
import app.diredawa.cleaning.ui.components.ErrorState
import app.diredawa.cleaning.ui.components.LoadingState
import app.diredawa.cleaning.ui.components.UiState
import app.diredawa.cleaning.ui.navigation.AppViewModelFactory

/**
 * Notifications (§31–§32): lists the authenticated user's real notifications from
 * the backend; tap to mark read (PUT). Notification `link` values are UI anchors
 * like `#payments` (`overdue_payment`), `#zonereports` (`pending_report`) or
 * `#workers` (`absent_worker`) — none carry entity IDs or deep links that could
 * bypass authorization, so no privileged deep navigation is surfaced (§32).
 */
@Composable
fun NotificationsScreen(
    viewModelFactory: AppViewModelFactory,
) {
    val viewModel: NotificationsViewModel = viewModel(factory = viewModelFactory)
    val state by viewModel.state.collectAsState()

    when (val s = state) {
        is UiState.Loading -> LoadingState("Loading notifications…")
        is UiState.Error -> ErrorState(s.error.message, onRetry = { viewModel.load() })
        is UiState.Content -> {
            if (s.data.isEmpty()) {
                Column(Modifier.fillMaxSize()) {
                    Text("Notifications", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.padding(16.dp))
                    EmptyState(message = "No notifications right now.")
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    item {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("Notifications", style = MaterialTheme.typography.headlineMedium)
                            TextButton(onClick = { viewModel.markAllRead() }) {
                                Text("Mark all read")
                            }
                        }
                    }
                    items(s.data, key = { it.id }) { n ->
                        NotificationRow(n, onMarkRead = { viewModel.markRead(n.id) })
                    }
                }
            }
        }
    }
}

@Composable
private fun NotificationRow(notification: AppNotification, onMarkRead: () -> Unit) {
    Card {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(12.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                // Unread indicator dot.
                if (!notification.isRead) {
                    Box(
                        Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primary),
                    )
                    Spacer(Modifier.size(8.dp))
                }
                Text(
                    notification.title,
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.weight(1f),
                )
                if (!notification.isRead) {
                    TextButton(onClick = onMarkRead) {
                        Text("Mark read")
                    }
                }
            }
            Spacer(Modifier.height(4.dp))
            Text(notification.message, style = MaterialTheme.typography.bodyLarge)
            notification.createdAt?.let {
                Spacer(Modifier.height(4.dp))
                Text(it, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}