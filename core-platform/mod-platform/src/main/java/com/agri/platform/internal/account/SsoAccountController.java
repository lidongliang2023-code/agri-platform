package com.agri.platform.internal.account;

import com.agri.platform.internal.identity.UserIdentityEntity;
import com.agri.platform.internal.identity.UserIdentityMapper;
import com.agri.platform.internal.identity.IdNumberUtil;
import com.agri.platform.internal.merchant.MerchantEntity;
import com.agri.platform.internal.merchant.MerchantCertificationEntity;
import com.agri.platform.internal.merchant.MerchantCertificationMapper;
import com.agri.platform.internal.merchant.MerchantMapper;
import com.agri.platform.internal.merchant.UserMerchantEntity;
import com.agri.platform.internal.merchant.UserMerchantMapper;
import com.agri.platform.internal.sso.SmsAuthService;
import com.agri.platform.internal.sso.SsoSessionService;
import com.agri.platform.internal.user.UserEntity;
import com.agri.platform.internal.user.UserMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 登录用户账号中心：资料、安全、地址、实名与经营主体。 */
@RestController
@RequestMapping("/api/v1/sso/account")
@RequiredArgsConstructor
public class SsoAccountController {

    private final SsoSessionService sessionService;
    private final SmsAuthService smsAuthService;
    private final UserMapper userMapper;
    private final UserMerchantMapper userMerchantMapper;
    private final MerchantMapper merchantMapper;
    private final MerchantCertificationMapper certificationMapper;
    private final UserIdentityMapper identityMapper;
    private final UserAddressMapper addressMapper;
    private final MerchantJoinRequestMapper joinRequestMapper;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

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
        result.put("merchants", merchantRows(userId));
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
        user.setNickname(nickname);
        user.setEmail(email);
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(user);
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
        if (next == null || next.length() < 8 || next.length() > 20
                || !next.matches(".*[A-Za-z].*") || !next.matches(".*\\d.*")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "新密码应为 8-20 位，且同时包含字母和数字");
        }
        if (!next.equals(body.getConfirmPassword())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "两次输入的新密码不一致");
        }
        user.setPassword(passwordEncoder.encode(next));
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(user);
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
        return ApiResponse.ok();
    }

    /** 账号级个人实名：不改变企业/个人经营主体类型，可与企业认证并存。 */
    @PostMapping("/real-name")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<Void> submitRealName(@RequestBody RealNameRequest body, HttpServletRequest request) {
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
        entity.setStatus("pending");
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
        return ApiResponse.ok();
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

    /** 将指定企业主体当前草稿/驳回认证提交为待审核。 */
    @PostMapping("/businesses/{merchantId}/submit-certification")
    public ApiResponse<Void> submitEnterpriseCertification(@PathVariable Long merchantId,
                                                           HttpServletRequest request) {
        long[] session = requireSession(request);
        if (!merchantIdsOfUser(session[0]).contains(merchantId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "无权认证该经营主体");
        }
        MerchantEntity merchant = merchantMapper.selectById(merchantId);
        if (merchant == null || "personal".equalsIgnoreCase(merchant.getMemberType())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "该主体不是企业主体");
        }
        MerchantCertificationEntity cert = certificationMapper.selectOne(
                new LambdaQueryWrapper<MerchantCertificationEntity>()
                        .eq(MerchantCertificationEntity::getMerchantId, merchantId)
                        .orderByDesc(MerchantCertificationEntity::getId)
                        .last("LIMIT 1"));
        LocalDateTime now = LocalDateTime.now();
        if (cert == null) {
            cert = new MerchantCertificationEntity();
            cert.setMerchantId(merchantId);
            cert.setMerchantName(merchant.getName());
            cert.setCompanyName(merchant.getName());
            cert.setCreditCode(merchant.getCreditCode());
            cert.setContactName(merchant.getContactName());
            cert.setContactPhone(merchant.getContactPhone());
            cert.setCertNo("CT" + System.currentTimeMillis());
            cert.setCertStatus("draft");
            cert.setSubmitTime(now);
            certificationMapper.insert(cert);
        }
        if ("approved".equals(cert.getCertStatus())) {
            throw new BusinessException(ErrorCode.CONFLICT, "该企业主体已经认证通过");
        }
        cert.setCertStatus("pending");
        cert.setSubmitTime(now);
        cert.setReviewer(null);
        cert.setReviewTime(null);
        cert.setReviewRemark(null);
        certificationMapper.updateById(cert);
        merchant.setVerifyStatus("pending");
        merchant.setVerifyRemark("企业认证已提交，等待平台审核");
        merchantMapper.updateById(merchant);
        return ApiResponse.ok();
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
        return ApiResponse.ok();
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

    private List<Map<String, Object>> merchantRows(Long userId) {
        List<UserMerchantEntity> bindings = userMerchantMapper.selectList(
                new LambdaQueryWrapper<UserMerchantEntity>()
                        .eq(UserMerchantEntity::getUserId, userId)
                        .eq(UserMerchantEntity::getStatus, 1));
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
            row.put("creditCodeMasked", merchant == null ? null : maskCreditCode(merchant.getCreditCode()));
            row.put("contactName", merchant == null ? null : merchant.getContactName());
            row.put("contactPhone", merchant == null ? null : merchant.getContactPhone());
            row.put("address", merchant == null ? null : merchant.getAddress());
            row.put("status", merchant == null ? null : merchant.getStatus());
            row.put("verifyStatus", merchant == null ? null : merchant.getVerifyStatus());
            row.put("verifyTime", merchant == null ? null : merchant.getVerifyTime());
            row.put("verifyRemark", merchant == null ? null : merchant.getVerifyRemark());
            row.put("roleInMerchant", binding.getRoleInMerchant());
            rows.add(row);
        }
        return rows;
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
    public static class JoinReview {
        private Boolean approved;
        private String remark;
    }
}
