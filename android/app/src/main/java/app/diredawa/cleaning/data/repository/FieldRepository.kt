package app.diredawa.cleaning.data.repository

import app.diredawa.cleaning.data.api.ApiResult
import app.diredawa.cleaning.data.api.ApiService
import app.diredawa.cleaning.data.api.ErrorKind
import app.diredawa.cleaning.data.api.ErrorMapper
import app.diredawa.cleaning.data.model.AttendanceBulkRecord
import app.diredawa.cleaning.data.model.AttendanceBulkRequest
import app.diredawa.cleaning.data.model.ZoneReportCreateRequest
import app.diredawa.cleaning.domain.model.AttendanceRecord
import app.diredawa.cleaning.domain.model.Business
import app.diredawa.cleaning.domain.model.Inspection
import app.diredawa.cleaning.domain.model.InspectionStatus
import app.diredawa.cleaning.domain.model.ZoneReport
import app.diredawa.cleaning.domain.model.ZoneReportStatus
import app.diredawa.cleaning.data.offline.AttendanceBulkPayload
import app.diredawa.cleaning.data.offline.AttendancePayloadRecord
import app.diredawa.cleaning.data.offline.InspectionCreatePayload
import app.diredawa.cleaning.data.offline.QueueOperationType
import app.diredawa.cleaning.data.offline.SyncQueue
import app.diredawa.cleaning.data.offline.ZoneReportCreatePayload
import app.diredawa.cleaning.data.offline.local.CachedWorkerDao
import app.diredawa.cleaning.data.offline.local.CachedWorkerEntity
import app.diredawa.cleaning.domain.model.Worker
import app.diredawa.cleaning.field.PreparedPhoto
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Field workflows (§9–§30): attendance, inspections, zone reports, businesses.
 * Layers cleanly over ApiService online and SyncQueue offline (§56). The backend
 * remains authoritative; this repository never grants access the backend rejects.
 *
 * Offline rule: a mutation is enqueued ONLY when the failure is a transport
 * problem (network unreachable / timeout). Validation, permission, and conflict
 * failures are returned to the user and are never queued (§36, §41).
 */
