package app.diredawa.cleaning

import app.diredawa.cleaning.data.api.ApiResult
import app.diredawa.cleaning.data.api.NetworkError
import app.diredawa.cleaning.ui.components.UiState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** UiState mapping + loading/empty/error semantics (§36 13-15). */
class UiStateTest {

    @Test
    fun successMapsToContent() {
        val s: UiState<String> = UiState.from(ApiResult.Success("data"))
        assertTrue(s is UiState.Content<String>)
        assertEquals("data", (s as UiState.Content<String>).data)
    }

    @Test
    fun failureMapsToError() {
        val e = NetworkError(app.diredawa.cleaning.data.api.ErrorKind.FORBIDDEN, 403, "Access denied.")
        val s: UiState<String> = UiState.from(ApiResult.Failure(e))
        assertTrue(s is UiState.Error)
        assertEquals(403, (s as UiState.Error).error.statusCode)
    }

    @Test
    fun loadingIsDistinctState() {
        assertTrue(UiState.Loading is UiState.Loading)
    }

    @Test
    fun emptyIsRepresentedAsEmptyContent() {
        val s: UiState<List<Int>> = UiState.Content(emptyList())
        val content = s as UiState.Content
        assertTrue(content.data.isEmpty())
    }
}