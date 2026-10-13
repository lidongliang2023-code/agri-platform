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
import org.springframework.web.bind.annotation.*;

import java.util.Date;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/trade/contract")
@RequiredArgsConstructor
public class ContractController {

    private final ContractMapper contractMapper;
    private final ContractTemplateMapper templateMapper;
    private final PlatformIdentityService identityService;

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

        if ("buyer".equals(signatoryType)) {
            contract.setBuyerSignStatus("signed");
            contract.setBuyerSignTime(new Date());
            contract.setBuyerSignIp(clientIp());
            contract.setBuyerSignature("SIGN-" + UUID.randomUUID().toString().substring(0, 32));
        } else if ("seller".equals(signatoryType)) {
            contract.setSellerSignStatus("signed");
            contract.setSellerSignTime(new Date());
            // 签署 IP 取服务端看到的来源地址，不采信请求体（那是可以随便填的留痕）
            contract.setSellerSignIp(clientIp());
            contract.setSellerSignature("SIGN-" + UUID.randomUUID().toString().substring(0, 32));
        }

        if ("signed".equals(contract.getBuyerSignStatus()) && "signed".equals(contract.getSellerSignStatus())) {
            contract.setContractStatus("signed");
            contract.setSignDate(new Date());
            contract.setEffectiveDate(new Date());
            
            contract.setChainStatus("success");
            // UUID 去掉横线是 32 位十六进制，取 64 位会越界（StringIndexOutOfBoundsException），
            // 而这一行正好在"双方都签完"的那一刻执行 —— 也就是说：
            // **双签走到最后一步必然 500，合同签署从来没有真正完成过。**
            // 拼两个 UUID 凑满 64 位十六进制。
            String hex = UUID.randomUUID().toString().replace("-", "")
                    + UUID.randomUUID().toString().replace("-", "");
            contract.setChainTxHash("0x" + hex.substring(0, 64));
            contract.setChainTime(new Date());
        }

        contract.setUpdateTime(new Date());
        int result = contractMapper.updateById(contract);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("签署失败");
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
}
