package app.diredawa.cleaning.data.api

import app.diredawa.cleaning.data.model.KebeleDto
import app.diredawa.cleaning.data.model.LoginRequest
import app.diredawa.cleaning.data.model.LoginResponse
import app.diredawa.cleaning.data.model.MeResponse
import app.diredawa.cleaning.data.model.NotificationListResponse
import app.diredawa.cleaning.data.model.SaferZoneDto
import app.diredawa.cleaning.data.model.UnreadCountResponse
import app.diredawa.cleaning.data.model.WorkerDto
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.QueryMap

/**
 * Retrofit interface for the existing backend (`/api` base). Consumes the same
 * endpoints as the web app — no invented APIs (§38). Auth is injected by the
 * [AuthInterceptor], so only the public auth endpoints omit the header implicitly.
 */
interface ApiService {

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    @POST("auth/logout")
    suspend fun logout()

    @GET("auth/me")
    suspend fun me(): MeResponse

    @GET("kebeles")
    suspend fun kebeles(): List<KebeleDto>

    @GET("safer-zones")
    suspend fun saferZones(@QueryMap filters: Map<String, String> = emptyMap()): List<SaferZoneDto>

    @GET("workers")
    suspend fun workers(@QueryMap filters: Map<String, String> = emptyMap()): List<WorkerDto>

    @GET("notifications")
    suspend fun notifications(@QueryMap filters: Map<String, String> = emptyMap()): NotificationListResponse

    @GET("notifications/unread-count")
    suspend fun unreadCount(): UnreadCountResponse

    @POST("notifications/{id}/read")
    suspend fun markNotificationRead(@Path("id") id: Long)
}