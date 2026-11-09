package com.agri.platform.internal.sso;

import com.agri.platform.internal.permission.RoleEntity;
import com.agri.platform.internal.permission.RoleMapper;
import com.agri.platform.internal.identity.IdNumberUtil;
import com.agri.platform.internal.identity.UserIdentityEntity;
import com.agri.platform.internal.identity.UserIdentityMapper;
import com.agri.platform.internal.merchant.MerchantCertificationEntity;
import com.agri.platform.internal.merchant.MerchantCertificationMapper;
import com.agri.platform.internal.merchant.ActiveMerchantService;
import com.agri.platform.internal.merchant.MerchantEntity;
import com.agri.platform.internal.merchant.MerchantMapper;
import com.agri.platform.internal.merchant.UserMerchantEntity;
import com.agri.platform.internal.merchant.UserMerchantMapper;
import com.agri.platform.internal.user.UserEntity;
import com.agri.platform.internal.user.UserMapper;
import com.agri.platform.internal.user.UserRoleEntity;
import com.agri.platform.internal.user.UserRoleMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 手机验证码登录 / 手机号验证码注册（2026-10-16）。

 *
 * <p><b>短信通道当前没有接入真实服务商</b>（需要 AccessKey / Secret / 签名 / 模板），所以按模式分流：</p>

 *
 * <ul>
 *   <li>{@code agri.auth.sms.mode=dev}（**只在 application-dev.yml 打开**）：验证码**写后端日志**，
 *       <b>不回响应体、不以明文落库</b> —— 联调时从日志取；这样页面流程与生产完全一致，
 *       不会有"验证码被前端拿到"的口子。</li>
 *   <li>{@code mode=none}（默认，生产形态）：发送直接拒绝并说明原因，不放"看起来发了、其实没发"的假象。</li>
 * </ul>

 *
 * <p>验证码存 Redis：TTL 5 分钟、同一手机号 60 秒内不重发、最多校验 5 次（错满即作废）。</p>

 *
 * <p><b>注册会一次建齐账号、平台角色、经营主体与 owner 绑定</b>：企业会员同时生成待审核的
 * 主体认证申请；个人会员必须提供身份证号，并生成服务端只保存掩码与加盐摘要的待审核实名记录。</p>
 */
@Slf4j
@Service
public class SmsAuthService {

    private static final String CODE_KEY = "agri:sms:code:";
    private static final String ATTEMPT_KEY = "agri:sms:attempt:";
    private static final String COOLDOWN_KEY = "agri:sms:cooldown:";
    /**
     * 日发上限计数：{@code agri:sms:daily:<场景>:<手机号>:<yyyyMMdd>}。
     * 运营端早就有 {@code captcha.sms.daily.limit} 这条配置（出厂值 10），但服务里从没读过 ——
     * "配置页能改、改了没东西执行"比没配置更糟，所以这里把它真正接上。
     */
    private static final String DAILY_KEY = "agri:sms:daily:";
    /** 验证码有效期兜底值；实际以 platform_uc_system_config 的 captcha.sms.ttl 为准 */
    private static final Duration CODE_TTL_FALLBACK = Duration.ofMinutes(5);
    private static final Duration COOLDOWN = Duration.ofSeconds(60);
    private static final int MAX_ATTEMPTS = 5;
    /**
     * 允许在**公开**端点（未登录）发码的场景。
     *
     * <p>换绑手机（change_phone）不在其中：它是登录态内的账号变更，
     * 走 {@code /api/v1/sso/account/phone/code}。留在公开端点上等于任何人都能
     * 对任意手机号发码（骚扰 + 把别人刚要用的码占掉），而公开发码又无法核对是谁发起的。</p>
     */
    private static final List<String> PUBLIC_SCENES = List.of("login", "register", "reset_password");

    private final StringRedisTemplate redis;
    private final UserMapper userMapper;
    private final UserRoleMapper userRoleMapper;
    private final RoleMapper roleMapper;
    private final MerchantMapper merchantMapper;
    private final UserMerchantMapper userMerchantMapper;
    private final MerchantCertificationMapper certificationMapper;
    private final ActiveMerchantService activeMerchantService;
    private final UserIdentityMapper userIdentityMapper;
    /** 账号侧策略（注册开关 / 密码复杂度 / 验证码时长 / 默认身份） */
    private final com.agri.platform.internal.uc.AccountPolicyService policy;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    /** 短信通道模式：none（默认，未配置服务商）/ dev（验证码写日志，仅联调用） */
    private final String mode;

    public SmsAuthService(StringRedisTemplate redis, UserMapper userMapper, UserRoleMapper userRoleMapper,
                          RoleMapper roleMapper, MerchantMapper merchantMapper, UserMerchantMapper userMerchantMapper,
                          MerchantCertificationMapper certificationMapper,
                          ActiveMerchantService activeMerchantService,
                          UserIdentityMapper userIdentityMapper,
                          com.agri.platform.internal.uc.AccountPolicyService policy,
                          @Value("${agri.auth.sms.mode:none}") String mode) {
        this.redis = redis;
        this.userMapper = userMapper;
        this.userRoleMapper = userRoleMapper;
        this.roleMapper = roleMapper;
        this.merchantMapper = merchantMapper;
        this.userMerchantMapper = userMerchantMapper;
        this.certificationMapper = certificationMapper;
        this.activeMerchantService = activeMerchantService;
        this.userIdentityMapper = userIdentityMapper;
        this.policy = policy;
        this.mode = mode == null ? "none" : mode.trim().toLowerCase();
        if ("dev".equals(this.mode)) {
            log.warn("短信通道运行在 [dev] 模式：验证码只写日志，不会真正发送短信。生产环境请把 "
                    + "agri.auth.sms.mode 改成真实服务商（并补齐 AccessKey/签名/模板）。");
        }
    }

