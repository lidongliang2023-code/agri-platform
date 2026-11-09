package com.agri.core.policy;

import com.agri.platform.internal.permission.*;
import com.agri.platform.internal.user.*;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;
import static org.assertj.core.api.Assertions.*;

class PermissionDomainTest {
    private UserPermissionService service(String scope, String code, String status, String permissions) {
        UserRoleMapper bindings = mock(UserRoleMapper.class);
        RoleMapper roles = mock(RoleMapper.class);
        UserRoleEntity binding = new UserRoleEntity();
        binding.setUserId(1L); binding.setRoleId(2L); binding.setMarketId(1L);
        RoleEntity role = new RoleEntity();
        role.setId(2L); role.setScopeType(scope); role.setCode(code);
        role.setStatus(status); role.setPermissions(permissions);
        when(bindings.selectList(any())).thenReturn(List.of(binding));
        when(roles.selectBatchIds(any())).thenReturn(List.of(role));
        return new UserPermissionService(bindings, roles);
    }
    @Test void platformAdminIsIndependentOfLegacyMarket() {
        var s = service("PLATFORM", "SUPER_ADMIN", "enabled", "[\"*\"]");
        assertThat(s.resolve(1L, 99L).has("uc:admin")).isTrue();
        assertThat(s.resolvePlatform(1L).has("uc:admin")).isTrue();
    }
    @Test void disabledRoleNeverGrantsAccess() {
        assertThat(service("PLATFORM", "SUPER_ADMIN", "disabled", "[\"*\"]")
                .resolvePlatform(1L).permissions()).isEmpty();
    }
    @Test void legacyBusinessOperatorCannotEscalateDomains() {
        var s = service("BUSINESS", "MARKET_OPS", "enabled",
                "[\"*\",\"uc:admin\",\"gov:admin\",\"production:write\",\"trade:read\"]");
        assertThat(s.resolve(1L, null).permissions()).containsExactly("trade:read");
        assertThat(s.resolvePlatform(1L).permissions()).isEmpty();
    }
    @Test void regulatorCannotOperatePlatformAccounts() {
        var s = service("REGULATORY", "GOVERNMENT_INSPECTOR", "enabled",
                "[\"gov:inspector\",\"uc:admin\",\"trade:write\",\"*\"]");
        assertThat(s.resolve(1L, 55L).permissions()).containsExactly("gov:inspector");
        assertThat(s.resolvePlatform(1L).permissions()).isEmpty();
    }
    @Test void subjectRoleDoesNotGrantRegulatoryAuthority() {
        var s = service("SUBJECT", "FARMER", "enabled",
                "[\"produce:read\",\"gov:citizen\",\"gov:admin\",\"*\"]");
        assertThat(s.resolve(1L, null).permissions()).containsExactly("produce:read", "gov:citizen");
    }
    @Test void unknownDomainFailsClosed() {
        assertThat(service("UNKNOWN", "CUSTOM", "enabled", "[\"*\"]")
                .resolve(1L, 1L).permissions()).isEmpty();
    }
}
