package app.diredawa.cleaning.data.api

import app.diredawa.cleaning.data.model.AttendanceBulkRequest
import app.diredawa.cleaning.data.model.AttendanceRecordDto
import app.diredawa.cleaning.data.model.BusinessDto
import app.diredawa.cleaning.data.model.BusinessListResponse
import app.diredawa.cleaning.data.model.CreateIdResponse
import app.diredawa.cleaning.data.model.GenericMessage
import app.diredawa.cleaning.data.model.InspectionCreateFields
import app.diredawa.cleaning.data.model.InspectionDto
import app.diredawa.cleaning.data.model.InspectionListResponse
import app.diredawa.cleaning.data.model.KebeleDto
import app.diredawa.cleaning.data.model.LoginRequest
import app.diredawa.cleaning.data.model.LoginResponse
import app.diredawa.cleaning.data.model.MeResponse
import app.diredawa.cleaning.data.model.NotificationListResponse
import app.diredawa.cleaning.data.model.SaferZoneDto
import app.diredawa.cleaning.data.model.UnreadCountResponse
import app.diredawa.cleaning.data.model.WorkerDto
import app.diredawa.cleaning.data.model.WorkerStatsDto
import app.diredawa.cleaning.data.model.ZoneReportCreateRequest
import app.diredawa.cleaning.data.model.ZoneReportDto
import app.diredawa.cleaning.data.model.ZoneReportListResponse
import app.diredawa.cleaning.data.model.ZoneReportReviewRequest
import app.diredawa.cleaning.data.model.ZoneReportUpdateRequest
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.QueryMap

/**
 * Retrofit interface for the existing backend (`/api` base). Consumes the same
 * endpoints as the web app — no invented APIs (§2, §15). Auth is injected by the
 * [AuthInterceptor].
 *
 * Phase 11 additions mirror the audited contracts: attendance bulk, inspections
 * (multipart with photos), zone reports (state machine), businesses, workers
 * summary. Notification mark-read is PUT (matches the real backend route).
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

    @GET("notifications")
    suspend fun notifications(@QueryMap filters: Map<String, String> = emptyMap()): NotificationListResponse

    @GET("notifications/unread-count")
    suspend fun unreadCount(): UnreadCountResponse

    @PUT("notifications/{id}/read")
    suspend fun markNotificationRead(@Path("id") id: Long)

    @PUT("notifications/read-all")
    suspend fun markAllNotificationsRead()

    // ── Workers ────────────────────────────────────────────────────────────

    @GET("workers")
    suspend fun workers(@QueryMap filters: Map<String, String> = emptyMap()): List<WorkerDto>

    @GET("workers/summary/stats")
    suspend fun workerStats(@QueryMap filters: Map<String, String> = emptyMap()): List<WorkerStatsDto>

    @GET("workers/{id}/attendance")
    suspend fun workerAttendance(
        @Path("id") id: Long,
        @QueryMap filters: Map<String, String> = emptyMap(),
    ): List<AttendanceRecordDto>

    @POST("workers/attendance/bulk")
    suspend fun saveAttendanceBulk(@Body body: AttendanceBulkRequest): GenericMessage

    // ── Inspections ───────────────────────────────────────────────────────

    @GET("inspections")
    suspend fun inspections(@QueryMap filters: Map<String, String> = emptyMap()): InspectionListResponse

    @Multipart
    @POST("inspections")
    suspend fun createInspection(
        @Part("kebeleId") kebeleId: RequestBody,
        @Part("saferZoneId") saferZoneId: RequestBody,
        @Part("date") date: RequestBody,
        @Part("status") status: RequestBody,
        @Part("notes") notes: RequestBody,
        @Part photos: List<MultipartBody.Part>,
    ): CreateIdResponse

    @Multipart
    @PUT("inspections/{id}")
    suspend fun updateInspection(
        @Path("id") id: Long,
        @Part("status") status: RequestBody,
        @Part("notes") notes: RequestBody,
        @Part photos: List<MultipartBody.Part>,
    ): GenericMessage

    @DELETE("inspections/photo/{photoId}")
    suspend fun deleteInspectionPhoto(@Path("photoId") photoId: Long): GenericMessage

    // ── Zone Reports ──────────────────────────────────────────────────────

    @GET("zone-reports")
    suspend fun zoneReports(@QueryMap filters: Map<String, String> = emptyMap()): ZoneReportListResponse

    @POST("zone-reports")
    suspend fun createZoneReport(@Body body: ZoneReportCreateRequest): CreateIdResponse

    @PUT("zone-reports/{id}")
    suspend fun updateZoneReport(
        @Path("id") id: Long,
        @Body body: ZoneReportUpdateRequest,
    ): GenericMessage

    @PUT("zone-reports/{id}/review")
    suspend fun reviewZoneReport(
        @Path("id") id: Long,
        @Body body: ZoneReportReviewRequest,
    ): GenericMessage

    // ── Businesses ────────────────────────────────────────────────────────

    @GET("businesses")
    suspend fun businesses(@QueryMap filters: Map<String, String> = emptyMap()): BusinessListResponse

    // ── GIS (Phase 12 GeoJSON; backend-scoped, auth via interceptor) ──────

    @GET("gis/kebeles")
    suspend fun gisKebeles(@QueryMap filters: Map<String, String> = emptyMap()): app.diredawa.cleaning.data.model.GisFeatureCollection

    @GET("gis/safer-zones")
    suspend fun gisSaferZones(@QueryMap filters: Map<String, String> = emptyMap()): app.diredawa.cleaning.data.model.GisFeatureCollection

    @GET("gis/businesses")
    suspend fun gisBusinesses(@QueryMap filters: Map<String, String> = emptyMap()): app.diredawa.cleaning.data.model.GisFeatureCollection

    @GET("gis/workers")
    suspend fun gisWorkers(@QueryMap filters: Map<String, String> = emptyMap()): app.diredawa.cleaning.data.model.GisFeatureCollection

    @GET("gis/inspections")
    suspend fun gisInspections(@QueryMap filters: Map<String, String> = emptyMap()): app.diredawa.cleaning.data.model.GisFeatureCollection
}