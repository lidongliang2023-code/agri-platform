package com.agri.iot.feign;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.Map;

@FeignClient(name = "masterdata", url = "${services.masterdata.url}")
public interface MasterDataFeignClient {

    @GetMapping("/api/masterdata/user/{id}")
    Map<String, Object> getUserById(@PathVariable("id") Long id);

    @GetMapping("/api/masterdata/user/info")
    Map<String, Object> getCurrentUser();

    @GetMapping("/api/masterdata/tenant/{id}")
    Map<String, Object> getTenantById(@PathVariable("id") Long id);

    @GetMapping("/api/masterdata/organization/{id}")
    Map<String, Object> getOrganizationById(@PathVariable("id") Long id);

    @GetMapping("/api/masterdata/tenant/current")
    Map<String, Object> getCurrentTenant();
}