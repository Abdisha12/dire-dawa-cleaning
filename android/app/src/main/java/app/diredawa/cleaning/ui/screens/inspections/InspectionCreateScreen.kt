package app.diredawa.cleaning.ui.screens.inspections

import android.Manifest
import android.content.ContentValues
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import app.diredawa.cleaning.domain.model.CapturedLocation
import app.diredawa.cleaning.domain.model.InspectionStatus
import app.diredawa.cleaning.domain.model.SaferZone
import app.diredawa.cleaning.field.PhotoProcessor
import app.diredawa.cleaning.ui.components.LoadingState
import app.diredawa.cleaning.ui.navigation.AppViewModelFactory
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Inspection field form (§15–§27). Site = a safer zone from the backend-scoped list.
 * GPS permission is requested only here, at the point of use (§18); camera too (§23).
 * Positions/photos are captured on demand. The submit reflects server-confirmed vs
 * queued accurately (§14, §26).
 */
@Composable
fun InspectionCreateScreen(
    viewModelFactory: AppViewModelFactory,
) {
    val viewModel: InspectionCreateViewModel = viewModel(factory = viewModelFactory)
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var hasLocationPermission by remember { mutableStateOf(hasLocationPermission(context)) }

    // ── Camera result (returns a boolean success; the photo was written to the Uri) ──
    var pendingPhotoUri by remember { mutableStateOf<Uri?>(null) }
    val takePicture = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        val uri = pendingPhotoUri
        if (success && uri != null) {
            scope.launch {
                val prepared = withContext(Dispatchers.IO) {
                    PhotoProcessor(context).prepare(uri)
                }
                viewModel.addPhoto(prepared)
            }
        }
        pendingPhotoUri = null
    }
    // ── Location permission launcher (point of use, §18) ──
    val locationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        hasLocationPermission = granted
        if (granted) viewModel.captureLocation(app.diredawa.cleaning.field.LocationProvider(context))
    }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("New Inspection", style = MaterialTheme.typography.headlineMedium)

        when {
            state.loadingContext -> LoadingState("Loading authorized sites…")
            state.contextError != null -> Text(
                state.contextError ?: "",
                color = MaterialTheme.colorScheme.error,
            )
            else -> {
                SiteSection(state.zones, state.selectedZone, onSelect = { viewModel.selectZone(it) })
                StatusSection(state.status, onSelect = { viewModel.setStatus(it) })

                OutlinedTextField(
                    value = state.date.format(DateTimeFormatter.ISO_LOCAL_DATE),
                    onValueChange = {},
                    label = { Text("Inspection date") },
                    modifier = Modifier.fillMaxWidth(),
                    readOnly = true,
                )

                OutlinedTextField(
                    value = state.notes,
                    onValueChange = { viewModel.setNotes(it) },
                    label = { Text("Findings / notes") },
                    modifier = Modifier.fillMaxWidth(),
                )

                LocationSection(
                    location = state.location,
                    locationMessage = state.locationMessage,
                    locationBusy = state.locationBusy,
                    onCapture = {
                        if (hasLocationPermission) {
                            viewModel.captureLocation(app.diredawa.cleaning.field.LocationProvider(context))
                        } else {
                            locationPermission.launch(Manifest.permission.ACCESS_FINE_LOCATION)
                        }
                    },
                    onClear = { viewModel.clearLocation() },
                )

                PhotoSection(
                    photoCount = state.photos.size,
                    onCapture = {
                        val uri = createImageUri(context)
                        pendingPhotoUri = uri
                        takePicture.launch(uri)
                    },
                    onRemove = { viewModel.removePhotoAt(state.photos.lastIndex) },
                )

                state.validationError?.let {
                    Text(it, color = MaterialTheme.colorScheme.error)
                }
                Text(submissionLabel(state), style = MaterialTheme.typography.bodyLarge)
                Button(
                    onClick = { viewModel.submit() },
                    enabled = state.submission != InspectionCreateViewModel.InspectionSubmitState.Submitting,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Submit Inspection")
                }
            }
        }
    }
}

