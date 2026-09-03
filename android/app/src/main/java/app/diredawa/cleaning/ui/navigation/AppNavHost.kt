package app.diredawa.cleaning.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavController
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import app.diredawa.cleaning.AppContainer
import app.diredawa.cleaning.ui.screens.auth.LoginScreen
import app.diredawa.cleaning.ui.screens.home.HomeScreen
import app.diredawa.cleaning.ui.screens.more.MoreScreen
import app.diredawa.cleaning.ui.screens.notifications.NotificationsScreen
import app.diredawa.cleaning.ui.screens.operations.OperationsScreen

/** App destinations (§16). Minimum set for the foundation. */
object Destinations {
    const val LOGIN = "login"
    const val HOME = "home"
    const val OPERATIONS = "operations"
    const val NOTIFICATIONS = "notifications"
    const val MORE = "more"
}

private data class BottomItem(
    val label: String,
    val icon: ImageVector,
    val destination: String,
)

private val bottomItems = listOf(
    BottomItem("Home", Icons.Filled.Home, Destinations.HOME),
    BottomItem("Operations", Icons.AutoMirrored.Filled.List, Destinations.OPERATIONS),
    BottomItem("Notifications", Icons.Filled.Notifications, Destinations.NOTIFICATIONS),
    BottomItem("More", Icons.Filled.MoreVert, Destinations.MORE),
)

/**
 * Root navigation graph. Routes on [isAuthenticated] so an invalid/expired session
 * returns to login. Deep links are intentionally not privileged: no destination
 * accepts privileged parameters beyond the graph itself (§32).
 */
@Composable
fun AppNavHost(
    container: AppContainer,
    modifier: Modifier = Modifier,
) {
    val navController = rememberNavController()
    val factory = AppViewModelFactory(container)
    val authenticated by container.sessionManager.isAuthenticated.collectAsState()

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    Scaffold(
        modifier = modifier,
        bottomBar = {
            if (authenticated && currentRoute != Destinations.LOGIN) {
                NavigationBar {
                    bottomItems.forEach { item ->
                        val selected = currentRoute == item.destination
                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                navController.navigate(item.destination) {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(item.icon, contentDescription = item.label) },
                            label = { Text(item.label) },
                        )
                    }
                }
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = if (authenticated) Destinations.HOME else Destinations.LOGIN,
            modifier = Modifier.padding(innerPadding),
        ) {
            composable(Destinations.LOGIN) {
                LoginScreen(
                    viewModelFactory = factory,
                    navController = navController,
                    container = container,
                )
            }
            composable(Destinations.HOME) {
                HomeScreen(
                    viewModelFactory = factory,
                    navController = navController,
                    container = container,
                )
            }
            composable(Destinations.OPERATIONS) {
                OperationsScreen(navController = navController)
            }
            composable(Destinations.NOTIFICATIONS) {
                NotificationsScreen(viewModelFactory = factory)
            }
            composable(Destinations.MORE) {
                MoreScreen(container = container, navController = navController)
            }
        }
    }
}