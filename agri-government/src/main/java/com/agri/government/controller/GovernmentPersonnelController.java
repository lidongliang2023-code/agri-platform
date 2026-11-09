package com.agri.government.controller;
import com.agri.common.rbac.OperatorOnly;
import com.agri.common.result.ApiResponse;
import com.agri.government.service.GovernmentPersonnelService;
import com.agri.government.security.GovernmentIdentityService;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController
@RequestMapping("/api/v1/government")
public class GovernmentPersonnelController {
    private final GovernmentPersonnelService service;
    private final GovernmentIdentityService identity;
    public GovernmentPersonnelController(GovernmentPersonnelService service,GovernmentIdentityService identity){this.service=service;this.identity=identity;}
    @GetMapping("/ops/personnel-grants/people") @OperatorOnly("gov:admin")
    public ApiResponse<List<Map<String,Object>>> people(){return ApiResponse.success(service.personnel());}
    @GetMapping("/ops/personnel-grants") @OperatorOnly("gov:admin")
    public ApiResponse<List<GovernmentPersonnelService.Grant>> list(){return ApiResponse.success(service.list());}
    @PostMapping("/ops/personnel-grants") @OperatorOnly("gov:admin")
    public ApiResponse<GovernmentPersonnelService.Grant> create(@RequestBody GovernmentPersonnelService.Grant body){return ApiResponse.success(service.save(null,body));}
    @PutMapping("/ops/personnel-grants/{id}") @OperatorOnly("gov:admin")
    public ApiResponse<GovernmentPersonnelService.Grant> update(@PathVariable String id,@RequestBody GovernmentPersonnelService.Grant body){return ApiResponse.success(service.save(id,body));}
    @GetMapping("/ops/personnel-grants/{id}/history") @OperatorOnly("gov:admin")
    public ApiResponse<List<Map<String,Object>>> history(@PathVariable String id){return ApiResponse.success(service.history(id));}
    @GetMapping("/mobile/authorization-status") @OperatorOnly("gov:inspector")
    public ApiResponse<Map<String,Object>> authorizationStatus(){return ApiResponse.success(service.currentAuthorizationStatus());}
    @GetMapping("/personnel-grants/mine") @OperatorOnly("gov:inspector")
    public ApiResponse<List<GovernmentPersonnelService.Grant>> mine(){return ApiResponse.success(service.effective(identity.currentInspectorId()));}
}
