package com.agri.core.policy;

import com.agri.platform.internal.sso.SmsAuthService;
import com.agri.platform.internal.merchant.*;
import com.agri.platform.internal.user.UserEntity;
import com.agri.platform.internal.user.UserMapper;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

class CertificationRectificationTest {
    private final MerchantMapper merchants = mock(MerchantMapper.class);
    private final MerchantCertificationMapper certifications = mock(MerchantCertificationMapper.class);
    private final ActiveMerchantService active = mock(ActiveMerchantService.class);
    private final UserMapper users = mock(UserMapper.class);
    private final SmsAuthService service = new SmsAuthService(null, users, null, null, merchants,
            null, certifications, active, null, null, "none");

    private MerchantEntity subject(String status) {
        MerchantEntity m = new MerchantEntity();
        m.setId(2001L); m.setName("测试企业"); m.setMemberType("enterprise");
        m.setCreditCode("91350627611515046B"); m.setVerifyStatus(status);
        m.setContactName("测试联系人"); m.setContactPhone("13800000001");
        m.setAddress("测试完整住所"); m.setIndustry("果蔬产业"); m.setCompanySize("小型（20-100人）");
        when(active.resolve(1L, 1L)).thenReturn(2001L);
        when(merchants.lockById(2001L)).thenReturn(m);
        when(merchants.selectById(2001L)).thenReturn(m);
        UserEntity u = new UserEntity(); u.setId(1L); u.setPhone("13800000001");
        when(users.selectById(1L)).thenReturn(u);
        return m;
    }

    @Test void creditCodeChecksChecksumAndForbiddenCharacters() {
        assertThat(CreditCodeValidator.validate("91350627611515046b")).isEqualTo("91350627611515046B");
        for (String code : new String[]{"91350627611515046A", "91350627611515046I", "350627000000004031", "123", ""}) {
            assertThatThrownBy(() -> CreditCodeValidator.validate(code)).isInstanceOf(RuntimeException.class);
        }
    }

    @Test void rejectedApplicationCannotBeActivatedOrOverwritten() {
        subject("rejected");
        MerchantCertificationEntity cert = new MerchantCertificationEntity();
        cert.setId(99L); cert.setCertStatus("rejected"); cert.setReviewRemark("补齐住所");
        when(certifications.selectOne(any())).thenReturn(cert);
        assertThatThrownBy(() -> service.activateCertification(1L, 1L)).hasMessageContaining("补正草稿");
        assertThat(cert.getCertStatus()).isEqualTo("rejected");
        assertThat(cert.getReviewRemark()).isEqualTo("补齐住所");
        verify(certifications, never()).updateById(any(MerchantCertificationEntity.class));
    }

    @Test void pendingSubjectCannotBeEditedEvenWhenNameIsUnchanged() {
        subject("pending");
        SmsAuthService.SubjectProfile profile = new SmsAuthService.SubjectProfile("enterprise", "测试企业",
                "91350627611515046B", "果蔬产业", "小型（20-100人）", "新住所", null, null,
                null, "新联系人", "13800000002", "测试法人", null, null, null, null, null);
        assertThatThrownBy(() -> service.createSubject(1L, 1L, profile)).hasMessageContaining("不能修改认证资料");
        verify(merchants, never()).updateById(any(MerchantEntity.class));
    }

    @Test void statusRestoresProfileAndReviewReason() {
        subject("rejected");
        MerchantCertificationEntity cert = new MerchantCertificationEntity();
        cert.setCompanyName("测试企业"); cert.setCreditCode("91350627611515046B");
        cert.setCertStatus("rejected"); cert.setReviewRemark("补齐住所");
        when(certifications.selectOne(any())).thenReturn(cert);
        var status = service.onboardingStatus(1L, 1L);
        assertThat(status.certificationStatus()).isEqualTo("rejected");
        assertThat(status.reviewRemark()).isEqualTo("补齐住所");
        assertThat(status.subject().contactName()).isEqualTo("测试联系人");
        assertThat(status.subject().contactPhone()).isEqualTo("13800000001");
        assertThat(status.subject().address()).isEqualTo("测试完整住所");
        assertThat(status.subject().industry()).isEqualTo("果蔬产业");
        assertThat(status.subject().companySize()).isEqualTo("小型（20-100人）");
    }

    @Test void pendingApplicationDoesNotInheritOldReviewRemark() {
        MerchantEntity m = subject("pending");
        m.setVerifyRemark("旧申请驳回意见");
        MerchantCertificationEntity cert = new MerchantCertificationEntity();
        cert.setCompanyName(m.getName()); cert.setCreditCode(m.getCreditCode());
        cert.setCertStatus("pending");
        when(certifications.selectOne(any())).thenReturn(cert);
        var status = service.onboardingStatus(1L, 1L);
        assertThat(status.certificationStatus()).isEqualTo("pending");
        assertThat(status.reviewRemark()).isNull();
    }

    @Test void snapshotDoesNotChangeWhenSubjectIsEditedLater() {
        MerchantEntity m = subject("draft");
        MerchantCertificationEntity cert = new MerchantCertificationEntity();
        cert.snapshot(m); m.setAddress("后续住所");
        assertThat(cert.getAddress()).isEqualTo("测试完整住所");
    }

    @Test void missingRegisteredAddressBlocksSubmission() {
        MerchantEntity m = subject("draft"); m.setAddress(null);
        assertThatThrownBy(() -> MerchantCertificationController.requireProfile(m)).hasMessageContaining("注册地址");
    }
}
