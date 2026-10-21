package com.agri.platform.internal.identity;

import com.agri.core.infra.web.MarketContext;
import com.agri.platform.internal.merchant.MerchantEntity;
import com.agri.platform.internal.merchant.MerchantMapper;
import com.agri.platform.internal.merchant.UserMerchantEntity;
import com.agri.platform.internal.merchant.UserMerchantMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 个人实名认证（用户与企业认证里的"个人"这一半，与 platform_merchant_certification 并列）。
 *
 * <p><b>口径（合规最保守的一档）</b>：
 * <ul>
 *   <li>库里**不存身份证号明文**：只存掩码（前 3 位 + 11 个 * + 后 4 位）与加盐 SHA-256；</li>
 *   <li>真实三要素核验（姓名+身份证+人脸/公安库）须接合规服务，届时也只把**核验结果**入库；</li>
 *   <li>运营端也只看得到掩码 —— 不是"前端藏起来"，而是服务端根本不返回明文；</li>
 *   <li>每次提交留一条记录（与主体认证同一套做法），当事人不能自己删除 —— 涉诉要能追溯。</li>
 * </ul></p>
 *
 * <p><b>两个入口分开</b>：{@code /api/v1/platform/identity/**} 是当事人提交与查看自己的；
 * {@code /api/v1/admin/user-identities/**} 是运营端审核。后者由平台侧的统一准入拦
 * （/api/v1/admin/** 要运营权限），不靠各控制器自己记得加校验。</p>
 */
@RestController
@RequiredArgsConstructor
public class UserIdentityController {

    private final UserIdentityMapper identityMapper;
    private final UserMerchantMapper userMerchantMapper;
    private final MerchantMapper merchantMapper;

    // ------------------------------ 当事人侧 ------------------------------

    /** 提交实名认证（一次提交一条记录；已通过的不再接受重复提交）。 */
    @PostMapping("/api/v1/platform/identity/real-name")
    public ApiResponse<Map<String, Object>> submit(@RequestBody SubmitRequest request) {
        Long userId = MarketContext.currentUserId();
        if (userId == null) {
            return ApiResponse.fail(ErrorCode.UNAUTHORIZED);
        }
        if (request == null || isBlank(request.getRealName())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请填写真实姓名");
        }
        // 明文只在这里出现一次，随后立即转成掩码 + 哈希
        String idNo = IdNumberUtil.validate(request.getIdNo());

        UserIdentityEntity latest = latestOf(userId);
        if (latest != null && "verified".equals(latest.getStatus())) {
            throw new BusinessException(ErrorCode.CONFLICT, "你的实名认证已通过，无需重复提交");
        }
        if (latest != null && "pending".equals(latest.getStatus())) {
            throw new BusinessException(ErrorCode.CONFLICT, "你已有一份待审核的实名认证，请等待审核结果");
        }

        // 同一人重复提交时沿用上一次的盐：这样"号码有没有换"可以直接比对哈希
        String salt = latest == null ? IdNumberUtil.newSalt() : latest.getIdNoSalt();
        LocalDateTime now = LocalDateTime.now();

        UserIdentityEntity entity = new UserIdentityEntity();
        entity.setUserId(userId);
        entity.setMarketId(MarketContext.currentMarketId());
        entity.setIdentityNo("ID" + System.currentTimeMillis());
        entity.setRealName(request.getRealName().trim());
        entity.setIdNoMasked(IdNumberUtil.mask(idNo));
        entity.setIdNoHash(IdNumberUtil.hash(idNo, salt));
        entity.setIdNoSalt(salt);
        entity.setStatus("pending");
        entity.setSubmitTime(now);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        identityMapper.insert(entity);
        return ApiResponse.ok(toView(entity, latest));
    }

    /** 我的实名认证状态（最新一条）。 */
    @GetMapping("/api/v1/platform/identity/real-name/mine")
    public ApiResponse<Map<String, Object>> mine() {
        Long userId = MarketContext.currentUserId();
        if (userId == null) {
            return ApiResponse.fail(ErrorCode.UNAUTHORIZED);
        }
        UserIdentityEntity latest = latestOf(userId);
        return ApiResponse.ok(latest == null ? null : toView(latest, null));
    }

    // ------------------------------ 运营端 ------------------------------

    /** 运营端：实名认证申请列表（可按状态筛）。 */
    @GetMapping("/api/v1/admin/user-identities")
    public ApiResponse<PageResult<Map<String, Object>>> page(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String status) {
        LambdaQueryWrapper<UserIdentityEntity> wrapper = new LambdaQueryWrapper<>();
        if (status != null && !status.isBlank()) {
            wrapper.eq(UserIdentityEntity::getStatus, status.trim());
        }
        wrapper.orderByDesc(UserIdentityEntity::getSubmitTime);
        Page<UserIdentityEntity> page = identityMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (UserIdentityEntity row : page.getRecords()) {
            rows.add(toView(row, null));
        }
        return ApiResponse.ok(new PageResult<>(rows, page.getTotal(), page.getCurrent(), page.getSize()));
    }

    /** 运营端：审核（通过 / 驳回）。驳回必须给原因。 */
    @PostMapping("/api/v1/admin/user-identities/{id}/review")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<Map<String, Object>> review(@PathVariable Long id,
                                                   @RequestBody ReviewRequest request) {
        UserIdentityEntity entity = identityMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "认证记录不存在");
        }
        if (!"pending".equals(entity.getStatus())) {
            throw new BusinessException(ErrorCode.CONFLICT, "这条认证已经审过了（" + entity.getStatus() + "）");
        }
        if (request == null || request.getApproved() == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请指定审核结果");
        }
        boolean approved = Boolean.TRUE.equals(request.getApproved());
        if (!approved && isBlank(request.getRemark())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "驳回必须填写原因");
        }

        Long reviewerId = MarketContext.currentUserId();
        String reviewerName = MarketContext.get() == null ? null : MarketContext.get().getUsername();
        entity.setStatus(approved ? "verified" : "rejected");
        entity.setReviewerId(reviewerId);
        entity.setReviewerName(reviewerName);
        entity.setReviewTime(LocalDateTime.now());
        entity.setReviewRemark(approved ? trim(request.getRemark()) : request.getRemark().trim());
        entity.setUpdatedAt(LocalDateTime.now());
        identityMapper.updateById(entity);
        if (approved) {
            syncPersonalMerchant(entity, reviewerName);
        }
        return ApiResponse.ok(toView(entity, null));
    }

    // ------------------------------ 内部 ------------------------------

    private UserIdentityEntity latestOf(Long userId) {
        return identityMapper.selectOne(new LambdaQueryWrapper<UserIdentityEntity>()
                .eq(UserIdentityEntity::getUserId, userId)
                .orderByDesc(UserIdentityEntity::getSubmitTime)
                .last("LIMIT 1"));
    }

    /**
     * 个人实名通过后同步个人经营主体的认证状态。
     *
     * <p>个人会员注册时会创建一条 `member_type=personal` 的经营主体，初始为
     * `unverified`；若只把实名记录改成 `verified` 而不更新主体，业务侧读取主体认证状态时
     * 仍会认为该用户“未认证”。这里只同步个人主体，不触碰其可能同时拥有的企业主体。</p>
     */
    private void syncPersonalMerchant(UserIdentityEntity identity, String reviewerName) {
        List<UserMerchantEntity> memberships = userMerchantMapper.selectList(
                new LambdaQueryWrapper<UserMerchantEntity>()
                        .eq(UserMerchantEntity::getUserId, identity.getUserId())
                        .eq(UserMerchantEntity::getStatus, 1));
        if (memberships.isEmpty()) {
            return;
        }
        List<Long> merchantIds = memberships.stream()
                .map(UserMerchantEntity::getMerchantId)
                .distinct()
                .toList();
        List<MerchantEntity> merchants = merchantMapper.selectList(
                new LambdaQueryWrapper<MerchantEntity>().in(MerchantEntity::getId, merchantIds));
        LocalDateTime now = LocalDateTime.now();
        for (MerchantEntity merchant : merchants) {
            if (!"personal".equalsIgnoreCase(merchant.getMemberType())) {
                continue;
            }
            merchant.setVerifyStatus("approved");
            merchant.setVerifyRemark("个人实名认证审核通过"
                    + (reviewerName == null ? "" : "（" + reviewerName + "）"));
            merchant.setVerifyTime(now);
            merchantMapper.updateById(merchant);
        }
    }

    /**
     * 出参视图：**只有掩码，没有明文**（也没有哈希与盐 —— 那两个是给服务端比对用的，
     * 返回给前端只会扩大暴露面）。
     */
    private Map<String, Object> toView(UserIdentityEntity entity, UserIdentityEntity previous) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", entity.getId());
        view.put("identityNo", entity.getIdentityNo());
        view.put("realName", entity.getRealName());
        view.put("idNoMasked", entity.getIdNoMasked());
        view.put("validStart", entity.getValidStart());
        view.put("validEnd", entity.getValidEnd());
        view.put("contactPhone", entity.getContactPhone());
        view.put("address", entity.getAddress());
        view.put("email", entity.getEmail());
        view.put("businessType", entity.getBusinessType());
        view.put("status", entity.getStatus());
        view.put("submitTime", entity.getSubmitTime());
        view.put("reviewerName", entity.getReviewerName());
        view.put("reviewTime", entity.getReviewTime());
        view.put("reviewRemark", entity.getReviewRemark());
        // 同一人重复提交时，明确告诉前端"号码和上次是否一致"，避免运营误以为换了人
        view.put("idNoChanged", previous != null && previous.getIdNoHash() != null
                && !previous.getIdNoHash().equals(entity.getIdNoHash()));
        return view;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String trim(String value) {
        return value == null ? null : value.trim();
    }

    @Data
    public static class SubmitRequest {
        private String realName;
        /** 身份证号：只在请求体里出现一次，服务端转掩码 + 哈希后不保留 */
        private String idNo;
    }

    @Data
    public static class ReviewRequest {
        private Boolean approved;
        private String remark;
    }
}