class FieldRepository(
    private val api: ApiService,
    private val queue: SyncQueue,
    private val photoDir: () -> java.io.File? = { null },
    private val workerCache: CachedWorkerDao? = null,
) {
    private val cacheTtlMs = 12L * 60L * 60L * 1000L // 12h freshness for the limited worker cache (§35).

    // ── Attendance ──────────────────────────────────────────────────────────

    /**
     * Authorized workers for attendance. Online → fetched from the backend and
     * written to the limited local cache for offline attendance reading (§35).
     * Offline → returns cached fresh workers so marking can continue; the
     * submission itself is queued for later sync (§36).
     */
    suspend fun attendanceWorkers(): ApiResult<List<Worker>> = try {
        val workers = api.workers().map {
            Worker(
                id = it.id,
                fullName = it.full_name,
                contact = it.contact,
                dailyWage = it.daily_wage,
                zoneName = it.zone_name,
                isActive = it.is_active,
            )
        }
        workerCache?.let { cache ->
            cache.clear()
            val now = System.currentTimeMillis()
            workers.forEach {
                cache.upsert(
                    CachedWorkerEntity(
                        workerId = it.id,
                        fullName = it.fullName,
                        zoneName = it.zoneName,
                        isActive = it.isActive,
                        cachedAt = now,
                    ),
                )
            }
        }
        ApiResult.Success(workers)
    } catch (e: Exception) {
        val error = ErrorMapper.map(e)
        if (error.kind == ErrorKind.NETWORK || error.kind == ErrorKind.TIMEOUT) {
            val cached = workerCache?.all().orEmpty()
            val fresh = cached.filter { System.currentTimeMillis() - it.cachedAt < cacheTtlMs }
            if (fresh.isNotEmpty()) {
                ApiResult.Success(fresh.map { Worker(id = it.workerId, fullName = it.fullName, zoneName = it.zoneName, isActive = it.isActive) })
            } else {
                ApiResult.Failure(error)
            }
        } else {
            ApiResult.Failure(error)
        }
    }

    suspend fun saveAttendanceBulk(date: String, records: List<AttendanceRecord>): FieldSubmitResult =
        try {
            api.saveAttendanceBulk(
                AttendanceBulkRequest(
                    date = date,
                    records = records.map { AttendanceBulkRecord(it.workerId, it.present, it.bonus) },
                ),
            )
            FieldSubmitResult.ServerConfirmed
        } catch (e: Exception) {
            when (classify(e)) {
                Classified.Transport -> {
                    val queued = queue.enqueue(
                        QueueOperationType.ATTENDANCE_BULK,
                        AttendanceBulkPayload(
                            date = date,
                            records = records.map { AttendancePayloadRecord(it.workerId, it.present, it.bonus) },
                        ),
                    )
                    FieldSubmitResult.Queued(queued)
                }
                Classified.Permanent -> FieldSubmitResult.Failed(ErrorMapper.map(e))
                Classified.Session -> FieldSubmitResult.Failed(ErrorMapper.map(e))
            }
        }

    // ── Inspections ─────────────────────────────────────────────────────────

    suspend fun inspections(): ApiResult<List<Inspection>> = try {
        ApiResult.Success(api.inspections().data.map { it.toDomain() })
    } catch (e: Exception) {
        ApiResult.Failure(ErrorMapper.map(e))
    }

    /** A worker's recent attendance (field-relevant detail, §7) from the verified endpoint. */
    suspend fun workerAttendance(workerId: Long): ApiResult<List<AttendanceRecord>> = try {
        ApiResult.Success(
            api.workerAttendance(workerId).map {
                AttendanceRecord(
                    id = it.id,
                    workerId = it.worker_id,
                    date = it.date,
                    present = it.present,
                    bonus = it.bonus,
                )
            },
        )
    } catch (e: Exception) {
        ApiResult.Failure(ErrorMapper.map(e))
    }

    /**
     * Creates an inspection. Online → multipart upload with photos; returns
     * [FieldSubmitResult.ServerConfirmed]. If the transport is unreachable, the
     * inspection (with its prepared photo files) is queued for later sync (§36).
     */
    suspend fun createInspection(
        kebeleId: Long,
        saferZoneId: Long?,
        date: String,
        status: InspectionStatus,
        notes: String?,
        photos: List<PreparedPhoto>,
    ): FieldSubmitResult = try {
        val photosParts = photos.map { photo ->
            val file = java.io.File(photo.absolutePath)
            okhttp3.MultipartBody.Part.createFormData(
                "photos",
                photo.fileName,
                file.asRequestBody("image/jpeg".toMediaType()),
            )
        }
        api.createInspection(
            kebeleId = kebeleId.toString().toRequestBody("text/plain".toMediaType()),
            saferZoneId = (saferZoneId?.toString() ?: "null").toRequestBody("text/plain".toMediaType()),
            date = date.toRequestBody("text/plain".toMediaType()),
            status = status.apiValue.toRequestBody("text/plain".toMediaType()),
            notes = (notes ?: "").toRequestBody("text/plain".toMediaType()),
            photos = photosParts,
        )
        FieldSubmitResult.ServerConfirmed
    } catch (e: Exception) {
        when (classify(e)) {
            Classified.Transport -> {
                val queued = queue.enqueue(
                    QueueOperationType.INSPECTION_CREATE,
                    InspectionCreatePayload(
                        kebeleId = kebeleId,
                        saferZoneId = saferZoneId,
                        date = date,
                        status = status.apiValue,
                        notes = notes,
                        photoFileNames = photos.map { it.fileName },
                    ),
                )
                FieldSubmitResult.Queued(queued)
            }
            Classified.Permanent -> FieldSubmitResult.Failed(ErrorMapper.map(e))
            Classified.Session -> FieldSubmitResult.Failed(ErrorMapper.map(e))
        }
    }

    // ── Zone Reports ────────────────────────────────────────────────────────

    suspend fun zoneReports(): ApiResult<List<ZoneReport>> = try {
        ApiResult.Success(api.zoneReports().data.map { it.toDomain() })
    } catch (e: Exception) {
        ApiResult.Failure(ErrorMapper.map(e))
    }

    /** Creates a zone report draft. Queueable offline (draft only) — §36. */
    suspend fun createZoneReport(request: ZoneReportCreateRequest): FieldSubmitResult = try {
        val created = api.createZoneReport(request)
        FieldSubmitResult.ServerConfirmed
    } catch (e: Exception) {
        when (classify(e)) {
            Classified.Transport -> {
                val queued = queue.enqueue(
                    QueueOperationType.ZONE_REPORT_CREATE,
                    ZoneReportCreatePayload(
                        saferZoneId = request.saferZoneId,
                        reportDate = request.reportDate,
                        reportMonth = request.reportMonth ?: 0,
                        reportYear = request.reportYear ?: 0,
                        workersPresent = request.workersPresent,
                        workersAbsent = request.workersAbsent,
                        collectionTotal = request.collectionTotal,
                        issuesReported = request.issuesReported,
                        actionsTaken = request.actionsTaken,
                        toolsStatus = request.toolsStatus,
                    ),
                )
                FieldSubmitResult.Queued(queued)
            }
            Classified.Permanent -> FieldSubmitResult.Failed(ErrorMapper.map(e))
            Classified.Session -> FieldSubmitResult.Failed(ErrorMapper.map(e))
        }
    }

    /**
     * Updates a zone report, including status transitions (submit/review).
     * ONLINE-ONLY: transitions must be validated live by the backend (§29, §40).
     * An offline transition is never queued, because the workflow state may have
     * moved while offline and a queued transition could become invalid (§69).
     */
    suspend fun updateZoneReport(reportId: Long, fields: ZoneReportUpdateFields): ApiResult<Unit> = try {
        api.updateZoneReport(reportId, fields.toRequest())
        ApiResult.Success(Unit)
    } catch (e: Exception) {
        ApiResult.Failure(ErrorMapper.map(e))
    }

    // ── Businesses (for inspection entity selection, §17) ───────────────────

    suspend fun businesses(saferZoneId: Long? = null): ApiResult<List<Business>> = try {
        val filters = saferZoneId?.let { mapOf("saferZoneId" to it.toString()) } ?: emptyMap()
        ApiResult.Success(api.businesses(filters).data.map {
            Business(
                id = it.id,
                name = it.name,
                ownerName = it.owner_name,
                type = it.type,
                saferZoneId = it.safer_zone_id,
                isActive = it.is_active,
                saferZoneName = it.safer_zone_name,
                kebeleName = it.kebele_name,
                kebeleId = it.kebele_id,
            )
        })
    } catch (e: Exception) {
        ApiResult.Failure(ErrorMapper.map(e))
    }

    // ── Mappers / helpers ───────────────────────────────────────────────────

    private enum class Classified { Transport, Permanent, Session }

    private fun classify(e: Exception): Classified {
        val error = ErrorMapper.map(e)
        return when (error.kind) {
            ErrorKind.NETWORK, ErrorKind.TIMEOUT, ErrorKind.SERVER, ErrorKind.RATE_LIMITED -> Classified.Transport
            ErrorKind.UNAUTHORIZED -> Classified.Session
            else -> Classified.Permanent
        }
    }

    private fun app.diredawa.cleaning.data.model.InspectionDto.toDomain(): Inspection = Inspection(
        id = id,
        kebeleId = kebele_id,
        saferZoneId = safer_zone_id,
        date = date,
        status = InspectionStatus.fromApi(status) ?: InspectionStatus.ACTIVE,
        notes = notes,
        kebeleName = kebele_name,
        zoneName = zone_name,
        inspectorName = inspector_name,
        photos = photos.map { app.diredawa.cleaning.domain.model.InspectionPhoto(it.id, it.file_path, it.uploaded_at) },
    )

    private fun app.diredawa.cleaning.data.model.ZoneReportDto.toDomain(): ZoneReport = ZoneReport(
        id = id,
        saferZoneId = safer_zone_id,
        reportDate = report_date,
        reportMonth = report_month,
        reportYear = report_year,
        status = ZoneReportStatus.fromApi(status),
        workersPresent = workers_present,
        workersAbsent = workers_absent,
        collectionTotal = collection_total,
        issuesReported = issues_reported,
        actionsTaken = actions_taken,
        toolsStatus = tools_status,
        reviewedAt = reviewed_at,
        reviewerNotes = reviewer_notes,
        zoneName = zone_name,
        kebeleName = kebele_name,
    )
}

