package com.agri.trade.service;

import com.agri.trade.entity.Contract;
import com.agri.trade.entity.ContractTemplate;
import com.agri.trade.entity.ContractSignature;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;

public interface IContractService extends IService<Contract> {

    Contract createContractFromOrder(Long orderId, Long templateId);

    Contract createContract(Long buyerId, Long sellerId, Long templateId, String contractContent);

    boolean signContract(Long contractId, Long signatoryId, String signatoryType, String signatureData, String signIp);

    boolean buyerSign(Long contractId, Long buyerId, String signatureData, String signIp);

    boolean sellerSign(Long contractId, Long sellerId, String signatureData, String signIp);

    ContractTemplate getDefaultTemplate(String contractType);

    List<ContractTemplate> getAvailableTemplates();

    ContractTemplate createTemplate(ContractTemplate template);

    ContractTemplate updateTemplate(ContractTemplate template);

    boolean deleteTemplate(Long templateId);

    boolean archiveContract(Long contractId);

    boolean submitToChain(Long contractId);

    ContractSignature getSignature(Long contractId, String signatoryType);

    List<Contract> getContractsByBuyer(Long buyerId);

    List<Contract> getContractsBySeller(Long sellerId);

    Contract getContractByOrder(Long orderId);
}