package com.agri.platform.internal.account;

import com.agri.platform.internal.merchant.MerchantCertificationFileService;
import com.agri.platform.internal.merchant.MerchantEntity;
import com.agri.platform.internal.merchant.MerchantMapper;
import com.agri.platform.internal.merchant.UserMerchantEntity;
import com.agri.platform.internal.merchant.UserMerchantMapper;
import com.agri.platform.internal.sso.SsoSessionService;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/** 门户个人中心的上传与预览入口，访问权限一律以 SSO 会话和主体绑定关系为准。 */
@RestController
@RequestMapping("/api/v1/sso/account/businesses/{merchantId}/certification-files")
@RequiredArgsConstructor
public class CertificationFileController {

    private final SsoSessionService sessionService;
    private final MerchantCertificationFileService fileService;
    private final MerchantMapper merchantMapper;
    private final UserMerchantMapper userMerchantMapper;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<MerchantCertificationFileService.UploadedFile> upload(
            @PathVariable Long merchantId,
            @RequestParam String kind,
            @RequestPart("file") MultipartFile file,
            HttpServletRequest request) throws IOException {
        requireEnterpriseAccess(merchantId, request);
        return ApiResponse.ok(fileService.store(merchantId, kind, file));
    }

    @GetMapping("/{kind}/{fileId}")
    public ResponseEntity<Resource> preview(@PathVariable Long merchantId,
                                            @PathVariable String kind,
                                            @PathVariable String fileId,
                                            HttpServletRequest request) {
        requireEnterpriseAccess(merchantId, request);
        Resource resource = fileService.load(merchantId, kind, fileId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(fileService.mediaType(fileId)))
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .body(resource);
    }

    private void requireEnterpriseAccess(Long merchantId, HttpServletRequest request) {
        long[] session = sessionService.resolve(request);
        if (session == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "请先登录后操作认证材料");
        }
        Long bound = userMerchantMapper.selectCount(new LambdaQueryWrapper<UserMerchantEntity>()
                .eq(UserMerchantEntity::getUserId, session[0])
                .eq(UserMerchantEntity::getMerchantId, merchantId)
                .eq(UserMerchantEntity::getStatus, 1));
        if (bound == null || bound == 0) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "无权访问该主体的认证材料");
        }
        MerchantEntity merchant = merchantMapper.selectById(merchantId);
        if (merchant == null || "personal".equalsIgnoreCase(merchant.getMemberType())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "该主体不是企业主体");
        }
    }
}
