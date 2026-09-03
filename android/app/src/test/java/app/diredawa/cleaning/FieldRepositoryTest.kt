package app.diredawa.cleaning

import app.diredawa.cleaning.data.api.ApiClient
import app.diredawa.cleaning.data.api.ApiResult
import app.diredawa.cleaning.data.offline.JsonQueuePayloadCodec
import app.diredawa.cleaning.data.offline.QueueOperationType
import app.diredawa.cleaning.data.offline.QueueStatus
import app.diredawa.cleaning.data.offline.RoomSyncQueue
import app.diredawa.cleaning.data.repository.FieldRepository
import app.diredawa.cleaning.data.repository.FieldSubmitResult
import app.diredawa.cleaning.domain.model.AttendanceRecord
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * FieldRepository phase-11 tests (§9–§30). Verifies offline-queue truthfulness:
 * queued is never reported as confirmed, transport failures queue, and
 * online-only transitions (zone report updates) are never queued offline and are
 * surfaced as failures instead.
 */
class FieldRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var dao: FakePendingOperationDao
    private lateinit var queue: RoomSyncQueue
    private lateinit var repo: FieldRepository

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        dao = FakePendingOperationDao()
        queue = RoomSyncQueue(dao, JsonQueuePayloadCodec())
        val api = ApiClient.build(server.url("/").toString(), tokenProvider = { "tok" }, enableLogging = false)
        repo = FieldRepository(api = api, queue = queue)
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun attendance_success_isServerConfirmed_notQueued() = runTest {
        server.enqueue(MockResponse().setResponseCode(200).setBody("""{"message":"saved"}"""))
        val result = repo.saveAttendanceBulk(
            "2026-01-15",
            listOf(AttendanceRecord(workerId = 1, date = "2026-01-15", present = true)),
        )
        assertEquals(FieldSubmitResult.ServerConfirmed, result)
        assertEquals(0, queue.all().size)
    }

    @Test
    fun attendance_transportFailure_isQueued_notConfirmed() = runTest {
        // Network unreachable: simulate by shutting down the server before the call.
        server.shutdown()
        val result = repo.saveAttendanceBulk(
            "2026-01-15",
            listOf(AttendanceRecord(workerId = 1, date = "2026-01-15", present = false)),
        )
        assertTrue(result is FieldSubmitResult.Queued)
        // It must never be reported as ServerConfirmed (§14, §33).
        val pending = queue.drainable()
        assertEquals(1, pending.size)
        assertEquals(QueueOperationType.ATTENDANCE_BULK, pending.first().operationType)
    }

    @Test
    fun attendance_validationError_isFailed_notQueued() = runTest {
        server.enqueue(MockResponse().setResponseCode(400).setBody("""{"error":"invalid date"}"""))
        val result = repo.saveAttendanceBulk(
            "2026-13-99",
            listOf(AttendanceRecord(workerId = 1, date = "2026-13-99", present = true)),
        )
        assertTrue(result is FieldSubmitResult.Failed)
        // A validation rejection is never queued (§36, §41).
        assertEquals(0, queue.all().size)
    }

    @Test
    fun zoneReportUpdate_isOnlineOnly_andNotQueuedOffline() = runTest {
        // Simulate offline: server unreachable.
        server.shutdown()
        val result = repo.updateZoneReport(
            reportId = 5,
            fields = app.diredawa.cleaning.data.repository.ZoneReportUpdateFields(status = "submitted"),
        )
        // Transition is online-only; must fail and NOT be queued for later sync (§29/§40/§69).
        assertTrue(result is ApiResult.Failure)
        assertEquals(0, queue.all().size)
    }

    @Test
    fun zoneReportDraftCreate_isQueueableOffline() = runTest {
        server.shutdown()
        val result = repo.createZoneReport(
            app.diredawa.cleaning.data.model.ZoneReportCreateRequest(
                saferZoneId = 3,
                reportDate = "2026-01-15",
                reportMonth = 1,
                reportYear = 2026,
            ),
        )
        assertTrue(result is FieldSubmitResult.Queued)
        // Draft create may be queued; the transition itself still requires online sync.
        val pending = queue.drainable()
        assertEquals(1, pending.size)
        assertEquals(QueueOperationType.ZONE_REPORT_CREATE, pending.first().operationType)
    }
}