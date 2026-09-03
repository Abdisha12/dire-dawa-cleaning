package app.diredawa.cleaning

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import app.diredawa.cleaning.ui.navigation.AppNavHost
import app.diredawa.cleaning.ui.theme.DireDawaTheme

/**
 * Single-activity Compose foundation.
 *
 * The [[AppNavHost]] hosts the Scaffold + bottom navigation + inner NavHost so the
 * bottom bar shares one NavController with the screens. Family of primary
 * destinations: Home, Operations, Notifications, More (§16).
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            DireDawaTheme {
                AppNavHost(container = AppGraph.container)
            }
        }
    }
}