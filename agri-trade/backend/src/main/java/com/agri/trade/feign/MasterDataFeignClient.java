package com.agri.trade.feign;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.Map;

@FeignClient(name = "masterdata", url = "${services.masterdata.url}")
public interface MasterDataFeignClient {

    @GetMapping("/api/masterdata/user/{id}")
    Map<String, Object> getUserById(@PathVariable Long id);

    @GetMapping("/api/masterdata/user/info")
    Map<String, Object> getUserInfo(@RequestParam Long userId);

    @GetMapping("/api/masterdata/customer/{id}")
    Map<String, Object> getCustomerById(@PathVariable Long id);

    @GetMapping("/api/masterdata/supplier/{id}")
    Map<String, Object> getSupplierById(@PathVariable Long id);

    @GetMapping("/api/masterdata/product/{id}")
    Map<String, Object> getProductById(@PathVariable Long id);

    @GetMapping("/api/masterdata/product/category/{id}")
    Map<String, Object> getCategoryById(@PathVariable Long id);

    @GetMapping("/api/masterdata/dict/item")
    Map<String, Object> getDictItems(@RequestParam String dictCode);
}