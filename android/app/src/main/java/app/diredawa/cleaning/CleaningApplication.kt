package app.diredawa.cleaning

import android.app.Application

class CleaningApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        AppGraph.container = AppContainer(this)
    }
}