/** Update fields for a zone report (matches the backend PUT body). */
data class ZoneReportUpdateFields(
    val workersPresent: Int? = null,
    val workersAbsent: Int? = null,
    val collectionTotal: Double? = null,
    val issuesReported: String? = null,
    val actionsTaken: String? = null,
    val toolsStatus: String? = null,
    val status: String? = null,
) {
    fun toRequest(): app.diredawa.cleaning.data.model.ZoneReportUpdateRequest =
        app.diredawa.cleaning.data.model.ZoneReportUpdateRequest(
            workersPresent = workersPresent,
            workersAbsent = workersAbsent,
            collectionTotal = collectionTotal,
            issuesReported = issuesReported,
            actionsTaken = actionsTaken,
            toolsStatus = toolsStatus,
            status = status,
        )
}

/** Outcome of a field submission (never conflates queued with confirmed, §14/§33). */
sealed interface FieldSubmitResult {
    /** Server returned 2xx — recorded for real. */
    data object ServerConfirmed : FieldSubmitResult
    /** Stored locally for later sync; NOT yet server-confirmed. */
    data class Queued(val localId: Long) : FieldSubmitResult
    /** Failed and shown to the user (validation/permission/conflict or session). */
    data class Failed(val error: app.diredawa.cleaning.data.api.NetworkError) : FieldSubmitResult
}