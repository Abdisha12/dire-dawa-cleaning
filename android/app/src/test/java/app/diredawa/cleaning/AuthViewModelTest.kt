package app.diredawa.cleaning

import app.diredawa.cleaning.data.api.ApiClient
import app.diredawa.cleaning.data.api.ApiService
import app.diredawa.cleaning.data.repository.AuthRepository
import app.diredawa.cleaning.ui.screens.auth.AuthUiState
import app.diredawa.cleaning.ui.screens.auth.AuthViewModel
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/**
 * AuthViewModel states: loading → success / error (§36 §9-13).
 */
class AuthViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private lateinit var server: MockWebServer
    private lateinit var api: ApiService
    private lateinit var storage: FakeSessionStorage

    private fun vm(): AuthViewModel {
        val session = fakeSessionManager(storage)
        return AuthViewModel(
            authRepository = AuthRepository(api, storage, session),
            session = session,
        )
    }

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
    fun loginSuccess_emitsSuccessAndPersists() = runTest(mainDispatcherRule.testDispatcher) {
        server.enqueue(MockResponse().setResponseCode(200).setBody(
            """{"token":"t","user":{"id":1,"username":"a","fullName":"A","role":"admin"}}"""
        ))
        val vm = vm()
        vm.login("a", "password")
        val s = awaitState(vm.state) { it is AuthUiState.Success }
        assertTrue(s is AuthUiState.Success)
        assertEquals("t", storage.token())
    }

    @Test
    fun blankInput_emitsErrorWithoutNetwork() = runTest(mainDispatcherRule.testDispatcher) {
        val vm = vm()
        vm.login("", "")
        assertTrue(vm.state.value is AuthUiState.Error)
        assertEquals(0, server.requestCount) // no network call made
    }

    @Test
    fun loginFailure_emitsErrorWithUserSafeMessage() = runTest(mainDispatcherRule.testDispatcher) {
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"Invalid credentials"}"""))
        val vm = vm()
        vm.login("bad", "wrong")
        val s = awaitState(vm.state) { it is AuthUiState.Error }
        assertTrue(s is AuthUiState.Error)
        assertEquals("Session expired — please sign in again.", (s as AuthUiState.Error).message)
    }
}