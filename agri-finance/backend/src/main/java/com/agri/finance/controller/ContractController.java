package com.agri.finance.controller;

import com.agri.finance.entity.Contract;
import com.agri.finance.service.impl.ContractServiceImpl;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/contract")
public class ContractController {

    private final ContractServiceImpl contractService;

    public ContractController(ContractServiceImpl contractService) {
        this.contractService = contractService;
    }

    @PostMapping("/create")
    public Map<String, Object> createContract(@RequestBody Contract contract) {
        Contract result = contractService.createContract(contract);
        return Map.of("code", 200, "message", "success", "data", result);
    }

    @GetMapping("/list")
    public Map<String, Object> getContracts(@RequestParam(defaultValue = "") String userId) {
        LambdaQueryWrapper<Contract> query = new LambdaQueryWrapper<>();
        query.eq(Contract::getDelFlag, 0);
        if (!userId.isEmpty()) {
            query.eq(Contract::getUserId, userId);
        }
        var list = contractService.list(query);
        return Map.of("code", 200, "message", "success", "data", list);
    }

    @GetMapping("/{id}")
    public Map<String, Object> getContract(@PathVariable String id) {
        Contract contract = contractService.getById(id);
        return Map.of("code", 200, "message", "success", "data", contract);
    }

    @PostMapping("/sign")
    public Map<String, Object> signContract(@RequestBody Map<String, String> request) {
        String id = request.get("id");
        String signType = request.get("signType");
        Contract contract = contractService.signContract(id, signType);
        return Map.of("code", 200, "message", "success", "data", contract);
    }
}