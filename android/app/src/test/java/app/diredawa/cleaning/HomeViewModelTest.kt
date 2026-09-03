package app.diredawa.cleaning

import app.diredawa.cleaning.data.api.ApiClient
import app.diredawa.cleaning.data.api.ApiService
import app.diredawa.cleaning.data.repository.AuthRepository
import app.diredawa.cleaning.domain.model.AuthenticatedUser
import app.diredawa.cleaning.domain.model.Role
import app.diredawa.cleaning.ui.components.UiState
import app.diredawa.cleaning.ui.screens.home.HomeViewModel
import app.diredawa.cleaning.domain.usecase.ResolveScopeUseCase
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
 * Home state: content (with scope) / error / empty-null-session (§36 §11, §17-19).
 */
class HomeViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private lateinit var server: MockWebServer
    private lateinit var api: ApiService
    private lateinit var storage: FakeSessionStorage

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
    fun noSession_emitsContentWithNullScope() = runTest(mainDispatcherRule.testDispatcher) {
        val vm = homeVm()
        assertTrue(vm.state.value is UiState.Content)
        val content = vm.state.value as UiState.Content<*>
        val home = content.data as app.diredawa.cleaning.ui.screens.home.HomeState
        assertEquals(null, home.scope)
    }

    @Test
    fun leaderSession_loadsZoneScopedHome() = runTest(mainDispatcherRule.testDispatcher) {
        storage.storedToken = "tok"
        storage.storedUser = AuthenticatedUser(1, "l", "Leader", Role.LEADER, zone = null)
        server.enqueue(MockResponse().setResponseCode(200).setBody(
            """{"id":1,"username":"l","fullName":"Leader","role":"leader","zone":{"id":7,"name":"Zone A","kebele_id":1,"kebele_name":"K01"}}"""
        ))
        val vm = homeVm()
        val s = awaitState(vm.state) { it is UiState.Content }
        assertTrue(s is UiState.Content)
        val scope = (s as UiState.Content<*>).data as app.diredawa.cleaning.ui.screens.home.HomeState
        assertTrue(scope.scope is app.diredawa.cleaning.domain.model.OperationalScope.Zone)
    }

    @Test
    fun sessionExpiredOnMe_invalidatesAndClearsScope() = runTest(mainDispatcherRule.testDispatcher) {
        storage.storedToken = "tok-expired"
        storage.storedUser = AuthenticatedUser(1, "l", "Leader", Role.LEADER, zone = null)
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"Session expired or invalid"}"""))
        val vm = homeVm()
        val s = awaitState(vm.state) { it is UiState.Content }
        assertTrue(s is UiState.Content)
        val scope = (s as UiState.Content<*>).data as app.diredawa.cleaning.ui.screens.home.HomeState
        assertEquals(null, scope.scope)
        assertEquals(null, storage.token())
    }

    @Test
    fun serverError_emitsErrorState() = runTest(mainDispatcherRule.testDispatcher) {
        storage.storedToken = "tok"
        storage.storedUser = AuthenticatedUser(1, "l", "Leader", Role.LEADER, zone = null)
        server.enqueue(MockResponse().setResponseCode(500).setBody("""{"error":"boom"}"""))
        val vm = homeVm()
        assertTrue(awaitState(vm.state) { it is UiState.Error } is UiState.Error)
    }

    private fun homeVm(): HomeViewModel {
        val session = fakeSessionManager(storage)
        return HomeViewModel(
            authRepository = AuthRepository(api, storage, session),
            session = session,
            resolveScope = ResolveScopeUseCase(),
        )
    }
}