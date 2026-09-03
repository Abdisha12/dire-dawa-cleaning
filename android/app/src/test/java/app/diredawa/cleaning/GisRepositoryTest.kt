package app.diredawa.cleaning

import app.diredawa.cleaning.data.api.ApiClient
import app.diredawa.cleaning.data.api.ApiResult
import app.diredawa.cleaning.data.repository.GisRepository
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Phase 12 Android GIS tests (§58): layer parsing is honest about geometry —
 * null geometry is flagged "location unavailable", never fabricated.
 */
class GisRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var repo: GisRepository

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        val api = ApiClient.build(server.url("/").toString(), tokenProvider = { "tok" }, enableLogging = false)
        repo = GisRepository(api)
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun kebeles_mixedGeometry_parsesHonestCounts() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """{"type":"FeatureCollection","features":[
                  {"type":"Feature","id":1,"geometry":{"type":"MultiPolygon","coordinates":[]},
                   "properties":{"id":1,"code":"K01","name":"Kebele 01","entityType":"Kebele"}},
                  {"type":"Feature","id":2,"geometry":null,
                   "properties":{"id":2,"code":"K02","name":"Kebele 02","entityType":"Kebele","locationUnavailable":true}}
                ]}""",
            ),
        )
        val result = repo.kebeles()
        assertTrue(result is ApiResult.Success)
        val layer = (result as ApiResult.Success).data
        assertEquals(2, layer.total)
        assertEquals(1, layer.withGeometry)
        assertEquals(1, layer.withoutGeometry)
        assertTrue(layer.items.any { it.locationUnavailable && it.label == "Kebele 02" })
    }

    @Test
    fun workers_emptyFeatures_returnsEmptyLayer() = runTest {
        server.enqueue(MockResponse().setResponseCode(200).setBody("""{"type":"FeatureCollection","features":[]}"""))
        val result = repo.workers()
        assertTrue(result is ApiResult.Success)
        assertEquals(0, (result as ApiResult.Success).data.total)
    }

    @Test
    fun forbidden_surfacesFailure() = runTest {
        server.enqueue(MockResponse().setResponseCode(403).setBody("""{"error":"forbidden"}"""))
        val result = repo.businesses()
        assertTrue(result is ApiResult.Failure)
    }
}
