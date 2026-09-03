package app.diredawa.cleaning.ui.screens.more

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import app.diredawa.cleaning.AppContainer
import app.diredawa.cleaning.ui.components.displayLabel
import app.diredawa.cleaning.ui.navigation.Destinations
import kotlinx.coroutines.launch

/**
 * "More" screen (§16, §19-20): shows current account summary and role-aware
 * controls. Logout calls the backend `/api/auth/logout` then clears local session.
 * Mutable controls are gated by role — Viewer never sees mutation actions (§20).
 */
@Composable
fun MoreScreen(
    container: AppContainer,
    navController: NavHostController,
) {
    val scope = rememberCoroutineScope()
    val currentUser by container.sessionManager.currentUser.collectAsState()

    Column(
        Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("More", style = MaterialTheme.typography.headlineMedium)

        Card {
            Column(Modifier.padding(16.dp)) {
                Text(currentUser?.fullName ?: "Signed out", style = MaterialTheme.typography.titleLarge)
                Text(currentUser?.role?.displayLabel() ?: "", style = MaterialTheme.typography.bodyLarge)
                currentUser?.username?.let {
                    Text("@$it", style = MaterialTheme.typography.bodyLarge)
                }
            }
        }

        Spacer(Modifier.height(8.dp))

        OutlinedButton(
            onClick = { navController.navigate(Destinations.WORKERS) },
            Modifier.fillMaxWidth(),
        ) {
            Text("Workers")
        }

        OutlinedButton(
            onClick = { navController.navigate(Destinations.SYNC) },
            Modifier.fillMaxWidth(),
        ) {
            Text("Sync status")
        }

        OutlinedButton(
            onClick = {},
            Modifier.fillMaxWidth(),
        ) {
            Text("Settings (prepared)")
        }

        if (currentUser != null) {
            // All authenticated roles (including Viewer) can sign out of the shared device.
            Button(
                onClick = {
                    scope.launch { container.authRepository.logout() }
                    navController.navigate(Destinations.LOGIN) {
                        popUpTo(Destinations.MORE) { inclusive = true }
                    }
                },
                Modifier.fillMaxWidth(),
            ) {
                Text("Sign out")
            }
        }
    }
}