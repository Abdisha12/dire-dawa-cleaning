package app.diredawa.cleaning

import app.diredawa.cleaning.data.api.ApiResult
import app.diredawa.cleaning.data.repository.AuthRepository
import app.diredawa.cleaning.data.api.ApiClient
import app.diredawa.cleaning.data.api.ApiService
import app.diredawa.cleaning.domain.model.AuthenticatedUser
import app.diredawa.cleaning.domain.model.Role
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * AuthRepository behaviour against a mock backend (§8, §36 §9-10).
 * Verifies login success/failure, session persistence, logout, /me and 401 expiry.
 */
class AuthRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var api: ApiService
    private lateinit var storage: FakeSessionStorage

    private fun repo(): AuthRepository =
        AuthRepository(api, storage, fakeSessionManager(storage))

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        api = ApiClient.build(server.url("/").toString(), tokenProvider = { storage.token() }, enableLogging = false)
        storage = FakeSessionStorage()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun loginSuccess_persistsTokenAndUser() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """{"token":"tok1","user":{"id":2,"username":"collector1","fullName":"Col","role":"collector"}}"""
            )
        )
        val result = repo().login("collector1", "password")
        assertTrue(result is ApiResult.Success)
        assertEquals("tok1", storage.token())
        val user = (result as ApiResult.Success<*>).data
        assertTrue(user is app.diredawa.cleaning.domain.model.AuthenticatedUser)
    }

    @Test
    fun loginFailure_doesNotPersist() = runTest {
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"Invalid credentials"}"""))
        val result = repo().login("bad", "wrong")
        assertTrue(result is ApiResult.Failure)
        assertNull(storage.token())
    }

    @Test
    fun me_withNoSession_returnsUnauthorized() = runTest {
        val result = repo().me()
        assertTrue(result is ApiResult.Failure)
        val failure = result as ApiResult.Failure
        assertTrue(failure.error.sessionExpired)
    }

    @Test
    fun me_withValidSession_returnsUser() = runTest {
        storage.storedToken = "tok"
        storage.storedUser = AuthenticatedUser(1, "a", "A", Role.LEADER)
        server.enqueue(MockResponse().setResponseCode(200).setBody("""{"id":1,"username":"a","fullName":"A","role":"leader","zone":{"id":7,"name":"Z","kebele_id":1}}"""))
        val result = repo().me()
        assertTrue(result is ApiResult.Success)
    }

    @Test
    fun logout_invalidatesLocalSession() = runTest {
        storage.storedToken = "tok"
        storage.storedUser = AuthenticatedUser(1, "a", "A", Role.LEADER)
        server.enqueue(MockResponse().setResponseCode(200).setBody("""{"message":"Logged out"}"""))
        repo().logout()
        assertNull(storage.token())
    }
}