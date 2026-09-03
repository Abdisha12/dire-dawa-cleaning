package app.diredawa.cleaning

import app.diredawa.cleaning.domain.model.AuthenticatedUser
import app.diredawa.cleaning.domain.model.OperationalScope
import app.diredawa.cleaning.domain.model.Role
import app.diredawa.cleaning.domain.model.Zone
import app.diredawa.cleaning.domain.usecase.ResolveScopeUseCase
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Role mapping + scope resolution tests (§6, §36-37, §19).
 * Verifies backend role string `collector` → display "Kebele Admin", and that
 * Kebele Admin / Leader scope is resolved from what the backend reports.
 * NOTE: security lives in the backend; these assert UI-scope derivation only.
 */
class RoleScopeTest {

    private val resolver = ResolveScopeUseCase()

    private fun user(role: Role, zone: Zone? = null) =
        AuthenticatedUser(id = 1, username = "u", fullName = "User", role = role, zone = zone)

    @Test
    fun collectorApiValueMapsToKebeleAdminDisplay() {
        assertEquals("collector", Role.COLLECTOR.apiValue)
        assertEquals("Kebele Admin", Role.COLLECTOR.displayName)
    }

    @Test
    fun roleFromApi_mapsKnownValues() {
        assertEquals(Role.ADMIN, Role.fromApi("admin"))
        assertEquals(Role.COLLECTOR, Role.fromApi("collector"))
        assertEquals(Role.LEADER, Role.fromApi("leader"))
        assertEquals(Role.VIEWER, Role.fromApi("viewer"))
        assertEquals(Role.UNKNOWN, Role.fromApi("whatever"))
        assertEquals(Role.UNKNOWN, Role.fromApi(null))
    }

    @Test
    fun mutableRoles_canMutate() {
        assertTrue(Role.ADMIN.isMutable)
        assertTrue(Role.COLLECTOR.isMutable)
        assertTrue(Role.LEADER.isMutable)
        assertTrue("Viewer cannot mutate", !Role.VIEWER.isMutable)
    }

    @Test
    fun adminScopeIsCityWide() {
        val scope = resolver(user(Role.ADMIN))
        assertTrue(scope is OperationalScope.CityWide)
    }

    @Test
    fun collectorScope_isKebeleOriented() {
        val scope = resolver(user(Role.COLLECTOR))
        assertTrue(scope is OperationalScope.Kebele)
    }

    @Test
    fun leaderScope_isTheirZone() {
        val zone = Zone(id = 7, name = "Zone B - Residential", kebeleId = 1, kebeleName = "K01", kebeleCode = "K01")
        val scope = resolver(user(Role.LEADER, zone))
        assertTrue(scope is OperationalScope.Zone)
        val zoneScope = scope as OperationalScope.Zone
        assertEquals(7L, zoneScope.zone.id)
        assertEquals("Zone B - Residential", zoneScope.zone.name)
    }

    @Test
    fun leaderWithoutZone_fallsBackToCityWide() {
        val scope = resolver(user(Role.LEADER, null))
        assertTrue(scope is OperationalScope.CityWide)
    }

    @Test
    fun viewerScopeIsCityWideReadOnly() {
        val scope = resolver(user(Role.VIEWER))
        assertTrue(scope is OperationalScope.CityWide)
        assertTrue(Role.VIEWER.isReadOnly)
    }

    @Test
    fun leaderCannotChangeZone_scopeReflectsReportedZoneOnly() {
        // The resolvable scope is derived from /me.zone (backend-authoritative).
        val zone = Zone(id = 1, name = "Zone A")
        val scope = resolver(user(Role.LEADER, zone)) as OperationalScope.Zone
        assertEquals(1L, scope.zone.id)
    }
}