package app.diredawa.cleaning

import app.diredawa.cleaning.data.api.ApiClient
import app.diredawa.cleaning.data.api.ApiService
import app.diredawa.cleaning.data.model.LoginRequest
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.HttpException

/**
 * Network-layer tests using a local MockWebServer (§36 §9 §12).
 * Verifies the exact-auth-header flow and status-code handling. No real backend.
 */
class ApiServiceTest {

    private lateinit var server: MockWebServer
    private lateinit var api: ApiService

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        api = ApiClient.build(
            baseUrl = server.url("/").toString(),
            tokenProvider = { "SESSION_TOKEN_ABC" },
            enableLogging = false,
        )
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun authTokenIsAttachedAsXSessionTokenAndBearer() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setBody("""{"id":1,"username":"a","fullName":"Admin","role":"admin"}""")
        )
        api.me()
        val recorded = server.takeRequest()
        assertEquals("SESSION_TOKEN_ABC", recorded.getHeader("X-Session-Token"))
        assertEquals("Bearer SESSION_TOKEN_ABC", recorded.getHeader("Authorization"))
        // Token must never be logged: assert header is present but not in any request body.
        assertTrue(recorded.body.size == 0L)
    }

    @Test
    fun loginSuccess_parsesTokenAndUser() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setBody(
                    """{"token":"tok123","user":{"id":2,"username":"collector1","fullName":"Col One","role":"collector","zone":null}}"""
                )
        )
        val resp = api.login(LoginRequest("collector1", "password"))
        assertEquals("tok123", resp.token)
        assertEquals("collector", resp.user.role)
    }

    @Test
    fun loginFailure_401_isHttpException() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(401)
                .setBody("""{"error":"Invalid credentials"}""")
        )
        try {
            api.login(LoginRequest("bad", "wrong"))
            assertTrue("Expected 401", false)
        } catch (e: HttpException) {
            assertEquals(401, e.code())
        }
    }

    @Test
    fun sessionExpiry_returns401() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(401)
                .setBody("""{"error":"Session expired or invalid"}""")
        )
        try {
            api.me()
            assertTrue("Expected 401", false)
        } catch (e: HttpException) {
            assertEquals(401, e.code())
        }
    }

    @Test
    fun forbidden_returns403() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(403)
                .setBody("""{"error":"Requires: admin"}""")
        )
        try {
            api.workers()
            assertTrue("Expected 403", false)
        } catch (e: HttpException) {
            assertEquals(403, e.code())
        }
    }

    @Test
    fun memberApiFields_unknownKeysIgnored() = runTest {
        // Backend additions must not break strict DTO parsing (resilience).
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setBody("""{"id":1,"username":"a","fullName":"A","role":"leader","zone":{"id":7,"name":"Z","kebele_id":1}}""")
        )
        val me = api.me()
        assertEquals(7L, me.zone?.id)
    }
}