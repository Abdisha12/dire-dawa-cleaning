package app.diredawa.cleaning.data.offline.local

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Minimal authorized worker cache for offline attendance (§35). Persists only the
 * fields needed to recognize a worker and mark attendance while offline: id and
 * full name plus a scoping hint. No Fayda ID, no salary, no contact — worker
 * privacy is preserved on field devices (§8, §45).
 *
 * Entries carry a `cachedAt` timestamp so the queue can enforce a freshness TTL
 * and drop stale records rather than keeping sensitive reference data forever.
 */
@Entity(tableName = "cached_workers")
data class CachedWorkerEntity(
    @PrimaryKey val workerId: Long,
    val fullName: String,
    val zoneName: String? = null,
    val isActive: Boolean = true,
    val cachedAt: Long,
)