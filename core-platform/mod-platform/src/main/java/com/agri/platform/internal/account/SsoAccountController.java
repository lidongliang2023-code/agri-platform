package com.agri.platform.internal.account;

import com.agri.platform.internal.identity.UserIdentityEntity;
import com.agri.platform.internal.identity.UserIdentityMapper;
import com.agri.platform.internal.identity.IdNumberUtil;
import com.agri.platform.internal.merchant.MerchantEntity;
import com.agri.platform.internal.merchant.ActiveMerchantService;
import com.agri.platform.internal.merchant.MerchantCertificationEntity;
import com.agri.platform.internal.merchant.MerchantCertificationFileService;
import com.agri.platform.internal.merchant.MerchantCertificationMapper;
import com.agri.platform.internal.merchant.MerchantMapper;
import com.agri.platform.internal.merchant.UserMerchantEntity;
import com.agri.platform.internal.merchant.UserMerchantMapper;
import com.agri.platform.internal.sso.SmsAuthService;
import com.agri.platform.api.facade.CapabilityFacade;
import com.agri.platform.api.facade.MessageFacade;
import com.agri.platform.internal.sso.SsoSessionService;
import com.agri.platform.internal.user.UserEntity;
import com.agri.platform.internal.user.UserMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.Set;

/** 登录用户账号中心：资料、安全、地址、实名与经营主体。 */
@Slf4j
@RestController
@RequestMapping("/api/v1/sso/account")
@RequiredArgsConstructor
public class SsoAccountController {

    private final SsoSessionService sessionService;
    /** 账号侧策略：密码复杂度 / 弱口令（运营端可改） */
    private final com.agri.platform.internal.uc.AccountPolicyService accountPolicy;
    private final SmsAuthService smsAuthService;
    private final UserMapper userMapper;
    private final UserMerchantMapper userMerchantMapper;
    private final MerchantMapper merchantMapper;
    private final MerchantCertificationMapper certificationMapper;
    private final ActiveMerchantService activeMerchantService;
    private final MerchantCertificationFileService certificationFileService;
    private final UserIdentityMapper identityMapper;
    private final UserAddressMapper addressMapper;
    private final MerchantJoinRequestMapper joinRequestMapper;
    /**
     * 站内信门面。用户中心「消息中心」读的是 {@code platform_message}，
     * 这里在"加入申请"的两个关键节点写消息 —— 否则消息表永远是空的，
     * 页面上线了也只是一个空收件箱。
     */
    private final MessageFacade messageFacade;
    private final UserBindingMapper userBindingMapper;
    private final NotificationSettingMapper notificationSettingMapper;
    private final UserOperationLogService operationLog;
    private final UserOperationLogMapper userOperationLogMapper;
    private final MerchantCertificateMapper merchantCertificateMapper;
    /** 业务能力门面：身份类与主体类能力统一在门面里判定 */
    private final CapabilityFacade capabilityFacade;
    private final IdentityApplicationMapper identityApplicationMapper;
    private final UserFeedbackMapper userFeedbackMapper;
    private final PrivacyRequestMapper privacyRequestMapper;
    private final MfaService mfaService;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Value("${agri.auth.identity.verification-mode:none}")
    private String identityVerificationMode;

