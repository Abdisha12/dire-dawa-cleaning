package app.diredawa.cleaning.data.repository

import app.diredawa.cleaning.data.api.ApiResult
import app.diredawa.cleaning.data.api.ApiService
import app.diredawa.cleaning.data.api.ErrorMapper
import app.diredawa.cleaning.data.api.NetworkError
import app.diredawa.cleaning.data.auth.SessionStorage
import app.diredawa.cleaning.data.auth.SessionManager
import app.diredawa.cleaning.data.model.LoginRequest
import app.diredawa.cleaning.domain.model.AuthenticatedUser
import app.diredawa.cleaning.domain.model.Role
import app.diredawa.cleaning.domain.model.Zone
import retrofit2.HttpException

/**
 * Single source of auth operations. Delegates to the existing backend
 * `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` endpoints (§8).
 * No parallel authentication system — the backend remains authoritative.
 */
class AuthRepository(
    private val api: ApiService,
    private val tokenStore: SessionStorage,
    private val session: SessionManager,
) {

    suspend fun login(username: String, password: String): ApiResult<AuthenticatedUser> {
        val response = try {
            api.login(LoginRequest(username = username, password = password))
        } catch (e: Exception) {
            return ApiResult.Failure(ErrorMapper.map(e))
        }

        val user = AuthenticatedUser(
            id = response.user.id,
            username = response.user.username,
            fullName = response.user.full_name ?: response.user.fullName ?: response.user.username,
            role = Role.fromApi(response.user.role),
            phone = response.user.phone,
            zone = response.user.zone?.let {
                Zone(
                    id = it.id,
                    name = it.name,
                    kebeleId = it.kebele_id,
                    kebeleName = it.kebele_name,
                    kebeleCode = it.kebele_code,
                )
            },
        )

        session.persistSession(response.token, user)
        return ApiResult.Success(user)
    }

    suspend fun logout() {
        try {
            api.logout()
        } catch (e: Exception) {
            // Best-effort: invalidate local session regardless of network state.
        } finally {
            session.invalidate()
        }
    }

    suspend fun me(): ApiResult<AuthenticatedUser> {
        if (!session.isAuthenticated.value) {
            return ApiResult.Failure(NetworkError.unauthorized())
        }
        return try {
            val me = api.me()
            val user = AuthenticatedUser(
                id = me.id,
                username = me.username,
                fullName = me.fullName.takeIf { it.isNotBlank() } ?: me.full_name ?: me.username,
                role = Role.fromApi(me.role),
                phone = me.phone,
                zone = me.zone?.let {
                    Zone(
                        id = it.id,
                        name = it.name,
                        kebeleId = it.kebele_id,
                        kebeleName = it.kebele_name,
                        kebeleCode = it.kebele_code,
                    )
                },
            )
            session.updateUserFromMe(
                id = me.id,
                username = me.username,
                fullName = user.fullName,
                role = me.role,
                phone = me.phone,
                zone = user.zone,
            )
            ApiResult.Success(user)
        } catch (e: Exception) {
            if (e is HttpException && e.code() == 401) session.invalidate()
            ApiResult.Failure(ErrorMapper.map(e))
        }
    }
}