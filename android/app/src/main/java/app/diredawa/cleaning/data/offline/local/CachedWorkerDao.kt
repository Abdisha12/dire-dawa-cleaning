package app.diredawa.cleaning.data.offline.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface CachedWorkerDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(worker: CachedWorkerEntity)

    @Query("DELETE FROM cached_workers")
    suspend fun clear()

    @Query("SELECT * FROM cached_workers WHERE isActive = 1 ORDER BY fullName ASC")
    suspend fun all(): List<CachedWorkerEntity>

    @Query("SELECT COUNT(*) FROM cached_workers WHERE cachedAt >= :since")
    suspend fun countFresh(since: Long): Int
}