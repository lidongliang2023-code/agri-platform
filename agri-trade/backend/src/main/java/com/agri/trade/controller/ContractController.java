package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.Contract;
import com.agri.trade.entity.ContractTemplate;
import com.agri.trade.mapper.ContractMapper;
import com.agri.trade.mapper.ContractTemplateMapper;
import com.agri.trade.service.PlatformIdentityService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.util.Date;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@RestController
@RequestMapping("/api/trade/contract")
@RequiredArgsConstructor
public class ContractController {

    private static final long MAX_EVIDENCE_BYTES = 5L * 1024 * 1024;

    private final ContractMapper contractMapper;
    private final ContractTemplateMapper templateMapper;
    private final PlatformIdentityService identityService;

    @Value("${agri.trade.upload-dir:uploads}")
    private String uploadDir;

    @GetMapping("/template/page")
    public ApiResponse<IPage<ContractTemplate>> getTemplatePage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        Page<ContractTemplate> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<ContractTemplate> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ContractTemplate::getDelFlag, 0);
        wrapper.eq(ContractTemplate::getStatus, 1);
        wrapper.orderByAsc(ContractTemplate::getSortOrder);
        return ApiResponse.success(templateMapper.selectPage(page, wrapper));
    }

    @GetMapping("/template/list")
    public ApiResponse<List<ContractTemplate>> getTemplateList() {
        LambdaQueryWrapper<ContractTemplate> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ContractTemplate::getDelFlag, 0);
        wrapper.eq(ContractTemplate::getStatus, 1);
        return ApiResponse.success(templateMapper.selectList(wrapper));
    }

    @PostMapping("/template")
    @com.agri.common.rbac.OperatorOnly
    public ApiResponse<Boolean> createTemplate(@RequestBody ContractTemplate template) {
        template.setTemplateCode("CT" + System.currentTimeMillis());
        template.setDelFlag(0);
        template.setStatus(1);
        template.setCreateTime(new Date());
        template.setUpdateTime(new Date());
        int result = templateMapper.insert(template);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("创建失败");
    }

    @GetMapping("/page")
    public ApiResponse<IPage<Contract>> getContractPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String contractStatus,
            // 列表页的搜索框一直在，但后端从来没收过 contractNo —— 输了字点搜索没有任何变化。
            @RequestParam(required = false) String contractNo) {
        // 数据范围：只返回"我参与的合同"（我是买方或卖方）。
        // 这个接口原先**不给范围就返回全平台合同** —— 与订单/纠纷是同一个越权面，
        // 只是当时没一起收口。合同里有金额、签署状态与双方名称，更不该全量外露。
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        Page<Contract> page = new Page<>(pageNum, pageSize);
        if (!scope.hasBinding()) {
            return ApiResponse.success(page);
        }
        List<Long> mine = scope.merchantIds();
        LambdaQueryWrapper<Contract> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Contract::getDelFlag, 0);
        wrapper.and(w -> w.in(Contract::getBuyerId, mine).or().in(Contract::getSellerId, mine));
        if (contractStatus != null) wrapper.eq(Contract::getContractStatus, contractStatus);
        if (contractNo != null && !contractNo.isEmpty()) wrapper.like(Contract::getContractNo, contractNo);
        wrapper.orderByDesc(Contract::getCreateTime);
        return ApiResponse.success(contractMapper.selectPage(page, wrapper));
    }

    @GetMapping("/{id}")
    public ApiResponse<Contract> getContractById(@PathVariable Long id) {
        Contract contract = contractMapper.selectById(id);
        if (contract == null) return ApiResponse.error("合同不存在");
        String denied = denyIfNotParty(contract);
        if (denied != null) return ApiResponse.error(denied);
        return ApiResponse.success(contract);
    }

    @PostMapping
    public ApiResponse<Boolean> createContract(@RequestBody Contract contract) {
        contract.setContractNo("CO" + System.currentTimeMillis());
        contract.setDelFlag(0);
        contract.setContractStatus("draft");
        // 签署状态用词表里的 pending（原先这里写 unsigned，第三种写法，
        // 前端的状态映射认不出它，页面上会直接显示英文原文）
        contract.setBuyerSignStatus("pending");
        contract.setSellerSignStatus("pending");
        contract.setChainStatus("pending");
        contract.setCreateTime(new Date());
        contract.setUpdateTime(new Date());
        int result = contractMapper.insert(contract);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("创建失败");
    }

    @PostMapping("/{id}/sign")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<Boolean> signContract(@PathVariable Long id,
                                             @RequestBody(required = false) java.util.Map<String, String> params) {
        Contract contract = contractMapper.selectById(id);
        if (contract == null) return ApiResponse.error("合同不存在");

        // 签署方由服务端判定，**不采信请求体里的 signatoryType** ——
        // 原先签名侧完全由调用方声明，等于任何人（包括与合同无关的第三方）都能
        // 拿别人的合同签上"买方"或"卖方"，还能把两侧都签掉、直接把合同推成已生效。
        // 委托签署要留痕也应该走"授权"这一层，而不是让签名接口自己声明我是谁。
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        boolean amBuyer = contract.getBuyerId() != null && scope.merchantIds().contains(contract.getBuyerId());
        boolean amSeller = contract.getSellerId() != null && scope.merchantIds().contains(contract.getSellerId());
        if (!amBuyer && !amSeller) {
            return ApiResponse.error("只有合同当事人（买方或卖方）可以签署");
        }
        if ("cancelled".equals(contract.getContractStatus())) {
            return ApiResponse.error("合同已取消，不能再签署");
        }
        String signMode = params == null ? "online" : params.getOrDefault("signMode", "online");
        if (!"online".equals(signMode) && !"offline".equals(signMode)) {
            return ApiResponse.error("签署方式只能是 online（在线电子签章）或 offline（线下签署）");
        }
        String evidenceUrl = params == null ? null : params.get("evidenceUrl");
        if (evidenceUrl == null || evidenceUrl.isBlank()
                || !evidenceUrl.startsWith("/uploads/trade/contracts/")) {
            return ApiResponse.error("请先上传" + ("online".equals(signMode) ? "电子签章" : "线下签署合同文件"));
        }
        if (params == null || !Boolean.parseBoolean(params.get("confirmed"))) {
            return ApiResponse.error("请确认已核对合同内容并同意签署");
        }

        // 挑一侧来签：优先挑"我有资格、且还没签"的那一侧。
        // 一个人同时是买卖双方时（同一主体自签），第一次会签买方，第二次自然落到卖方。
        String signatoryType;
        if (amBuyer && !"signed".equals(contract.getBuyerSignStatus())) {
            signatoryType = "buyer";
        } else if (amSeller && !"signed".equals(contract.getSellerSignStatus())) {
            signatoryType = "seller";
        } else {
            return ApiResponse.error("你这一方已经签署过了，不能重复签署");
        }
        String signerName = params.get("signerName");
        if (signerName == null || signerName.isBlank()) {
            signerName = "buyer".equals(signatoryType) ? contract.getBuyerName() : contract.getSellerName();
        }
        if (signerName.length() > 80) {
            return ApiResponse.error("签署人姓名不能超过 80 个字符");
        }

        if ("buyer".equals(signatoryType)) {
            contract.setBuyerSignStatus("signed");
            contract.setBuyerSignTime(new Date());
            contract.setBuyerSignIp(clientIp());
            contract.setBuyerSignature(signatureEvidence(signMode, signerName, evidenceUrl));
        } else if ("seller".equals(signatoryType)) {
            contract.setSellerSignStatus("signed");
            contract.setSellerSignTime(new Date());
            // 签署 IP 取服务端看到的来源地址，不采信请求体（那是可以随便填的留痕）
            contract.setSellerSignIp(clientIp());
            contract.setSellerSignature(signatureEvidence(signMode, signerName, evidenceUrl));
        }
        if ("offline".equals(signMode)) {
            contract.setContractFileUrl(evidenceUrl);
        }

        contract.setContractHash(contractContentHash(contract));
        if ("signed".equals(contract.getBuyerSignStatus()) && "signed".equals(contract.getSellerSignStatus())) {
            contract.setContractStatus("signed");
            contract.setSignDate(new Date());
            contract.setEffectiveDate(new Date());
            
            contract.setChainStatus("success");
            contract.setChainTxHash(signatureHash(contract));
            contract.setChainTime(new Date());
        }

        contract.setUpdateTime(new Date());
        int result = contractMapper.updateById(contract);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("签署失败");
    }

    /**
     * 上传签署证据。在线签章限制为图片；线下签署允许 PDF、扫描件或照片。
     * 文件先落盘，再由签署接口把 URL、签署人、方式一并写入合同。
     */
    @PostMapping("/{id}/evidence")
    public ApiResponse<EvidenceView> uploadEvidence(@PathVariable Long id,
                                                    @RequestParam String signMode,
                                                    @RequestPart("file") MultipartFile file) throws IOException {
        Contract contract = contractMapper.selectById(id);
        if (contract == null) return ApiResponse.error("合同不存在");
        String denied = denyIfNotParty(contract);
        if (denied != null) return ApiResponse.error(denied);
        if ("cancelled".equals(contract.getContractStatus())) {
            return ApiResponse.error("合同已取消，不能上传签署证据");
        }
        if (file == null || file.isEmpty()) {
            return ApiResponse.error("请选择签署文件");
        }
        if (file.getSize() > MAX_EVIDENCE_BYTES) {
            return ApiResponse.error("签署文件不能超过 5MB");
        }
        if (!"online".equals(signMode) && !"offline".equals(signMode)) {
            return ApiResponse.error("不支持的签署方式");
        }
        String originalName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        String extension = "";
        int dot = originalName.lastIndexOf('.');
        if (dot >= 0) extension = originalName.substring(dot + 1).toLowerCase(Locale.ROOT);
        boolean image = List.of("png", "jpg", "jpeg", "webp").contains(extension);
        boolean document = image || "pdf".equals(extension);
        if ("online".equals(signMode) && !image) {
            return ApiResponse.error("在线电子签章请上传 PNG、JPG、JPEG 或 WEBP 图片");
        }
        if ("offline".equals(signMode) && !document) {
            return ApiResponse.error("线下签署请上传 PDF 或图片扫描件");
        }
        Path directory = Paths.get(uploadDir, "trade", "contracts").toAbsolutePath().normalize();
        Files.createDirectories(directory);
        String filename = "contract-" + id + "-" + UUID.randomUUID().toString().replace("-", "")
                + "." + extension;
        Path target = directory.resolve(filename).normalize();
        if (!target.startsWith(directory)) {
            return ApiResponse.error("文件路径不合法");
        }
        file.transferTo(target.toFile());
        return ApiResponse.success(new EvidenceView(
                "/uploads/trade/contracts/" + filename, originalName, file.getSize(), signMode));
    }

    public record EvidenceView(String url, String originalName, long size, String signMode) {
    }

    @PostMapping("/{id}/archive")
    public ApiResponse<Boolean> archiveContract(@PathVariable Long id) {
        Contract contract = contractMapper.selectById(id);
        if (contract == null) return ApiResponse.error("合同不存在");
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        boolean party = (contract.getBuyerId() != null && scope.merchantIds().contains(contract.getBuyerId()))
                || (contract.getSellerId() != null && scope.merchantIds().contains(contract.getSellerId()));
        if (!party) {
            return ApiResponse.error("只有合同当事人可以归档");
        }
        contract.setArchiveStatus("archived");
        contract.setArchiveTime(new Date());
        contract.setUpdateTime(new Date());
        int result = contractMapper.updateById(contract);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("归档失败");
    }

    /** 取服务端看到的调用方地址，用于签署留痕。 */
    private static String clientIp() {
        org.springframework.web.context.request.ServletRequestAttributes attributes =
                (org.springframework.web.context.request.ServletRequestAttributes)
                        org.springframework.web.context.request.RequestContextHolder.getRequestAttributes();
        if (attributes == null) {
            return null;
        }
        String forwarded = attributes.getRequest().getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isEmpty()) {
            return forwarded.split(",")[0].trim();
        }
        return attributes.getRequest().getRemoteAddr();
    }

    /** 合同详情也只允许买卖双方查看。 */
    private String denyIfNotParty(Contract contract) {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) return scope.error();
        if (!scope.hasBinding()) return "当前账号还没有绑定经营主体";
        boolean party = (contract.getBuyerId() != null && scope.merchantIds().contains(contract.getBuyerId()))
                || (contract.getSellerId() != null && scope.merchantIds().contains(contract.getSellerId()));
        return party ? null : "只有合同当事人可以查看或签署该合同";
    }

    private static String signatureEvidence(String signMode, String signerName, String evidenceUrl) {
        String value = signMode.toUpperCase(Locale.ROOT) + "|" + signerName.trim() + "|" + evidenceUrl;
        return value.length() <= 255 ? value : value.substring(0, 255);
    }

    private static String contractContentHash(Contract contract) {
        String content = String.join("|",
                contract.getContractNo(),
                contract.getOrderNo(),
                String.valueOf(contract.getBuyerId()),
                String.valueOf(contract.getSellerId()),
                String.valueOf(contract.getContractAmount()),
                String.valueOf(contract.getBuyerSignature()),
                String.valueOf(contract.getSellerSignature()));
        return sha256(content);
    }

    private static String signatureHash(Contract contract) {
        return "0x" + sha256(String.join("|",
                contract.getContractHash(),
                String.valueOf(contract.getBuyerSignTime()),
                String.valueOf(contract.getSellerSignTime())));
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException("合同存证哈希计算失败", e);
        }
    }
}
