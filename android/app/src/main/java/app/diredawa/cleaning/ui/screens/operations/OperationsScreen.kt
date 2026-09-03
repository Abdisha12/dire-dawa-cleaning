package app.diredawa.cleaning.ui.screens.operations

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController

/**
 * Operations foundation (§24). Navigation hub for future field workflows.
 * Only links that map to verified existing backend workflows are enabled; the
 * rest are presented as "prepared" placeholders and are clearly marked, never
 * fabricated as working features (§44).
 */
@Composable
fun OperationsScreen(
    navController: NavHostController,
) {
    Column(
        Modifier
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Operations", style = MaterialTheme.typography.headlineMedium)

        Card {
            Column(Modifier.padding(16.dp)) {
                Text("Workers", style = MaterialTheme.typography.titleMedium)
                Text("List and view worker details (backend-supported).", style = MaterialTheme.typography.bodyLarge)
            }
        }
        Card {
            Column(Modifier.padding(16.dp)) {
                Text("Attendance", style = MaterialTheme.typography.titleMedium)
                Text("Record daily attendance (foundation only — full workflow not yet wired).", style = MaterialTheme.typography.bodyLarge)
            }
        }
        Card {
            Column(Modifier.padding(16.dp)) {
                Text("Inspections", style = MaterialTheme.typography.titleMedium)
                Text("Prepared for inspections (location / photos / findings / submit).", style = MaterialTheme.typography.bodyLarge)
            }
        }
        Card {
            Column(Modifier.padding(16.dp)) {
                Text("Zone Reports", style = MaterialTheme.typography.titleMedium)
                Text("Prepares the draft → submitted → reviewed → approved workflow.", style = MaterialTheme.typography.bodyLarge)
            }
        }
    }
}