    /** 是否处于 dev 通道（页面据此提示"验证码见后端日志"） */
    public boolean devMode() {
        return "dev".equals(mode);
    }

    /**
     * 发送验证码。

     *
     * @param phone 手机号（11 位）
     * @param scene 场景：login 登录 / register 注册 / change_phone 更换手机 /
     *              reset_password 找回密码（不同场景的码不通用）
     */
    public void send(String phone, String scene) {
        String normalized = normalizePhone(phone);
        assertScene(scene);
        if (!devMode()) {
            throw new BusinessException(ErrorCode.BIZ_ERROR,
                    "短信通道未配置（agri.auth.sms.mode=" + mode + "）：请提供短信服务商的 AccessKey、签名与模板后再启用");
        }
        if (Boolean.TRUE.equals(redis.hasKey(COOLDOWN_KEY + normalized))) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "验证码已发送，请 60 秒后再试");
        }
        Duration ttl = codeTtl();
        assertDailyLimit(normalized, scene);
        String code = String.format("%06d", ThreadLocalRandom.current().nextInt(1_000_000));
        redis.opsForValue().set(CODE_KEY + scene + ":" + normalized, code, ttl);
        redis.delete(ATTEMPT_KEY + scene + ":" + normalized);
        redis.opsForValue().set(COOLDOWN_KEY + normalized, "1", COOLDOWN);
        // 只进日志：不回响应体、不落库明文
        log.warn("[DEV 短信通道] {} 的验证码（场景 {}）＝ {}（{} 秒内有效）",
                mask(normalized), scene, code, ttl.toSeconds());
    }

    /**
     * 校验验证码。
     *
     * <p>口径写死在这里，避免"最多 5 次"被实现成第 6 次才作废：</p>
     * <ul>
     *   <li>先比码：码对了一定算通过，不会因为"前面错过几次"就拒绝正确输入；</li>
     *   <li>只有错的那次才计入次数，错满 {@value #MAX_ATTEMPTS} 次本条立即作废（要重新获取）；</li>
     *   <li>验过即删（一次性，防重放），并解除重发冷却。</li>
     * </ul>
     *
     * @param phone 手机号
     * @param scene 场景（与发送时一致）
     * @param code 用户输入的验证码
     */
    public void verify(String phone, String scene, String code) {
        String normalized = normalizePhone(phone);
        assertScene(scene);
        if (code == null || !code.trim().matches("\\d{6}")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "验证码应为 6 位数字");
        }
        String key = CODE_KEY + scene + ":" + normalized;
        String expected = redis.opsForValue().get(key);
        if (expected == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "验证码已过期或未发送，请重新获取");
        }
        if (expected.equals(code.trim())) {
            redis.delete(key);
            redis.delete(ATTEMPT_KEY + scene + ":" + normalized);
            // 验证成功后解除重发冷却：此时号码已证明可接收，留着冷却只会让
            // "刚登录完、马上换账号再登"的人面对一条已失效的验证码干等 60 秒。
            redis.delete(COOLDOWN_KEY + normalized);
            return;
        }
        String attemptKey = ATTEMPT_KEY + scene + ":" + normalized;
        Long incremented = redis.opsForValue().increment(attemptKey);
        // 计数键必须自己带过期：否则码早就作废了，"已错 3 次"这个状态会一直挂在 Redis 里，
        // 下次同号同场景重发时又叠上去，用户会遇到"我刚发的码一填就错"这种解释不了的提示。
        long wrong = incremented == null ? MAX_ATTEMPTS : incremented;
        if (wrong == 1L) {
            redis.expire(attemptKey, codeTtl());
        }
        if (wrong >= MAX_ATTEMPTS) {
            redis.delete(key);
            redis.delete(attemptKey);
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "验证码已连续错满 " + MAX_ATTEMPTS + " 次，本条已作废，请重新获取");
        }
        throw new BusinessException(ErrorCode.BAD_REQUEST,
                "验证码不正确（还可试 " + (MAX_ATTEMPTS - wrong) + " 次）");
    }

    /**
     * 按手机号取账号（验证码登录用）。

     *
     * @param phone 手机号
     * @returns 账号实体
     * @throws BusinessException 没有该手机号的账号（消息里说清"去注册"）
     */
    public UserEntity requireUserByPhone(String phone) {
        String normalized = normalizePhone(phone);
        UserEntity user = userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getPhone, normalized));
        if (user == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "该手机号还没有注册账号，请先注册");
        }
        if (user.getStatus() == null || user.getStatus() != 1) {
            throw new BusinessException(ErrorCode.USER_DISABLED);
        }
        return user;
    }

    /**
     * 手机验证码自助重置密码。
     *
     * <p>验证码成功校验后立即作废；密码规则与注册、修改密码保持一致。
     * 调用方随后必须吊销该用户已有令牌与 SSO 会话。</p>
     *
     * @return 被重置密码的用户 ID
     */
    @Transactional(rollbackFor = Exception.class)
    public Long resetPassword(String phone, String code, String newPassword) {
        policy.validatePassword(newPassword, normalizePhone(phone));
        verify(phone, "reset_password", code);
        UserEntity user = requireUserByPhone(phone);
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(user);
        log.info("用户 {} 已通过短信验证码重置登录密码", user.getId());
        return user.getId();
    }

    /**
     * 手机号验证码注册：手机号即账号，授予平台 {@code FARMER} 角色。

     *
     * <p>页面提供了密码时使用用户设置的密码；旧调用方未提供密码时使用随机 BCrypt 串占位，
     * 不会产生可猜测的默认口令。</p>

     *
     * <p>注册会为当前用户创建独立经营主体和 owner 绑定；企业会员的主体认证与个人会员的实名记录
     * 都以 pending 状态进入运营端审核，审核通过后才对业务生效。</p>
     *
     * @param phone 手机号（同时作为登录账号名）
     * @param nickname 昵称（可空，默认"用户+手机号后四位"）
     * @param marketId 进入的市场（缺省 1）
     * @returns 新建账号实体
     */
    public record RegistrationProfile(
            String nickname,
            String password,
            String identity,
            String companyName,
            String creditCode,
            String industry,
            String companySize,
            String address,
            String realName,
            String idCard,
            String businessType,
            String contactName) {
    }

    /** 分步注册：第 2 步提交的主体资料。 */
    public record SubjectProfile(
            String identity,
            String companyName,
            String creditCode,
            String industry,
            String companySize,
            String address,
            String realName,
            String idCard,
            String businessType,
            String contactName,
            String contactPhone,
            String legalPerson,
            String licenseNo,
            String attachNote,
            String validStart,
            String validEnd,
            String email) {
    }

    /** 当前账号的开通阶段。 */
    public record OnboardingStatus(
            String stage,
            String phone,
            String nickname,
            String identity,
            Long merchantId,
            String subjectName,
            String certificationStatus,
            String certificationNo,
            VerificationProgress verification,
            SubjectDetails subject,
            String reviewRemark,
            LocalDateTime reviewTime) {
        public OnboardingStatus(String stage, String phone, String nickname, String identity,
                Long merchantId, String subjectName, String certificationStatus, String certificationNo,
                VerificationProgress verification) {
            this(stage, phone, nickname, identity, merchantId, subjectName, certificationStatus,
                    certificationNo, verification, null, null, null);
        }
    }

    public record SubjectDetails(String creditCode, String contactName, String contactPhone,
            String address, String industry, String companySize, String businessType) {
        static SubjectDetails of(MerchantEntity m) {
            return new SubjectDetails(m.getCreditCode(), m.getContactName(), m.getContactPhone(),
                    m.getAddress(), m.getIndustry(), m.getCompanySize(), m.getBusinessType());
        }

    }

    /**
     * 认证开通进度。个人通道为公安二要素 + 活体；企业通道为执照、法人扫脸与对公打款。
     * 文件地址均为受控地址，前端只用于预览和确认材料是否已上传。
     */
    public record VerificationProgress(
            String channel,
            Boolean policeVerified,
            Boolean livenessVerified,
            String businessLicenseUrl,
            String legalPersonFaceUrl,
            String legalPersonFaceStatus,
            String corporateBankName,
            String corporateBankAccount,
            String corporateTransferAmount,
            String corporateTransferReference,
            String corporateTransferProofUrl,
            String corporateTransferStatus,
            String registeredCapital,
            String idNoMasked,
            String creditCode,
            String legalPerson) {

        public static VerificationProgress empty() {
            return new VerificationProgress("", false, false, null, null, null,
                    null, null, null, null, null, null, null, null, null, null);
        }
    }

    /**
     * 第 1 步：只创建登录账号与 FARMER 角色，不创建经营主体。
     */
    @Transactional(rollbackFor = Exception.class)
    public UserEntity registerAccountByPhone(String phone, String password, String nickname, Long marketId) {
        String normalized = normalizePhone(phone);
        Long market = marketId == null ? 1L : marketId;
        UserEntity exists = userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getPhone, normalized));
        if (exists != null) {
            throw new BusinessException(ErrorCode.CONFLICT, "该手机号已注册，请直接登录");
        }
        // 复杂度与弱口令都由运营端的「参数配置」决定，不再写死在这里
        policy.validatePassword(password, normalized);
        LocalDateTime now = LocalDateTime.now();
        UserEntity user = new UserEntity();
        user.setUsername(normalized);
        user.setPassword(passwordEncoder.encode(password));
        user.setPhone(normalized);
        user.setNickname(trimToNull(nickname) == null ? "用户" + normalized.substring(7) : nickname.trim());
        user.setStatus(1);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        userMapper.insert(user);

        grantDefaultRole(user, market);
        log.info("账号注册成功：user={} phone={}（等待创建主体）", user.getId(), mask(normalized));
        return user;
    }

    /** 验证码有效期：跟随运营端配置，读不到就用 5 分钟兜底。 */
    private Duration codeTtl() {
        try {
            return Duration.ofSeconds(policy.smsCodeTtlSeconds());
        } catch (RuntimeException e) {
            return CODE_TTL_FALLBACK;
        }
    }

    /**
     * 同一手机号、同一场景的当日发送上限（运营端 {@code captcha.sms.daily.limit}）。
     *
     * <p>先计数再判上限：被拒的那一次也占用额度。反骚扰宁可偏严一点——
     * 一个脚本反复试同一批号码时，"这次没发出去所以不算"正是它想要的口径。</p>
     */
    private void assertDailyLimit(String phone, String scene) {
        int limit;
        try {
            limit = policy.smsDailyLimit();
        } catch (RuntimeException e) {
            return;   // 配置读不到时不拦正常业务，只失去这层保护
        }
        String key = DAILY_KEY + scene + ":" + phone + ":" + LocalDate.now();
        Long used = redis.opsForValue().increment(key);
        if (used == null) {
            return;
        }
        if (used == 1L) {
            redis.expire(key, Duration.between(LocalDateTime.now(), LocalDate.now().plusDays(1).atStartOfDay()));
        }
        if (used > limit) {
            throw new BusinessException(ErrorCode.BIZ_ERROR,
                    "该手机号今日验证码已发送 " + limit + " 条，请明天再试；如需立即处理请联系平台运营");
        }
    }

    /** 场景词表（所有入口共用，包括公开端点）。 */
    private static void assertScene(String scene) {
        if (!"login".equals(scene) && !"register".equals(scene) && !"change_phone".equals(scene)
                && !"reset_password".equals(scene)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "场景只能是 login、register、change_phone 或 reset_password");
        }
    }

    /**
     * 公开端点的场景白名单：未登录只允许发登录 / 注册 / 找回密码的码。
     * 换绑手机是账号变更，必须由账号中心在登录态里发起，否则任何人都能替别人发码。
     */
    public static void assertPublicScene(String scene) {
        assertScene(scene);
        if (!PUBLIC_SCENES.contains(scene)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "场景 " + scene + " 需要在账号中心登录后发起，不能从公开端点发送验证码");
        }
    }

    /**
     * 按运营端「新用户默认身份」授予角色。
     *
     * <p>配置为 NONE 时不授任何角色 —— 用户能登录但进不了业务域，需要走身份申请。
     * 这是产品口径，不是 bug；配置页的选项写得很清楚。</p>
     */
    private void grantDefaultRole(UserEntity user, Long market) {
        String code = policy.defaultRole();
        if (code == null || code.isBlank() || "NONE".equalsIgnoreCase(code)) {
            log.info("新用户 {} 未授默认身份（register.default.role=NONE），需自行申请身份", user.getId());
            return;
        }
        RoleEntity role = roleMapper.selectOne(new LambdaQueryWrapper<RoleEntity>()
                .eq(RoleEntity::getCode, code));
        if (role == null) {
            log.warn("平台没有 {} 角色，注册用户 {} 未授任何角色", code, user.getId());
            return;
        }
        UserRoleEntity binding = new UserRoleEntity();
        binding.setUserId(user.getId());
        binding.setRoleId(role.getId());
        binding.setMarketId(market);
        userRoleMapper.insert(binding);
    }

    /** 查询当前账号的开通阶段，供登录后自动分流与注册页恢复步骤。 */
    public OnboardingStatus onboardingStatus(Long userId, Long marketId) {
        UserEntity user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "账号不存在");
        }
        Long market = marketId == null ? 1L : marketId;
        Long merchantId = activeMerchantService.resolve(userId, market);
        if (merchantId == null) {
            return new OnboardingStatus("subject", user.getPhone(), user.getNickname(), null,
                    null, null, null, null, VerificationProgress.empty());
        }
        MerchantEntity merchant = merchantMapper.selectById(merchantId);
        String identity = merchant == null ? null : merchant.getMemberType();
        // 缺少主体类型不能推断认证通过，需补齐主体资料。
        if (merchant == null || identity == null || identity.isBlank()) {
            return new OnboardingStatus("subject", user.getPhone(), user.getNickname(), identity,
                    merchantId, merchant == null ? null : merchant.getName(),
                    merchant == null ? null : merchant.getVerifyStatus(), null, VerificationProgress.empty());
        }
        if ("enterprise".equalsIgnoreCase(identity)) {
            MerchantCertificationEntity cert = latestCertification(merchantId);
            if (cert != null && (!java.util.Objects.equals(trimToNull(merchant.getName()), trimToNull(cert.getCompanyName()))
                    || !java.util.Objects.equals(trimToNull(merchant.getCreditCode()), trimToNull(cert.getCreditCode())))) {
                return new OnboardingStatus("subject", user.getPhone(), user.getNickname(), identity,
                        merchantId, merchant.getName(), "rejected", cert.getCertNo(), VerificationProgress.empty(),
                        SubjectDetails.of(merchant), cert.getReviewRemark(), cert.getReviewTime());
            }
            String certStatus = cert == null ? null : cert.getCertStatus();
            String stage = "approved".equals(certStatus) ? "done"
                    : "pending".equals(certStatus) ? "pending" : "certification";
            return new OnboardingStatus(stage, user.getPhone(), user.getNickname(), identity,
                    merchantId, merchant.getName(), certStatus, cert == null ? null : cert.getCertNo(),
                    verificationProgress(null, cert), SubjectDetails.of(merchant),
                    cert == null ? null : cert.getReviewRemark(),
                    cert == null ? null : cert.getReviewTime());
        }
        UserIdentityEntity identityRecord = latestIdentity(userId);
        String identityStatus = identityRecord == null ? null : identityRecord.getStatus();
        String stage = "approved".equals(identityStatus) ? "done"
                : "pending".equals(identityStatus) ? "pending" : "certification";
        return new OnboardingStatus(stage, user.getPhone(), user.getNickname(), identity,
                merchantId, merchant == null ? null : merchant.getName(), identityStatus,
                identityRecord == null ? null : identityRecord.getIdentityNo(),
                verificationProgress(identityRecord, null), SubjectDetails.of(merchant),
                identityRecord == null ? null : identityRecord.getReviewRemark(),
                identityRecord == null ? null : identityRecord.getReviewTime());
    }

    private VerificationProgress verificationProgress(UserIdentityEntity identity,
                                                      MerchantCertificationEntity certification) {
        if (identity != null) {
            return new VerificationProgress("公安二要素 + 活体",
                    Boolean.TRUE.equals(identity.getPoliceVerified()),
                    Boolean.TRUE.equals(identity.getLivenessVerified()),
                    null, null, null, null, null, null, null, null, null, null,
                    identity.getIdNoMasked(), null, identity.getRealName());
        }
        if (certification != null) {
            return new VerificationProgress(
                    certification.getVerificationChannel(),
                    false, false,
                    certification.getBusinessLicenseUrl(),
                    certification.getLegalPersonFaceUrl(),
                    certification.getLegalPersonFaceStatus(),
                    certification.getCorporateBankName(),
                    certification.getCorporateBankAccount(),
                    certification.getCorporateTransferAmount(),
                    certification.getCorporateTransferReference(),
                    certification.getCorporateTransferProofUrl(),
                    certification.getCorporateTransferStatus(),
                    certification.getRegisteredCapital(),
                    null,
                    certification.getCreditCode(),
                    certification.getLegalPerson());
        }
        return VerificationProgress.empty();
    }

    /**
     * 第 2 步：创建（或继续编辑）经营主体，并生成不可审核的 draft 认证草稿。
     * 只有第 3 步激活后，申请才会进入运营审核列表。
     */
    @Transactional(rollbackFor = Exception.class)
    public OnboardingStatus createSubject(Long userId, Long marketId, SubjectProfile profile) {
        return createSubject(userId, marketId, profile, false);
    }

    /**
     * 已登录账号追加创建另一个经营主体。
     *
     * <p>与注册向导的 createSubject 不同，这里不复用账号已有主体，而是新建一条
     * platform_merchant 和 owner 绑定，因此用户可在个人中心同时拥有企业/个人主体。</p>
     */
    @Transactional(rollbackFor = Exception.class)
    public OnboardingStatus createAdditionalSubject(Long userId, Long marketId, SubjectProfile profile) {
        return createSubject(userId, marketId, profile, true);
    }

    private OnboardingStatus createSubject(Long userId, Long marketId, SubjectProfile profile, boolean forceNewMerchant) {
        if (profile == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "主体资料不能为空");
        }
        Long market = marketId == null ? 1L : marketId;
        String identity = profile.identity() == null ? "" : profile.identity().trim().toLowerCase();
        if (!"enterprise".equals(identity) && !"personal".equals(identity)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "主体类型只能是 enterprise 或 personal");
        }
        UserEntity user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "账号不存在");
        }
        String companyName = trimToNull(profile.companyName());
        String creditCode = trimToNull(profile.creditCode());
        String realName = trimToNull(profile.realName());
        String contactName = trimToNull(profile.contactName());
        String contactPhone = trimToNull(profile.contactPhone());
        String idCard = trimToNull(profile.idCard());
        if ("enterprise".equals(identity)) {
            if (companyName == null) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "企业名称不能为空");
            }
            creditCode = com.agri.platform.internal.merchant.CreditCodeValidator.validate(creditCode);
        } else {
            if (realName == null) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "真实姓名不能为空");
            }
            if (idCard == null) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "个人会员必须填写身份证号");
            }
        }

        Long merchantId = forceNewMerchant
                ? null : activeMerchantService.resolve(userId, market);
        MerchantEntity merchant;
        LocalDateTime now = LocalDateTime.now();
        if (merchantId == null) {
            merchant = new MerchantEntity();
            merchant.setMarketId(market);
            merchant.setCode(forceNewMerchant
                    ? "REG" + Long.toString(System.currentTimeMillis(), 36).toUpperCase()
                    : "REG" + userId);
            merchant.setName("enterprise".equals(identity) ? companyName : realName);
            merchant.setType("BOTH");
            merchant.setMemberType(identity);
            merchant.setContactName(contactName == null
                    ? ("enterprise".equals(identity) ? companyName : realName) : contactName);
            merchant.setContactPhone(contactPhone == null ? user.getPhone() : contactPhone);
            merchant.setStatus(1);
            merchant.setVerifyStatus("unverified");
            merchant.setIndustry("enterprise".equals(identity) ? trimToNull(profile.industry()) : null);
            merchant.setCompanySize("enterprise".equals(identity) ? trimToNull(profile.companySize()) : null);
            merchant.setAddress(trimToNull(profile.address()));
            merchant.setBusinessType("enterprise".equals(identity) ? null : trimToNull(profile.businessType()));
            merchant.setCreditCode("enterprise".equals(identity) ? creditCode : null);
            merchantMapper.insert(merchant);

            UserMerchantEntity membership = new UserMerchantEntity();
            membership.setUserId(userId);
            membership.setMerchantId(merchant.getId());
            membership.setMarketId(market);
            membership.setRoleInMerchant("owner");
            membership.setStatus(1);
            membership.setCreatedAt(now);
            membership.setUpdatedAt(now);
            userMerchantMapper.insert(membership);
        } else {
            merchant = merchantMapper.lockById(merchantId);
            if (merchant == null) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "经营主体不存在");
            }
            if (merchant.getMemberType() != null && !merchant.getMemberType().isBlank()
                    && !identity.equalsIgnoreCase(merchant.getMemberType())) {
                throw new BusinessException(ErrorCode.CONFLICT, "主体类型创建后不可更改");
            }
            MerchantCertificationEntity existingCert = latestCertificationForUpdate(merchant.getId());
            boolean locked = "approved".equals(merchant.getVerifyStatus())
                    || "pending".equals(merchant.getVerifyStatus())
                    || (existingCert != null && ("pending".equals(existingCert.getCertStatus())
                    || "approved".equals(existingCert.getCertStatus())));
            if (locked) {
                throw new BusinessException(ErrorCode.CONFLICT, "主体正在审核或已认证，不能修改认证资料；请等待退回补正或走主体变更流程");
            }
            merchant.setName("enterprise".equals(identity) ? companyName : realName);
            merchant.setMemberType(identity);
            merchant.setContactName(contactName == null
                    ? ("enterprise".equals(identity) ? companyName : realName) : contactName);
            merchant.setContactPhone(contactPhone == null ? user.getPhone() : contactPhone);
            merchant.setIndustry("enterprise".equals(identity) ? trimToNull(profile.industry()) : null);
            merchant.setCompanySize("enterprise".equals(identity) ? trimToNull(profile.companySize()) : null);
            merchant.setAddress(trimToNull(profile.address()));
            merchant.setBusinessType("enterprise".equals(identity) ? null : trimToNull(profile.businessType()));
            merchant.setCreditCode("enterprise".equals(identity) ? creditCode : null);
            merchantMapper.updateById(merchant);
        }

        if ("enterprise".equals(identity)) {
            Long sameCredit = merchantMapper.selectCount(new LambdaQueryWrapper<MerchantEntity>()
                    .eq(MerchantEntity::getCreditCode, creditCode)
                    .ne(MerchantEntity::getId, merchant.getId()));
            if (sameCredit != null && sameCredit > 0) {
                throw new BusinessException(ErrorCode.CONFLICT, "该统一社会信用代码已登记");
            }
            MerchantCertificationEntity cert = latestCertificationForUpdate(merchant.getId());
            if (cert == null || "draft".equals(cert.getCertStatus()) || "rejected".equals(cert.getCertStatus())) {
                if (cert == null || "rejected".equals(cert.getCertStatus())) {
                    Long previousId = cert == null ? null : cert.getId();
                    cert = new MerchantCertificationEntity();
                    cert.setPreviousCertificationId(previousId);
                    cert.setMerchantId(merchant.getId());
                    cert.setMerchantName(merchant.getName());
                    cert.setCertNo("CT" + System.currentTimeMillis()
                            + String.format("%03d", ThreadLocalRandom.current().nextInt(1000)));
                    cert.setCertStatus("draft");
                    // 表字段 NOT NULL；draft 不属于审核队列，提交时间会在激活时覆盖。
                    cert.setSubmitTime(now);
                }
                cert.snapshot(merchant);
                cert.setMerchantName(merchant.getName());
                cert.setCompanyName(companyName);
                cert.setCreditCode(creditCode);
                cert.setContactName(merchant.getContactName());
                cert.setContactPhone(merchant.getContactPhone());
                cert.setLegalPerson(trimToNull(profile.legalPerson()));
                cert.setLicenseNo(trimToNull(profile.licenseNo()));
                cert.setAttachNote(trimToNull(profile.attachNote()) == null
                        ? "分步注册：主体资料已保存，等待认证开通步骤提交审核。"
                        : profile.attachNote().trim());
                if (cert.getId() == null) {
                    certificationMapper.insert(cert);
                } else {
                    certificationMapper.updateById(cert);
                }
            }
        } else {
            String idNo = IdNumberUtil.validate(idCard);
            UserIdentityEntity latest = latestIdentity(userId);
            UserIdentityEntity draft = latest;
            if (latest == null || "draft".equals(latest.getStatus()) || "rejected".equals(latest.getStatus())) {
                if (latest == null || "rejected".equals(latest.getStatus())) {
                    draft = new UserIdentityEntity();
                    draft.setUserId(userId);
                    draft.setMarketId(market);
                    draft.setIdentityNo("ID" + System.currentTimeMillis()
                            + String.format("%03d", ThreadLocalRandom.current().nextInt(1000)));
                    draft.setStatus("draft");
                    // 表字段 NOT NULL；draft 不属于审核队列，提交时间会在激活时覆盖。
                    draft.setSubmitTime(now);
                    draft.setCreatedAt(now);
                }
                String salt = draft.getIdNoSalt() == null ? IdNumberUtil.newSalt() : draft.getIdNoSalt();
                draft.setRealName(realName);
                draft.setIdNoMasked(IdNumberUtil.mask(idNo));
                draft.setIdNoHash(IdNumberUtil.hash(idNo, salt));
                draft.setIdNoSalt(salt);
                draft.setValidStart(trimToNull(profile.validStart()));
                draft.setValidEnd(trimToNull(profile.validEnd()));
                draft.setContactPhone(contactPhone == null ? user.getPhone() : contactPhone);
                draft.setAddress(trimToNull(profile.address()));
                draft.setEmail(trimToNull(profile.email()));
                draft.setBusinessType(trimToNull(profile.businessType()));
                draft.setUpdatedAt(now);
                if (draft.getId() == null) {
                    userIdentityMapper.insert(draft);
                } else {
                    userIdentityMapper.updateById(draft);
                }
            }
        }
        return onboardingStatus(userId, market);
    }

    /** 第 3 步：把 draft 认证激活为 pending，进入运营审核队列。 */
    @Transactional(rollbackFor = Exception.class)
    public OnboardingStatus activateCertification(Long userId, Long marketId) {
        Long market = marketId == null ? 1L : marketId;
        Long merchantId = activeMerchantService.resolve(userId, market);
        if (merchantId == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请先完成主体创建");
        }
        MerchantEntity merchant = merchantMapper.lockById(merchantId);
        if (merchant == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "经营主体不存在");
        }
        LocalDateTime now = LocalDateTime.now();
        if ("enterprise".equalsIgnoreCase(merchant.getMemberType())) {
            MerchantCertificationEntity cert = latestCertificationForUpdate(merchantId);
            if (cert == null) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "认证资料不存在，请返回主体步骤重新填写");
            }
            if ("approved".equals(cert.getCertStatus())) {
                return onboardingStatus(userId, market);
            }
            if ("pending".equals(cert.getCertStatus())) {
                return onboardingStatus(userId, market);
            }
            if (!"draft".equals(cert.getCertStatus())) {
                throw new BusinessException(ErrorCode.CONFLICT, "请返回主体资料步骤保存补正草稿，原驳回申请不可再次提交");
            }
            if ("draft".equals(cert.getCertStatus())) {
                com.agri.platform.internal.merchant.CreditCodeValidator.validate(cert.getCreditCode());
                if (!java.util.Objects.equals(merchant.getName(), cert.getCompanyName())
                        || !java.util.Objects.equals(merchant.getCreditCode(), cert.getCreditCode())) {
                    throw new BusinessException(ErrorCode.CONFLICT, "主体资料已变化，请返回主体步骤重新保存");
                }
                requireText(merchant.getContactName(), "请填写联系人姓名");
                if (merchant.getContactPhone() == null || !merchant.getContactPhone().matches("^1[3-9]\\d{9}$")) {
                    throw new BusinessException(ErrorCode.BAD_REQUEST, "请填写有效的联系电话");
                }
                requireText(merchant.getAddress(), "请按营业执照补齐完整注册地址");
                requireText(merchant.getIndustry(), "请选择行业");
                requireText(merchant.getCompanySize(), "请选择企业规模");
                cert.snapshot(merchant);
                cert.setContactName(merchant.getContactName());
                cert.setContactPhone(merchant.getContactPhone());
                requireText(cert.getBusinessLicenseUrl(), "请先上传营业执照照片");
                requireText(cert.getLegalPersonFaceUrl(), "请先完成法定代表人扫脸");
                if (!"verified".equals(cert.getLegalPersonFaceStatus())) {
                    throw new BusinessException(ErrorCode.BAD_REQUEST, "法定代表人扫脸尚未通过");
                }
                requireText(cert.getCorporateBankName(), "请填写对公账户户名");
                requireText(cert.getCorporateBankAccount(), "请填写对公账户账号");
                requireText(cert.getCorporateTransferAmount(), "请填写对公打款金额");
                requireText(cert.getCorporateTransferReference(), "请填写对公打款流水号");
                requireText(cert.getCorporateTransferProofUrl(), "请上传对公打款凭证");
                if (!"submitted".equals(cert.getCorporateTransferStatus())
                        && !"verified".equals(cert.getCorporateTransferStatus())) {
                    throw new BusinessException(ErrorCode.BAD_REQUEST, "对公打款凭证尚未提交");
                }
                cert.setCertStatus("pending");
                cert.setSubmitTime(now);
                cert.setReviewer(null);
                cert.setReviewTime(null);
                cert.setReviewRemark(null);
                certificationMapper.updateById(cert);
            }
        } else {
            UserIdentityEntity identity = latestIdentity(userId);
            if (identity == null) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "实名资料不存在，请返回主体步骤重新填写");
            }
            if ("verified".equals(identity.getStatus())) {
                return onboardingStatus(userId, market);
            }
            if ("pending".equals(identity.getStatus())) {
                return onboardingStatus(userId, market);
            }
            if (!"draft".equals(identity.getStatus())) {
                throw new BusinessException(ErrorCode.CONFLICT, "请返回主体资料步骤保存新的补正草稿");
            }
            if ("draft".equals(identity.getStatus())) {
                if (!Boolean.TRUE.equals(identity.getPoliceVerified())) {
                    throw new BusinessException(ErrorCode.BAD_REQUEST, "请先完成公安二要素核验");
                }
                if (!Boolean.TRUE.equals(identity.getLivenessVerified())) {
                    throw new BusinessException(ErrorCode.BAD_REQUEST, "请先完成人脸活体检测");
                }
                identity.setStatus("pending");
                identity.setSubmitTime(now);
                identity.setUpdatedAt(now);
                identity.setReviewerId(null);
                identity.setReviewerName(null);
                identity.setReviewTime(null);
                identity.setReviewRemark(null);
                userIdentityMapper.updateById(identity);
            }
        }
        merchant.setVerifyStatus("pending");
        merchant.setVerifyRemark(null);
        merchantMapper.updateById(merchant);
        return onboardingStatus(userId, market);
    }

    private static void requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, message);
        }
    }

    private List<Long> myMerchantIds(Long userId, Long marketId) {
        LambdaQueryWrapper<UserMerchantEntity> wrapper = new LambdaQueryWrapper<UserMerchantEntity>()
                .eq(UserMerchantEntity::getUserId, userId)
                .eq(UserMerchantEntity::getStatus, 1);
        if (marketId != null) {
            wrapper.eq(UserMerchantEntity::getMarketId, marketId);
        }
        return userMerchantMapper.selectList(wrapper).stream()
                .map(UserMerchantEntity::getMerchantId)
                .distinct()
                .toList();
    }

    private MerchantCertificationEntity latestCertificationForUpdate(Long merchantId) {
        return certificationMapper.selectOne(new LambdaQueryWrapper<MerchantCertificationEntity>()
                .eq(MerchantCertificationEntity::getMerchantId, merchantId)
                .orderByDesc(MerchantCertificationEntity::getId).last("LIMIT 1 FOR UPDATE"));
    }

    private MerchantCertificationEntity latestCertification(Long merchantId) {
        return certificationMapper.selectOne(new LambdaQueryWrapper<MerchantCertificationEntity>()
                .eq(MerchantCertificationEntity::getMerchantId, merchantId)
                .orderByDesc(MerchantCertificationEntity::getId)
                .last("LIMIT 1"));
    }

    private UserIdentityEntity latestIdentity(Long userId) {
        return userIdentityMapper.selectOne(new LambdaQueryWrapper<UserIdentityEntity>()
                .eq(UserIdentityEntity::getUserId, userId)
                .orderByDesc(UserIdentityEntity::getId)
                .last("LIMIT 1"));
    }

    @Transactional(rollbackFor = Exception.class)
    public UserEntity registerByPhone(String phone, RegistrationProfile profile, Long marketId) {
        String normalized = normalizePhone(phone);
        Long market = marketId == null ? 1L : marketId;
        UserEntity exists = userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getPhone, normalized));
        if (exists != null) {
            throw new BusinessException(ErrorCode.CONFLICT, "该手机号已注册，请直接登录");
        }

        String identity = profile.identity() == null || profile.identity().isBlank()
                ? "enterprise" : profile.identity().trim().toLowerCase();
        if (!"enterprise".equals(identity) && !"personal".equals(identity)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "注册身份只能是 enterprise 或 personal");
        }

        String companyName = trimToNull(profile.companyName());
        String creditCode = trimToNull(profile.creditCode());
        String realName = trimToNull(profile.realName());
        String contactName = trimToNull(profile.contactName());
        if ("enterprise".equals(identity)) {
            if (companyName == null) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "企业名称不能为空");
            }
            creditCode = com.agri.platform.internal.merchant.CreditCodeValidator.validate(creditCode);
            Long sameCredit = merchantMapper.selectCount(new LambdaQueryWrapper<MerchantEntity>()
                    .eq(MerchantEntity::getCreditCode, creditCode));
            if (sameCredit != null && sameCredit > 0) {
                throw new BusinessException(ErrorCode.CONFLICT, "该统一社会信用代码已登记，请直接登录或联系平台运营");
            }
        } else {
            if (realName == null) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "真实姓名不能为空");
            }
            if (trimToNull(profile.idCard()) == null) {
                throw new BusinessException(ErrorCode.BAD_REQUEST,
                        "个人会员注册必须填写身份证号，用于生成实名认证待审记录");
            }
        }

        String rawPassword = profile.password();
        if (rawPassword != null && !rawPassword.isBlank()) {
            policy.validatePassword(rawPassword, normalized);
        }

        LocalDateTime now = LocalDateTime.now();
        String displayName = "enterprise".equals(identity) ? companyName : realName;
        UserEntity user = new UserEntity();
        user.setUsername(normalized);
        user.setPassword(passwordEncoder.encode(rawPassword == null || rawPassword.isBlank()
                ? UUID.randomUUID().toString() : rawPassword));
        user.setPhone(normalized);
        user.setNickname(trimToNull(profile.nickname()) != null
                ? profile.nickname().trim()
                : displayName);
        user.setStatus(1);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        userMapper.insert(user);

        grantDefaultRole(user, market);

        MerchantEntity merchant = new MerchantEntity();
        merchant.setMarketId(market);
        merchant.setCode("REG" + user.getId());
        merchant.setName(displayName);
        merchant.setType("BOTH");
        merchant.setMemberType(identity);
        // 只存该身份对应的档案字段：个人会员不继承企业表单的行业/规模/地址默认值
        boolean enterprise = "enterprise".equals(identity);
        merchant.setIndustry(enterprise ? trimToNull(profile.industry()) : null);
        merchant.setCompanySize(enterprise ? trimToNull(profile.companySize()) : null);
        merchant.setAddress(enterprise ? trimToNull(profile.address()) : null);
        merchant.setBusinessType(enterprise ? null : trimToNull(profile.businessType()));
        merchant.setCreditCode("enterprise".equals(identity) ? creditCode : null);
        merchant.setContactName(contactName == null ? displayName : contactName);
        merchant.setContactPhone(normalized);
        merchant.setStatus(1);
        merchant.setVerifyStatus("unverified");
        merchantMapper.insert(merchant);

        UserMerchantEntity membership = new UserMerchantEntity();
        membership.setUserId(user.getId());
        membership.setMerchantId(merchant.getId());
        membership.setMarketId(market);
        membership.setRoleInMerchant("owner");
        membership.setStatus(1);
        membership.setCreatedAt(now);
        membership.setUpdatedAt(now);
        userMerchantMapper.insert(membership);

        if ("enterprise".equals(identity)) {
            MerchantCertificationEntity certification = new MerchantCertificationEntity();
            certification.setMarketId(market);
            certification.setMerchantId(merchant.getId());
            certification.setMerchantName(displayName);
            certification.setCertNo("CT" + System.currentTimeMillis()
                    + String.format("%03d", ThreadLocalRandom.current().nextInt(1000)));
            certification.setCompanyName(companyName);
            certification.setCreditCode(creditCode);
            certification.setContactName(contactName == null ? displayName : contactName);
            certification.setContactPhone(normalized);
            certification.setAttachNote("统一认证中心自注册提交；所属行业、企业规模与注册地址已登记在经营主体档案。");
            certification.setCertStatus("draft");
            certification.setSubmitTime(now);
            certificationMapper.insert(certification);
        } else {
            String idNo = IdNumberUtil.validate(profile.idCard());
            String salt = IdNumberUtil.newSalt();
            UserIdentityEntity realNameRecord = new UserIdentityEntity();
            realNameRecord.setUserId(user.getId());
            realNameRecord.setMarketId(market);
            realNameRecord.setIdentityNo("ID" + System.currentTimeMillis()
                    + String.format("%03d", ThreadLocalRandom.current().nextInt(1000)));
            realNameRecord.setRealName(realName);
            realNameRecord.setIdNoMasked(IdNumberUtil.mask(idNo));
            realNameRecord.setIdNoHash(IdNumberUtil.hash(idNo, salt));
            realNameRecord.setIdNoSalt(salt);
            realNameRecord.setStatus("draft");
            realNameRecord.setSubmitTime(now);
            realNameRecord.setCreatedAt(now);
            realNameRecord.setUpdatedAt(now);
            userIdentityMapper.insert(realNameRecord);
        }

        log.info("注册成功：user={} phone={} identity={} merchant={}", user.getId(), mask(normalized),
                identity, merchant.getId());
        return user;
    }

    private static String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private static String normalizePhone(String phone) {
        String value = phone == null ? "" : phone.trim();
        if (!value.matches("1[3-9]\\d{9}")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "手机号格式不正确");
        }
        return value;
    }

    private static String mask(String phone) {
        return phone.length() == 11 ? phone.substring(0, 3) + "****" + phone.substring(7) : phone;
    }
}
