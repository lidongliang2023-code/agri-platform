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
        contract.setBuyerSignStatus("unsigned");
        contract.setSellerSignStatus("unsigned");
        contract.setChainStatus("pending");
        contract.setCreateTime(new Date());
        contract.setUpdateTime(new Date());
        int result = contractMapper.insert(contract);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("创建失败");
    }

    @PostMapping("/{id}/sign")
    public ApiResponse<Boolean> signContract(@PathVariable Long id, @RequestBody java.util.Map<String, String> params) {
        Contract contract = contractMapper.selectById(id);
        if (contract == null) return ApiResponse.error("合同不存在");

        String signatoryType = params.get("signatoryType");
        if ("buyer".equals(signatoryType)) {
            contract.setBuyerSignStatus("signed");
            contract.setBuyerSignTime(new Date());
            contract.setBuyerSignIp(params.get("signIp"));
            contract.setBuyerSignature("SIGN-" + UUID.randomUUID().toString().substring(0, 32));
        } else if ("seller".equals(signatoryType)) {
            contract.setSellerSignStatus("signed");
            contract.setSellerSignTime(new Date());
            contract.setSellerSignIp(params.get("signIp"));
            contract.setSellerSignature("SIGN-" + UUID.randomUUID().toString().substring(0, 32));
        }

        if ("signed".equals(contract.getBuyerSignStatus()) && "signed".equals(contract.getSellerSignStatus())) {
            contract.setContractStatus("signed");
            contract.setSignDate(new Date());
            contract.setEffectiveDate(new Date());
            
            contract.setChainStatus("success");
            contract.setChainTxHash("0x" + UUID.randomUUID().toString().replace("-", "").substring(0, 64));
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
        contract.setArchiveStatus("archived");
        contract.setArchiveTime(new Date());
        contract.setUpdateTime(new Date());
        int result = contractMapper.updateById(contract);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("归档失败");
    }
}
