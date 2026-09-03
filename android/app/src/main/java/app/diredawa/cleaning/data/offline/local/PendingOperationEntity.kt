package app.diredawa.cleaning.data.offline.local

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Room entity for a queued pending operation (§37). Column set mirrors the queue
 * record spec: local_id, operation_type, created_at, attempt_count, status,
 * payload/reference. No tokens are stored in this table (§37, §45).
 */
@Entity(tableName = "pending_operations")
data class PendingOperationEntity(
    @PrimaryKey(autoGenerate = true) val localId: Long = 0,
    val operationType: String,
    val payloadJson: String,
    val createdAt: Long,
    val attemptCount: Int = 0,
    val status: String,
    val lastError: String? = null,
)