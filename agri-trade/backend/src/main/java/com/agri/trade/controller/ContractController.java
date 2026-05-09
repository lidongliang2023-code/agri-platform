package com.agri.iot.controller.trade;

import com.agri.common.entity.ApiResponse;
import com.agri.iot.entity.trade.Contract;
import com.agri.iot.entity.trade.ContractTemplate;
import com.agri.iot.mapper.trade.ContractMapper;
import com.agri.iot.mapper.trade.ContractTemplateMapper;
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
            @RequestParam(required = false) Long buyerId,
            @RequestParam(required = false) Long sellerId,
            @RequestParam(required = false) String contractStatus) {
        Page<Contract> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Contract> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Contract::getDelFlag, 0);
        if (buyerId != null) wrapper.eq(Contract::getBuyerId, buyerId);
        if (sellerId != null) wrapper.eq(Contract::getSellerId, sellerId);
        if (contractStatus != null) wrapper.eq(Contract::getContractStatus, contractStatus);
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