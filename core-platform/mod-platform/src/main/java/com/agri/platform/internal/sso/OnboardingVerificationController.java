package com.agri.platform.internal.sso;

import com.agri.platform.internal.identity.IdNumberUtil;
import com.agri.platform.internal.identity.UserIdentityEntity;
import com.agri.platform.internal.identity.UserIdentityMapper;
import com.agri.platform.internal.merchant.ActiveMerchantService;
import com.agri.platform.internal.merchant.MerchantCertificationEntity;
import com.agri.platform.internal.merchant.MerchantCertificationFileService;
import com.agri.platform.internal.merchant.MerchantCertificationMapper;
import com.agri.platform.internal.merchant.MerchantEntity;
import com.agri.platform.internal.merchant.MerchantMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Set;

/**
 * 分步注册的认证开通证据入口。
 *
 * <p>个人必须完成公安二要素和活体检测；企业必须提供营业执照、法人扫脸和对公打款凭证。
 * 本次不伪造第三方核验：本地 dev 配置允许模拟通道，生产环境 provider=none 时接口明确拒绝，
 * 接入合规服务商后再替换为真实核验。</p>
 */
@RestController
@RequestMapping("/api/v1/sso/onboarding/verification")
@RequiredArgsConstructor
public class OnboardingVerificationController {

    private static final Set<String> SANDBOX_MODES = Set.of("dev", "sandbox");

    private final SsoSessionService sessionService;
    private final SmsAuthService smsAuthService;
    private final ActiveMerchantService activeMerchantService;
    private final MerchantMapper merchantMapper;
    private final MerchantCertificationMapper certificationMapper;
    private final MerchantCertificationFileService certificationFileService;
    private final UserIdentityMapper identityMapper;

    @Value("${agri.auth.identity.verification-mode:none}")
    private String verificationMode;

