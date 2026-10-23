package com.agri.finance.controller;

import com.agri.finance.entity.Loan;
import com.agri.finance.entity.LoanApplication;
import com.agri.finance.service.ILoanApplicationService;
import com.agri.finance.service.ILoanService;
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

    public LoanController(ILoanApplicationService loanApplicationService, ILoanService loanService) {
        this.loanApplicationService = loanApplicationService;
        this.loanService = loanService;
    }

    @PostMapping("/apply")
    public Map<String, Object> applyLoan(@RequestBody LoanApplication application) {
        if (application == null || application.getUserId() == null || application.getUserId().isBlank()) {
            return Map.of("code", 400, "message", "缺少融资方主体", "data", "");
        }
        if (application.getProductType() == null || application.getProductType().isBlank()) {
            return Map.of("code", 400, "message", "请选择融资产品", "data", "");
        }
        if (application.getApplyAmount() == null || application.getApplyAmount().signum() <= 0) {
            return Map.of("code", 400, "message", "融资金额必须大于0", "data", "");
        }
        if (application.getApplyTerm() == null || application.getApplyTerm() <= 0) {
            return Map.of("code", 400, "message", "融资期限必须大于0", "data", "");
        }
        LoanApplication result = loanApplicationService.apply(application);
        return Map.of("code", 200, "message", "success", "data", result);
    }

    @PostMapping("/evidence")
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
        if (!userId.isEmpty()) {
            query.eq(LoanApplication::getUserId, userId);
        }
        if (!status.isEmpty()) {
            query.eq(LoanApplication::getStatus, status);
        }
        query.orderByDesc(LoanApplication::getApplyTime);
        var list = loanApplicationService.list(query);
        return Map.of("code", 200, "message", "success", "data", list);
    }

    @GetMapping("/application/{id}")
    public Map<String, Object> getApplication(@PathVariable String id) {
        LoanApplication application = loanApplicationService.getById(id);
        return Map.of("code", 200, "message", "success", "data", application);
    }

    @PostMapping("/review")
    public Map<String, Object> reviewApplication(@RequestBody Map<String, Object> request) {
        String id = (String) request.get("id");
        String result = (String) request.get("result");
        String opinion = (String) request.get("opinion");
        BigDecimal amount = request.get("amount") != null ? new BigDecimal(request.get("amount").toString()) : null;
        BigDecimal rate = request.get("rate") != null ? new BigDecimal(request.get("rate").toString()) : null;
        
        LoanApplication application = loanApplicationService.review(id, result, opinion, amount, rate);
        return Map.of("code", 200, "message", "success", "data", application);
    }

    @GetMapping("/list")
    public Map<String, Object> getLoans(@RequestParam(defaultValue = "") String userId) {
        LambdaQueryWrapper<Loan> query = new LambdaQueryWrapper<>();
        query.eq(Loan::getDelFlag, 0);
        if (!userId.isEmpty()) {
            query.eq(Loan::getUserId, userId);
        }
        query.orderByDesc(Loan::getLoanDate);
        var list = loanService.list(query);
        return Map.of("code", 200, "message", "success", "data", list);
    }

    @GetMapping("/{id}")
    public Map<String, Object> getLoan(@PathVariable String id) {
        Loan loan = loanService.getById(id);
        return Map.of("code", 200, "message", "success", "data", loan);
    }

    @PostMapping("/create")
    public Map<String, Object> createLoan(@RequestBody Map<String, String> request) {
        String applicationId = request.get("applicationId");
        Loan loan = loanService.createLoan(applicationId);
        if (loan == null) {
            return Map.of("code", 400, "message", "申请未通过或不存在");
        }
        return Map.of("code", 200, "message", "success", "data", loan);
    }
}
