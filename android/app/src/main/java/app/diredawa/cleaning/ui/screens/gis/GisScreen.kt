package app.diredawa.cleaning.ui.screens.gis

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import app.diredawa.cleaning.data.repository.GisLayer
import app.diredawa.cleaning.ui.components.EmptyState
import app.diredawa.cleaning.ui.components.ErrorState
import app.diredawa.cleaning.ui.components.LoadingState
import app.diredawa.cleaning.ui.navigation.AppViewModelFactory

/**
 * Android GIS screen (§36–§38, §54). No map SDK is bundled in this phase: the
 * screen shows backend-scoped layer summaries with honest geometry counts plus
 * an accessible entity list (required by §54–§55). Offline shows "Map data
 * unavailable offline" instead of stale geometry. Locate-me is on-demand only.
 */
@Composable
fun GisScreen(viewModelFactory: AppViewModelFactory) {
    val viewModel: GisViewModel = viewModel(factory = viewModelFactory)
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current
    var hasLocationPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED,
        )
    }
    val permissionLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            hasLocationPermission = granted
            if (granted) viewModel.locateMe(app.diredawa.cleaning.field.LocationProvider(context))
        }

    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("GIS Map", style = MaterialTheme.typography.headlineMedium)

        if (!state.isOnline) {
            Card(Modifier.fillMaxWidth()) {
                Text(
                    "Map data unavailable offline",
                    Modifier.padding(12.dp),
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(
                onClick = {
                    if (hasLocationPermission) {
                        viewModel.locateMe(app.diredawa.cleaning.field.LocationProvider(context))
                    } else {
                        permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
                    }
                },
                modifier = Modifier.weight(1f),
            ) {
                Text(if (state.locating) "Locating…" else "Locate me")
            }
            OutlinedButton(onClick = { viewModel.loadBase() }, modifier = Modifier.weight(1f)) {
                Text("Refresh")
            }
        }
        state.myLocation?.let {
            Text(
                "My location: %.6f, %.6f (±%.0fm)".format(it.latitude, it.longitude, it.accuracy ?: 0f),
                style = MaterialTheme.typography.bodyLarge,
            )
        }
        state.locationMessage?.let {
            Text(it, color = MaterialTheme.colorScheme.error)
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            LayerToggle("Kebele", state.enabledLayers.contains("Kebele")) { viewModel.toggleLayer("Kebele") }
            LayerToggle("SaferZone", state.enabledLayers.contains("SaferZone")) { viewModel.toggleLayer("SaferZone") }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            LayerToggle("Business", state.enabledLayers.contains("Business")) { viewModel.toggleLayer("Business") }
            LayerToggle("Worker", state.enabledLayers.contains("Worker")) { viewModel.toggleLayer("Worker") }
            LayerToggle("Inspection", state.enabledLayers.contains("Inspection")) { viewModel.toggleLayer("Inspection") }
        }

        when {
            state.loadingBase -> LoadingState("Loading map layers…")
            state.baseError != null -> ErrorState(state.baseError ?: "", onRetry = { viewModel.loadBase() })
            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (state.enabledLayers.contains("Kebele")) {
                    item { LayerSection("Kebeles", state.kebeles) }
                }
                if (state.enabledLayers.contains("SaferZone")) {
                    item { LayerSection("Safer Zones", state.zones) }
                }
                if (state.enabledLayers.contains("Business")) {
                    item { LayerSection("Businesses", state.businesses) }
                }
                if (state.enabledLayers.contains("Worker")) {
                    item { LayerSection("Workers", state.workers) }
                }
                if (state.enabledLayers.contains("Inspection")) {
                    item { LayerSection("Inspections", state.inspections) }
                }
            }
        }
    }
}

@Composable
private fun LayerToggle(label: String, enabled: Boolean, onToggle: () -> Unit) {
    OutlinedButton(onClick = onToggle) {
        Text(if (enabled) "$label ✓" else label)
    }
}

@Composable
private fun LayerSection(title: String, layer: GisLayer?) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            if (layer == null) {
                Text("Enable this layer to load it.", style = MaterialTheme.typography.bodyLarge)
                return@Column
            }
            Text(
                "${layer.total} total • ${layer.withGeometry} with location • ${layer.withoutGeometry} location unavailable",
                style = MaterialTheme.typography.bodyLarge,
            )
            if (layer.items.isEmpty()) {
                EmptyState(message = "No $title in your scope.")
            } else {
                layer.items.take(50).forEach { item ->
                    Column(Modifier.fillMaxWidth()) {
                        Text(item.label, style = MaterialTheme.typography.bodyLarge)
                        val detail = listOfNotNull(
                            item.kebeleName?.let { "Kebele: $it" },
                            item.zoneName?.let { "Zone: $it" },
                            item.status?.let { "Status: $it" },
                            if (item.locationUnavailable) "Location unavailable" else null,
                        ).joinToString(" • ")
                        if (detail.isNotBlank()) {
                            Text(detail, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
                if (layer.items.size > 50) {
                    Text("+${layer.items.size - 50} more (bounded list)", style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}
