package app.diredawa.cleaning

import app.diredawa.cleaning.data.api.ApiClient
import app.diredawa.cleaning.data.api.ApiService
import app.diredawa.cleaning.data.repository.OperationsRepository
import app.diredawa.cleaning.data.api.ApiResult
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Operations data load path: workers + notifications (+ empty lists) (§21, §25, §36 13-15).
 */
class OperationsRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var api: ApiService
    private lateinit var storage: FakeSessionStorage

    private fun repo() = OperationsRepository(api)

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        storage = FakeSessionStorage()
        api = ApiClient.build(server.url("/").toString(), tokenProvider = { storage.token() }, enableLogging = false)
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun workers_emptyList_returnsEmptyContent() = runTest {
        server.enqueue(MockResponse().setResponseCode(200).setBody("[]"))
        val result = repo().workers()
        assertTrue(result is ApiResult.Success)
        assertTrue((result as ApiResult.Success<*>).data is List<*>)
        assertTrue(((result.data as List<*>)).isEmpty())
    }

    @Test
    fun notificationList_parsesRowsAndUnreadFlag() = runTest {
        server.enqueue(MockResponse().setResponseCode(200).setBody(
            """{"rows":[{"id":1,"user_id":2,"type":"overdue_payment","title":"Payment overdue","message":"Biz paid late","is_read":false,"created_at":"2026-01-01"}],"total":1,"page":1,"pages":1}"""
        ))
        val result = repo().notifications()
        assertTrue(result is ApiResult.Success)
        val list = (result as ApiResult.Success<*>).data as List<*>
        assertEquals(1, list.size)
        val n = list[0] as app.diredawa.cleaning.domain.model.AppNotification
        assertEquals("Payment overdue", n.title)
        assertEquals(false, n.isRead)
    }

    @Test
    fun networkDown_returnsNetworkError() = runTest {
        server.enqueue(MockResponse().setSocketPolicy(okhttp3.mockwebserver.SocketPolicy.DISCONNECT_AT_START))
        val result = repo().notifications()
        assertTrue(result is ApiResult.Failure)
        val failure = result as ApiResult.Failure
        assertEquals(app.diredawa.cleaning.data.api.ErrorKind.NETWORK, failure.error.kind)
    }
}