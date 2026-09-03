package app.diredawa.cleaning.data.offline.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

/**
 * Local persistence for offline field workflows (§34). Holds only:
 *  - the pending mutation queue (pending_operations)
 *  - a limited authorized worker cache for offline attendance (cached_workers)
 *
 * The full municipal database is never cached (§34). Sensitive state (session
 * token) stays in EncryptedSharedPreferences, not here (§45).
 */
@Database(
    entities = [PendingOperationEntity::class, CachedWorkerEntity::class],
    version = 1,
    exportSchema = false,
)
abstract class FieldDatabase : RoomDatabase() {

    abstract fun pendingOperationDao(): PendingOperationDao
    abstract fun cachedWorkerDao(): CachedWorkerDao

    companion object {
        @Volatile private var instance: FieldDatabase? = null

        fun get(context: Context): FieldDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    FieldDatabase::class.java,
                    "field.db",
                ).build().also { instance = it }
            }
    }
}