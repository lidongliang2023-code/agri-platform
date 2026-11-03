package com.agri.finance.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.finance.entity.Contract;
import com.agri.finance.entity.FundProvider;
import com.agri.finance.entity.Loan;
import com.agri.finance.entity.LoanApplication;
import com.agri.finance.entity.FinanceProductConfig;
import com.agri.finance.mapper.FinanceProductConfigMapper;
import com.agri.finance.service.FinanceIdentityService;
import com.agri.finance.service.ILoanApplicationService;
import com.agri.finance.service.ILoanService;
import com.agri.finance.service.impl.FundProviderServiceImpl;
import com.agri.finance.service.impl.BlacklistServiceImpl;
import com.agri.finance.service.impl.LoanApprovalServiceImpl;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/loan")
public class LoanController {

    private static final long MAX_EVIDENCE_SIZE = 5L * 1024 * 1024;

    private final ILoanApplicationService loanApplicationService;
    private final ILoanService loanService;
    private final FinanceProductConfigMapper productConfigMapper;
    private final LoanApprovalServiceImpl approvalService;
    private final FundProviderServiceImpl providerService;
    private final BlacklistServiceImpl blacklistService;
    private final FinanceIdentityService identityService;

    public LoanController(
            ILoanApplicationService loanApplicationService,
            ILoanService loanService,
            FinanceProductConfigMapper productConfigMapper,
            LoanApprovalServiceImpl approvalService,
            FundProviderServiceImpl providerService,
            BlacklistServiceImpl blacklistService,
            FinanceIdentityService identityService) {
        this.loanApplicationService = loanApplicationService;
        this.loanService = loanService;
        this.productConfigMapper = productConfigMapper;
        this.approvalService = approvalService;
        this.providerService = providerService;
        this.blacklistService = blacklistService;
        this.identityService = identityService;
    }

    @PostMapping("/apply")
    @OperatorOnly("finance:borrower")
    public Map<String, Object> applyLoan(@RequestBody LoanApplication application) {
        if (application == null) {
            return Map.of("code", 400, "message", "缺少融资申请内容", "data", "");
        }
        // 融资主体由令牌决定：请求里传谁的主体号都不作数，避免替别人发起申请
        String subjectId = identityService.currentBorrowerId();
        com.agri.finance.entity.Blacklist blocked = blacklistService.activeEntry(subjectId);
        if (blocked != null) {
            return Map.of("code", 403, "message",
                    "主体已在黑名单（" + blocked.getListNo() + "）：" + blocked.getReason() + "，结清并整改后可申请解除", "data", "");
        }
        application.setUserId(subjectId);
        application.setUserName(identityService.currentBorrowerName());
        if (application.getProductType() == null || application.getProductType().isBlank()) {
            return Map.of("code", 400, "message", "请选择融资产品", "data", "");
        }
        if (application.getApplyAmount() == null || application.getApplyAmount().signum() <= 0) {
            return Map.of("code", 400, "message", "融资金额必须大于0", "data", "");
        }
        if (application.getApplyTerm() == null || application.getApplyTerm() <= 0) {
            return Map.of("code", 400, "message", "融资期限必须大于0", "data", "");
        }
        FinanceProductConfig product = productConfigMapper.selectOne(
                new LambdaQueryWrapper<FinanceProductConfig>()
                        .eq(FinanceProductConfig::getProductCode, application.getProductType().trim().toLowerCase())
                        .eq(FinanceProductConfig::getStatus, "启用")
                        .eq(FinanceProductConfig::getDelFlag, 0)
                        .last("LIMIT 1")
        );
        if (product == null) {
            return Map.of("code", 400, "message", "所选融资产品不存在或已停用", "data", "");
        }
        if (application.getApplyAmount().compareTo(product.getAmountMin()) < 0
                || application.getApplyAmount().compareTo(product.getAmountMax()) > 0) {
            return Map.of("code", 400, "message", "申请金额超出产品额度范围", "data", "");
        }
        if (application.getApplyTerm() < product.getTermMin() || application.getApplyTerm() > product.getTermMax()) {
            return Map.of("code", 400, "message", "申请期限超出产品期限范围", "data", "");
        }
        LoanApplication result = loanApplicationService.apply(application);
        return Map.of("code", 200, "message", "success", "data", result);
    }

