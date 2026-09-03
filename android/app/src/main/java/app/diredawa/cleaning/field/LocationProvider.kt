package app.diredawa.cleaning.field

import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Looper
import android.annotation.SuppressLint
import app.diredawa.cleaning.domain.model.CapturedLocation
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext

/** Outcome of a location-capture attempt so the UI can render every state (§19). */
sealed interface LocationCaptureOutcome {
    data class Success(val location: CapturedLocation) : LocationCaptureOutcome
    data class Unavailable(val reason: String) : LocationCaptureOutcome
}

/**
 * On-demand device GPS capture (§18, §54). Uses the platform [LocationManager] —
 * no continuous polling, no background tracking. Best-effort single update with a
 * timeout; reports the actual accuracy provided by the OS, never a claimed value
 * (§20). Coordinates are real GPS only — never fabricated.
 *
 * Permission is handled by the caller (requested at the point of use), not here.
 */
class LocationProvider(context: Context) {

    private val lm = context.applicationContext
        .getSystemService(Context.LOCATION_SERVICE) as LocationManager

    suspend fun capture(timeoutMs: Long = 15_000): LocationCaptureOutcome {
        if (!lm.isProviderEnabled(LocationManager.GPS_PROVIDER) &&
            !lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
        ) {
            return LocationCaptureOutcome.Unavailable("GPS is disabled. No location recorded.")
        }
        lastKnown()?.let { return LocationCaptureOutcome.Success(it) }
        return requestSingleUpdate(timeoutMs)
    }

    @SuppressLint("MissingPermission")
    private fun lastKnown(): CapturedLocation? {
        val gps = runCatching { lm.getLastKnownLocation(LocationManager.GPS_PROVIDER) }.getOrNull()
        val fused = runCatching { lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER) }.getOrNull()
        return listOfNotNull(gps, fused).firstOrNull { isRecent(it) }?.let { toDomain(it) }
    }

    private fun isRecent(location: Location): Boolean =
        (System.currentTimeMillis() - location.time) < 60_000L

    @SuppressLint("MissingPermission")
    private suspend fun requestSingleUpdate(timeoutMs: Long): LocationCaptureOutcome = withContext(Dispatchers.IO) {
        suspendCancellableCoroutine { cont ->
            if (cont.isCancelled) return@suspendCancellableCoroutine

            val listener = object : LocationListener {
                override fun onLocationChanged(location: Location) {
                    if (cont.isActive) cont.resume(LocationCaptureOutcome.Success(toDomain(location)))
                }
            }

            val timeout = Runnable {
                if (cont.isActive) {
                    cont.resume(LocationCaptureOutcome.Unavailable("Location timed out. No location recorded."))
                }
                runCatching { lm.removeUpdates(listener) }
            }

            cont.invokeOnCancellation {
                runCatching { lm.removeUpdates(listener) }.getOrNull()
                runCatching { timeout.run() }
            }

            val startedGps = runCatching {
                lm.requestSingleUpdate(LocationManager.GPS_PROVIDER, listener, Looper.getMainLooper())
            }.isSuccess
            val startedNetwork = runCatching {
                lm.requestSingleUpdate(LocationManager.NETWORK_PROVIDER, listener, Looper.getMainLooper())
            }.isSuccess

            if (!startedGps && !startedNetwork) {
                cont.resume(LocationCaptureOutcome.Unavailable("Location unavailable on this device."))
                return@suspendCancellableCoroutine
            }

            val scheduler = Executors.newSingleThreadScheduledExecutor()
            scheduler.schedule(timeout, timeoutMs, TimeUnit.MILLISECONDS)
        }
    }

    private fun toDomain(location: Location): CapturedLocation = CapturedLocation(
        latitude = location.latitude,
        longitude = location.longitude,
        accuracy = if (location.hasAccuracy()) location.accuracy else null,
        capturedAt = location.time,
    )
}