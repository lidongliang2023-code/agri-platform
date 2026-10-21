package com.agri.platform.internal.merchant;

import com.agri.core.infra.web.MarketContext;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 经营主体认证（用户与企业认证里的"企业"这一半）。
 *
 * <p><b>它补的是什么</b>：平台有主体登记信息（名称、统一社会信用代码、联系人），
 * 但从来没有"验没验过"这一层 —— 运营端做不了企业认证，谁提交了材料、审到哪一步、
 * 为什么被驳回，都无处可放。</p>
 *
 * <p><b>两个入口分开</b>（与用户-主体绑定同一套口径）：
 * <ul>
 *   <li>{@code /api/v1/platform/merchant-certifications/**}：主体自己提交、查自己的申请。
 *       能提交哪个主体由服务端按登录用户绑定的经营主体判定，不接受前端指定"替谁提交"；</li>
 *   <li>{@code /api/v1/admin/merchant-certifications/**}：运营端查看与审核。</li>
 * </ul></p>
 *
 * <p><b>为什么每次提交留一条记录</b>：商家会问"我上次为什么被驳回"，
 * 如果只维护一个状态，那条理由会被新的提交覆盖掉，就再也答不上来。</p>
 */
@RestController
@RequiredArgsConstructor
public class MerchantCertificationController {

    private final MerchantCertificationMapper certificationMapper;
    private final MerchantCertificationFileService certificationFileService;
    private final MerchantMapper merchantMapper;
    private final UserMerchantMapper userMerchantMapper;

    // ------------------------------ 主体侧 ------------------------------

    /** 提交认证申请。 */
    @PostMapping("/api/v1/platform/merchant-certifications")
    public ApiResponse<MerchantCertificationEntity> submit(@RequestBody SubmitRequest request) {
        Long userId = MarketContext.currentUserId();
        if (userId == null) {
            return ApiResponse.fail(ErrorCode.UNAUTHORIZED);
        }
        if (isBlank(request.getCompanyName()) || isBlank(request.getCreditCode())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "企业名称与统一社会信用代码都必须填写");
        }
        // 能替哪个主体提交，由服务端按绑定关系判定
        Long merchantId = resolveMyMerchant(request.getMerchantId(), userId);
        MerchantEntity merchant = merchantMapper.selectById(merchantId);
        if (merchant == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "经营主体不存在");
        }
        // 已经认证通过的，不再接受重复提交：现在没有"认证有效期"这层模型，
        // 允许重交只会把一家已验证的主体打回待审核 —— 等于自己把自己的认证撤销了。
        // 真要变更主体信息，应当走运营端的变更流程（后续再做）。
        if ("approved".equals(merchant.getVerifyStatus())) {
            throw new BusinessException(ErrorCode.CONFLICT, "该主体已通过认证，如需变更信息请联系运营");
        }
        // 一次只能有一条待审核：否则运营端面对同一家主体的多份材料，不知道该审哪一份
        Long pending = certificationMapper.selectCount(new LambdaQueryWrapper<MerchantCertificationEntity>()
                .eq(MerchantCertificationEntity::getMerchantId, merchantId)
                .eq(MerchantCertificationEntity::getCertStatus, "pending"));
        if (pending != null && pending > 0) {
            throw new BusinessException(ErrorCode.CONFLICT, "该主体已有一份待审核的认证申请，请等待审核结果");
        }

        LocalDateTime now = LocalDateTime.now();
        MerchantCertificationEntity entity = new MerchantCertificationEntity();
        entity.setMerchantId(merchantId);
        entity.setMerchantName(merchant.getName());
        entity.setCertNo("CT" + System.currentTimeMillis());
        entity.setCompanyName(request.getCompanyName().trim());
        entity.setCreditCode(request.getCreditCode().trim());
        entity.setLegalPerson(trim(request.getLegalPerson()));
        entity.setLicenseNo(trim(request.getLicenseNo()));
        entity.setContactName(trim(request.getContactName()));
        entity.setContactPhone(trim(request.getContactPhone()));
        entity.setAttachNote(trim(request.getAttachNote()));
        entity.setBusinessLicenseUrl(certificationFileService.requireOwnedUrl(merchantId,
                MerchantCertificationFileService.BUSINESS_LICENSE, request.getBusinessLicenseUrl()));
        entity.setLegalPersonIdFrontUrl(certificationFileService.requireOwnedUrl(merchantId,
                MerchantCertificationFileService.LEGAL_PERSON_ID_FRONT,
                request.getLegalPersonIdFrontUrl()));
        entity.setLegalPersonIdBackUrl(certificationFileService.requireOwnedUrl(merchantId,
                MerchantCertificationFileService.LEGAL_PERSON_ID_BACK,
                request.getLegalPersonIdBackUrl()));
        entity.setCertStatus("pending");
        entity.setSubmitTime(now);
        certificationMapper.insert(entity);

        merchant.setVerifyStatus("pending");
        merchant.setVerifyRemark(null);
        merchantMapper.updateById(merchant);
        return ApiResponse.ok(entity);
    }

    /** 我提交过的认证申请。 */
    @GetMapping("/api/v1/platform/merchant-certifications/mine")
    public ApiResponse<List<MerchantCertificationEntity>> mine() {
        Long userId = MarketContext.currentUserId();
        if (userId == null) {
            return ApiResponse.fail(ErrorCode.UNAUTHORIZED);
        }
        List<Long> myMerchantIds = userMerchantMapper.selectList(
                        new LambdaQueryWrapper<UserMerchantEntity>()
                                .eq(UserMerchantEntity::getUserId, userId)
                                .eq(UserMerchantEntity::getStatus, 1))
                .stream().map(UserMerchantEntity::getMerchantId).collect(Collectors.toList());
        if (myMerchantIds.isEmpty()) {
            return ApiResponse.ok(List.of());
        }
        return ApiResponse.ok(certificationMapper.selectList(
                new LambdaQueryWrapper<MerchantCertificationEntity>()
                        .in(MerchantCertificationEntity::getMerchantId, myMerchantIds)
                        .orderByDesc(MerchantCertificationEntity::getSubmitTime)));
    }

    // ------------------------------ 运营端 ------------------------------

    /** 认证申请列表（运营端）。 */
    @GetMapping("/api/v1/admin/merchant-certifications")
    public ApiResponse<PageResult<MerchantCertificationEntity>> page(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String certStatus,
            @RequestParam(required = false) String merchantName) {
        LambdaQueryWrapper<MerchantCertificationEntity> wrapper = new LambdaQueryWrapper<>();
        if (!isBlank(certStatus)) {
            wrapper.eq(MerchantCertificationEntity::getCertStatus, certStatus);
        }
        if (!isBlank(merchantName)) {
            wrapper.like(MerchantCertificationEntity::getMerchantName, merchantName);
        }
        wrapper.orderByDesc(MerchantCertificationEntity::getSubmitTime);
        Page<MerchantCertificationEntity> page = certificationMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
        return ApiResponse.ok(new PageResult<>(new ArrayList<>(page.getRecords()),
                page.getTotal(), page.getCurrent(), page.getSize()));
    }

    /** 审核认证申请。 */
    @PostMapping("/api/v1/admin/merchant-certifications/{id}/audit")
    public ApiResponse<Void> audit(@PathVariable Long id, @RequestBody AuditRequest request) {
        MerchantCertificationEntity entity = certificationMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "认证申请不存在");
        }
        if (!"pending".equals(entity.getCertStatus())) {
            throw new BusinessException(ErrorCode.CONFLICT, "该申请已经审核过了");
        }
        String status = request.getStatus();
        if (!"approved".equals(status) && !"rejected".equals(status)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "审核结论只支持 approved（通过）或 rejected（驳回）");
        }
        // 驳回必须给理由：商家要照着改，运营端也要能回答"为什么没过"
        if ("rejected".equals(status) && isBlank(request.getRemark())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "驳回必须填写审核意见");
        }

        MarketContext.Session session = MarketContext.get();
        String reviewer = session == null ? null : session.getUsername();
        LocalDateTime now = LocalDateTime.now();
        entity.setCertStatus(status);
        entity.setReviewer(reviewer);
        entity.setReviewTime(now);
        entity.setReviewRemark(trim(request.getRemark()));
        certificationMapper.updateById(entity);

        MerchantEntity merchant = merchantMapper.selectById(entity.getMerchantId());
        if (merchant != null) {
            merchant.setVerifyStatus(status);
            merchant.setVerifyRemark(trim(request.getRemark()));
            if ("approved".equals(status)) {
                merchant.setVerifyTime(now);
            }
            merchantMapper.updateById(merchant);
        }
        return ApiResponse.ok();
    }

    /** 运营端读取认证材料。JWT 过滤器已在进入本方法前完成运营角色校验。 */
    @GetMapping("/api/v1/admin/merchant-certifications/{merchantId}/certification-files/{kind}/{fileId}")
    public ResponseEntity<Resource> document(@PathVariable Long merchantId,
                                             @PathVariable String kind,
                                             @PathVariable String fileId) {
        Resource resource = certificationFileService.load(merchantId, kind, fileId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(certificationFileService.mediaType(fileId)))
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .body(resource);
    }

    // ------------------------------ 内部 ------------------------------

    /** 请求里点了名就用点名的（必须是自己绑定的），没点名则只有一个绑定时自动用；多家时报错不猜。 */
    private Long resolveMyMerchant(Long requested, Long userId) {
        List<Long> mine = userMerchantMapper.selectList(
                        new LambdaQueryWrapper<UserMerchantEntity>()
                                .eq(UserMerchantEntity::getUserId, userId)
                                .eq(UserMerchantEntity::getStatus, 1))
                .stream().map(UserMerchantEntity::getMerchantId).collect(Collectors.toList());
        if (mine.isEmpty()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "当前账号还没有绑定经营主体，无法提交认证");
        }
        if (requested != null) {
            if (!mine.contains(requested)) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "你无权以该经营主体提交认证");
            }
            return requested;
        }
        if (mine.size() == 1) {
            return mine.get(0);
        }
        throw new BusinessException(ErrorCode.BAD_REQUEST, "你的账号绑定了多家经营主体，请指定 merchantId");
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private static String trim(String value) {
        return value == null ? null : (value.trim().isEmpty() ? null : value.trim());
    }

    @Data
    public static class SubmitRequest {
        private Long merchantId;
        private String companyName;
        private String creditCode;
        private String legalPerson;
        private String licenseNo;
        private String contactName;
        private String contactPhone;
        private String attachNote;
        private String businessLicenseUrl;
        private String legalPersonIdFrontUrl;
        private String legalPersonIdBackUrl;
    }

    @Data
    public static class AuditRequest {
        private String status;
        private String remark;
    }
}
