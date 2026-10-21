package com.agri.platform.internal.sso;

import com.agri.platform.internal.permission.RoleEntity;
import com.agri.platform.internal.permission.RoleMapper;
import com.agri.platform.internal.identity.IdNumberUtil;
import com.agri.platform.internal.identity.UserIdentityEntity;
import com.agri.platform.internal.identity.UserIdentityMapper;
import com.agri.platform.internal.merchant.MerchantCertificationEntity;
import com.agri.platform.internal.merchant.MerchantCertificationMapper;
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
    private static final Duration CODE_TTL = Duration.ofMinutes(5);
    private static final Duration COOLDOWN = Duration.ofSeconds(60);
    private static final int MAX_ATTEMPTS = 5;

    private final StringRedisTemplate redis;
    private final UserMapper userMapper;
    private final UserRoleMapper userRoleMapper;
    private final RoleMapper roleMapper;
    private final MerchantMapper merchantMapper;
    private final UserMerchantMapper userMerchantMapper;
    private final MerchantCertificationMapper certificationMapper;
    private final UserIdentityMapper userIdentityMapper;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    /** 短信通道模式：none（默认，未配置服务商）/ dev（验证码写日志，仅联调用） */
    private final String mode;

    public SmsAuthService(StringRedisTemplate redis, UserMapper userMapper, UserRoleMapper userRoleMapper,
                          RoleMapper roleMapper, MerchantMapper merchantMapper, UserMerchantMapper userMerchantMapper,
                          MerchantCertificationMapper certificationMapper, UserIdentityMapper userIdentityMapper,
                          @Value("${agri.auth.sms.mode:none}") String mode) {
        this.redis = redis;
        this.userMapper = userMapper;
        this.userRoleMapper = userRoleMapper;
        this.roleMapper = roleMapper;
        this.merchantMapper = merchantMapper;
        this.userMerchantMapper = userMerchantMapper;
        this.certificationMapper = certificationMapper;
        this.userIdentityMapper = userIdentityMapper;
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
     * @param scene 场景：login 登录 / register 注册（不同场景的码不通用）
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
        String code = String.format("%06d", ThreadLocalRandom.current().nextInt(1_000_000));
        redis.opsForValue().set(CODE_KEY + scene + ":" + normalized, code, CODE_TTL);
        redis.delete(ATTEMPT_KEY + scene + ":" + normalized);
        redis.opsForValue().set(COOLDOWN_KEY + normalized, "1", COOLDOWN);
        // 只进日志：不回响应体、不落库明文
        log.warn("[DEV 短信通道] {} 的验证码（场景 {}）＝ {}（5 分钟内有效）", mask(normalized), scene, code);
    }

    /**
     * 校验验证码：成功即作废；错误累计到上限整体作废。

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
        Long attempts = redis.opsForValue().increment(ATTEMPT_KEY + scene + ":" + normalized);
        if (attempts != null && attempts > MAX_ATTEMPTS) {
            redis.delete(key);
            throw new BusinessException(ErrorCode.BAD_REQUEST, "验证码错误次数过多，请重新获取");
        }
        if (!expected.equals(code.trim())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "验证码不正确");
        }
        // 一次性：验过即删，防重放
        redis.delete(key);
        redis.delete(ATTEMPT_KEY + scene + ":" + normalized);
        // 验证成功后解除重发冷却：此时号码已证明可接收，留着冷却只会让
        // "刚登录完、马上换账号再登"的人面对一条已失效的验证码干等 60 秒。
        redis.delete(COOLDOWN_KEY + normalized);
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
            String certificationNo) {
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
        if (password == null || password.length() < 8 || password.length() > 20
                || !password.matches(".*[A-Za-z].*") || !password.matches(".*\\d.*")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "密码应为 8-20 位，且同时包含字母和数字");
        }
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

        RoleEntity farmer = roleMapper.selectOne(new LambdaQueryWrapper<RoleEntity>()
                .eq(RoleEntity::getCode, "FARMER"));
        if (farmer == null) {
            log.warn("平台没有 FARMER 角色，注册用户 {} 未授任何角色", user.getId());
        } else {
            UserRoleEntity binding = new UserRoleEntity();
            binding.setUserId(user.getId());
            binding.setRoleId(farmer.getId());
            binding.setMarketId(market);
            userRoleMapper.insert(binding);
        }
        log.info("账号注册成功：user={} phone={}（等待创建主体）", user.getId(), mask(normalized));
        return user;
    }

    /** 查询当前账号的开通阶段，供登录后自动分流与注册页恢复步骤。 */
    public OnboardingStatus onboardingStatus(Long userId, Long marketId) {
        UserEntity user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "账号不存在");
        }
        Long market = marketId == null ? 1L : marketId;
        Long merchantId = myMerchantIds(userId, market).stream().findFirst().orElse(null);
        if (merchantId == null) {
            return new OnboardingStatus("subject", user.getPhone(), user.getNickname(), null,
                    null, null, null, null);
        }
        MerchantEntity merchant = merchantMapper.selectById(merchantId);
        String identity = merchant == null ? null : merchant.getMemberType();
        // 历史账号的主体没有 member_type：不能因为新流程上线就把老账号拦在开通向导里。
        if (merchant == null || identity == null || identity.isBlank()) {
            return new OnboardingStatus("done", user.getPhone(), user.getNickname(), identity,
                    merchantId, merchant == null ? null : merchant.getName(),
                    merchant == null ? null : merchant.getVerifyStatus(), null);
        }
        if ("enterprise".equalsIgnoreCase(identity)) {
            MerchantCertificationEntity cert = latestCertification(merchantId);
            String certStatus = cert == null ? null : cert.getCertStatus();
            String stage = certStatus == null || "draft".equals(certStatus) || "rejected".equals(certStatus)
                    ? "certification" : "pending".equals(certStatus) ? "pending" : "done";
            return new OnboardingStatus(stage, user.getPhone(), user.getNickname(), identity,
                    merchantId, merchant.getName(), certStatus, cert == null ? null : cert.getCertNo());
        }
        UserIdentityEntity identityRecord = latestIdentity(userId);
        String identityStatus = identityRecord == null ? null : identityRecord.getStatus();
        String stage = identityStatus == null || "draft".equals(identityStatus) || "rejected".equals(identityStatus)
                ? "certification" : "pending".equals(identityStatus) ? "pending" : "done";
        return new OnboardingStatus(stage, user.getPhone(), user.getNickname(), identity,
                merchantId, merchant == null ? null : merchant.getName(), identityStatus,
                identityRecord == null ? null : identityRecord.getIdentityNo());
    }

    /**
     * 第 2 步：创建（或继续编辑）经营主体，并生成不可审核的 draft 认证草稿。
     * 只有第 3 步激活后，申请才会进入运营审核列表。
     */
    @Transactional(rollbackFor = Exception.class)
    public OnboardingStatus createSubject(Long userId, Long marketId, SubjectProfile profile) {
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
            if (creditCode == null || !creditCode.matches("[0-9A-Za-z]{15,18}")) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "统一社会信用代码应为 15-18 位字母数字");
            }
        } else {
            if (realName == null) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "真实姓名不能为空");
            }
            if (idCard == null) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "个人会员必须填写身份证号");
            }
        }

        Long merchantId = myMerchantIds(userId, market).stream().findFirst().orElse(null);
        MerchantEntity merchant;
        LocalDateTime now = LocalDateTime.now();
        if (merchantId == null) {
            merchant = new MerchantEntity();
            merchant.setMarketId(market);
            merchant.setCode("REG" + userId);
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
            merchant = merchantMapper.selectById(merchantId);
            if (merchant == null) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "经营主体不存在");
            }
            if (merchant.getMemberType() != null && !merchant.getMemberType().isBlank()
                    && !identity.equalsIgnoreCase(merchant.getMemberType())) {
                throw new BusinessException(ErrorCode.CONFLICT, "主体类型创建后不可更改");
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
            MerchantCertificationEntity cert = latestCertification(merchant.getId());
            if (cert == null || "draft".equals(cert.getCertStatus()) || "rejected".equals(cert.getCertStatus())) {
                if (cert == null || "rejected".equals(cert.getCertStatus())) {
                    cert = new MerchantCertificationEntity();
                    cert.setMerchantId(merchant.getId());
                    cert.setMerchantName(merchant.getName());
                    cert.setCertNo("CT" + System.currentTimeMillis()
                            + String.format("%03d", ThreadLocalRandom.current().nextInt(1000)));
                    cert.setCertStatus("draft");
                    // 表字段 NOT NULL；draft 不属于审核队列，提交时间会在激活时覆盖。
                    cert.setSubmitTime(now);
                }
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
        Long merchantId = myMerchantIds(userId, market).stream().findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.BAD_REQUEST, "请先完成主体创建"));
        MerchantEntity merchant = merchantMapper.selectById(merchantId);
        if (merchant == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "经营主体不存在");
        }
        LocalDateTime now = LocalDateTime.now();
        if ("enterprise".equalsIgnoreCase(merchant.getMemberType())) {
            MerchantCertificationEntity cert = latestCertification(merchantId);
            if (cert == null) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "认证资料不存在，请返回主体步骤重新填写");
            }
            if ("approved".equals(cert.getCertStatus())) {
                return onboardingStatus(userId, market);
            }
            if ("draft".equals(cert.getCertStatus()) || "rejected".equals(cert.getCertStatus())) {
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
            if ("draft".equals(identity.getStatus()) || "rejected".equals(identity.getStatus())) {
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
            if (creditCode == null || !creditCode.matches("[0-9A-Za-z]{15,18}")) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "统一社会信用代码应为 15-18 位字母数字");
            }
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
            if (rawPassword.length() < 8 || rawPassword.length() > 20
                    || !rawPassword.matches(".*[A-Za-z].*") || !rawPassword.matches(".*\\d.*")) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "密码应为 8-20 位，且同时包含字母和数字");
            }
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

        RoleEntity farmer = roleMapper.selectOne(new LambdaQueryWrapper<RoleEntity>()
                .eq(RoleEntity::getCode, "FARMER"));
        if (farmer == null) {
            log.warn("平台没有 FARMER 角色，注册用户 {} 未授任何角色", user.getId());
        } else {
            UserRoleEntity binding = new UserRoleEntity();
            binding.setUserId(user.getId());
            binding.setRoleId(farmer.getId());
            binding.setMarketId(market);
            userRoleMapper.insert(binding);
        }

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
        merchant.setVerifyStatus("enterprise".equals(identity) ? "pending" : "unverified");
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
            certification.setCertStatus("pending");
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
            realNameRecord.setStatus("pending");
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

    private static void assertScene(String scene) {
        if (!"login".equals(scene) && !"register".equals(scene)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "场景只能是 login 或 register");
        }
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