    @GetMapping("/summary")
    public ApiResponse<Map<String, Object>> summary(HttpServletRequest request) {
        long[] session = requireSession(request);
        Long userId = session[0];
        Long marketId = session[1];
        UserEntity user = requireUser(userId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", String.valueOf(user.getId()));
        result.put("username", user.getUsername());
        result.put("nickname", user.getNickname());
        result.put("phone", user.getPhone());
        result.put("email", user.getEmail());
        result.put("status", user.getStatus());
        result.put("createdAt", user.getCreatedAt());

        UserIdentityEntity identity = latestIdentity(userId);
        result.put("realName", identity == null ? null : identityView(identity));
        Long activeMerchantId = activeMerchantService.resolve(userId, marketId);
        result.put("activeMerchantId", activeMerchantId == null ? null : String.valueOf(activeMerchantId));
        result.put("merchants", merchantRows(userId, activeMerchantId));
        result.put("addresses", addressRows(userId));
        result.put("sentJoinRequests", joinRows(userId, null, true));
        List<Long> ownedMerchantIds = ownedMerchantIds(userId);
        result.put("reviewInbox", ownedMerchantIds.isEmpty()
                ? List.of() : joinRows(null, ownedMerchantIds, false));
        result.put("marketId", String.valueOf(marketId));
        return ApiResponse.ok(result);
    }

    @PutMapping("/profile")
    public ApiResponse<Void> updateProfile(@RequestBody ProfileRequest body, HttpServletRequest request) {
        long[] session = requireSession(request);
        UserEntity user = requireUser(session[0]);
        String nickname = trim(body.getNickname());
        String email = trim(body.getEmail());
        if (nickname == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "昵称不能为空");
        }
        if (nickname.length() > 64) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "昵称不能超过 64 个字符");
        }
        if (email != null && !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "邮箱格式不正确");
        }
        LocalDateTime now = LocalDateTime.now();
        // 整表提交语义：账号资料页每次都会带上邮箱，清空输入框就该真的解绑。
        // updateById 走的是 NOT_NULL 策略，null 字段会被跳过 —— 于是操作日志写着"未绑定"、库里还留着旧地址。
        userMapper.update(null, new LambdaUpdateWrapper<UserEntity>()
                .eq(UserEntity::getId, user.getId())
                .set(UserEntity::getNickname, nickname)
                .set(UserEntity::getEmail, email)
                .set(UserEntity::getUpdatedAt, now));
        operationLog.record(session[0], "profile_update", "更新账号资料", nickname,
                "邮箱：" + (email == null ? "未绑定" : email));
        return ApiResponse.ok();
    }

    @PostMapping("/password")
    public ApiResponse<Void> changePassword(@RequestBody PasswordRequest body, HttpServletRequest request) {
        long[] session = requireSession(request);
        UserEntity user = requireUser(session[0]);
        if (body == null || body.getCurrentPassword() == null
                || !passwordEncoder.matches(body.getCurrentPassword(), user.getPassword())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "当前密码不正确");
        }
        String next = body.getNewPassword();
        // 复杂度与弱口令由运营端「参数配置」决定；手机号传入用于识别"密码就是手机号"
        accountPolicy.validatePassword(next, user.getPhone());
        if (!next.equals(body.getConfirmPassword())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "两次输入的新密码不一致");
        }
        user.setPassword(passwordEncoder.encode(next));
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(user);
        operationLog.record(session[0], "password_change", "修改登录密码", user.getUsername(), "已重置登录密码");
        return ApiResponse.ok();
    }

    @PostMapping("/phone")
    public ApiResponse<Void> changePhone(@RequestBody PhoneRequest body, HttpServletRequest request) {
        long[] session = requireSession(request);
        UserEntity user = requireUser(session[0]);
        String phone = trim(body == null ? null : body.getPhone());
        if (phone == null || !phone.matches("^1[3-9]\\d{9}$")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请输入正确的 11 位手机号");
        }
        smsAuthService.verify(phone, "change_phone", body.getCode());
        Long exists = userMapper.selectCount(new LambdaQueryWrapper<UserEntity>()
                .and(w -> w.eq(UserEntity::getPhone, phone).or().eq(UserEntity::getUsername, phone))
                .ne(UserEntity::getId, user.getId()));
        if (exists != null && exists > 0) {
            throw new BusinessException(ErrorCode.CONFLICT, "该手机号已绑定其他账号");
        }
        String oldPhone = user.getPhone();
        if (oldPhone != null && oldPhone.equals(user.getUsername())) {
            user.setUsername(phone);
        }
        user.setPhone(phone);
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(user);
        operationLog.record(session[0], "phone_change", "变更绑定手机号", maskPhone(phone),
                oldPhone == null ? "首次绑定手机号" : "原手机号 " + maskPhone(oldPhone));
        return ApiResponse.ok();
    }

    /** 手机号掩码：日志里不留明文 */
    private static String maskPhone(String phone) {
        if (phone == null || phone.length() < 7) {
            return phone == null ? "" : phone;
        }
        return phone.substring(0, 3) + "****" + phone.substring(phone.length() - 4);
    }

    /** 账号级个人实名：保存身份证 OCR 信息为草稿，进入活体与公安核验流程。 */
    @PostMapping("/real-name")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<Map<String, Object>> saveRealName(@RequestBody RealNameRequest body, HttpServletRequest request) {
        long[] session = requireSession(request);
        String realName = trim(body == null ? null : body.getRealName());
        String idCard = trim(body == null ? null : body.getIdCard());
        String phone = trim(body == null ? null : body.getContactPhone());
        String address = trim(body == null ? null : body.getAddress());
        if (realName == null || idCard == null || phone == null || address == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "姓名、身份证号、联系电话和常住地址不能为空");
        }
        if (!phone.matches("^1[3-9]\\d{9}$")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "联系电话格式不正确");
        }
        String idNo = IdNumberUtil.validate(idCard);
        UserIdentityEntity latest = latestIdentity(session[0]);
        if (latest != null && "verified".equals(latest.getStatus())) {
            throw new BusinessException(ErrorCode.CONFLICT, "实名认证已通过，如需变更请联系平台运营");
        }
        String salt = latest == null || latest.getIdNoSalt() == null
                ? IdNumberUtil.newSalt() : latest.getIdNoSalt();
        String hash = IdNumberUtil.hash(idNo, salt);
        Long duplicate = identityMapper.selectCount(new LambdaQueryWrapper<UserIdentityEntity>()
                .eq(UserIdentityEntity::getIdNoHash, hash)
                .ne(UserIdentityEntity::getUserId, session[0]));
        if (duplicate != null && duplicate > 0) {
            throw new BusinessException(ErrorCode.CONFLICT, "该身份证号已绑定其他账号");
        }
        LocalDateTime now = LocalDateTime.now();
        UserIdentityEntity entity = latest;
        if (entity == null) {
            entity = new UserIdentityEntity();
            entity.setUserId(session[0]);
            entity.setMarketId(session[1]);
            entity.setIdentityNo("ID" + System.currentTimeMillis());
            entity.setCreatedAt(now);
        }
        entity.setRealName(realName);
        entity.setIdNoMasked(IdNumberUtil.mask(idNo));
        entity.setIdNoHash(hash);
        entity.setIdNoSalt(salt);
        entity.setContactPhone(phone);
        entity.setAddress(address);
        entity.setValidStart(trim(body.getValidStart()));
        entity.setValidEnd(trim(body.getValidEnd()));
        entity.setBusinessType(trim(body.getBusinessType()));
        entity.setEmail(trim(body.getEmail()));
        entity.setPoliceVerified(false);
        entity.setPoliceVerifiedAt(null);
        entity.setLivenessVerified(false);
        entity.setLivenessVerifiedAt(null);
        entity.setVerificationChannel(null);
        entity.setStatus("draft");
        entity.setSubmitTime(now);
        entity.setReviewerId(null);
        entity.setReviewerName(null);
        entity.setReviewTime(null);
        entity.setReviewRemark(null);
        entity.setUpdatedAt(now);
        if (entity.getId() == null) {
            identityMapper.insert(entity);
        } else {
            identityMapper.updateById(entity);
        }
        return ApiResponse.ok(identityView(entity));
    }

    /** 身份证 OCR 资料保存后的活体检测（开发态为模拟通道）。 */
    @PostMapping("/real-name/liveness")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<Map<String, Object>> verifyRealNameLiveness(HttpServletRequest request) {
        long[] session = requireSession(request);
        assertIdentityVerificationAvailable();
        UserIdentityEntity entity = requireDraftIdentity(session[0]);
        LocalDateTime now = LocalDateTime.now();
        entity.setLivenessVerified(true);
        entity.setLivenessVerifiedAt(now);
        entity.setVerificationChannel("公安二要素 + 活体");
        entity.setUpdatedAt(now);
        identityMapper.updateById(entity);
        return ApiResponse.ok(identityView(entity));
    }

    /** 活体通过后执行公安二要素比对：姓名和身份证号必须与 OCR 草稿一致。 */
    @PostMapping("/real-name/police")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<Map<String, Object>> verifyRealNamePolice(
            @RequestBody PoliceRequest body, HttpServletRequest request) {
        long[] session = requireSession(request);
        assertIdentityVerificationAvailable();
        UserIdentityEntity entity = requireDraftIdentity(session[0]);
        if (body == null || trim(body.getRealName()) == null || trim(body.getIdCard()) == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请填写姓名和身份证号");
        }
        String normalizedId = IdNumberUtil.validate(body.getIdCard());
        if (!body.getRealName().trim().equals(entity.getRealName())
                || !IdNumberUtil.hash(normalizedId, entity.getIdNoSalt()).equals(entity.getIdNoHash())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "姓名或身份证号与已保存的证件信息不一致");
        }
        LocalDateTime now = LocalDateTime.now();
        entity.setPoliceVerified(true);
        entity.setPoliceVerifiedAt(now);
        entity.setVerificationChannel("公安二要素 + 活体");
        entity.setUpdatedAt(now);
        identityMapper.updateById(entity);
        return ApiResponse.ok(identityView(entity));
    }

    /** 四项前置完成后提交运营审核。 */
    @PostMapping("/real-name/submit")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<Map<String, Object>> submitRealName(HttpServletRequest request) {
        long[] session = requireSession(request);
        UserIdentityEntity entity = requireDraftIdentity(session[0]);
        if (!Boolean.TRUE.equals(entity.getLivenessVerified())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请先完成人脸活体检测");
        }
        if (!Boolean.TRUE.equals(entity.getPoliceVerified())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请先完成公安二要素核验");
        }
        LocalDateTime now = LocalDateTime.now();
        entity.setStatus("pending");
        entity.setSubmitTime(now);
        entity.setReviewerId(null);
        entity.setReviewerName(null);
        entity.setReviewTime(null);
        entity.setReviewRemark(null);
        entity.setUpdatedAt(now);
        identityMapper.updateById(entity);
        return ApiResponse.ok(identityView(entity));
    }

    private void assertIdentityVerificationAvailable() {
        String verificationMode = identityVerificationMode == null
                ? "none" : identityVerificationMode.trim().toLowerCase(Locale.ROOT);
        if (!Set.of("dev", "sandbox").contains(verificationMode)) {
            throw new BusinessException(ErrorCode.BIZ_ERROR,
                    "实名核验服务尚未配置，无法完成人脸活体和公安二要素核验");
        }
    }

    private UserIdentityEntity requireDraftIdentity(Long userId) {
        UserIdentityEntity entity = latestIdentity(userId);
        if (entity == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请先保存实名认证资料");
        }
        if ("verified".equals(entity.getStatus())) {
            throw new BusinessException(ErrorCode.CONFLICT, "实名认证已通过，如需变更请联系平台运营");
        }
        if ("pending".equals(entity.getStatus())) {
            throw new BusinessException(ErrorCode.CONFLICT, "实名认证已提交审核，请等待审核结果");
        }
        return entity;
    }

    /* ==================== 身份申请 ==================== */

    /** 可申请的身份类型（对齐原型「可申请身份 共 6 类」） */
    private static final List<Map<String, Object>> IDENTITY_TYPES = List.of(
            identityType("wholesaler", "批发商"),
            identityType("retailer", "零售商"),
            identityType("farmer", "农户"),
            identityType("coop_admin", "合作社管理员"),
            identityType("service_provider", "服务商"),
            identityType("government", "政府人员"));

    private static Map<String, Object> identityType(String code, String label) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("code", code);
        row.put("label", label);
        return row;
    }

    /**
     * 我的身份申请列表（含已开通/审核中的身份状态）。
     *
     * <p>同时返回**全部 6 类身份**及其"当前状态"：没有申请过的显示 available，
     * 有申请单的显示单据状态 —— 页面据此渲染"去申请 / 审核中 / 已开通"。</p>
     */
    @GetMapping("/identity-applications")
    public ApiResponse<Map<String, Object>> identityApplications(HttpServletRequest request) {
        long[] session = requireSession(request);
        List<IdentityApplicationEntity> entities = identityApplicationMapper.selectList(
                new LambdaQueryWrapper<IdentityApplicationEntity>()
                        .eq(IdentityApplicationEntity::getUserId, session[0])
                        .orderByDesc(IdentityApplicationEntity::getCreatedAt)
                        .orderByDesc(IdentityApplicationEntity::getId));
        // 每类身份取最近一张单子
        Map<String, IdentityApplicationEntity> latest = new LinkedHashMap<>();
        for (IdentityApplicationEntity entity : entities) {
            latest.putIfAbsent(entity.getIdentityType(), entity);
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> type : IDENTITY_TYPES) {
            String code = String.valueOf(type.get("code"));
            IdentityApplicationEntity entity = latest.get(code);
            Map<String, Object> row = new LinkedHashMap<>(type);
            row.put("status", entity == null ? "available" : entity.getStatus());
            row.put("applicationId", entity == null ? null : String.valueOf(entity.getId()));
            row.put("applyNote", entity == null ? null : entity.getApplyNote());
            row.put("reviewRemark", entity == null ? null : entity.getReviewRemark());
            row.put("applyTime", entity == null || entity.getCreatedAt() == null
                    ? null : entity.getCreatedAt().toString());
            row.put("reviewTime", entity == null || entity.getReviewTime() == null
                    ? null : entity.getReviewTime().toString());
            rows.add(row);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("identities", rows);
        result.put("records", entities.stream().map(this::applicationView).toList());
        return ApiResponse.ok(result);
    }

    /** 提交身份申请 */
    @PostMapping("/identity-applications")
    public ApiResponse<Map<String, Object>> applyIdentity(@RequestBody IdentityApplicationRequest body,
                                                          HttpServletRequest request) {
        long[] session = requireSession(request);
        if (body == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请求体不能为空");
        }
        Set<String> validTypes = new LinkedHashSet<>();
        for (Map<String, Object> type : IDENTITY_TYPES) {
            validTypes.add(String.valueOf(type.get("code")));
        }
        String identityType = trim(body.identityType());
        if (identityType == null || !validTypes.contains(identityType)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "身份类型不正确：" + body.identityType());
        }
        String subjectName = trim(body.subjectName());
        if (subjectName == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请填写主体名称");
        }
        // 同一身份已有审核中的单子时不允许重复提交，避免运营端出现重复待审
        Long pending = identityApplicationMapper.selectCount(
                new LambdaQueryWrapper<IdentityApplicationEntity>()
                        .eq(IdentityApplicationEntity::getUserId, session[0])
                        .eq(IdentityApplicationEntity::getIdentityType, identityType)
                        .eq(IdentityApplicationEntity::getStatus, "pending"));
        if (pending != null && pending > 0) {
            throw new BusinessException(ErrorCode.CONFLICT, "该身份已有审核中的申请，请等待处理");
        }
        IdentityApplicationEntity entity = new IdentityApplicationEntity();
        entity.setUserId(session[0]);
        entity.setIdentityType(identityType);
        entity.setMerchantId(body.merchantId());
        entity.setSubjectName(subjectName);
        entity.setCreditCode(trim(body.creditCode()));
        entity.setBusinessPlace(trim(body.businessPlace()));
        entity.setBusinessCategory(trim(body.businessCategory()));
        entity.setAnnualVolume(trim(body.annualVolume()));
        entity.setContactName(trim(body.contactName()));
        entity.setContactPhone(trim(body.contactPhone()));
        entity.setApplyNote(trim(body.applyNote()));
        entity.setStatus("pending");
        identityApplicationMapper.insert(entity);
        operationLog.record(session[0], "identity_apply", "提交身份申请", subjectName, identityType);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", String.valueOf(entity.getId()));
        return ApiResponse.ok(result);
    }

    /** 撤回身份申请（仅 pending 可撤） */
    @DeleteMapping("/identity-applications/{id}")
    public ApiResponse<Void> cancelIdentityApplication(@PathVariable Long id, HttpServletRequest request) {
        long[] session = requireSession(request);
        IdentityApplicationEntity entity = identityApplicationMapper.selectById(id);
        // session[0] 是基本类型 long，不能调 .equals；先判空再比数值
        if (entity == null || entity.getUserId() == null || entity.getUserId() != session[0]) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "申请单不存在");
        }
        if (!"pending".equals(entity.getStatus())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "只有审核中的申请可以撤回");
        }
        entity.setStatus("cancelled");
        identityApplicationMapper.updateById(entity);
        operationLog.record(session[0], "identity_cancel", "撤回身份申请", entity.getSubjectName(),
                entity.getIdentityType());
        return ApiResponse.ok();
    }

    /** 申请单 → 页面结构 */
    private Map<String, Object> applicationView(IdentityApplicationEntity entity) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", String.valueOf(entity.getId()));
        row.put("identityType", entity.getIdentityType());
        row.put("subjectName", entity.getSubjectName());
        row.put("creditCode", entity.getCreditCode());
        row.put("businessPlace", entity.getBusinessPlace());
        row.put("businessCategory", entity.getBusinessCategory());
        row.put("annualVolume", entity.getAnnualVolume());
        row.put("contactName", entity.getContactName());
        row.put("contactPhone", entity.getContactPhone());
        row.put("applyNote", entity.getApplyNote());
        row.put("status", entity.getStatus());
        row.put("reviewerName", entity.getReviewerName());
        row.put("reviewRemark", entity.getReviewRemark());
        row.put("applyTime", entity.getCreatedAt() == null ? null : entity.getCreatedAt().toString());
        row.put("reviewTime", entity.getReviewTime() == null ? null : entity.getReviewTime().toString());
        return row;
    }

    /** 身份申请入参 */
    public record IdentityApplicationRequest(String identityType, Long merchantId, String subjectName,
                                             String creditCode, String businessPlace,
                                             String businessCategory, String annualVolume,
                                             String contactName, String contactPhone,
                                             String applyNote) {
    }

    /* ==================== 意见反馈 ==================== */

    /** 反馈类型目录（对齐原型「意见反馈」四类），由后端下发，前端不留第二份 */
    private static final List<Map<String, Object>> FEEDBACK_TYPES = List.of(
            feedbackType("suggestion", "功能建议"),
            feedbackType("bug", "问题报错"),
            feedbackType("complaint", "投诉举报"),
            feedbackType("other", "其他"));

    private static Map<String, Object> feedbackType(String code, String label) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("code", code);
        row.put("label", label);
        return row;
    }

    /** 我的反馈列表 + 类型目录 */
    @GetMapping("/feedback")
    public ApiResponse<Map<String, Object>> myFeedback(HttpServletRequest request) {
        long[] session = requireSession(request);
        List<UserFeedbackEntity> entities = userFeedbackMapper.selectList(
                new LambdaQueryWrapper<UserFeedbackEntity>()
                        .eq(UserFeedbackEntity::getUserId, session[0])
                        .orderByDesc(UserFeedbackEntity::getCreatedAt)
                        .orderByDesc(UserFeedbackEntity::getId));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("types", FEEDBACK_TYPES);
        result.put("records", entities.stream().map(this::feedbackView).toList());
        return ApiResponse.ok(result);
    }

    /**
     * 提交反馈。
     *
     * <p>标题与内容都必填：只写"有问题"的反馈运营没法处理，宁可提交时就拦下来。</p>
     */
    @PostMapping("/feedback")
    public ApiResponse<Map<String, Object>> submitFeedback(@RequestBody FeedbackRequest body,
                                                          HttpServletRequest request) {
        long[] session = requireSession(request);
        if (body == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请求体不能为空");
        }
        Set<String> validTypes = new LinkedHashSet<>();
        for (Map<String, Object> type : FEEDBACK_TYPES) {
            validTypes.add(String.valueOf(type.get("code")));
        }
        String feedbackType = trim(body.feedbackType());
        if (feedbackType == null) {
            feedbackType = "other";
        }
        if (!validTypes.contains(feedbackType)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "反馈类型不正确：" + body.feedbackType());
        }
        String title = trim(body.title());
        if (title == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请填写反馈标题");
        }
        if (title.length() > 120) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "标题最多 120 字");
        }
        String content = trim(body.content());
        if (content == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请填写反馈内容");
        }
        if (content.length() > 2000) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "反馈内容最多 2000 字");
        }
        UserFeedbackEntity entity = new UserFeedbackEntity();
        entity.setUserId(session[0]);
        entity.setFeedbackType(feedbackType);
        entity.setTitle(title);
        entity.setContent(content);
        entity.setContact(trim(body.contact()));
        entity.setPagePath(trim(body.pagePath()));
        entity.setStatus("pending");
        userFeedbackMapper.insert(entity);
        operationLog.record(session[0], "feedback_submit", "提交意见反馈", title, feedbackType);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", String.valueOf(entity.getId()));
        return ApiResponse.ok(result);
    }

    /** 反馈单 → 页面结构 */
    private Map<String, Object> feedbackView(UserFeedbackEntity entity) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", String.valueOf(entity.getId()));
        row.put("feedbackType", entity.getFeedbackType());
        row.put("title", entity.getTitle());
        row.put("content", entity.getContent());
        row.put("contact", entity.getContact());
        row.put("pagePath", entity.getPagePath());
        row.put("status", entity.getStatus());
        row.put("replyContent", entity.getReplyContent());
        row.put("replierName", entity.getReplierName());
        row.put("submitTime", entity.getCreatedAt() == null ? null : entity.getCreatedAt().toString());
        row.put("replyTime", entity.getReplyTime() == null ? null : entity.getReplyTime().toString());
        return row;
    }

    /** 提交反馈入参 */
    public record FeedbackRequest(String feedbackType, String title, String content,
                                  String contact, String pagePath) {
    }

    /* ==================== 跨模块入口 ==================== */

    /**
     * 子系统目录。
     *
     * <p><b>这里只声明"这个模块自己的页面需要什么"，不替模块做权限判断。</b>
     * 每个模块的 {@code requires} 都是本服务**真能判定**的前置条件，
     * 判定不了的一律写空数组（= 登录即可进），不编造门槛。</p>
     *
     * <p>{@code entryUrl} 是网关上的真实入口；同源的用相对路径（跟随当前域），
     * 独立端口的用绝对地址。改端口只改这一处。</p>
     */
    private static final List<Map<String, Object>> MODULES = List.of(
            module("prod", "生产管理", "种植计划、农事任务、采收与库存、溯源",
                    "/prod/index.html", "seed", List.of("merchant")),
            module("trade", "交易撮合", "发布供求、撮合下单、合同与结算",
                    "http://localhost:8086/", "cart", List.of("trade_identity")),
            module("finance", "供应链金融", "授信申请、仓单质押、还款计划",
                    "http://localhost:8081/", "money", List.of("merchant_verified")),
            module("iot", "物联网管理", "设备台账、实时监测、告警规则",
                    "http://localhost:8101/", "cpu", List.of("merchant")),
            module("info", "资讯服务", "价格行情、政策资讯、产业报告",
                    "http://localhost:8104/", "file", List.of()),
            module("mall", "农产品商城", "自营与第三方商品、订单与售后",
                    "http://localhost:8082/", "box", List.of()));

    private static Map<String, Object> module(String code, String name, String description,
                                              String entryUrl, String icon, List<String> requires) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("code", code);
        row.put("name", name);
        row.put("description", description);
        row.put("entryUrl", entryUrl);
        row.put("icon", icon);
        row.put("requires", requires);
        return row;
    }

    /** 前置条件的用户可读名称 */
    private static final Map<String, String> REQUIREMENT_LABEL = Map.of(
            "merchant", "需要已加入经营主体",
            "merchant_verified", "需要经营主体认证通过",
            "personal_verified", "需要个人实名认证通过",
            "business_identity", "需要已开通业务身份（批发商 / 零售商 / 农户等）",
            "trade_identity", "需要已开通交易类业务身份（批发商 / 零售商 / 农户 / 合作社管理员）");

    /**
     * 我的跨模块入口。
     *
     * <p>每个模块给出三态：</p>
     * <ul>
     *   <li>{@code available} —— 前置条件全部满足</li>
     *   <li>{@code partial}   —— 能进，但部分功能会受限（例如没开通业务身份也能浏览商品，
     *       但发不了供求）；{@code missing} 里写明缺什么</li>
     *   <li>{@code blocked}   —— 缺关键前置，进去也做不了事</li>
     * </ul>
     *
     * <p>判定依据全部来自本服务已有的真实数据：个人实名状态、主体列表与认证状态、
     * 已通过的身份申请。**没有依据的模块不设门槛**，而不是拍一个"看起来合理"的条件。</p>
     */
    @GetMapping("/modules")
    public ApiResponse<Map<String, Object>> modules(HttpServletRequest request) {
        long[] session = requireSession(request);
        UserEntity user = userMapper.selectById(session[0]);

        // 个人实名
        UserIdentityEntity identity = identityMapper.selectOne(
                new LambdaQueryWrapper<UserIdentityEntity>()
                        .eq(UserIdentityEntity::getUserId, session[0])
                        .orderByDesc(UserIdentityEntity::getId)
                        .last("LIMIT 1"));
        boolean personalVerified = identity != null && "verified".equals(identity.getStatus());

        // 经营主体（有效绑定 + 认证状态）
        List<UserMerchantEntity> bindings = userMerchantMapper.selectList(
                new LambdaQueryWrapper<UserMerchantEntity>()
                        .eq(UserMerchantEntity::getUserId, session[0])
                        .eq(UserMerchantEntity::getStatus, 1));
        boolean hasMerchant = !bindings.isEmpty();
        boolean merchantVerified = false;
        for (UserMerchantEntity binding : bindings) {
            MerchantCertificationEntity cert = certificationMapper.selectOne(
                    new LambdaQueryWrapper<MerchantCertificationEntity>()
                            .eq(MerchantCertificationEntity::getMerchantId, binding.getMerchantId())
                            .orderByDesc(MerchantCertificationEntity::getId)
                            .last("LIMIT 1"));
            // 注意：企业认证的状态字段是 certStatus（不是 status），个人实名才是 status
            if (cert != null && "approved".equals(cert.getCertStatus())) {
                merchantVerified = true;
                break;
            }
        }

        // 已开通的业务身份（按身份类型取集合：交易模块只认交易类身份）
        java.util.Set<String> approvedIdentityTypes = identityApplicationMapper.selectList(
                        new LambdaQueryWrapper<IdentityApplicationEntity>()
                                .eq(IdentityApplicationEntity::getUserId, session[0])
                                .eq(IdentityApplicationEntity::getStatus, "approved"))
                .stream()
                .map(IdentityApplicationEntity::getIdentityType)
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        boolean hasBusinessIdentity = !approvedIdentityTypes.isEmpty();
        boolean hasTradeIdentity = approvedIdentityTypes.stream()
                .anyMatch(java.util.Set.of("wholesaler", "retailer", "farmer", "coop_admin")::contains);

        Map<String, Boolean> satisfied = new LinkedHashMap<>();
        satisfied.put("merchant", hasMerchant);
        satisfied.put("merchant_verified", merchantVerified);
        satisfied.put("personal_verified", personalVerified);
        satisfied.put("business_identity", hasBusinessIdentity);
        satisfied.put("trade_identity", hasTradeIdentity);

        List<Map<String, Object>> rows = new ArrayList<>();
        int availableCount = 0;
        for (Map<String, Object> template : MODULES) {
            @SuppressWarnings("unchecked")
            List<String> requires = (List<String>) template.get("requires");
            List<String> missing = new ArrayList<>();
            for (String requirement : requires) {
                if (!Boolean.TRUE.equals(satisfied.get(requirement))) {
                    missing.add(requirement);
                }
            }
            Map<String, Object> row = new LinkedHashMap<>(template);
            // 有硬前置缺失即 blocked；没有前置的模块天然 available
            String state = missing.isEmpty() ? "available" : "blocked";
            row.put("state", state);
            row.put("missing", missing);
            List<String> missingLabels = new ArrayList<>();
            for (String requirement : missing) {
                missingLabels.add(REQUIREMENT_LABEL.getOrDefault(requirement, requirement));
            }
            row.put("missingLabels", missingLabels);
            if ("available".equals(state)) {
                availableCount++;
            }
            rows.add(row);
        }

        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("personalVerified", personalVerified);
        profile.put("hasMerchant", hasMerchant);
        profile.put("merchantVerified", merchantVerified);
        profile.put("hasBusinessIdentity", hasBusinessIdentity);
        profile.put("hasTradeIdentity", hasTradeIdentity);
        profile.put("accountName", user == null ? null
                : (user.getNickname() == null ? user.getUsername() : user.getNickname()));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("profile", profile);
        result.put("modules", rows);
        result.put("availableCount", availableCount);
        result.put("total", rows.size());
        return ApiResponse.ok(result);
    }

    /* ==================== 业务能力 ==================== */

    /**
     * 我的业务能力：身份审核通过后会在这里变成 granted。
     *
     * <p>能力的来源只有一个：**已审核通过的业务身份**（映射见 {@code BusinessCapabilities}）。
     * 业务模块用同一张映射做前置校验，所以这里看到的 granted 与接口是否放行是同一口径，
     * 不会出现"页面显示已开通、接口还是 403"。</p>
     */
    @GetMapping("/capabilities")
    public ApiResponse<Map<String, Object>> capabilities(HttpServletRequest request) {
        long[] session = requireSession(request);
        List<IdentityApplicationEntity> rows = identityApplicationMapper.selectList(
                new LambdaQueryWrapper<IdentityApplicationEntity>()
                        .eq(IdentityApplicationEntity::getUserId, session[0])
                        .orderByDesc(IdentityApplicationEntity::getId));
        Map<String, String> latestStatus = new LinkedHashMap<>();
        for (IdentityApplicationEntity row : rows) {
            latestStatus.putIfAbsent(row.getIdentityType(), row.getStatus());
        }
        List<Map<String, Object>> list = new ArrayList<>();
        int grantedCount = 0;
        for (BusinessCapabilities.Definition definition : BusinessCapabilities.all()) {
            CapabilityFacade.Decision decision = capabilityFacade.check(session[0], definition.code(), null);
            String identityStatus = definition.identityCode().isEmpty()
                    ? "derived" : latestStatus.getOrDefault(definition.identityCode(), "available");
            boolean granted = decision.granted();
            if (granted) {
                grantedCount++;
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("code", definition.code());
            item.put("label", definition.label());
            item.put("identityCode", definition.identityCode());
            item.put("identityLabel", definition.identityLabel());
            item.put("description", definition.description());
            item.put("identityStatus", identityStatus);
            item.put("granted", granted);
            item.put("reason", decision.reason());
            list.add(item);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("capabilities", list);
        result.put("grantedCount", grantedCount);
        result.put("total", list.size());
        return ApiResponse.ok(result);
    }

    /* ==================== 二次验证（TOTP） ==================== */

    /**
     * 我的二次验证状态。
     *
     * <p>只回状态与剩余备用码数量，**不回密钥、不回备用码内容** ——
     * 密钥一旦签发就不该再被读出来，备用码只在生成时显示一次。</p>
     */
    @GetMapping("/mfa")
    public ApiResponse<Map<String, Object>> mfaStatus(HttpServletRequest request) {
        long[] session = requireSession(request);
        UserMfaEntity entity = mfaService.find(session[0]);
        boolean enabled = entity != null && "active".equals(entity.getStatus());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("enabled", enabled);
        result.put("status", entity == null ? "none" : entity.getStatus());
        result.put("enabledAt", entity == null || entity.getEnabledAt() == null
                ? null : entity.getEnabledAt().toString());
        result.put("lastUsedAt", entity == null || entity.getLastUsedAt() == null
                ? null : entity.getLastUsedAt().toString());
        result.put("remainingRecoveryCodes", enabled ? mfaService.remainingRecoveryCodes(session[0]) : 0);
        return ApiResponse.ok(result);
    }

    /**
     * 开始设置二次验证：生成密钥并返回 otpauth 链接。
     *
     * <p>此时**还没启用** —— 必须调 confirm 输一次正确的码才生效，
     * 否则扫码失败的人会被锁在门外。</p>
     */
    @PostMapping("/mfa/setup")
    public ApiResponse<Map<String, Object>> mfaSetup(HttpServletRequest request) {
        long[] session = requireSession(request);
        UserEntity user = userMapper.selectById(session[0]);
        String account = user == null ? String.valueOf(session[0])
                : (user.getUsername() == null ? String.valueOf(session[0]) : user.getUsername());
        Map<String, Object> result = mfaService.startSetup(session[0], account);
        operationLog.record(session[0], "mfa_setup", "生成二次验证密钥", account, null);
        return ApiResponse.ok(result);
    }

    /** 确认启用：校验一次验证码，通过后返回备用码（**仅此一次**） */
    @PostMapping("/mfa/confirm")
    public ApiResponse<Map<String, Object>> mfaConfirm(@RequestBody MfaCodeRequest body,
                                                      HttpServletRequest request) {
        long[] session = requireSession(request);
        if (body == null || body.code() == null || body.code().isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请输入验证器上的 6 位验证码");
        }
        List<String> recoveryCodes = mfaService.confirm(session[0], body.code());
        operationLog.record(session[0], "mfa_enable", "启用二次验证", null, null);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("recoveryCodes", recoveryCodes);
        return ApiResponse.ok(result);
    }

    /** 停用：必须再验一次码（TOTP 或备用码），防止会话被拿到就关掉 2FA */
    @PostMapping("/mfa/disable")
    public ApiResponse<Void> mfaDisable(@RequestBody MfaCodeRequest body, HttpServletRequest request) {
        long[] session = requireSession(request);
        if (body == null || body.code() == null || body.code().isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请输入验证码或备用码");
        }
        mfaService.disable(session[0], body.code());
        operationLog.record(session[0], "mfa_disable", "停用二次验证", null, null);
        return ApiResponse.ok();
    }

    /** 重新生成备用码（旧的立即作废） */
    @PostMapping("/mfa/recovery-codes")
    public ApiResponse<Map<String, Object>> mfaRecoveryCodes(@RequestBody MfaCodeRequest body,
                                                             HttpServletRequest request) {
        long[] session = requireSession(request);
        if (body == null || body.code() == null || body.code().isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请输入验证码或备用码");
        }
        List<String> codes = mfaService.regenerateRecoveryCodes(session[0], body.code());
        operationLog.record(session[0], "mfa_recovery", "重新生成备用码", null, null);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("recoveryCodes", codes);
        return ApiResponse.ok(result);
    }

    /** 二次验证入参 */
    public record MfaCodeRequest(String code) {
    }

    /* ==================== 授权管理 ==================== */

    /**
     * 授权清单：谁、用什么方式在代表我访问平台。
     *
     * <p><b>不新建授权表</b>，全部复用已有数据源 —— 另建一份"授权表"必然与真实状态不一致：</p>
     * <ul>
     *   <li>第三方渠道授权 ← {@code platform_user_binding}（与「第三方绑定」「隐私与数据」同源）</li>
     *   <li>活跃登录会话 ← {@code SsoSessionService}（与「登录设备」同源）</li>
     *   <li>业务身份授权 ← 已通过的 {@code platform_identity_application}</li>
     *   <li>主体成员身份 ← {@code user_merchant}（我在各主体里是 owner 还是 member）</li>
     * </ul>
     *
     * <p><b>本页不做细粒度权限配置</b>：角色 → 菜单/操作的映射属于主体的 RBAC，
     * 由「我的角色与权限」维护（数据在生产域）。这里只回答"我有哪些对外授权"，
     * 避免出现第二套权限配置入口、两边改出不一致。</p>
     */
    @GetMapping("/authorizations")
    public ApiResponse<Map<String, Object>> authorizations(HttpServletRequest request) {
        long[] session = requireSession(request);
        String currentSid = sessionService.currentSid(request);

        /* 1) 第三方渠道授权 */
        List<Map<String, Object>> channels = new ArrayList<>();
        List<UserBindingEntity> bindings = userBindingMapper.selectList(
                new LambdaQueryWrapper<UserBindingEntity>()
                        .eq(UserBindingEntity::getUserId, session[0])
                        .eq(UserBindingEntity::getBindStatus, "bound")
                        .orderByDesc(UserBindingEntity::getId));
        for (UserBindingEntity binding : bindings) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("provider", binding.getProvider());
            row.put("label", providerLabel(binding.getProvider()));
            row.put("externalAccount", binding.getExternalAccount());
            row.put("displayName", binding.getDisplayName());
            row.put("boundAt", binding.getBindAt() == null ? null : binding.getBindAt().toString());
            channels.add(row);
        }

        /* 2) 活跃登录会话 */
        List<Map<String, Object>> sessions = sessionService.listSessions(session[0], currentSid);

        /* 3) 已开通的业务身份 */
        List<Map<String, Object>> identities = new ArrayList<>();
        Map<String, String> typeLabels = new LinkedHashMap<>();
        for (Map<String, Object> type : IDENTITY_TYPES) {
            typeLabels.put(String.valueOf(type.get("code")), String.valueOf(type.get("label")));
        }
        List<IdentityApplicationEntity> approvedApps = identityApplicationMapper.selectList(
                new LambdaQueryWrapper<IdentityApplicationEntity>()
                        .eq(IdentityApplicationEntity::getUserId, session[0])
                        .eq(IdentityApplicationEntity::getStatus, "approved")
                        .orderByDesc(IdentityApplicationEntity::getReviewTime));
        Set<String> seenTypes = new LinkedHashSet<>();
        for (IdentityApplicationEntity app : approvedApps) {
            // 同一身份可能有多张历史单，只展示最近一张
            if (!seenTypes.add(app.getIdentityType())) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("code", app.getIdentityType());
            row.put("label", typeLabels.getOrDefault(app.getIdentityType(), app.getIdentityType()));
            row.put("reviewTime", app.getReviewTime() == null ? null : app.getReviewTime().toString());
            row.put("reviewerName", app.getReviewerName());
            identities.add(row);
        }

        /* 4) 主体成员身份（我在各主体里以什么角色参与） */
        List<Map<String, Object>> memberships = new ArrayList<>();
        Long activeMerchantId = activeMerchantService.resolve(session[0], session[1]);
        List<UserMerchantEntity> bindingsOfMerchant = userMerchantMapper.selectList(
                new LambdaQueryWrapper<UserMerchantEntity>()
                        .eq(UserMerchantEntity::getUserId, session[0])
                        .eq(UserMerchantEntity::getStatus, 1));
        for (UserMerchantEntity membership : bindingsOfMerchant) {
            MerchantEntity merchant = merchantMapper.selectById(membership.getMerchantId());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("merchantId", String.valueOf(membership.getMerchantId()));
            row.put("merchantName", merchant == null ? null : merchant.getName());
            row.put("roleInMerchant", membership.getRoleInMerchant());
            row.put("roleLabel", "owner".equals(membership.getRoleInMerchant()) ? "负责人" : "成员");
            // 当前正在使用的主体：与「账号总览」同一口径，由 ActiveMerchantService 解析
            row.put("active", activeMerchantId != null
                    && activeMerchantId.equals(membership.getMerchantId()));
            memberships.add(row);
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("channelCount", channels.size());
        summary.put("sessionCount", sessions.size());
        summary.put("identityCount", identities.size());
        summary.put("membershipCount", memberships.size());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("summary", summary);
        result.put("channels", channels);
        result.put("sessions", sessions);
        result.put("identities", identities);
        result.put("memberships", memberships);
        return ApiResponse.ok(result);
    }

    /** 第三方渠道的中文名（与「第三方绑定」页保持一致） */
    private String providerLabel(String provider) {
        if (provider == null) {
            return "未知渠道";
        }
        return switch (provider) {
            case "wechat" -> "微信";
            case "alipay" -> "支付宝";
            case "dingtalk" -> "钉钉";
            default -> provider;
        };
    }

    /* ==================== 帮助中心 ==================== */

    /**
     * 平台使用常见问题。
     *
     * <p><b>这些答案描述的都是系统当前的真实行为</b>，不是营销话术：</p>
     * <ul>
     *   <li>「短信/推送未接入」对应通知设置页只有站内信生效；</li>
     *   <li>「身份审核不改权限」对应 {@code IdentityApplicationAdminController} 只改单据状态；</li>
     *   <li>「注销不会立即生效」对应 {@code PrivacyRequestAdminController} 不执行删除；</li>
     *   <li>「订单按主体归属」对应交易域从令牌推导范围。</li>
     * </ul>
     *
     * <p>所以这份内容要跟着行为改：**改了行为忘了改这里，就等于对用户撒谎**。
     * 放在代码里而不是数据库里，是为了让它跟实现一起被 review。</p>
     */
    private static final List<Map<String, Object>> HELP_FAQS = List.of(
            helpGroup("账号与登录", List.of(
                    helpQa("换个浏览器就要重新登录，正常吗？",
                            "正常。访问令牌只保存在当前标签页，刷新页面靠 HttpOnly 刷新凭证续签；"
                                    + "不同浏览器各自独立。想确认当前有哪些登录中的会话，去「登录设备」查看，可单台下线或退出其他设备。",
                            "devices"),
                    helpQa("「登录设备」里为什么看不到完整 IP 和设备信息？",
                            "页面只展示来源 IP 与浏览器标识的摘要，对外仅暴露会话标识的哈希前 12 位 —— "
                                    + "展示越完整，泄露后被人冒用的风险越大。"))),
            helpGroup("实名与主体认证", List.of(
                    helpQa("个人实名和企业认证有什么区别？",
                            "个人实名证明「你是你」（身份证 + 公安比对 / 活体）；企业认证证明「你代表这家主体」。"
                                    + "两者独立，互不替代：借款要企业认证，个人实名用于账号安全与合规留痕。"),
                    helpQa("主体认证一直在审核中，会影响我用系统吗？",
                            "不影响登录和浏览。但供应链金融要求主体认证通过；生产管理、物联网需要已加入经营主体。"
                                    + "具体每个模块缺什么，见「跨模块入口」。",
                            "crossModule"))),
            helpGroup("身份与权限", List.of(
                    helpQa("业务身份审核通过后，是不是就能用所有功能了？",
                            "不是。身份申请审核**只改单据状态**，不会自动改主体绑定，也不会自动开通 RBAC 权限 —— "
                                    + "否则就是「审核一次静默授权」，权限来源无法追溯。对应权限请到「我的角色与权限」配置。",
                            "roles"),
                    helpQa("为什么同一身份不能重复提交申请？",
                            "已有审核中的申请时，重复提交会被拒绝（409），避免运营端出现一串重复待办。"
                                    + "想改材料可以先撤回再重新提交。",
                            "identityApply"))),
            helpGroup("订单与交易", List.of(
                    helpQa("我确实下过单，为什么「订单聚合」里是空的？",
                            "订单按**经营主体**归属，不是按登录账号。账号还没绑定主体，或者下单时用的是另一个主体，"
                                    + "这里就查不到。先去「跨模块入口」看当前主体状态。",
                            "crossModule"),
                    helpQa("为什么只看到交易订单，看不到服务预约单和商城订单？",
                            "目前只聚合能可靠归属到当前账号的来源。服务预约单表里没有账号或主体字段，"
                                    + "商城订单的消费者 id 与平台账号尚未打通 —— 这两类没有纳入，"
                                    + "接入会得到「看起来是我的、其实是别人的」结果，所以宁可不接。"))),
            helpGroup("消息与通知", List.of(
                    helpQa("通知设置里勾了短信和推送，为什么收不到？",
                            "短信与推送渠道**尚未接入**，当前只有站内信真正生效。页面上的「未接入」标注就是这个意思，"
                                    + "勾选只是先记下你的偏好，接入后按此生效。",
                            "notification"),
                    helpQa("订单、告警类的通知为什么一条都没有？",
                            "这两类消息源暂未接入用户中心，站内信目前只覆盖加入申请、身份申请与反馈回复等节点。"
                                    + "没有的消息就是没有，不会用假数据凑数。",
                            "messages"))),
            helpGroup("隐私与数据", List.of(
                    helpQa("提交「账号注销」后，账号会立即消失吗？",
                            "不会。提交只是**收单**，运营会先核对未结清交易、未到期合同、主体负责人身份，"
                                    + "办结后才实际注销。系统不会在提交时删除任何数据。",
                            "privacy"),
                    helpQa("数据导出多久能拿到？",
                            "运营在 5 个工作日内处理并交付；办结后「隐私与数据」页会显示处理说明。"
                                    + "导出需要跨多个业务库取数，不是点一下就能生成文件。",
                            "privacy"))),
            helpGroup("反馈与其他", List.of(
                    helpQa("反馈提交后在哪里看回复？",
                            "「意见反馈」页，回复内容直接显示在对应单据下面，不依赖站内信 —— "
                                    + "站内信会被用户删掉，反馈单不会，回头查得到平台怎么答复的。",
                            "feedback"),
                    helpQa("哪些操作会被记入「操作日志」？",
                            "登录、改密、换手机、改资料、绑定/解绑第三方、改通知设置、下线设备，"
                                    + "以及提交身份申请、意见反馈、隐私与数据申请等。日志只返回本人记录。",
                            "logs"))));

    private static Map<String, Object> helpGroup(String category, List<Map<String, Object>> items) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("category", category);
        row.put("items", items);
        return row;
    }

    private static Map<String, Object> helpQa(String question, String answer, String relatedView) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("question", question);
        row.put("answer", answer);
        row.put("relatedView", relatedView);
        return row;
    }

    /** 没有对应页面可跳的问答 */
    private static Map<String, Object> helpQa(String question, String answer) {
        return helpQa(question, answer, null);
    }

    /**
     * 可查阅的资料入口。
     *
     * <p>内容本身在资讯域（`/api/v1/info/public/*`），这里只给入口，不搬运正文 ——
     * 用户中心不该成为资讯的第二个副本。</p>
     */
    private static final List<Map<String, Object>> HELP_RESOURCES = List.of(
            helpResource("knowledge", "农业知识库", "病虫害、营养管理、栽培技术的条目式知识",
                    "#/info/knowledge"),
            helpResource("training", "培训课程", "平台操作与生产技能的课程",
                    "#/info/training"),
            helpResource("reports", "产业报告", "行情分析与产业研究报告",
                    "#/info/reports"),
            helpResource("news", "政策与资讯", "政策法规、行业动态",
                    "#/info"));

    private static Map<String, Object> helpResource(String code, String name, String description,
                                                    String entryUrl) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("code", code);
        row.put("name", name);
        row.put("description", description);
        row.put("entryUrl", entryUrl);
        return row;
    }

    /** 帮助中心：常见问题 + 资料入口 + 找不到答案时的出口 */
    @GetMapping("/help")
    public ApiResponse<Map<String, Object>> help(HttpServletRequest request) {
        requireSession(request);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("faqs", HELP_FAQS);
        result.put("resources", HELP_RESOURCES);
        result.put("faqCount", HELP_FAQS.stream()
                .mapToInt(group -> ((List<?>) group.get("items")).size()).sum());
        Map<String, Object> contact = new LinkedHashMap<>();
        contact.put("title", "没找到答案？");
        contact.put("description", "把问题描述清楚，运营回复后会显示在「意见反馈」里");
        contact.put("entryView", "feedback");
        result.put("contact", contact);
        return ApiResponse.ok(result);
    }

    /* ==================== 订单聚合 ==================== */

    /**
     * 订单来源清单。
     *
     * <p><b>这里只列"哪些域的订单能按当前账号归属"，不搬运订单数据。</b>
     * 订单明细由前端直接调各域自己的接口（交易域 `/api/trade/order/page` 会从令牌推导
     * 当前账号名下主体范围），用户中心**不转发、也不缓存**别人的单据 ——
     * 一旦在中间层做聚合查询，就很容易变成"谁的都能查"。</p>
     *
     * <p>为什么只接入交易域：</p>
     * <ul>
     *   <li><b>交易域</b>：`agri_trade_order` 有 `buyer_id` / `seller_id`（主体维度），
     *       且接口能从令牌推导范围 —— 能可靠回答"我的订单"。</li>
     *   <li><b>服务域</b>：`service_order` 表只有 `contact_name` / `contact_phone`，
     *       <b>没有账号或主体字段</b>，按手机号猜归属会把别人的单子算进来，所以不接。</li>
     *   <li><b>商城域</b>：`s2b2c_order.consumer_id` 是商城自己的消费者 id，
     *       与平台账号尚未打通，接入会得到"看起来是我的、其实是别人的"结果。</li>
     * </ul>
     *
     * <p>宁可少聚合一个域，也不能给出一份归属不明的订单列表。</p>
     */
    private static final List<Map<String, Object>> ORDER_SOURCES = List.of(
            orderSource("trade", "交易撮合", true, "/api/trade/order/page",
                    "我作为买方或卖方的交易订单，范围由交易域从令牌推导",
                    null),
            orderSource("service", "农业服务", false, null,
                    "预约服务订单",
                    "service_order 表没有账号/主体字段，无法判断哪些单属于当前账号；"
                            + "补 user_id 或 merchant_id 后可接入"),
            orderSource("mall", "农产品商城", false, null,
                    "商城零售订单",
                    "s2b2c_order.consumer_id 是商城消费者 id，与平台账号未打通；打通后可接入"));

    private static Map<String, Object> orderSource(String code, String name, boolean enabled,
                                                   String endpoint, String description, String reason) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("code", code);
        row.put("name", name);
        row.put("enabled", enabled);
        row.put("endpoint", endpoint);
        row.put("description", description);
        row.put("reason", reason);
        return row;
    }

    /** 订单聚合的来源清单 + 状态口径（由后端下发，前端不维护第二份） */
    @GetMapping("/orders/sources")
    public ApiResponse<Map<String, Object>> orderSources(HttpServletRequest request) {
        requireSession(request);
        // 状态口径按交易域真实取值给出，不臆造"待付款/待发货"这种交易域没有的状态
        List<Map<String, Object>> statuses = new ArrayList<>();
        statuses.add(orderStatus("pending_confirm", "待确认"));
        statuses.add(orderStatus("shipped", "已发货"));
        statuses.add(orderStatus("received", "已收货"));
        statuses.add(orderStatus("refunded", "已退款"));
        statuses.add(orderStatus("cancelled", "已取消"));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sources", ORDER_SOURCES);
        result.put("statuses", statuses);
        result.put("enabledCount", ORDER_SOURCES.stream()
                .filter(row -> Boolean.TRUE.equals(row.get("enabled"))).count());
        return ApiResponse.ok(result);
    }

    private static Map<String, Object> orderStatus(String code, String label) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("code", code);
        row.put("label", label);
        return row;
    }

    /* ==================== 隐私与数据 ==================== */

    /**
     * 可提交的隐私请求类型。
     *
     * <p>只有两类需要走审批：「数据导出」「账号注销」。两者都要动跨库数据或连带处理主体归属，
     * 系统里能自动做的只有收单与流转状态 —— 页面必须把这点写明，不能让人以为点一下就已经办完。</p>
     *
     * <p>「授权撤回」不在此列：解绑第三方渠道是立刻生效的真实动作，
     * 直接调 {@code DELETE /sso/account/bindings/{provider}} 即可，不需要审批。</p>
     */
    private static final List<Map<String, Object>> PRIVACY_TYPES = List.of(
            privacyType("export", "数据导出",
                    "打包你在平台的账号资料、主体信息、经营与交易记录，由运营在 5 个工作日内交付"),
            privacyType("deletion", "账号注销",
                    "注销后账号将无法登录。存在未结清交易、未到期合同或主体负责人身份时，运营会先与你确认"));

    private static Map<String, Object> privacyType(String code, String label, String description) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("code", code);
        row.put("label", label);
        row.put("description", description);
        return row;
    }

    /**
     * 我的隐私请求 + 类型目录 + 可撤回的第三方授权。
     *
     * <p>授权撤回所需的数据直接取 `platform_user_binding`，与「第三方绑定」页同源，
     * 不另建一份"授权表"—— 否则两边状态迟早不一致。</p>
     */
    @GetMapping("/privacy-requests")
    public ApiResponse<Map<String, Object>> privacyRequests(HttpServletRequest request) {
        long[] session = requireSession(request);
        List<PrivacyRequestEntity> entities = privacyRequestMapper.selectList(
                new LambdaQueryWrapper<PrivacyRequestEntity>()
                        .eq(PrivacyRequestEntity::getUserId, session[0])
                        .orderByDesc(PrivacyRequestEntity::getCreatedAt)
                        .orderByDesc(PrivacyRequestEntity::getId));
        List<Map<String, Object>> rows = new ArrayList<>();
        for (PrivacyRequestEntity entity : entities) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", String.valueOf(entity.getId()));
            row.put("requestType", entity.getRequestType());
            row.put("reason", entity.getReason());
            row.put("scope", entity.getScope());
            row.put("status", entity.getStatus());
            row.put("handlerName", entity.getHandlerName());
            row.put("handleRemark", entity.getHandleRemark());
            row.put("submitTime", entity.getCreatedAt() == null ? null : entity.getCreatedAt().toString());
            row.put("handleTime", entity.getHandleTime() == null ? null : entity.getHandleTime().toString());
            rows.add(row);
        }
        // 已绑定的第三方渠道（撤回授权的入口）。注意字段名是 bindStatus/bindAt，不是 status/createdAt
        List<UserBindingEntity> bindings = userBindingMapper.selectList(
                new LambdaQueryWrapper<UserBindingEntity>()
                        .eq(UserBindingEntity::getUserId, session[0])
                        .eq(UserBindingEntity::getBindStatus, "bound"));
        List<Map<String, Object>> grants = new ArrayList<>();
        for (UserBindingEntity binding : bindings) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("provider", binding.getProvider());
            row.put("externalAccount", binding.getExternalAccount());
            row.put("displayName", binding.getDisplayName());
            row.put("boundAt", binding.getBindAt() == null ? null : binding.getBindAt().toString());
            grants.add(row);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("types", PRIVACY_TYPES);
        result.put("records", rows);
        result.put("grants", grants);
        return ApiResponse.ok(result);
    }

    /**
     * 提交隐私请求（数据导出 / 账号注销）。
     *
     * <p>同类请求已有未办结的单子时拒绝重复提交 —— 否则运营端会看到一串重复待办。</p>
     */
    @PostMapping("/privacy-requests")
    public ApiResponse<Map<String, Object>> submitPrivacyRequest(@RequestBody PrivacyRequest body,
                                                                HttpServletRequest request) {
        long[] session = requireSession(request);
        if (body == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请求体不能为空");
        }
        Set<String> validTypes = new LinkedHashSet<>();
        for (Map<String, Object> type : PRIVACY_TYPES) {
            validTypes.add(String.valueOf(type.get("code")));
        }
        String requestType = trim(body.requestType());
        if (requestType == null || !validTypes.contains(requestType)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请求类型不正确：" + body.requestType());
        }
        String reason = trim(body.reason());
        if (reason != null && reason.length() > 500) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "申请理由最多 500 字");
        }
        // 注销必须写明理由：这是不可逆操作，运营需要据此判断能否办理
        if ("deletion".equals(requestType) && reason == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "注销申请请填写理由");
        }
        Long open = privacyRequestMapper.selectCount(
                new LambdaQueryWrapper<PrivacyRequestEntity>()
                        .eq(PrivacyRequestEntity::getUserId, session[0])
                        .eq(PrivacyRequestEntity::getRequestType, requestType)
                        .in(PrivacyRequestEntity::getStatus, "pending", "processing"));
        if (open != null && open > 0) {
            throw new BusinessException(ErrorCode.CONFLICT, "该申请已在处理中，请等待办结");
        }
        PrivacyRequestEntity entity = new PrivacyRequestEntity();
        entity.setUserId(session[0]);
        entity.setRequestType(requestType);
        entity.setReason(reason);
        entity.setScope(trim(body.scope()));
        entity.setStatus("pending");
        privacyRequestMapper.insert(entity);
        operationLog.record(session[0], "privacy_request", "提交隐私与数据申请",
                "deletion".equals(requestType) ? "账号注销" : "数据导出", reason);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", String.valueOf(entity.getId()));
        return ApiResponse.ok(result);
    }

    /** 撤回隐私请求（仅 pending 可撤） */
    @DeleteMapping("/privacy-requests/{id}")
    public ApiResponse<Void> cancelPrivacyRequest(@PathVariable Long id, HttpServletRequest request) {
        long[] session = requireSession(request);
        PrivacyRequestEntity entity = privacyRequestMapper.selectById(id);
        if (entity == null || entity.getUserId() == null || entity.getUserId() != session[0]) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "申请单不存在");
        }
        if (!"pending".equals(entity.getStatus())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "只有待处理的申请可以撤回");
        }
        entity.setStatus("cancelled");
        privacyRequestMapper.updateById(entity);
        operationLog.record(session[0], "privacy_cancel", "撤回隐私与数据申请",
                entity.getRequestType(), null);
        return ApiResponse.ok();
    }

    /** 隐私请求入参 */
    public record PrivacyRequest(String requestType, String reason, String scope) {
    }

    /* ==================== 资质证照 ==================== */

    /** 证照类型目录（两端共用一份） */
    private static final List<Map<String, Object>> CERT_TYPES = List.of(
            certType("business_license", "营业执照"),
            certType("food_production", "食品生产许可证"),
            certType("food_business", "食品经营许可证"),
            certType("organic", "有机认证"),
            certType("gmo_free", "非转基因证明"),
            certType("other", "其他资质"));

    private static Map<String, Object> certType(String code, String label) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("code", code);
        row.put("label", label);
        return row;
    }

    /**
     * 当前账号可管理的主体证照列表。
     *
     * @param merchantId 主体 ID；为空时返回**我名下全部主体**的证照
     */
    @GetMapping("/certificates")
    public ApiResponse<Map<String, Object>> certificates(
            @RequestParam(required = false) Long merchantId,
            HttpServletRequest request) {
        long[] session = requireSession(request);
        List<Long> mine = merchantIdsOfUser(session[0]);
        if (mine.isEmpty()) {
            Map<String, Object> empty = new LinkedHashMap<>();
            empty.put("records", List.of());
            empty.put("types", CERT_TYPES);
            empty.put("expiringCount", 0);
            empty.put("expiredCount", 0);
            return ApiResponse.ok(empty);
        }
        LambdaQueryWrapper<MerchantCertificateEntity> wrapper =
                new LambdaQueryWrapper<MerchantCertificateEntity>()
                        .in(MerchantCertificateEntity::getMerchantId,
                                merchantId == null ? mine : List.of(merchantId))
                        .eq(MerchantCertificateEntity::getStatus, "active")
                        .orderByAsc(MerchantCertificateEntity::getExpireDate);
        // 指定了不属于自己的主体，直接按空结果处理（不暴露"该主体存在但你没权限"）
        if (merchantId != null && !mine.contains(merchantId)) {
            wrapper.in(MerchantCertificateEntity::getMerchantId, List.of(-1L));
        }
        List<MerchantCertificateEntity> entities = merchantCertificateMapper.selectList(wrapper);
        Map<Long, String> merchantNames = new LinkedHashMap<>();
        for (MerchantEntity merchant : merchantMapper.selectBatchIds(
                entities.stream().map(MerchantCertificateEntity::getMerchantId).distinct().toList())) {
            merchantNames.put(merchant.getId(), merchant.getName());
        }
        LocalDate today = LocalDate.now();
        List<Map<String, Object>> rows = new ArrayList<>();
        int expiring = 0;
        int expired = 0;
        for (MerchantCertificateEntity entity : entities) {
            String expireState = expireStateOf(entity.getExpireDate(), today);
            if ("expiring".equals(expireState)) {
                expiring++;
            } else if ("expired".equals(expireState)) {
                expired++;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", String.valueOf(entity.getId()));
            row.put("merchantId", String.valueOf(entity.getMerchantId()));
            row.put("merchantName", merchantNames.get(entity.getMerchantId()));
            row.put("certType", entity.getCertType());
            row.put("certName", entity.getCertName());
            row.put("certNo", entity.getCertNo());
            row.put("issueOrg", entity.getIssueOrg());
            row.put("issueDate", entity.getIssueDate() == null ? null : entity.getIssueDate().toString());
            row.put("expireDate", entity.getExpireDate() == null ? null : entity.getExpireDate().toString());
            row.put("expireState", expireState);
            row.put("daysToExpire", entity.getExpireDate() == null ? null
                    : java.time.temporal.ChronoUnit.DAYS.between(today, entity.getExpireDate()));
            row.put("fileUrl", entity.getFileUrl());
            row.put("remark", entity.getRemark());
            rows.add(row);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("records", rows);
        result.put("types", CERT_TYPES);
        result.put("expiringCount", expiring);
        result.put("expiredCount", expired);
        return ApiResponse.ok(result);
    }

    /** 新增证照 */
    @PostMapping("/certificates")
    public ApiResponse<Map<String, Object>> createCertificate(@RequestBody CertificateRequest body,
                                                              HttpServletRequest request) {
        long[] session = requireSession(request);
        MerchantCertificateEntity entity = new MerchantCertificateEntity();
        applyCertificate(entity, body, session[0]);
        merchantCertificateMapper.insert(entity);
        operationLog.record(session[0], "certificate_create", "新增资质证照",
                entity.getCertName(), entity.getCertNo());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", String.valueOf(entity.getId()));
        return ApiResponse.ok(result);
    }

    /** 修改证照 */
    @PutMapping("/certificates/{id}")
    public ApiResponse<Void> updateCertificate(@PathVariable Long id,
                                               @RequestBody CertificateRequest body,
                                               HttpServletRequest request) {
        long[] session = requireSession(request);
        MerchantCertificateEntity entity = requireOwnCertificate(id, session[0]);
        String previousFileUrl = entity.getFileUrl();
        applyCertificate(entity, body, session[0]);
        merchantCertificateMapper.updateById(entity);
        operationLog.record(session[0], "certificate_update", "修改资质证照",
                entity.getCertName(), entity.getCertNo());
        if (previousFileUrl != null && !previousFileUrl.equals(entity.getFileUrl())) {
            releaseCertificateFile(entity.getMerchantId(), previousFileUrl);
        }
        return ApiResponse.ok();
    }

    /** 删除证照（逻辑删除） */
    @DeleteMapping("/certificates/{id}")
    public ApiResponse<Void> deleteCertificate(@PathVariable Long id, HttpServletRequest request) {
        long[] session = requireSession(request);
        MerchantCertificateEntity entity = requireOwnCertificate(id, session[0]);
        String fileUrl = entity.getFileUrl();
        merchantCertificateMapper.deleteById(id);
        operationLog.record(session[0], "certificate_delete", "删除资质证照",
                entity.getCertName(), entity.getCertNo());
        releaseCertificateFile(entity.getMerchantId(), fileUrl);
        return ApiResponse.ok();
    }

    /**
     * 证照删除 / 换图后的影像件清理。
     *
     * <p>先查还有没有别的有效证照引用同一个地址（同一张图理论上可能被多条证照引用），
     * 没有才删文件；清理是尽力而为，失败不影响证照删除结果。</p>
     */
    private void releaseCertificateFile(Long merchantId, String fileUrl) {
        if (merchantId == null || fileUrl == null || fileUrl.isBlank()) {
            return;
        }
        Long stillUsed = merchantCertificateMapper.selectCount(new LambdaQueryWrapper<MerchantCertificateEntity>()
                .eq(MerchantCertificateEntity::getFileUrl, fileUrl)
                .eq(MerchantCertificateEntity::getStatus, "active"));
        if (stillUsed != null && stillUsed > 0) {
            return;
        }
        certificationFileService.deleteOwnedFile(merchantId, MerchantCertificationFileService.CERTIFICATE, fileUrl);
    }

    /** 取出并校验证照归属：必须是自己主体的证照 */
    private MerchantCertificateEntity requireOwnCertificate(Long id, Long userId) {
        MerchantCertificateEntity entity = merchantCertificateMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "证照不存在");
        }
        if (!merchantIdsOfUser(userId).contains(entity.getMerchantId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "无权操作该主体的证照");
        }
        return entity;
    }

    /** 入参 → 实体（含校验） */
    private void applyCertificate(MerchantCertificateEntity entity, CertificateRequest body, Long userId) {
        if (body == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请求体不能为空");
        }
        Long merchantId = body.merchantId();
        if (merchantId == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请选择所属主体");
        }
        if (!merchantIdsOfUser(userId).contains(merchantId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "无权为该主体维护证照");
        }
        Set<String> validTypes = new LinkedHashSet<>();
        for (Map<String, Object> type : CERT_TYPES) {
            validTypes.add(String.valueOf(type.get("code")));
        }
        String certType = trim(body.certType());
        if (certType == null || !validTypes.contains(certType)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "证照类型不正确：" + body.certType());
        }
        String certName = trim(body.certName());
        if (certName == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请填写证照名称");
        }
        LocalDate issueDate = parseDate(body.issueDate(), "发证日期");
        LocalDate expireDate = parseDate(body.expireDate(), "有效期至");
        if (issueDate != null && expireDate != null && expireDate.isBefore(issueDate)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "有效期不能早于发证日期");
        }
        // 影像件只接受本服务上传后生成的受控地址：任意外链一律拒绝，
        // 否则"证照地址"会变成一个能存任意 URL 的字段。
        String fileUrl = trim(body.fileUrl());
        if (fileUrl != null) {
            certificationFileService.requireOwnedUrl(merchantId, MerchantCertificationFileService.CERTIFICATE, fileUrl);
        }
        entity.setMerchantId(merchantId);
        entity.setCertType(certType);
        entity.setCertName(certName);
        entity.setCertNo(trim(body.certNo()));
        entity.setIssueOrg(trim(body.issueOrg()));
        entity.setIssueDate(issueDate);
        entity.setExpireDate(expireDate);
        entity.setFileUrl(fileUrl);
        entity.setRemark(trim(body.remark()));
        entity.setStatus("active");
    }

    /** yyyy-MM-dd 解析；空值返回 null，格式不对 400 */
    private static LocalDate parseDate(String raw, String field) {
        String text = trim(raw);
        if (text == null) {
            return null;
        }
        try {
            return LocalDate.parse(text);
        } catch (RuntimeException e) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, field + " 格式应为 yyyy-MM-dd：" + text);
        }
    }

    /**
     * 到期状态：30 天内到期算 expiring，已过期算 expired。
     *
     * <p>现算而不是存库：存下来的状态今天对、明天就错了。</p>
     */
    private static String expireStateOf(LocalDate expireDate, LocalDate today) {
        if (expireDate == null) {
            return "permanent";
        }
        long days = java.time.temporal.ChronoUnit.DAYS.between(today, expireDate);
        if (days < 0) {
            return "expired";
        }
        return days <= 30 ? "expiring" : "valid";
    }

    /** 证照入参 */
    public record CertificateRequest(Long merchantId, String certType, String certName, String certNo,
                                     String issueOrg, String issueDate, String expireDate,
                                     String fileUrl, String remark) {
    }

    /* ==================== 操作日志 ==================== */

    /**
     * 当前账号的操作日志（分页）。
     *
     * <p>只返回**本人**的记录：这里不是运维审计台，用户不该看到别人的操作。
     * 支持按动作编码筛选，供页面上的"全部 / 仅安全类"这类切换使用。</p>
     *
     * @param action 动作编码，为空表示全部
     */
    @GetMapping("/operation-logs")
    public ApiResponse<Map<String, Object>> operationLogs(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String action,
            HttpServletRequest request) {
        long[] session = requireSession(request);
        int p = Math.max(pageNum, 1);
        int size = Math.min(Math.max(pageSize, 1), 100);
        LambdaQueryWrapper<UserOperationLogEntity> wrapper = new LambdaQueryWrapper<UserOperationLogEntity>()
                .eq(UserOperationLogEntity::getUserId, session[0])
                .eq(action != null && !action.isBlank() && !"all".equalsIgnoreCase(action),
                        UserOperationLogEntity::getAction, action)
                .orderByDesc(UserOperationLogEntity::getCreatedAt)
                .orderByDesc(UserOperationLogEntity::getId);
        com.baomidou.mybatisplus.extension.plugins.pagination.Page<UserOperationLogEntity> result =
                userOperationLogMapper.selectPage(
                        new com.baomidou.mybatisplus.extension.plugins.pagination.Page<>(p, size), wrapper);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (UserOperationLogEntity entity : result.getRecords()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", String.valueOf(entity.getId()));
            row.put("action", entity.getAction());
            row.put("actionLabel", entity.getActionLabel());
            row.put("target", entity.getTarget());
            row.put("detail", entity.getDetail());
            row.put("ip", entity.getIp());
            row.put("result", entity.getResult());
            row.put("createdAt", entity.getCreatedAt() == null ? null : entity.getCreatedAt().toString());
            rows.add(row);
        }
        Map<String, Object> page = new LinkedHashMap<>();
        page.put("records", rows);
        page.put("total", result.getTotal());
        page.put("page", p);
        page.put("size", size);
        return ApiResponse.ok(page);
    }

    /* ==================== 通知设置 ==================== */

    /**
     * 通知类型目录（两端共用一份，避免前端自己再维护一套）。
     *
     * <p>{@code produces} 表示"这个类型现在真的会产生消息"：
     * join_request / audit_result 已由加入申请流程接入 MessageFacade；
     * order / alert / system 属预留 —— 对应域还没接消息门面，配了也不会收到，
     * 页面必须把这点标出来，否则用户会以为配了就生效。</p>
     */
    private static final List<Map<String, Object>> NOTIFY_TYPES = List.of(
            notifyType("join_request", "加入申请", true),
            notifyType("audit_result", "审核结果", true),
            notifyType("order", "订单与交易", false),
            notifyType("alert", "告警提醒", false),
            notifyType("system", "系统公告", false));

    /** 通知渠道：只有站内信已接入 */
    private static final List<Map<String, Object>> NOTIFY_CHANNELS = List.of(
            notifyChannel("inapp", "站内信", true),
            notifyChannel("sms", "短信", false),
            notifyChannel("push", "推送", false));

    private static Map<String, Object> notifyType(String code, String label, boolean produces) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("code", code);
        row.put("label", label);
        row.put("produces", produces);
        return row;
    }

    private static Map<String, Object> notifyChannel(String code, String label, boolean wired) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("code", code);
        row.put("label", label);
        row.put("wired", wired);
        return row;
    }

    /**
     * 读取通知设置。
     *
     * <p>没有记录时返回**默认值**而不是空对象：用户第一次进来就能看到一份合理的默认配置，
     * 页面上也不用区分"没配过"和"全关掉"这两种状态。</p>
     */
    @GetMapping("/notification-settings")
    public ApiResponse<Map<String, Object>> notificationSettings(HttpServletRequest request) {
        long[] session = requireSession(request);
        NotificationSettingEntity entity = notificationSettingMapper.selectOne(
                new LambdaQueryWrapper<NotificationSettingEntity>()
                        .eq(NotificationSettingEntity::getUserId, session[0])
                        .last("LIMIT 1"));
        boolean persisted = entity != null;
        String inapp = persisted ? entity.getInappTypes() : "join_request,audit_result";
        String sms = persisted ? entity.getSmsTypes() : "";
        String push = persisted ? entity.getPushTypes() : "";
        Set<String> inappSet = csvSet(inapp);
        Set<String> smsSet = csvSet(sms);
        Set<String> pushSet = csvSet(push);

        List<Map<String, Object>> types = new ArrayList<>();
        for (Map<String, Object> type : NOTIFY_TYPES) {
            String code = String.valueOf(type.get("code"));
            Map<String, Object> row = new LinkedHashMap<>(type);
            row.put("inapp", inappSet.contains(code));
            row.put("sms", smsSet.contains(code));
            row.put("push", pushSet.contains(code));
            types.add(row);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("persisted", persisted);
        result.put("types", types);
        result.put("channels", NOTIFY_CHANNELS);
        result.put("quietStart", persisted ? entity.getQuietStart() : null);
        result.put("quietEnd", persisted ? entity.getQuietEnd() : null);
        result.put("digest", persisted ? entity.getDigest() : "realtime");
        return ApiResponse.ok(result);
    }

    /** 保存通知设置（无记录则新建）。 */
    @PutMapping("/notification-settings")
    public ApiResponse<Void> saveNotificationSettings(@RequestBody NotificationSettingRequest body,
                                                      HttpServletRequest request) {
        long[] session = requireSession(request);
        if (body == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请求体不能为空");
        }
        String digest = trim(body.digest()) == null ? "realtime" : trim(body.digest()).toLowerCase(Locale.ROOT);
        if (!List.of("realtime", "daily", "weekly").contains(digest)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "推送频率只能是 realtime / daily / weekly");
        }
        String quietStart = normalizeClock(body.quietStart(), "免打扰开始");
        String quietEnd = normalizeClock(body.quietEnd(), "免打扰结束");
        // 只允许配置目录里存在的类型，避免前端塞进未知编码后永远不生效又查不出原因
        Set<String> validCodes = new LinkedHashSet<>();
        for (Map<String, Object> type : NOTIFY_TYPES) {
            validCodes.add(String.valueOf(type.get("code")));
        }
        String inapp = joinKnown(body.inappTypes(), validCodes);
        String sms = joinKnown(body.smsTypes(), validCodes);
        String push = joinKnown(body.pushTypes(), validCodes);

        NotificationSettingEntity entity = notificationSettingMapper.selectOne(
                new LambdaQueryWrapper<NotificationSettingEntity>()
                        .eq(NotificationSettingEntity::getUserId, session[0])
                        .last("LIMIT 1"));
        boolean created = entity == null;
        if (created) {
            entity = new NotificationSettingEntity();
            entity.setUserId(session[0]);
        }
        entity.setInappTypes(inapp);
        entity.setSmsTypes(sms);
        entity.setPushTypes(push);
        entity.setQuietStart(quietStart);
        entity.setQuietEnd(quietEnd);
        entity.setDigest(digest);
        if (created) {
            notificationSettingMapper.insert(entity);
        } else {
            notificationSettingMapper.updateById(entity);
        }
        operationLog.record(session[0], "notify_update", "更新通知设置", digest,
                "站内信：" + (inapp.isEmpty() ? "全关" : inapp));
        return ApiResponse.ok();
    }

    /** 逗号串 → 集合 */
    private static Set<String> csvSet(String csv) {
        Set<String> set = new LinkedHashSet<>();
        if (csv == null || csv.isBlank()) {
            return set;
        }
        for (String part : csv.split(",")) {
            String value = part.trim();
            if (!value.isEmpty()) {
                set.add(value);
            }
        }
        return set;
    }

    /** 过滤掉未知编码后重新拼成逗号串 */
    private static String joinKnown(List<String> values, Set<String> valid) {
        if (values == null) {
            return "";
        }
        Set<String> kept = new LinkedHashSet<>();
        for (String value : values) {
            String code = value == null ? null : value.trim();
            if (code != null && valid.contains(code)) {
                kept.add(code);
            }
        }
        return String.join(",", kept);
    }

    /**
     * 校验并规整 HH:mm。
     *
     * <p>空值原样返回 null（表示不启用免打扰）；格式不对直接 400，
     * 不"猜一个看起来合理的时刻"存进去。</p>
     */
    private static String normalizeClock(String raw, String field) {
        String text = trim(raw);
        if (text == null) {
            return null;
        }
        if (!text.matches("^([01]\\d|2[0-3]):[0-5]\\d$")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, field + " 格式应为 HH:mm：" + text);
        }
        return text;
    }

    /** 通知设置入参 */
    public record NotificationSettingRequest(List<String> inappTypes, List<String> smsTypes,
                                             List<String> pushTypes, String quietStart,
                                             String quietEnd, String digest) {
    }

    /* ==================== 第三方账号绑定 ==================== */

    /** 支持的第三方渠道（与页面下拉保持一致） */
    private static final Map<String, String> BINDING_PROVIDERS = Map.of(
            "wechat", "微信",
            "alipay", "支付宝",
            "dingtalk", "钉钉");

    /**
     * 当前账号的第三方绑定列表。
     *
     * <p>返回**全部渠道**（含未绑定的），页面据此渲染"已绑定 / 去绑定"两种状态 ——
     * 只返回已绑定的记录会让前端无法知道还有哪些渠道可以绑。</p>
     */
    @GetMapping("/bindings")
    public ApiResponse<List<Map<String, Object>>> bindings(HttpServletRequest request) {
        long[] session = requireSession(request);
        Map<String, UserBindingEntity> bound = new LinkedHashMap<>();
        for (UserBindingEntity entity : userBindingMapper.selectList(
                new LambdaQueryWrapper<UserBindingEntity>()
                        .eq(UserBindingEntity::getUserId, session[0])
                        .eq(UserBindingEntity::getBindStatus, "bound"))) {
            bound.put(entity.getProvider(), entity);
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        BINDING_PROVIDERS.forEach((provider, label) -> {
            UserBindingEntity entity = bound.get(provider);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("provider", provider);
            row.put("providerLabel", label);
            row.put("bound", entity != null);
            row.put("externalAccount", entity == null ? null : entity.getExternalAccount());
            row.put("displayName", entity == null ? null : entity.getDisplayName());
            row.put("bindAt", entity == null || entity.getBindAt() == null ? null : entity.getBindAt().toString());
            rows.add(row);
        });
        return ApiResponse.ok(rows);
    }

    /**
     * 绑定（或改绑）第三方账号。
     *
     * <p><b>本部署未接入第三方 OAuth</b>：这里登记的是外部账号标识，不发起授权跳转。
     * 同一渠道重复绑定视为改绑（覆盖标识），不会产生多条记录。</p>
     */
    @PostMapping("/bindings")
    public ApiResponse<Map<String, Object>> bind(@RequestBody BindingRequest body,
                                                 HttpServletRequest request) {
        long[] session = requireSession(request);
        if (body == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请求体不能为空");
        }
        String provider = trim(body.provider()) == null ? null : trim(body.provider()).toLowerCase(Locale.ROOT);
        if (provider == null || !BINDING_PROVIDERS.containsKey(provider)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "不支持的第三方渠道：" + body.provider());
        }
        String account = trim(body.externalAccount());
        if (account == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请填写外部账号标识");
        }
        if (account.length() > 128) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "外部账号标识过长（上限 128 字符）");
        }
        UserBindingEntity entity = userBindingMapper.selectOne(new LambdaQueryWrapper<UserBindingEntity>()
                .eq(UserBindingEntity::getUserId, session[0])
                .eq(UserBindingEntity::getProvider, provider)
                .last("LIMIT 1"));
        boolean created = entity == null;
        if (created) {
            entity = new UserBindingEntity();
            entity.setUserId(session[0]);
            entity.setProvider(provider);
        }
        entity.setExternalAccount(account);
        entity.setDisplayName(trim(body.displayName()));
        entity.setBindStatus("bound");
        entity.setBindAt(LocalDateTime.now());
        entity.setUnbindAt(null);
        entity.setRemark(trim(body.remark()));
        if (created) {
            userBindingMapper.insert(entity);
        } else {
            userBindingMapper.updateById(entity);
        }
        operationLog.record(session[0], "binding_bind",
                created ? "绑定第三方账号" : "改绑第三方账号",
                BINDING_PROVIDERS.get(provider), entity.getExternalAccount());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("provider", provider);
        result.put("providerLabel", BINDING_PROVIDERS.get(provider));
        result.put("externalAccount", entity.getExternalAccount());
        result.put("created", created);
        return ApiResponse.ok(result);
    }

    /** 解除绑定（逻辑删除 + 状态置 unbound，保留留痕）。 */
    @DeleteMapping("/bindings/{provider}")
    public ApiResponse<Void> unbind(@PathVariable String provider, HttpServletRequest request) {
        long[] session = requireSession(request);
        String key = provider == null ? "" : provider.trim().toLowerCase(Locale.ROOT);
        UserBindingEntity entity = userBindingMapper.selectOne(new LambdaQueryWrapper<UserBindingEntity>()
                .eq(UserBindingEntity::getUserId, session[0])
                .eq(UserBindingEntity::getProvider, key)
                .eq(UserBindingEntity::getBindStatus, "bound")
                .last("LIMIT 1"));
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "该渠道尚未绑定");
        }
        entity.setBindStatus("unbound");
        entity.setUnbindAt(LocalDateTime.now());
        userBindingMapper.updateById(entity);
        operationLog.record(session[0], "binding_unbind", "解绑第三方账号",
                BINDING_PROVIDERS.getOrDefault(key, key), entity.getExternalAccount());
        return ApiResponse.ok();
    }

    /** 绑定入参 */
    public record BindingRequest(String provider, String externalAccount, String displayName, String remark) {
    }

    /* ==================== 登录设备 / 会话 ==================== */

    /**
     * 当前账号的登录设备列表。
     *
     * <p>会话真身在 Redis，这里只返回设备名、IP、登录时间与「是否本机」。
     * **不返回原始 sid** —— 那是浏览器里的凭据，泄露等于把会话送人；
     * 对外用 {@code SHA-256(sid)} 前 12 位作为行标识。</p>
     */
    @GetMapping("/sessions")
    public ApiResponse<Map<String, Object>> sessions(HttpServletRequest request) {
        long[] session = requireSession(request);
        String currentSid = sessionService.currentSid(request);
        List<Map<String, Object>> rows = sessionService.listSessions(session[0], currentSid);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", rows.size());
        result.put("records", rows);
        return ApiResponse.ok(result);
    }

    /** 下线指定设备（吊销单个会话）。 */
    @DeleteMapping("/sessions/{sessionKey}")
    public ApiResponse<Void> revokeSession(@PathVariable String sessionKey, HttpServletRequest request) {
        long[] session = requireSession(request);
        if (!sessionService.revokeSession(session[0], sessionKey)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "该登录设备不存在或已下线");
        }
        operationLog.record(session[0], "session_revoke", "下线登录设备", sessionKey, null);
        return ApiResponse.ok();
    }

    /** 退出其他所有设备（保留当前会话）。 */
    @DeleteMapping("/sessions")
    public ApiResponse<Map<String, Object>> revokeOtherSessions(HttpServletRequest request) {
        long[] session = requireSession(request);
        int revoked = sessionService.revokeOthers(session[0], sessionService.currentSid(request));
        operationLog.record(session[0], "session_revoke", "下线登录设备", "其他设备",
                "共下线 " + revoked + " 台");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("revoked", revoked);
        return ApiResponse.ok(result);
    }

    @GetMapping("/addresses")
    public ApiResponse<List<Map<String, Object>>> addresses(HttpServletRequest request) {
        return ApiResponse.ok(addressRows(requireSession(request)[0]));
    }

    @PostMapping("/addresses")
    public ApiResponse<Map<String, Object>> createAddress(@RequestBody AddressRequest body,
                                                          HttpServletRequest request) {
        long[] session = requireSession(request);
        validateAddress(body);
        UserAddressEntity entity = new UserAddressEntity();
        entity.setUserId(session[0]);
        entity.setMarketId(session[1]);
        copyAddress(body, entity);
        if (body.getIsDefault() == null) {
            entity.setIsDefault(addressRows(session[0]).isEmpty() ? 1 : 0);
        }
        if (Integer.valueOf(1).equals(entity.getIsDefault())) {
            clearDefaultAddress(session[0]);
        }
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        addressMapper.insert(entity);
        return ApiResponse.ok(addressView(entity));
    }

    @PutMapping("/addresses/{id}")
    public ApiResponse<Map<String, Object>> updateAddress(@PathVariable Long id,
                                                          @RequestBody AddressRequest body,
                                                          HttpServletRequest request) {
        long[] session = requireSession(request);
        UserAddressEntity entity = requireAddress(id, session[0]);
        validateAddress(body);
        copyAddress(body, entity);
        if (Integer.valueOf(1).equals(body.getIsDefault())) {
            clearDefaultAddress(session[0]);
            entity.setIsDefault(1);
        }
        entity.setUpdatedAt(LocalDateTime.now());
        addressMapper.updateById(entity);
        return ApiResponse.ok(addressView(entity));
    }

    @DeleteMapping("/addresses/{id}")
    public ApiResponse<Void> deleteAddress(@PathVariable Long id, HttpServletRequest request) {
        long[] session = requireSession(request);
        UserAddressEntity entity = requireAddress(id, session[0]);
        addressMapper.deleteById(entity.getId());
        if (Integer.valueOf(1).equals(entity.getIsDefault())) {
            List<UserAddressEntity> remaining = addressMapper.selectList(
                    new LambdaQueryWrapper<UserAddressEntity>()
                            .eq(UserAddressEntity::getUserId, session[0])
                            .orderByDesc(UserAddressEntity::getIsDefault)
                            .orderByDesc(UserAddressEntity::getUpdatedAt));
            if (!remaining.isEmpty()) {
                UserAddressEntity next = remaining.get(0);
                next.setIsDefault(1);
                next.setUpdatedAt(LocalDateTime.now());
                addressMapper.updateById(next);
            }
        }
        return ApiResponse.ok();
    }

    @PostMapping("/addresses/{id}/default")
    public ApiResponse<Void> setDefaultAddress(@PathVariable Long id, HttpServletRequest request) {
        long[] session = requireSession(request);
        UserAddressEntity entity = requireAddress(id, session[0]);
        clearDefaultAddress(session[0]);
        entity.setIsDefault(1);
        entity.setUpdatedAt(LocalDateTime.now());
        addressMapper.updateById(entity);
        return ApiResponse.ok();
    }

    /** 搜索可申请加入的经营主体（不返回联系方式与证件原文）。 */
    @GetMapping("/businesses/search")
    public ApiResponse<List<Map<String, Object>>> searchBusinesses(@RequestParam String keyword,
                                                                   HttpServletRequest request) {
        long[] session = requireSession(request);
        String value = trim(keyword);
        if (value == null || value.length() < 2) {
            return ApiResponse.ok(List.of());
        }
        List<MerchantEntity> merchants = merchantMapper.selectList(new LambdaQueryWrapper<MerchantEntity>()
                .eq(MerchantEntity::getStatus, 1)
                .and(w -> w.like(MerchantEntity::getName, value)
                        .or().like(MerchantEntity::getCode, value)
                        .or().like(MerchantEntity::getCreditCode, value))
                .last("LIMIT 20"));
        List<Long> mine = merchantIdsOfUser(session[0]);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (MerchantEntity merchant : merchants) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("merchantId", String.valueOf(merchant.getId()));
            row.put("name", merchant.getName());
            row.put("type", merchant.getType());
            row.put("memberType", merchant.getMemberType());
            row.put("industry", merchant.getIndustry());
            row.put("verifyStatus", merchant.getVerifyStatus());
            row.put("creditCodeMasked", maskCreditCode(merchant.getCreditCode()));
            row.put("alreadyJoined", mine.contains(merchant.getId()));
            rows.add(row);
        }
        return ApiResponse.ok(rows);
    }

    /** 已登录账号创建新的企业或个人经营主体。 */
    @PostMapping("/businesses")
    public ApiResponse<Void> createBusiness(@RequestBody CreateBusinessRequest body,
                                            HttpServletRequest request) {
        long[] session = requireSession(request);
        UserEntity user = requireUser(session[0]);
        if (body == null || body.getIdentity() == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请选择主体类型");
        }
        String identity = body.getIdentity().trim().toLowerCase();
        String address = trim(body.getAddress());
        String contactName = trim(body.getContactName());
        String contactPhone = trim(body.getContactPhone()) == null
                ? user.getPhone() : trim(body.getContactPhone());
        if (contactName == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "联系人姓名不能为空");
        }
        SmsAuthService.SubjectProfile profile = new SmsAuthService.SubjectProfile(
                identity,
                trim(body.getCompanyName()),
                trim(body.getCreditCode()),
                trim(body.getIndustry()),
                trim(body.getCompanySize()),
                address,
                trim(body.getRealName()),
                trim(body.getIdCard()),
                trim(body.getBusinessType()),
                contactName,
                contactPhone,
                trim(body.getLegalPerson()),
                trim(body.getLicenseNo()),
                trim(body.getAttachNote()),
                trim(body.getValidStart()),
                trim(body.getValidEnd()),
                trim(body.getEmail()));
        smsAuthService.createAdditionalSubject(user.getId(), session[1], profile);
        return ApiResponse.ok();
    }

    /** 切换当前登录主体。一个账号可绑定多家，但任一时刻只允许一家处于登录态。 */
    @PostMapping("/businesses/{merchantId}/activate")
    public ApiResponse<Map<String, Object>> activateBusiness(@PathVariable Long merchantId,
                                                             HttpServletRequest request) {
        long[] session = requireSession(request);
        MerchantEntity merchant = activeMerchantService.switchTo(session[0], session[1], merchantId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("activeMerchantId", String.valueOf(merchant.getId()));
        result.put("merchantName", merchant.getName());
        return ApiResponse.ok(result);
    }

    /** 将指定企业主体当前草稿/驳回认证提交为待审核。 */
    @PostMapping("/businesses/{merchantId}/submit-certification")
    public ApiResponse<Void> submitEnterpriseCertification(@PathVariable Long merchantId,
                                                           @RequestBody(required = false) CertificationSubmitRequest body,
                                                           HttpServletRequest request) {
        long[] session = requireSession(request);
        if (!merchantIdsOfUser(session[0]).contains(merchantId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "无权认证该经营主体");
        }
        MerchantEntity merchant = merchantMapper.selectById(merchantId);
        if (merchant == null || "personal".equalsIgnoreCase(merchant.getMemberType())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "该主体不是企业主体");
        }
        String companyName = trim(body == null ? null : body.getCompanyName());
        String creditCode = trim(body == null ? null : body.getCreditCode());
        String legalPerson = trim(body == null ? null : body.getLegalPerson());
        String contactName = trim(body == null ? null : body.getContactName());
        String contactPhone = trim(body == null ? null : body.getContactPhone());
        String licenseNo = trim(body == null ? null : body.getLicenseNo());
        String attachNote = trim(body == null ? null : body.getAttachNote());
        String businessLicenseUrl = certificationFileService.requireOwnedUrl(merchantId,
                MerchantCertificationFileService.BUSINESS_LICENSE,
                body == null ? null : body.getBusinessLicenseUrl());
        String legalPersonFaceUrl = certificationFileService.requireOwnedUrl(merchantId,
                MerchantCertificationFileService.LEGAL_PERSON_FACE,
                body == null ? null : body.getLegalPersonFaceUrl());
        String transferProofUrl = certificationFileService.requireOwnedUrl(merchantId,
                MerchantCertificationFileService.CORPORATE_TRANSFER_PROOF,
                body == null ? null : body.getCorporateTransferProofUrl());
        String legalPersonIdFrontUrl = optionalOwnedUrl(merchantId,
                MerchantCertificationFileService.LEGAL_PERSON_ID_FRONT,
                body == null ? null : body.getLegalPersonIdFrontUrl());
        String legalPersonIdBackUrl = optionalOwnedUrl(merchantId,
                MerchantCertificationFileService.LEGAL_PERSON_ID_BACK,
                body == null ? null : body.getLegalPersonIdBackUrl());
        if (companyName == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "企业认证必须填写企业名称");
        }
        if (creditCode == null || !creditCode.matches("[0-9A-Za-z]{15,18}")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "统一社会信用代码应为 15-18 位字母数字");
        }
        if (legalPerson == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "企业认证必须填写法定代表人");
        }
        if (contactName == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "企业认证必须填写联系人姓名");
        }
        if (contactPhone == null || !contactPhone.matches("^1[3-9]\\d{9}$")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "企业认证联系电话格式不正确");
        }
        String bankName = trim(body == null ? null : body.getCorporateBankName());
        String bankAccount = trim(body == null ? null : body.getCorporateBankAccount());
        String transferAmount = trim(body == null ? null : body.getCorporateTransferAmount());
        String transferReference = trim(body == null ? null : body.getCorporateTransferReference());
        if (bankName == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请填写对公账户户名");
        }
        if (bankAccount == null || !bankAccount.matches("[0-9 ]{8,32}")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请填写有效的对公账户账号");
        }
        if (transferAmount == null || !transferAmount.matches("\\d{1,3}(\\.\\d{1,2})?")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "对公打款金额格式不正确");
        }
        if (transferReference == null || transferReference.length() < 6) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请填写对公打款流水号");
        }
        Long duplicateCredit = merchantMapper.selectCount(new LambdaQueryWrapper<MerchantEntity>()
                .eq(MerchantEntity::getCreditCode, creditCode)
                .ne(MerchantEntity::getId, merchantId));
        if (duplicateCredit != null && duplicateCredit > 0) {
            throw new BusinessException(ErrorCode.CONFLICT, "该统一社会信用代码已绑定其他经营主体");
        }
        MerchantCertificationEntity cert = certificationMapper.selectOne(
                new LambdaQueryWrapper<MerchantCertificationEntity>()
                        .eq(MerchantCertificationEntity::getMerchantId, merchantId)
                        .orderByDesc(MerchantCertificationEntity::getId)
                        .last("LIMIT 1"));
        LocalDateTime now = LocalDateTime.now();
        if ("pending".equals(cert == null ? null : cert.getCertStatus())) {
            throw new BusinessException(ErrorCode.CONFLICT, "该企业主体已有待审核认证，请等待审核结果");
        }
        if ("approved".equals(cert == null ? null : cert.getCertStatus())) {
            throw new BusinessException(ErrorCode.CONFLICT, "该企业主体已经认证通过");
        }
        if (cert == null || "rejected".equals(cert.getCertStatus())) {
            cert = new MerchantCertificationEntity();
            cert.setMerchantId(merchantId);
            cert.setMerchantName(companyName);
            cert.setCompanyName(companyName);
            cert.setCreditCode(creditCode);
            cert.setLegalPerson(legalPerson);
            cert.setLicenseNo(licenseNo);
            cert.setContactName(contactName);
            cert.setContactPhone(contactPhone);
            cert.setAttachNote(attachNote);
            cert.setBusinessLicenseUrl(businessLicenseUrl);
            cert.setLegalPersonIdFrontUrl(legalPersonIdFrontUrl);
            cert.setLegalPersonIdBackUrl(legalPersonIdBackUrl);
            cert.setRegisteredCapital(trim(body.getRegisteredCapital()));
            cert.setLegalPersonFaceUrl(legalPersonFaceUrl);
            cert.setLegalPersonFaceStatus("submitted");
            cert.setLegalPersonFaceAt(now);
            cert.setCorporateBankName(bankName);
            cert.setCorporateBankAccount(maskBankAccount(bankAccount));
            cert.setCorporateTransferAmount(transferAmount);
            cert.setCorporateTransferReference(transferReference);
            cert.setCorporateTransferProofUrl(transferProofUrl);
            cert.setCorporateTransferStatus("submitted");
            cert.setCorporateTransferAt(now);
            cert.setVerificationChannel("法人扫脸 + 对公打款");
            cert.setCertNo("CT" + System.currentTimeMillis());
            cert.setCertStatus("draft");
            cert.setSubmitTime(now);
            certificationMapper.insert(cert);
        } else {
            cert.setMerchantName(companyName);
            cert.setCompanyName(companyName);
            cert.setCreditCode(creditCode);
            cert.setLegalPerson(legalPerson);
            cert.setLicenseNo(licenseNo);
            cert.setContactName(contactName);
            cert.setContactPhone(contactPhone);
            cert.setAttachNote(attachNote);
            cert.setBusinessLicenseUrl(businessLicenseUrl);
            cert.setLegalPersonIdFrontUrl(legalPersonIdFrontUrl);
            cert.setLegalPersonIdBackUrl(legalPersonIdBackUrl);
            cert.setRegisteredCapital(trim(body.getRegisteredCapital()));
            cert.setLegalPersonFaceUrl(legalPersonFaceUrl);
            cert.setLegalPersonFaceStatus("submitted");
            cert.setLegalPersonFaceAt(now);
            cert.setCorporateBankName(bankName);
            cert.setCorporateBankAccount(maskBankAccount(bankAccount));
            cert.setCorporateTransferAmount(transferAmount);
            cert.setCorporateTransferReference(transferReference);
            cert.setCorporateTransferProofUrl(transferProofUrl);
            cert.setCorporateTransferStatus("submitted");
            cert.setCorporateTransferAt(now);
            cert.setVerificationChannel("法人扫脸 + 对公打款");
        }
        cert.setCertStatus("pending");
        cert.setSubmitTime(now);
        cert.setReviewer(null);
        cert.setReviewTime(null);
        cert.setReviewRemark(null);
        certificationMapper.updateById(cert);
        merchant.setName(companyName);
        merchant.setCreditCode(creditCode);
        merchant.setContactName(contactName);
        merchant.setContactPhone(contactPhone);
        merchant.setVerifyStatus("pending");
        merchant.setVerifyRemark("企业认证已提交，等待平台审核");
        merchantMapper.updateById(merchant);
        return ApiResponse.ok();
    }

    /**
     * 本主体成员列表（企业端）。
     *
     * <p><b>成员归属的唯一权威源在这里</b>，不在主数据子系统。主数据的
     * `agri_md_user` 是本地业务档案表（含种子数据），与统一认证账号不是一套 ——
     * 实测同一主体在本地表有 5 条、在 `platform_user_merchant` 只有 2 条。
     * 所以成员列表必须以本接口为准，主数据只负责补充"这个人在哪个部门/岗位"。</p>
     *
     * <p>只允许查看自己所属的主体：{@code merchantId} 必须在调用者的绑定列表里，
     * 否则就是"换个 id 看别家员工名单"。</p>
     */
    @GetMapping("/businesses/{merchantId}/members")
    public ApiResponse<Map<String, Object>> merchantMembers(@PathVariable Long merchantId,
                                                            HttpServletRequest request) {
        long[] session = requireSession(request);
        if (!merchantIdsOfUser(session[0]).contains(merchantId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "你不属于该经营主体");
        }
        MerchantEntity merchant = merchantMapper.selectById(merchantId);
        List<UserMerchantEntity> bindings = userMerchantMapper.selectList(
                new LambdaQueryWrapper<UserMerchantEntity>()
                        .eq(UserMerchantEntity::getMerchantId, merchantId)
                        .eq(UserMerchantEntity::getStatus, 1)
                        .orderByAsc(UserMerchantEntity::getCreatedAt));
        List<Map<String, Object>> rows = new ArrayList<>();
        for (UserMerchantEntity binding : bindings) {
            UserEntity user = userMapper.selectById(binding.getUserId());
            if (user == null) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("userId", String.valueOf(user.getId()));
            row.put("username", user.getUsername());
            row.put("nickname", user.getNickname());
            row.put("phone", user.getPhone());
            row.put("status", user.getStatus());
            row.put("roleInMerchant", binding.getRoleInMerchant());
            row.put("joinedAt", binding.getCreatedAt() == null ? null : binding.getCreatedAt().toString());
            rows.add(row);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("merchantId", String.valueOf(merchantId));
        result.put("merchantName", merchant == null ? null : merchant.getName());
        result.put("total", rows.size());
        result.put("records", rows);
        return ApiResponse.ok(result);
    }

    /**
     * 本主体的加入申请（企业端，负责人视角）。
     *
     * <p>补这个接口的原因：审批接口 {@code /join-requests/{id}/review} 早就有了，
     * 但负责人**列不出待审批的申请** —— 只能靠通知里的 id 点进去。
     * 主数据要做的"邀请成员"，本质就是这条链路的入口，所以缺口补在这里，
     * 而不是在子系统里另建一套邀请表。</p>
     *
     * @param status 传 pending 只看待审批；不传返回全部
     */
    @GetMapping("/businesses/{merchantId}/join-requests")
    public ApiResponse<Map<String, Object>> merchantJoinRequests(
            @PathVariable Long merchantId,
            @RequestParam(required = false) String status,
            HttpServletRequest request) {
        long[] session = requireSession(request);
        if (!merchantIdsOfUser(session[0]).contains(merchantId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "你不属于该经营主体");
        }
        LambdaQueryWrapper<MerchantJoinRequestEntity> wrapper =
                new LambdaQueryWrapper<MerchantJoinRequestEntity>()
                        .eq(MerchantJoinRequestEntity::getMerchantId, merchantId)
                        .orderByDesc(MerchantJoinRequestEntity::getCreatedAt);
        if (status != null && !status.isBlank()) {
            wrapper.eq(MerchantJoinRequestEntity::getStatus, status);
        }
        List<MerchantJoinRequestEntity> list = joinRequestMapper.selectList(wrapper);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (MerchantJoinRequestEntity entity : list) {
            rows.add(joinRequestView(entity));
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("merchantId", String.valueOf(merchantId));
        result.put("total", rows.size());
        result.put("records", rows);
        return ApiResponse.ok(result);
    }

    @PostMapping("/businesses/join-requests")
    public ApiResponse<Map<String, Object>> requestJoin(@RequestBody JoinRequest body,
                                                        HttpServletRequest request) {
        long[] session = requireSession(request);
        if (body == null || body.getMerchantId() == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请选择要加入的经营主体");
        }
        MerchantEntity merchant = merchantMapper.selectById(body.getMerchantId());
        if (merchant == null || !Integer.valueOf(1).equals(merchant.getStatus())) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "经营主体不存在或已停用");
        }
        if (merchantIdsOfUser(session[0]).contains(merchant.getId())) {
            throw new BusinessException(ErrorCode.CONFLICT, "你已经加入该经营主体");
        }
        String role = normalizeMerchantRole(body.getRoleInMerchant());
        Long pending = joinRequestMapper.selectCount(new LambdaQueryWrapper<MerchantJoinRequestEntity>()
                .eq(MerchantJoinRequestEntity::getUserId, session[0])
                .eq(MerchantJoinRequestEntity::getMerchantId, merchant.getId())
                .eq(MerchantJoinRequestEntity::getStatus, "pending"));
        if (pending != null && pending > 0) {
            throw new BusinessException(ErrorCode.CONFLICT, "已提交过申请，请等待主体负责人处理");
        }
        MerchantJoinRequestEntity entity = new MerchantJoinRequestEntity();
        entity.setUserId(session[0]);
        entity.setMarketId(session[1]);
        entity.setMerchantId(merchant.getId());
        entity.setRequestedRole(role);
        entity.setMessage(trim(body.getMessage()));
        entity.setStatus("pending");
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        joinRequestMapper.insert(entity);
        notifyMerchantOwners(merchant, session[0], role, trim(body.getMessage()));
        return ApiResponse.ok(joinRequestView(entity));
    }

    @DeleteMapping("/businesses/join-requests/{id}")
    public ApiResponse<Void> cancelJoin(@PathVariable Long id, HttpServletRequest request) {
        long[] session = requireSession(request);
        MerchantJoinRequestEntity entity = joinRequestMapper.selectById(id);
        if (entity == null || session[0] != entity.getUserId() || !"pending".equals(entity.getStatus())) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "待处理申请不存在");
        }
        entity.setStatus("cancelled");
        entity.setUpdatedAt(LocalDateTime.now());
        joinRequestMapper.updateById(entity);
        return ApiResponse.ok();
    }

    /** 主体负责人审批加入申请；通过后创建用户-主体绑定。 */
    @PostMapping("/businesses/join-requests/{id}/review")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<Void> reviewJoin(@PathVariable Long id, @RequestBody JoinReview body,
                                        HttpServletRequest request) {
        long[] session = requireSession(request);
        MerchantJoinRequestEntity join = joinRequestMapper.selectById(id);
        if (join == null || !"pending".equals(join.getStatus())) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "待审批申请不存在");
        }
        UserMerchantEntity reviewerBinding = userMerchantMapper.selectOne(
                new LambdaQueryWrapper<UserMerchantEntity>()
                        .eq(UserMerchantEntity::getUserId, session[0])
                        .eq(UserMerchantEntity::getMerchantId, join.getMerchantId())
                        .eq(UserMerchantEntity::getStatus, 1));
        if (reviewerBinding == null || !"owner".equalsIgnoreCase(reviewerBinding.getRoleInMerchant())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有主体负责人可以审批加入申请");
        }
        boolean approved = body != null && Boolean.TRUE.equals(body.getApproved());
        join.setStatus(approved ? "approved" : "rejected");
        join.setReviewerId(session[0]);
        join.setReviewerName(requireUser(session[0]).getNickname());
        join.setReviewTime(LocalDateTime.now());
        join.setReviewRemark(trim(body == null ? null : body.getRemark()));
        join.setUpdatedAt(LocalDateTime.now());
        joinRequestMapper.updateById(join);
        if (approved) {
            UserMerchantEntity binding = userMerchantMapper.selectOne(
                    new LambdaQueryWrapper<UserMerchantEntity>()
                            .eq(UserMerchantEntity::getUserId, join.getUserId())
                            .eq(UserMerchantEntity::getMerchantId, join.getMerchantId()));
            if (binding == null) {
                binding = new UserMerchantEntity();
                binding.setUserId(join.getUserId());
                binding.setMerchantId(join.getMerchantId());
                binding.setMarketId(join.getMarketId());
                binding.setCreatedAt(LocalDateTime.now());
                binding.setRoleInMerchant(join.getRequestedRole());
                binding.setStatus(1);
                userMerchantMapper.insert(binding);
            } else {
                binding.setRoleInMerchant(join.getRequestedRole());
                binding.setStatus(1);
                binding.setUpdatedAt(LocalDateTime.now());
                userMerchantMapper.updateById(binding);
            }
        }
        notifyApplicant(join, approved, session[0]);
        return ApiResponse.ok();
    }

    /**
     * 通知主体的负责人：有人申请加入。
     *
     * <p>找不到负责人时不报错 —— 消息是附加动作，不能因为它失败把"申请已提交"回滚掉。</p>
     */
    private void notifyMerchantOwners(MerchantEntity merchant, Long applicantUserId,
                                      String role, String message) {
        try {
            UserEntity applicant = userMapper.selectById(applicantUserId);
            String who = applicant == null ? ("用户" + applicantUserId)
                    : (applicant.getNickname() != null ? applicant.getNickname() : applicant.getUsername());
            String content = String.format("%s 申请以「%s」身份加入「%s」%s",
                    who, role, merchant.getName(),
                    message == null || message.isBlank() ? "。" : "，留言：" + message);
            List<UserMerchantEntity> owners = userMerchantMapper.selectList(
                    new LambdaQueryWrapper<UserMerchantEntity>()
                            .eq(UserMerchantEntity::getMerchantId, merchant.getId())
                            .eq(UserMerchantEntity::getStatus, 1)
                            .eq(UserMerchantEntity::getRoleInMerchant, "owner"));
            for (UserMerchantEntity owner : owners) {
                messageFacade.notify(owner.getUserId(), owner.getMarketId(),
                        "新的加入申请", content);
            }
        } catch (RuntimeException e) {
            log.warn("发送加入申请站内信失败（不影响申请本身）：{}", e.getMessage());
        }
    }

    /** 通知申请人审核结果。 */
    private void notifyApplicant(MerchantJoinRequestEntity join, boolean approved, Long reviewerId) {
        try {
            MerchantEntity merchant = merchantMapper.selectById(join.getMerchantId());
            String merchantName = merchant == null ? ("主体" + join.getMerchantId()) : merchant.getName();
            String title = approved ? "加入申请已通过" : "加入申请未通过";
            String content = approved
                    ? String.format("你加入「%s」的申请已通过，现在可以切换到该主体开展业务。", merchantName)
                    : String.format("你加入「%s」的申请未通过。%s", merchantName,
                            join.getReviewRemark() == null ? "" : "原因：" + join.getReviewRemark());
            messageFacade.notify(join.getUserId(), join.getMarketId(), title, content);
        } catch (RuntimeException e) {
            log.warn("发送审核结果站内信失败（不影响审核本身）：{}", e.getMessage());
        }
    }

    private long[] requireSession(HttpServletRequest request) {
        long[] session = sessionService.resolve(request);
        if (session == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "请先登录");
        }
        return session;
    }

    private UserEntity requireUser(Long userId) {
        UserEntity user = userMapper.selectById(userId);
        if (user == null) throw new BusinessException(ErrorCode.NOT_FOUND, "账号不存在");
        return user;
    }

    private UserIdentityEntity latestIdentity(Long userId) {
        return identityMapper.selectOne(new LambdaQueryWrapper<UserIdentityEntity>()
                .eq(UserIdentityEntity::getUserId, userId)
                .orderByDesc(UserIdentityEntity::getSubmitTime)
                .last("LIMIT 1"));
    }

    private List<Map<String, Object>> merchantRows(Long userId, Long activeMerchantId) {
        List<UserMerchantEntity> bindings = userMerchantMapper.selectList(
                new LambdaQueryWrapper<UserMerchantEntity>()
                        .eq(UserMerchantEntity::getUserId, userId)
                        .eq(UserMerchantEntity::getStatus, 1));
        List<Long> merchantIds = bindings.stream().map(UserMerchantEntity::getMerchantId).toList();
        Map<Long, MerchantCertificationEntity> certifications = new LinkedHashMap<>();
        if (!merchantIds.isEmpty()) {
            List<MerchantCertificationEntity> records = certificationMapper.selectList(
                    new LambdaQueryWrapper<MerchantCertificationEntity>()
                            .in(MerchantCertificationEntity::getMerchantId, merchantIds)
                            .orderByDesc(MerchantCertificationEntity::getSubmitTime)
                            .orderByDesc(MerchantCertificationEntity::getId));
            for (MerchantCertificationEntity record : records) {
                certifications.putIfAbsent(record.getMerchantId(), record);
            }
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (UserMerchantEntity binding : bindings) {
            MerchantEntity merchant = merchantMapper.selectById(binding.getMerchantId());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("bindingId", String.valueOf(binding.getId()));
            row.put("merchantId", String.valueOf(binding.getMerchantId()));
            row.put("merchantName", merchant == null ? null : merchant.getName());
            row.put("merchantCode", merchant == null ? null : merchant.getCode());
            row.put("memberType", merchant == null ? null : merchant.getMemberType());
            row.put("industry", merchant == null ? null : merchant.getIndustry());
            row.put("companySize", merchant == null ? null : merchant.getCompanySize());
            row.put("businessType", merchant == null ? null : merchant.getBusinessType());
            row.put("creditCode", merchant == null ? null : merchant.getCreditCode());
            row.put("creditCodeMasked", merchant == null ? null : maskCreditCode(merchant.getCreditCode()));
            row.put("contactName", merchant == null ? null : merchant.getContactName());
            row.put("contactPhone", merchant == null ? null : merchant.getContactPhone());
            row.put("address", merchant == null ? null : merchant.getAddress());
            row.put("status", merchant == null ? null : merchant.getStatus());
            row.put("verifyStatus", merchant == null ? null : merchant.getVerifyStatus());
            row.put("verifyTime", merchant == null ? null : merchant.getVerifyTime());
            row.put("verifyRemark", merchant == null ? null : merchant.getVerifyRemark());
            row.put("roleInMerchant", binding.getRoleInMerchant());
            row.put("active", binding.getMerchantId().equals(activeMerchantId));
            MerchantCertificationEntity certification = certifications.get(binding.getMerchantId());
            row.put("certification", certification == null ? null : certificationView(certification));
            rows.add(row);
        }
        return rows;
    }

    private Map<String, Object> certificationView(MerchantCertificationEntity entity) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", String.valueOf(entity.getId()));
        row.put("certNo", entity.getCertNo());
        row.put("companyName", entity.getCompanyName());
        row.put("creditCode", entity.getCreditCode());
        row.put("legalPerson", entity.getLegalPerson());
        row.put("licenseNo", entity.getLicenseNo());
        row.put("contactName", entity.getContactName());
        row.put("contactPhone", entity.getContactPhone());
        row.put("attachNote", entity.getAttachNote());
        row.put("businessLicenseUrl", entity.getBusinessLicenseUrl());
        row.put("legalPersonIdFrontUrl", entity.getLegalPersonIdFrontUrl());
        row.put("legalPersonIdBackUrl", entity.getLegalPersonIdBackUrl());
        row.put("legalPersonFaceUrl", entity.getLegalPersonFaceUrl());
        row.put("legalPersonFaceStatus", entity.getLegalPersonFaceStatus());
        row.put("corporateBankName", entity.getCorporateBankName());
        row.put("corporateBankAccount", entity.getCorporateBankAccount());
        row.put("corporateTransferAmount", entity.getCorporateTransferAmount());
        row.put("corporateTransferReference", entity.getCorporateTransferReference());
        row.put("corporateTransferProofUrl", entity.getCorporateTransferProofUrl());
        row.put("corporateTransferStatus", entity.getCorporateTransferStatus());
        row.put("registeredCapital", entity.getRegisteredCapital());
        row.put("verificationChannel", entity.getVerificationChannel());
        row.put("status", entity.getCertStatus());
        row.put("submitTime", entity.getSubmitTime());
        row.put("reviewer", entity.getReviewer());
        row.put("reviewTime", entity.getReviewTime());
        row.put("reviewRemark", entity.getReviewRemark());
        return row;
    }

    private List<Map<String, Object>> addressRows(Long userId) {
        return addressMapper.selectList(new LambdaQueryWrapper<UserAddressEntity>()
                        .eq(UserAddressEntity::getUserId, userId)
                        .orderByDesc(UserAddressEntity::getIsDefault)
                        .orderByDesc(UserAddressEntity::getUpdatedAt))
                .stream().map(this::addressView).toList();
    }

    private Map<String, Object> addressView(UserAddressEntity entity) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", String.valueOf(entity.getId()));
        row.put("receiverName", entity.getReceiverName());
        row.put("contactPhone", entity.getContactPhone());
        row.put("province", entity.getProvince());
        row.put("city", entity.getCity());
        row.put("district", entity.getDistrict());
        row.put("detailAddress", entity.getDetailAddress());
        row.put("postalCode", entity.getPostalCode());
        row.put("isDefault", entity.getIsDefault());
        return row;
    }

    private Map<String, Object> identityView(UserIdentityEntity entity) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("identityNo", entity.getIdentityNo());
        row.put("realName", entity.getRealName());
        row.put("idNoMasked", entity.getIdNoMasked());
        row.put("validStart", entity.getValidStart());
        row.put("validEnd", entity.getValidEnd());
        row.put("contactPhone", entity.getContactPhone());
        row.put("address", entity.getAddress());
        row.put("businessType", entity.getBusinessType());
        row.put("email", entity.getEmail());
        row.put("policeVerified", Boolean.TRUE.equals(entity.getPoliceVerified()));
        row.put("livenessVerified", Boolean.TRUE.equals(entity.getLivenessVerified()));
        row.put("verificationChannel", entity.getVerificationChannel());
        row.put("policeVerifiedAt", entity.getPoliceVerifiedAt());
        row.put("livenessVerifiedAt", entity.getLivenessVerifiedAt());
        row.put("status", entity.getStatus());
        row.put("submitTime", entity.getSubmitTime());
        row.put("reviewRemark", entity.getReviewRemark());
        return row;
    }

    private List<Map<String, Object>> joinRows(Long userId, List<Long> merchantIds, boolean sent) {
        LambdaQueryWrapper<MerchantJoinRequestEntity> wrapper = new LambdaQueryWrapper<>();
        if (sent) wrapper.eq(MerchantJoinRequestEntity::getUserId, userId);
        else wrapper.in(MerchantJoinRequestEntity::getMerchantId, merchantIds)
                .eq(MerchantJoinRequestEntity::getStatus, "pending");
        wrapper.orderByDesc(MerchantJoinRequestEntity::getCreatedAt);
        return joinRequestMapper.selectList(wrapper).stream().map(this::joinRequestView).toList();
    }

    private Map<String, Object> joinRequestView(MerchantJoinRequestEntity entity) {
        MerchantEntity merchant = merchantMapper.selectById(entity.getMerchantId());
        UserEntity applicant = userMapper.selectById(entity.getUserId());
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", String.valueOf(entity.getId()));
        row.put("merchantId", String.valueOf(entity.getMerchantId()));
        row.put("merchantName", merchant == null ? null : merchant.getName());
        row.put("applicantUserId", String.valueOf(entity.getUserId()));
        row.put("applicantName", applicant == null ? entity.getUserId().toString() : applicant.getNickname());
        row.put("requestedRole", entity.getRequestedRole());
        row.put("message", entity.getMessage());
        row.put("status", entity.getStatus());
        row.put("createdAt", entity.getCreatedAt());
        row.put("reviewRemark", entity.getReviewRemark());
        return row;
    }

    private List<Long> merchantIdsOfUser(Long userId) {
        return userMerchantMapper.selectList(new LambdaQueryWrapper<UserMerchantEntity>()
                        .eq(UserMerchantEntity::getUserId, userId)
                        .eq(UserMerchantEntity::getStatus, 1))
                .stream().map(UserMerchantEntity::getMerchantId).toList();
    }

    private List<Long> ownedMerchantIds(Long userId) {
        return userMerchantMapper.selectList(new LambdaQueryWrapper<UserMerchantEntity>()
                        .eq(UserMerchantEntity::getUserId, userId)
                        .eq(UserMerchantEntity::getStatus, 1)
                        .eq(UserMerchantEntity::getRoleInMerchant, "owner"))
                .stream().map(UserMerchantEntity::getMerchantId).toList();
    }

    private UserAddressEntity requireAddress(Long id, Long userId) {
        UserAddressEntity entity = addressMapper.selectById(id);
        if (entity == null || !userId.equals(entity.getUserId())) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "地址不存在");
        }
        return entity;
    }

    private void clearDefaultAddress(Long userId) {
        List<UserAddressEntity> rows = addressMapper.selectList(
                new LambdaQueryWrapper<UserAddressEntity>()
                        .eq(UserAddressEntity::getUserId, userId)
                        .eq(UserAddressEntity::getIsDefault, 1));
        for (UserAddressEntity row : rows) {
            row.setIsDefault(0);
            row.setUpdatedAt(LocalDateTime.now());
            addressMapper.updateById(row);
        }
    }

    private void validateAddress(AddressRequest body) {
        if (body == null || trim(body.getReceiverName()) == null || trim(body.getContactPhone()) == null
                || trim(body.getProvince()) == null || trim(body.getCity()) == null
                || trim(body.getDetailAddress()) == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "收货人、电话、省市和详细地址不能为空");
        }
        if (!body.getContactPhone().trim().matches("^1[3-9]\\d{9}$")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "联系电话格式不正确");
        }
    }

    private void copyAddress(AddressRequest body, UserAddressEntity entity) {
        entity.setReceiverName(body.getReceiverName().trim());
        entity.setContactPhone(body.getContactPhone().trim());
        entity.setProvince(body.getProvince().trim());
        entity.setCity(body.getCity().trim());
        entity.setDistrict(trim(body.getDistrict()));
        entity.setDetailAddress(body.getDetailAddress().trim());
        entity.setPostalCode(trim(body.getPostalCode()));
        if (body.getIsDefault() != null) entity.setIsDefault(body.getIsDefault() ? 1 : 0);
    }

    private String normalizeMerchantRole(String role) {
        String value = role == null ? "buyer" : role.trim().toLowerCase();
        if (!List.of("buyer", "seller", "finance").contains(value)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "主体角色只能是 buyer、seller 或 finance");
        }
        return value;
    }

    private String maskCreditCode(String value) {
        if (value == null || value.length() < 8) return value;
        return value.substring(0, 4) + "********" + value.substring(value.length() - 4);
    }

    private String optionalOwnedUrl(Long merchantId, String kind, String url) {
        return url == null || url.isBlank()
                ? null : certificationFileService.requireOwnedUrl(merchantId, kind, url);
    }

    private static String maskBankAccount(String value) {
        String normalized = value.replace(" ", "");
        if (normalized.length() <= 8) {
            return "****" + normalized.substring(Math.max(0, normalized.length() - 4));
        }
        return normalized.substring(0, 4) + " **** **** "
                + normalized.substring(normalized.length() - 4);
    }

    private static String trim(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    @Data
    public static class ProfileRequest {
        private String nickname;
        private String email;
    }

    @Data
    public static class PasswordRequest {
        private String currentPassword;
        private String newPassword;
        private String confirmPassword;
    }

    @Data
    public static class PhoneRequest {
        private String phone;
        private String code;
    }

    @Data
    public static class RealNameRequest {
        private String realName;
        private String idCard;
        private String contactPhone;
        private String address;
        private String validStart;
        private String validEnd;
        private String businessType;
        private String email;
    }

    @Data
    public static class PoliceRequest {
        private String realName;
        private String idCard;
    }

    @Data
    public static class AddressRequest {
        private String receiverName;
        private String contactPhone;
        private String province;
        private String city;
        private String district;
        private String detailAddress;
        private String postalCode;
        private Boolean isDefault;
    }

    @Data
    public static class JoinRequest {
        private Long merchantId;
        private String roleInMerchant;
        private String message;
    }

    @Data
    public static class CreateBusinessRequest {
        private String identity;
        private String companyName;
        private String creditCode;
        private String industry;
        private String companySize;
        private String realName;
        private String idCard;
        private String businessType;
        private String address;
        private String contactName;
        private String contactPhone;
        private String legalPerson;
        private String licenseNo;
        private String attachNote;
        private String validStart;
        private String validEnd;
        private String email;
    }

    @Data
    public static class CertificationSubmitRequest {
        private String companyName;
        private String creditCode;
        private String legalPerson;
        private String licenseNo;
        private String registeredCapital;
        private String contactName;
        private String contactPhone;
        private String attachNote;
        private String businessLicenseUrl;
        private String legalPersonIdFrontUrl;
        private String legalPersonIdBackUrl;
        private String legalPersonFaceUrl;
        private String corporateBankName;
        private String corporateBankAccount;
        private String corporateTransferAmount;
        private String corporateTransferReference;
        private String corporateTransferProofUrl;
    }

    @Data
    public static class JoinReview {
        private Boolean approved;
        private String remark;
    }
}
