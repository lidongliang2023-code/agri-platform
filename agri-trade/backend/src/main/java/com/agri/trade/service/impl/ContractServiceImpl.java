package com.agri.trade.service.impl;

import com.agri.trade.entity.Contract;
import com.agri.trade.entity.ContractTemplate;
import com.agri.trade.entity.ContractSignature;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.mapper.ContractMapper;
import com.agri.trade.mapper.ContractTemplateMapper;
import com.agri.trade.mapper.ContractSignatureMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.service.IContractService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ContractServiceImpl extends ServiceImpl<ContractMapper, Contract> implements IContractService {

    private final ContractTemplateMapper templateMapper;
    private final ContractSignatureMapper signatureMapper;
    private final TradeOrderMapper orderMapper;

    @Override
    @Transactional
    public Contract createContractFromOrder(Long orderId, Long templateId) {
        TradeOrder order = orderMapper.selectById(orderId);
        if (order == null) {
            return null;
        }

        ContractTemplate template = templateMapper.selectById(templateId);
        String contractContent = "";
        if (template != null) {
            contractContent = renderTemplate(template, order);
        }

        Contract contract = new Contract();
        contract.setContractNo("CT" + System.currentTimeMillis());
        contract.setContractName("农产品采购合同");
        contract.setContractType("purchase");
        contract.setTemplateId(templateId);
        contract.setOrderId(orderId);
        contract.setOrderNo(order.getOrderNo());
        contract.setBuyerId(order.getBuyerId());
        contract.setBuyerName(order.getBuyerName());
        contract.setBuyerSignStatus("pending");
        contract.setSellerId(order.getSellerId());
        contract.setSellerName(order.getSellerName());
        contract.setSellerSignStatus("pending");
        contract.setContractContent(contractContent);
        contract.setContractAmount(order.getTotalAmount());
        contract.setDeliveryDate(order.getDeliveryDeadline());
        contract.setDeliveryAddress(order.getDeliveryAddress());
        contract.setContractStatus("draft");
        contract.setDelFlag(0);
        contract.setCreateTime(new Date());
        contract.setUpdateTime(new Date());

        baseMapper.insert(contract);
        return contract;
    }

    @Override
    @Transactional
    public Contract createContract(Long buyerId, Long sellerId, Long templateId, String contractContent) {
        ContractTemplate template = templateMapper.selectById(templateId);
        String templateName = template != null ? template.getTemplateName() : "自定义合同";

        Contract contract = new Contract();
        contract.setContractNo("CT" + System.currentTimeMillis());
        contract.setContractName(templateName);
        contract.setContractType("custom");
        contract.setTemplateId(templateId);
        contract.setBuyerId(buyerId);
        contract.setBuyerSignStatus("pending");
        contract.setSellerId(sellerId);
        contract.setSellerSignStatus("pending");
        contract.setContractContent(contractContent);
        contract.setContractStatus("draft");
        contract.setDelFlag(0);
        contract.setCreateTime(new Date());
        contract.setUpdateTime(new Date());

        baseMapper.insert(contract);
        return contract;
    }

    @Override
    @Transactional
    public boolean signContract(Long contractId, Long signatoryId, String signatoryType, String signatureData, String signIp) {
        Contract contract = baseMapper.selectById(contractId);
        if (contract == null) {
            return false;
        }

        ContractSignature signature = new ContractSignature();
        signature.setContractId(contractId);
        signature.setSignatoryType(signatoryType);
        signature.setSignatoryId(signatoryId);
        signature.setSignStatus("signed");
        signature.setSignTime(new Date());
        signature.setSignIp(signIp);
        signature.setSignatureData(signatureData);
        signature.setSignMethod("electronic");
        signature.setSignResult("success");
        signature.setDelFlag(0);
        signature.setCreateTime(new Date());

        signatureMapper.insert(signature);

        if ("buyer".equals(signatoryType)) {
            contract.setBuyerSignStatus("signed");
            contract.setBuyerSignTime(new Date());
            contract.setBuyerSignIp(signIp);
            contract.setBuyerSignature(signatureData);
        } else if ("seller".equals(signatoryType)) {
            contract.setSellerSignStatus("signed");
            contract.setSellerSignTime(new Date());
            contract.setSellerSignIp(signIp);
            contract.setSellerSignature(signatureData);
        }

        if ("signed".equals(contract.getBuyerSignStatus()) && "signed".equals(contract.getSellerSignStatus())) {
            contract.setContractStatus("effective");
            contract.setSignDate(new Date());
            contract.setEffectiveDate(new Date());
            contract.setExpireDate(new Date(System.currentTimeMillis() + 365 * 24 * 60 * 60 * 1000L));
        }

        contract.setUpdateTime(new Date());
        baseMapper.updateById(contract);

        return true;
    }

    @Override
    public boolean buyerSign(Long contractId, Long buyerId, String signatureData, String signIp) {
        return signContract(contractId, buyerId, "buyer", signatureData, signIp);
    }

    @Override
    public boolean sellerSign(Long contractId, Long sellerId, String signatureData, String signIp) {
        return signContract(contractId, sellerId, "seller", signatureData, signIp);
    }

    @Override
    public ContractTemplate getDefaultTemplate(String contractType) {
        LambdaQueryWrapper<ContractTemplate> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ContractTemplate::getTemplateType, contractType);
        wrapper.eq(ContractTemplate::getIsDefault, 1);
        wrapper.eq(ContractTemplate::getStatus, 1);
        wrapper.eq(ContractTemplate::getDelFlag, 0);
        return templateMapper.selectOne(wrapper);
    }

    @Override
    public List<ContractTemplate> getAvailableTemplates() {
        LambdaQueryWrapper<ContractTemplate> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ContractTemplate::getStatus, 1);
        wrapper.eq(ContractTemplate::getDelFlag, 0);
        wrapper.orderByAsc(ContractTemplate::getSortOrder);
        return templateMapper.selectList(wrapper);
    }

    @Override
    @Transactional
    public ContractTemplate createTemplate(ContractTemplate template) {
        template.setTemplateCode("TP" + System.currentTimeMillis());
        template.setStatus(1);
        template.setDelFlag(0);
        template.setCreateTime(new Date());
        template.setUpdateTime(new Date());
        templateMapper.insert(template);
        return template;
    }

    @Override
    @Transactional
    public ContractTemplate updateTemplate(ContractTemplate template) {
        template.setUpdateTime(new Date());
        templateMapper.updateById(template);
        return template;
    }

    @Override
    @Transactional
    public boolean deleteTemplate(Long templateId) {
        ContractTemplate template = templateMapper.selectById(templateId);
        if (template != null) {
            template.setDelFlag(1);
            template.setUpdateTime(new Date());
            templateMapper.updateById(template);
            return true;
        }
        return false;
    }

    @Override
    @Transactional
    public boolean archiveContract(Long contractId) {
        Contract contract = baseMapper.selectById(contractId);
        if (contract != null) {
            contract.setArchiveStatus("archived");
            contract.setArchiveTime(new Date());
            contract.setContractStatus("archived");
            contract.setUpdateTime(new Date());
            baseMapper.updateById(contract);
            return true;
        }
        return false;
    }

    @Override
    @Transactional
    public boolean submitToChain(Long contractId) {
        Contract contract = baseMapper.selectById(contractId);
        if (contract == null) {
            return false;
        }

        String txHash = UUID.randomUUID().toString();
        contract.setChainStatus("success");
        contract.setChainTxHash(txHash);
        contract.setChainTime(new Date());
        contract.setContractHash(txHash);
        contract.setUpdateTime(new Date());
        baseMapper.updateById(contract);

        return true;
    }

    @Override
    public ContractSignature getSignature(Long contractId, String signatoryType) {
        LambdaQueryWrapper<ContractSignature> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ContractSignature::getContractId, contractId);
        wrapper.eq(ContractSignature::getSignatoryType, signatoryType);
        wrapper.eq(ContractSignature::getDelFlag, 0);
        return signatureMapper.selectOne(wrapper);
    }

    @Override
    public List<Contract> getContractsByBuyer(Long buyerId) {
        LambdaQueryWrapper<Contract> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Contract::getBuyerId, buyerId);
        wrapper.eq(Contract::getDelFlag, 0);
        wrapper.orderByDesc(Contract::getCreateTime);
        return baseMapper.selectList(wrapper);
    }

    @Override
    public List<Contract> getContractsBySeller(Long sellerId) {
        LambdaQueryWrapper<Contract> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Contract::getSellerId, sellerId);
        wrapper.eq(Contract::getDelFlag, 0);
        wrapper.orderByDesc(Contract::getCreateTime);
        return baseMapper.selectList(wrapper);
    }

    @Override
    public Contract getContractByOrder(Long orderId) {
        LambdaQueryWrapper<Contract> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Contract::getOrderId, orderId);
        wrapper.eq(Contract::getDelFlag, 0);
        return baseMapper.selectOne(wrapper);
    }

    private String renderTemplate(ContractTemplate template, TradeOrder order) {
        String content = template.getTemplateContent();
        content = content.replace("${buyerName}", order.getBuyerName());
        content = content.replace("${sellerName}", order.getSellerName());
        content = content.replace("${orderNo}", order.getOrderNo());
        content = content.replace("${amount}", order.getTotalAmount().toString());
        content = content.replace("${deliveryAddress}", order.getDeliveryAddress());
        content = content.replace("${deliveryDate}", order.getDeliveryDeadline() != null ? order.getDeliveryDeadline().toString() : "");
        return content;
    }
}