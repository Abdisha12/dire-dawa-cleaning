package app.diredawa.cleaning.data.offline

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Interface for connectivity signalling so the [ConnectivityRepository] (and UI
 * indicator, §43) can be tested without Android framework.
 */
interface NetworkMonitor {
    val isOnline: StateFlow<Boolean>
}

/**
 * Real connectivity monitor backed by [ConnectivityManager] (§43). Exposes a
 * simple Online/Offline StateFlow. Used for the global network indicator and to
 * schedule a sync pass when connectivity is restored (§38).
 */
class RealNetworkMonitor(context: Context) : NetworkMonitor {

    private val cm =
        context.applicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private val _isOnline = MutableStateFlow(currentlyOnline())
    override val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()

    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            _isOnline.value = true
        }

        override fun onLost(network: Network) {
            _isOnline.value = currentlyOnline()
        }

        override fun onUnavailable() {
            _isOnline.value = currentlyOnline()
        }
    }

    init {
        cm.registerDefaultNetworkCallback(callback)
    }

    private fun currentlyOnline(): Boolean {
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }
}