private fun hasLocationPermission(context: android.content.Context): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED

private fun createImageUri(context: android.content.Context): Uri {
    val resolver = context.contentResolver
    val values = ContentValues().apply {
        put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/DireDawa")
            put(MediaStore.Images.Media.IS_PENDING, 1)
        }
    }
    return resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)!!
}

@Composable
private fun submissionLabel(state: InspectionCreateViewModel.InspectionDraft): String = when (state.submission) {
    InspectionCreateViewModel.InspectionSubmitState.Idle -> "Ready to submit."
    InspectionCreateViewModel.InspectionSubmitState.Submitting -> "Submitting…"
    InspectionCreateViewModel.InspectionSubmitState.ServerConfirmed -> "Saved by the server."
    is InspectionCreateViewModel.InspectionSubmitState.Queued -> "Queued for offline sync (not yet confirmed)."
    is InspectionCreateViewModel.InspectionSubmitState.Failed -> "Failed: ${state.submission.message}"
}

@Composable
private fun SiteSection(zones: List<SaferZone>, selected: SaferZone?, onSelect: (SaferZone?) -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            Text("Inspection site (Safer Zone)", style = MaterialTheme.typography.titleMedium)
            if (zones.isEmpty()) {
                Text("No authorized sites.", style = MaterialTheme.typography.bodyLarge)
            } else if (zones.size <= 3) {
                zones.forEach { zone ->
                    val isSelected = selected?.id == zone.id
                    OutlinedButton(
                        onClick = { onSelect(zone) },
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    ) {
                        Text(if (isSelected) "${zone.name}  •  selected" else zone.name)
                    }
                }
            } else {
                // Fallback: minimal picker for many options.
                Column {
                    zones.take(20).forEach { zone ->
                        OutlinedButton(
                            onClick = { onSelect(zone) },
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text(zone.name) }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatusSection(status: InspectionStatus, onSelect: (InspectionStatus) -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            Text("Status", style = MaterialTheme.typography.titleMedium)
            InspectionStatus.entries.forEach { s ->
                OutlinedButton(
                    onClick = { onSelect(s) },
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                ) { Text(if (s == status) "${s.apiValue}  •  selected" else s.apiValue) }
            }
        }
    }
}

@Composable
private fun LocationSection(
    location: CapturedLocation?,
    locationMessage: String?,
    locationBusy: Boolean,
    onCapture: () -> Unit,
    onClear: () -> Unit,
) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Location (GPS)", style = MaterialTheme.typography.titleMedium)
            when {
                locationBusy -> Text("Capturing location…", style = MaterialTheme.typography.bodyLarge)
                location != null -> {
                    Text("Captured:", style = MaterialTheme.typography.bodyLarge)
                    Text(
                        "%.6f, %.6f  •  ±%.0fm".format(location.latitude, location.longitude, location.accuracy ?: 0f),
                        style = MaterialTheme.typography.bodyLarge,
                    )
                    OutlinedButton(onClick = onClear) { Text("Clear location") }
                }
                locationMessage != null -> {
                    Text(locationMessage, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyLarge)
                    OutlinedButton(onClick = onCapture) { Text("Capture location") }
                }
                else -> OutlinedButton(onClick = onCapture) { Text("Capture location") }
            }
            Text("Location permission is requested only when you capture here (§18).",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun PhotoSection(photoCount: Int, onCapture: () -> Unit, onRemove: () -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Photos ($photoCount)", style = MaterialTheme.typography.titleMedium)
            Text("Up to 10 photos are supported (§23).", style = MaterialTheme.typography.bodySmall)
            OutlinedButton(onClick = onCapture, enabled = photoCount < 10) {
                Text("Capture photo")
            }
            if (photoCount > 0) {
                OutlinedButton(onClick = onRemove) { Text("Remove last photo") }
            }
        }
    }
}