    @PostMapping("/evidence")
    @OperatorOnly("finance:borrower")
    public Map<String, Object> uploadEvidence(@RequestPart("file") MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            return Map.of("code", 400, "message", "请选择补充材料", "data", "");
        }
        if (file.getSize() > MAX_EVIDENCE_SIZE) {
            return Map.of("code", 400, "message", "补充材料不能超过 5MB", "data", "");
        }
        String originalName = file.getOriginalFilename() == null ? "evidence" : file.getOriginalFilename();
        int dot = originalName.lastIndexOf('.');
        String extension = dot >= 0 ? originalName.substring(dot + 1).toLowerCase(Locale.ROOT) : "";
        if (!java.util.Set.of("pdf", "png", "jpg", "jpeg", "webp").contains(extension)) {
            return Map.of("code", 400, "message", "仅支持 PDF、PNG、JPG、JPEG 或 WEBP", "data", "");
        }
        Path directory = Paths.get("uploads", "finance", "applications").toAbsolutePath().normalize();
        Files.createDirectories(directory);
        String filename = "finance-" + UUID.randomUUID().toString().replace("-", "") + "." + extension;
        Path target = directory.resolve(filename).normalize();
        if (!target.startsWith(directory)) {
            return Map.of("code", 400, "message", "文件路径不合法", "data", "");
        }
        file.transferTo(target);
        return Map.of(
                "code", 200,
                "message", "success",
                "data", Map.of(
                        "url", "/uploads/finance/applications/" + filename,
                        "originalName", originalName,
                        "size", file.getSize()
                )
        );
    }

    @GetMapping("/applications")
    public Map<String, Object> getApplications(@RequestParam(defaultValue = "") String status,
                                               @RequestParam(defaultValue = "") String userId) {
        LambdaQueryWrapper<LoanApplication> query = new LambdaQueryWrapper<>();
        query.eq(LoanApplication::getDelFlag, 0);
        String scope = identityService.scopedBorrowerId(userId);
        if (scope != null) {
            query.eq(LoanApplication::getUserId, scope);
        }
        if (!status.isEmpty()) {
            query.eq(LoanApplication::getStatus, status);
        }
        query.orderByDesc(LoanApplication::getApplyTime);
        var list = loanApplicationService.list(query);
        return Map.of("code", 200, "message", "success", "data", list);
    }

    /** 审批池（资金方/运营视角）：跨主体看待审申请，融资方拿不到这个入口。 */
    @GetMapping("/applications/review-pool")
    @OperatorOnly("finance:review")
    public Map<String, Object> reviewPool(@RequestParam(defaultValue = "待审批") String status) {
        LambdaQueryWrapper<LoanApplication> query = new LambdaQueryWrapper<>();
        query.eq(LoanApplication::getDelFlag, 0);
        query.eq(LoanApplication::getStatus, status);
        query.orderByDesc(LoanApplication::getApplyTime);
        return Map.of("code", 200, "message", "success", "data", loanApplicationService.list(query));
    }

    @GetMapping("/application/{id}")
    public Map<String, Object> getApplication(@PathVariable String id) {
        LoanApplication application = loanApplicationService.getById(id);
        if (application == null) {
            return Map.of("code", 404, "message", "融资申请不存在", "data", "");
        }
        identityService.assertBorrowerOwns(application.getUserId());
        return Map.of("code", 200, "message", "success", "data", application);
    }

    /**
     * 融资方确认借款：生成待签合同。
     *
     * <p>原先这个按钮直接调 {@code POST /loan/create}，而它要 {@code finance:review}，
     * 融资方账号一点就 403；而且那一步会把借款直接置为「还款中」并起算还款计划 ——
     * 合同还没签，债已经记上了。</p>
     */
    @PostMapping("/{id}/accept")
    @OperatorOnly("finance:borrower")
    public Map<String, Object> accept(@PathVariable String id) {
        LoanApplication application = loanApplicationService.getById(id);
        if (application == null) {
            return Map.of("code", 404, "message", "融资申请不存在", "data", "");
        }
        identityService.assertBorrowerOwns(application.getUserId());
        Contract contract = loanService.prepareContract(id);
        return Map.of("code", 200, "message", "借款合同已生成，请签署", "data", contract);
    }

    @PostMapping("/review")
    @OperatorOnly("finance:review")
    public Map<String, Object> reviewApplication(@RequestBody Map<String, Object> request) {
        String id = text(request.get("id"));
        String result = text(request.get("result"));
        String opinion = text(request.get("opinion"));

        if (id == null || id.isBlank()) {
            return Map.of("code", 400, "message", "缺少融资申请编号", "data", "");
        }
        BigDecimal amount;
        BigDecimal rate;
        try {
            amount = request.get("amount") == null ? null : new BigDecimal(request.get("amount").toString());
            rate = request.get("rate") == null ? null : new BigDecimal(request.get("rate").toString());
        } catch (NumberFormatException error) {
            return Map.of("code", 400, "message", "审批金额或利率格式不正确", "data", "");
        }
        // 审批机构与审批人都取当前登录者绑定的资金机构，不接受前端自报
        FundProvider provider = resolveProvider(text(request.get("providerId")));
        return approvalService.review(
                id,
                provider.getId(),
                provider.getInstitutionName(),
                normalizeDecision(result),
                opinion,
                amount,
                rate,
                identityService.currentOperatorId(),
                identityService.currentOperatorName()
        );
    }

    @GetMapping("/approval/overview")
    @OperatorOnly("finance:review")
    public Map<String, Object> approvalOverview(@RequestParam(defaultValue = "") String providerId) {
        return Map.of("code", 200, "message", "success",
                "data", approvalService.overview(resolveProvider(providerId).getId()));
    }

    @GetMapping("/list")
    public Map<String, Object> getLoans(@RequestParam(defaultValue = "") String userId) {
        LambdaQueryWrapper<Loan> query = new LambdaQueryWrapper<>();
        query.eq(Loan::getDelFlag, 0);
        String scope = identityService.scopedBorrowerId(userId);
        if (scope != null) {
            query.eq(Loan::getUserId, scope);
        }
        query.orderByDesc(Loan::getLoanDate);
        var list = loanService.list(query);
        return Map.of("code", 200, "message", "success", "data", list);
    }

    @GetMapping("/{id}")
    public Map<String, Object> getLoan(@PathVariable String id) {
        Loan loan = loanService.getById(id);
        if (loan == null) {
            return Map.of("code", 404, "message", "借款不存在", "data", "");
        }
        identityService.assertBorrowerOwns(loan.getUserId());
        return Map.of("code", 200, "message", "success", "data", loan);
    }

    /** 人工放款（资金方/运营）：同样必须已过合同签署闸门。 */
    @PostMapping("/disburse")
    @OperatorOnly("finance:review")
    public Map<String, Object> disburse(@RequestBody Map<String, String> request) {
        String applicationId = request.get("applicationId");
        if (applicationId == null || applicationId.isBlank()) {
            return Map.of("code", 400, "message", "缺少融资申请编号", "data", "");
        }
        return Map.of("code", 200, "message", "放款成功", "data", loanService.disburse(applicationId));
    }

    private FundProvider resolveProvider(String requested) {
        String providerId = identityService.providerIdFor(requested);
        FundProvider provider = providerService.getById(providerId);
        if (provider == null || Integer.valueOf(1).equals(provider.getDelFlag())) {
            throw new com.agri.common.exception.BusinessException(404, "资金机构不存在：" + providerId);
        }
        return provider;
    }

    /** 审批结论归一：前端历史上传过「通过/拒绝」，落库口径统一为「已通过/已拒绝」。 */
    private String normalizeDecision(String result) {
        if (result == null || result.isBlank()) {
            return "已通过";
        }
        return switch (result.trim()) {
            case "通过", "已通过" -> "已通过";
            default -> "已拒绝";
        };
    }

    private String text(Object value) {
        return value == null ? null : value.toString();
    }
}
