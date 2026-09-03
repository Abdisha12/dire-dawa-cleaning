package app.diredawa.cleaning.domain.usecase

import app.diredawa.cleaning.domain.model.AuthenticatedUser
import app.diredawa.cleaning.domain.model.OperationalScope
import app.diredawa.cleaning.domain.model.Role

/**
 * Derives the [OperationalScope] for an authenticated user for mobile UI purposes.
 * NOTE: This is a UX concern — the backend remains the authority on what data a
 * user may access. UI scoping here can only reflect what `/me` reports; it must
 * never be used to grant access a backend rejects.
 */
class ResolveScopeUseCase {
    operator fun invoke(user: AuthenticatedUser): OperationalScope = when (user.role) {
        Role.ADMIN -> OperationalScope.CityWide(user)
        // Kebele Admin is backend-locked to their assigned kebele. /me does not
        // currently return the kebele for collectors, so the UI must not assume a
        // specific kebele here — it reflects the user context and defers to the
        // backend for actual data scoping.
        Role.COLLECTOR -> OperationalScope.Kebele(user, kebeleFor(user))
        Role.LEADER -> {
            // Leader scoped to their single assigned zone (reported by /me).
            user.zone?.let { OperationalScope.Zone(user, it) } ?: OperationalScope.CityWide(user)
        }
        Role.VIEWER -> OperationalScope.CityWide(user)
        Role.UNKNOWN -> OperationalScope.CityWide(user)
    }

    /**
     * Placeholder for a Collector's kebele. The backend is the authority; until a
     * kebele is resolvable from the session it is left unset (clearly "unknown").
     */
    private fun kebeleFor(user: AuthenticatedUser) =
        if (user.zone?.kebeleName != null) {
            app.diredawa.cleaning.domain.model.Kebele(
                id = user.zone.kebeleId ?: -1L,
                name = user.zone.kebeleName,
                code = user.zone.kebeleCode ?: "",
            )
        } else {
            app.diredawa.cleaning.domain.model.Kebele(id = -1L, name = "Assigned kebele", code = "")
        }
}