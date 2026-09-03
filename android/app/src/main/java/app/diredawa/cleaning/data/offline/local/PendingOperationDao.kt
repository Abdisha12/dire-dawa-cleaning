package app.diredawa.cleaning.data.offline.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query

@Dao
interface PendingOperationDao {

    @Insert
    suspend fun insert(entity: PendingOperationEntity): Long

    @Query("SELECT * FROM pending_operations WHERE status IN ('PENDING','SYNCING','NEEDS_AUTH') ORDER BY createdAt ASC")
    suspend fun drainable(): List<PendingOperationEntity>

    @Query("SELECT * FROM pending_operations ORDER BY createdAt DESC")
    suspend fun all(): List<PendingOperationEntity>

    @Query("UPDATE pending_operations SET status=:status WHERE localId=:id")
    suspend fun setStatus(id: Long, status: String)

    @Query("UPDATE pending_operations SET attemptCount=attemptCount+1, lastError=:error WHERE localId=:id")
    suspend fun incrementAttempt(id: Long, error: String?)

    @Query("DELETE FROM pending_operations WHERE localId=:id")
    suspend fun delete(id: Long)

    @Query("SELECT COUNT(*) FROM pending_operations")
    suspend fun countAll(): Int

    @Query("SELECT COUNT(*) FROM pending_operations WHERE status IN ('PENDING','SYNCING','NEEDS_AUTH')")
    suspend fun countPending(): Int
}