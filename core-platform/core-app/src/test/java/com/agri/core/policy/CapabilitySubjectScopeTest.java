package com.agri.core.policy;

import com.agri.platform.internal.account.*;
import com.agri.platform.internal.merchant.*;
import com.agri.platform.api.facade.CapabilityCodes;
import com.agri.core.infra.web.MarketContext;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;
import static org.assertj.core.api.Assertions.*;

class CapabilitySubjectScopeTest {
    private CapabilityFacadeImpl service(Long identitySubject, String type, String status, Long... memberships) {
        var identities = mock(IdentityApplicationMapper.class);
        var members = mock(UserMerchantMapper.class);
        var certifications = mock(MerchantCertificationMapper.class);
        var approved = new MerchantCertificationEntity(); approved.setMerchantId(2001L); approved.setCertStatus("approved");
        when(certifications.selectList(any())).thenReturn(List.of(approved));
        var row = new IdentityApplicationEntity();
        row.setUserId(1L); row.setMerchantId(identitySubject); row.setIdentityType(type); row.setStatus(status);
        when(identities.selectList(any())).thenReturn(List.of(row));
        when(members.selectList(any())).thenReturn(java.util.Arrays.stream(memberships).map(id -> {
            var member = new UserMerchantEntity(); member.setUserId(1L); member.setMerchantId(id); member.setStatus(1); return member;
        }).toList());
        return new CapabilityFacadeImpl(identities, members, certifications);
    }
    @Test void approvedFarmerCanUseOwnSubject() {
        assertThat(service(2001L,"farmer","approved",2001L,2002L).check(1L,CapabilityCodes.PRODUCTION_MANAGE,2001L).granted()).isTrue();
    }
    @Test void membershipInTwoSubjectsDoesNotShareIdentity() {
        assertThat(service(2001L,"farmer","approved",2001L,2002L).check(1L,CapabilityCodes.PRODUCTION_MANAGE,2002L).granted()).isFalse();
    }
    @Test void identityWithoutMembershipIsRejected() {
        assertThat(service(2001L,"farmer","approved",2002L).check(1L,CapabilityCodes.PRODUCTION_MANAGE,2001L).granted()).isFalse();
    }
    @Test void pendingIdentityIsRejected() {
        assertThat(service(2001L,"farmer","pending",2001L).check(1L,CapabilityCodes.PRODUCTION_MANAGE,2001L).granted()).isFalse();
    }
    @Test void legacyUnscopedIdentityCannotAuthorizeProduction() {
        assertThat(service(null,"farmer","approved",2001L).check(1L,CapabilityCodes.PRODUCTION_MANAGE,2001L).granted()).isFalse();
    }
    @Test void overviewDoesNotCombineFormerSubjectIdentityAndNewMembership() {
        assertThat(service(2001L,"farmer","approved",2002L).codesOf(1L)).doesNotContain(CapabilityCodes.PRODUCTION_MANAGE);
    }
    @Test void overviewStillShowsValidProductionAbility() {
        assertThat(service(2001L,"farmer","approved",2001L).codesOf(1L)).contains(CapabilityCodes.PRODUCTION_MANAGE);
    }
    @Test void cooperativeIdentityWorksInItsOwnSubject() {
        assertThat(service(2001L,"coop_admin","approved",2001L).check(1L,CapabilityCodes.PRODUCTION_MANAGE,2001L).granted()).isTrue();
    }
    @Test void supplierIdentityCannotCrossSubjects() {
        assertThat(service(2001L,"mall_supplier","approved",2001L,2002L).check(1L,CapabilityCodes.S2B2C_SUPPLIER,2002L).granted()).isFalse();
    }
    @Test void unrelatedIdentityDoesNotGrantProduction() {
        assertThat(service(2001L,"wholesaler","approved",2001L).check(1L,CapabilityCodes.PRODUCTION_MANAGE,2001L).granted()).isFalse();
    }
    @Test void missingSubjectIsRejectedAtInternalWriteBoundary() {
        var facade = mock(com.agri.platform.api.facade.CapabilityFacade.class);
        var controller = new InternalCapabilityController(facade);
        MarketContext.set(new MarketContext.Session(1L,"farmer",1L,List.of()));
        try {
            controller.check("agri-internal-dev",new InternalCapabilityController.CapabilityCheckRequest("production.manage",null));
            verifyNoInteractions(facade);
        } finally { MarketContext.clear(); }
    }
    @Test void multipleSubjectsRequireExplicitSelection() {
        assertThat(service(2001L,"farmer","approved",2001L,2002L)
                .check(1L,CapabilityCodes.PRODUCTION_MANAGE,null).granted()).isFalse();
    }
    private CapabilityFacadeImpl certificationService(String status, Long approvedSubject) {
        var identities = mock(IdentityApplicationMapper.class);
        var members = mock(UserMerchantMapper.class);
        var certifications = mock(MerchantCertificationMapper.class);
        var identity = new IdentityApplicationEntity(); identity.setUserId(1L); identity.setMerchantId(2001L);
        identity.setStatus("approved"); identity.setIdentityType("farmer");
        when(identities.selectList(any())).thenReturn(List.of(identity));
        when(members.selectList(any())).thenReturn(java.util.stream.Stream.of(2001L,2002L).map(id -> {
            var member = new UserMerchantEntity(); member.setUserId(1L); member.setMerchantId(id); member.setStatus(1); return member;
        }).toList());
        var cert = new MerchantCertificationEntity(); cert.setMerchantId(approvedSubject); cert.setCertStatus(status);
        when(certifications.selectList(any())).thenReturn(status == null ? List.of() : List.of(cert));
        return new CapabilityFacadeImpl(identities,members,certifications);
    }
    @Test void pendingCertificationRejectsApprovedFarmer() {
        var result = certificationService("pending",2001L).check(1L,CapabilityCodes.PRODUCTION_MANAGE,2001L);
        assertThat(result.granted()).isFalse(); assertThat(result.reason()).contains("认证尚未通过");
    }
    @Test void unknownRejectedDraftAndMissingCertificationsFailClosed() {
        for (String status : new String[]{"unknown","rejected","draft",null}) {
            assertThat(certificationService(status,2001L).check(1L,CapabilityCodes.PRODUCTION_MANAGE,2001L).granted()).isFalse();
        }
    }
    @Test void certificationAndIdentityCannotBeCombinedAcrossSubjects() {
        assertThat(certificationService("approved",2002L).codesOf(1L)).doesNotContain(CapabilityCodes.PRODUCTION_MANAGE);
    }
    @Test void certificationIsRequiredInOverviewToo() {
        assertThat(certificationService("pending",2001L).codesOf(1L)).doesNotContain(CapabilityCodes.PRODUCTION_MANAGE);
    }
}