    /** 公安二要素：姓名与身份证号必须与主体步骤保存的实名信息一致。 */
    @PostMapping("/personal/police")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<SmsAuthService.OnboardingStatus> verifyPolice(
            @RequestBody PoliceRequest body, HttpServletRequest request) {
        assertSandboxOrConfigured();
        long[] session = requireSession(request);
        requireMemberType(session, "personal");
        UserIdentityEntity identity = requireEditableIdentity(session[0]);
        if (body == null || body.realName() == null || body.realName().isBlank()
                || body.idCard() == null || body.idCard().isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请填写姓名和身份证号");
        }
        String normalizedId = IdNumberUtil.validate(body.idCard());
        String expectedHash = IdNumberUtil.hash(normalizedId, identity.getIdNoSalt());
        if (!body.realName().trim().equals(identity.getRealName())
                || !expectedHash.equals(identity.getIdNoHash())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "姓名或身份证号与已登记主体信息不一致");
        }
        LocalDateTime now = LocalDateTime.now();
        identity.setPoliceVerified(true);
        identity.setPoliceVerifiedAt(now);
        identity.setVerificationChannel("公安二要素 + 活体");
        identity.setUpdatedAt(now);
        identityMapper.updateById(identity);
        return ApiResponse.ok(smsAuthService.onboardingStatus(session[0], session[1]));
    }

    /** 人脸活体检测。开发态只记录通过结果，不保存人脸照片。 */
    @PostMapping("/personal/liveness")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<SmsAuthService.OnboardingStatus> verifyLiveness(HttpServletRequest request) {
        assertSandboxOrConfigured();
        long[] session = requireSession(request);
        requireMemberType(session, "personal");
        UserIdentityEntity identity = requireEditableIdentity(session[0]);
        LocalDateTime now = LocalDateTime.now();
        identity.setLivenessVerified(true);
        identity.setLivenessVerifiedAt(now);
        identity.setVerificationChannel("公安二要素 + 活体");
        identity.setUpdatedAt(now);
        identityMapper.updateById(identity);
        return ApiResponse.ok(smsAuthService.onboardingStatus(session[0], session[1]));
    }

    /** 企业认证：保存执照、法人扫脸和对公打款材料，资料齐全后才允许提交审核。 */
    @PostMapping("/enterprise/prepare")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<SmsAuthService.OnboardingStatus> prepareEnterprise(
            @RequestBody EnterpriseEvidence body, HttpServletRequest request) {
        assertSandboxOrConfigured();
        long[] session = requireSession(request);
        MerchantEntity merchant = requireMemberType(session, "enterprise");
        MerchantCertificationEntity cert = latestCertification(merchant.getId());
        if (cert == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "企业认证草稿不存在，请返回主体步骤重新保存");
        }
        if (!"draft".equals(cert.getCertStatus())) {
            throw new BusinessException(ErrorCode.CONFLICT, "仅可修改新草稿，请先返回主体步骤保存补正资料");
        }
        if (body == null || isBlank(body.legalPerson())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请填写法定代表人姓名");
        }
        if (isBlank(body.corporateBankName())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请填写对公账户户名");
        }
        if (isBlank(body.corporateBankAccount()) || !body.corporateBankAccount().matches("[0-9 ]{8,32}")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请填写有效的对公账户账号");
        }
        String amount = trim(body.corporateTransferAmount());
        if (amount == null || !amount.matches("\\d{1,3}(\\.\\d{1,2})?")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "对公打款金额格式不正确");
        }
        BigDecimal numericAmount = new BigDecimal(amount);
        if (numericAmount.signum() <= 0 || numericAmount.compareTo(new BigDecimal("100")) > 0) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "对公打款验证金额应大于 0 且不超过 100 元");
        }
        String reference = trim(body.corporateTransferReference());
        if (reference == null || reference.length() < 6 || reference.length() > 64) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "对公打款流水号应为 6-64 位");
        }

        String licenseUrl = certificationFileService.requireOwnedUrl(merchant.getId(),
                MerchantCertificationFileService.BUSINESS_LICENSE, body.businessLicenseUrl());
        String faceUrl = certificationFileService.requireOwnedUrl(merchant.getId(),
                MerchantCertificationFileService.LEGAL_PERSON_FACE, body.legalPersonFaceUrl());
        String transferProofUrl = certificationFileService.requireOwnedUrl(merchant.getId(),
                MerchantCertificationFileService.CORPORATE_TRANSFER_PROOF, body.corporateTransferProofUrl());
        LocalDateTime now = LocalDateTime.now();
        cert.setLegalPerson(body.legalPerson().trim());
        cert.setRegisteredCapital(trim(body.registeredCapital()));
        cert.setBusinessLicenseUrl(licenseUrl);
        cert.setLegalPersonFaceUrl(faceUrl);
        cert.setLegalPersonFaceStatus("verified");
        cert.setLegalPersonFaceAt(now);
        cert.setCorporateBankName(body.corporateBankName().trim());
        cert.setCorporateBankAccount(maskBankAccount(body.corporateBankAccount()));
        cert.setCorporateTransferAmount(numericAmount.toPlainString());
        cert.setCorporateTransferReference(reference);
        cert.setCorporateTransferProofUrl(transferProofUrl);
        cert.setCorporateTransferStatus("submitted");
        cert.setCorporateTransferAt(now);
        cert.setVerificationChannel("法人扫脸 + 对公打款");
        certificationMapper.updateById(cert);
        return ApiResponse.ok(smsAuthService.onboardingStatus(session[0], session[1]));
    }

    private void assertSandboxOrConfigured() {
        String mode = verificationMode == null ? "none" : verificationMode.trim().toLowerCase(Locale.ROOT);
        if (!SANDBOX_MODES.contains(mode)) {
            throw new BusinessException(ErrorCode.BIZ_ERROR,
                    "实名核验服务尚未配置：请接入公安二要素/活体及工商核验服务后再完成认证");
        }
    }

    private long[] requireSession(HttpServletRequest request) {
        long[] session = sessionService.resolve(request);
        if (session == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "登录会话已失效，请重新登录");
        }
        return session;
    }

    private MerchantEntity requireMemberType(long[] session, String expected) {
        Long merchantId = activeMerchantService.resolve(session[0], session[1]);
        if (merchantId == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请先创建经营主体");
        }
        MerchantEntity merchant = merchantMapper.lockById(merchantId);
        if (merchant == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "经营主体不存在");
        }
        if (!expected.equalsIgnoreCase(merchant.getMemberType())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "个人".equals(expected) ? "当前主体不是个人主体" : "当前主体不是企业主体");
        }
        return merchant;
    }

    private UserIdentityEntity requireEditableIdentity(Long userId) {
        UserIdentityEntity identity = latestIdentity(userId);
        if (identity == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "实名资料不存在，请返回主体步骤重新保存");
        }
        if (!"draft".equals(identity.getStatus())) {
            throw new BusinessException(ErrorCode.CONFLICT, "实名认证已提交或已通过，不能重复修改");
        }
        return identity;
    }

    private UserIdentityEntity latestIdentity(Long userId) {
        return identityMapper.selectOne(new LambdaQueryWrapper<UserIdentityEntity>()
                .eq(UserIdentityEntity::getUserId, userId)
                .orderByDesc(UserIdentityEntity::getId)
                .last("LIMIT 1 FOR UPDATE"));
    }

    private MerchantCertificationEntity latestCertification(Long merchantId) {
        return certificationMapper.selectOne(new LambdaQueryWrapper<MerchantCertificationEntity>()
                .eq(MerchantCertificationEntity::getMerchantId, merchantId)
                .orderByDesc(MerchantCertificationEntity::getId)
                .last("LIMIT 1 FOR UPDATE"));
    }

    private static String maskBankAccount(String value) {
        String normalized = value.replace(" ", "");
        if (normalized.length() <= 8) {
            return "****" + normalized.substring(Math.max(0, normalized.length() - 4));
        }
        return normalized.substring(0, 4) + " **** **** "
                + normalized.substring(normalized.length() - 4);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String trim(String value) {
        return isBlank(value) ? null : value.trim();
    }

    public record PoliceRequest(String realName, String idCard) {
    }

    public record EnterpriseEvidence(
            String legalPerson,
            String registeredCapital,
            String businessLicenseUrl,
            String legalPersonFaceUrl,
            String corporateBankName,
            String corporateBankAccount,
            String corporateTransferAmount,
            String corporateTransferReference,
            String corporateTransferProofUrl) {
    }
}
