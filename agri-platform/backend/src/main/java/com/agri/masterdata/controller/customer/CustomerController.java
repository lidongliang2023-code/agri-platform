package com.agri.masterdata.controller.customer;

import com.agri.common.entity.ApiResponse;
import com.agri.masterdata.dto.CustomerSaveDTO;
import com.agri.masterdata.service.ICustomerService;
import com.agri.masterdata.vo.CustomerVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/customer")
@RequiredArgsConstructor
public class CustomerController {

    private final ICustomerService customerService;

    @GetMapping("/list")
    public ApiResponse<List<CustomerVO>> list() {
        return ApiResponse.success(customerService.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<CustomerVO> getDetail(@PathVariable Long id) {
        return ApiResponse.success(customerService.getById(id));
    }

    @PostMapping
    public ApiResponse<Void> save(@RequestBody @Valid CustomerSaveDTO dto) {
        customerService.save(dto);
        return ApiResponse.success();
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @RequestBody @Valid CustomerSaveDTO dto) {
        customerService.update(id, dto);
        return ApiResponse.success();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        customerService.delete(id);
        return ApiResponse.success();
    }
}
