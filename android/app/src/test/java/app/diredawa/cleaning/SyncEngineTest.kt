package app.diredawa.cleaning

import app.diredawa.cleaning.data.api.ApiClient
import app.diredawa.cleaning.data.api.ApiService
import app.diredawa.cleaning.data.offline.AttendanceBulkPayload
import app.diredawa.cleaning.data.offline.AttendancePayloadRecord
import app.diredawa.cleaning.data.offline.JsonQueuePayloadCodec
import app.diredawa.cleaning.data.offline.QueueOperationType
import app.diredawa.cleaning.data.offline.QueueStatus
import app.diredawa.cleaning.data.offline.RoomSyncQueue
import app.diredawa.cleaning.data.offline.SyncEngine
import app.diredawa.cleaning.data.offline.local.PendingOperationDao
import app.diredawa.cleaning.data.offline.local.PendingOperationEntity
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Phase 11 offline sync engine tests (§38–§45). Uses an in-memory fake
 * [PendingOperationDao] + real [RoomSyncQueue] + real [SyncEngine] against a
 * MockWebServer-backed Retrofit [ApiService]. Verifies classification, retry,
 * 401 (session expired, payload preserved), 403/404/409 permanent, dedupe on
 * success, and never auto-deleting queued work on auth failure.
 */
class SyncEngineTest {

    private lateinit var server: MockWebServer
    private lateinit var dao: FakePendingOperationDao
    private lateinit var queue: RoomSyncQueue
    private lateinit var api: ApiService
    private lateinit var engine: SyncEngine

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        dao = FakePendingOperationDao()
        queue = RoomSyncQueue(dao, JsonQueuePayloadCodec())
        api = ApiClient.build(server.url("/").toString(), tokenProvider = { "tok" }, enableLogging = false)
        engine = SyncEngine(queue = queue, api = api, maxAttempts = 3)
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    private suspend fun enqueueAttendance() {
        queue.enqueue(
            QueueOperationType.ATTENDANCE_BULK,
            AttendanceBulkPayload(date = "2026-01-15", records = listOf(AttendancePayloadRecord(1, true, null))),
        )
    }

    @Test
    fun success_confirmsAndDeletesFromQueue() = runTest {
        enqueueAttendance()
        server.enqueue(MockResponse().setResponseCode(200).setBody("""{"message":"saved"}"""))
        val summary = engine.processPendingOps()
        assertEquals(1, summary.confirmed)
        assertEquals(0, dao.all().size)
    }

    @Test
    fun server500_retriesWithoutDeleting() = runTest {
        enqueueAttendance()
        server.enqueue(MockResponse().setResponseCode(500).setBody("""{"error":"boom"}"""))
        val summary = engine.processPendingOps()
        assertEquals(1, summary.retryable)
        assertEquals(0, summary.permanentlyFailed)
        val remaining = dao.all()
        assertEquals(1, remaining.size)
        assertEquals(1, remaining.first().attemptCount)
        // incrementAttempt keeps the op drainable (SYNCING is in the drainable set).
        assertTrue(remaining.first().status in setOf(QueueStatus.PENDING.name, QueueStatus.SYNCING.name))
    }

    @Test
    fun unauthorized_preservesPayloadAndMarksNeedsAuth() = runTest {
        enqueueAttendance()
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"Session expired or invalid"}"""))
        val summary = engine.processPendingOps()
        assertEquals(1, summary.needsAuth)
        val remaining = dao.all()
        assertEquals(1, remaining.size)
        assertEquals(QueueStatus.NEEDS_AUTH.name, remaining.first().status)
        // Payload is still present so it can be replayed after reauth (§42).
        assertTrue(remaining.first().payloadJson.isNotBlank())
    }

    @Test
    fun forbidden_isPermanent() = runTest {
        enqueueAttendance()
        server.enqueue(MockResponse().setResponseCode(403).setBody("""{"error":"forbidden"}"""))
        val summary = engine.processPendingOps()
        assertEquals(1, summary.permanentlyFailed)
        assertEquals(QueueStatus.FAILED.name, dao.all().first().status)
    }

    @Test
    fun notFound_isPermanent() = runTest {
        enqueueAttendance()
        server.enqueue(MockResponse().setResponseCode(404).setBody("""{"error":"missing"}"""))
        val summary = engine.processPendingOps()
        assertEquals(1, summary.permanentlyFailed)
        assertEquals(QueueStatus.FAILED.name, dao.all().first().status)
    }

    @Test
    fun conflict_isPermanentAndFriendly() = runTest {
        enqueueAttendance()
        server.enqueue(MockResponse().setResponseCode(409).setBody("""{"error":"conflict"}"""))
        val summary = engine.processPendingOps()
        assertEquals(1, summary.permanentlyFailed)
        val failed = dao.all().first()
        assertEquals(QueueStatus.FAILED.name, failed.status)
        assertTrue(failed.lastError.orEmpty().isNotBlank())
    }

    @Test
    fun rateLimited_retries() = runTest {
        enqueueAttendance()
        server.enqueue(MockResponse().setResponseCode(429).setBody("""{"error":"rate limited"}"""))
        val summary = engine.processPendingOps()
        assertEquals(1, summary.retryable)
        assertTrue(dao.all().first().status in setOf(QueueStatus.PENDING.name, QueueStatus.SYNCING.name))
    }

    @Test
    fun exceedsMaxAttempts_marksFailed() = runTest {
        dao.insert(
            PendingOperationEntity(
                operationType = "attendance_bulk",
                payloadJson = JsonQueuePayloadCodec().encode(
                    QueueOperationType.ATTENDANCE_BULK,
                    AttendanceBulkPayload("2026-01-15", listOf(AttendancePayloadRecord(1, true, null))),
                ),
                createdAt = 1,
                attemptCount = 3,
                status = QueueStatus.PENDING.name,
            ),
        )
        // maxAttempts=3 => this op is already at the cap; must fail without hitting the network.
        val summary = engine.processPendingOps()
        assertEquals(1, summary.permanentlyFailed)
        assertEquals(QueueStatus.FAILED.name, dao.all().first().status)
    }
}