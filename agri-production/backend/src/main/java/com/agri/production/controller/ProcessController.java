package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.dto.ProcessSaveDTO;
import com.agri.production.service.TenantContextService;
import com.agri.production.service.impl.ProcessServiceImpl;
import com.agri.production.vo.ProcessVO;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 加工记录（{@code /api/v1/production/process}）。
 *
 * <p>「种植 → 采收 → 加工」的加工环节从这里写入；溯源链路（属主全链路与公众核验）读同一批记录，
 * 所以页面看到的就是这里登记的，中间没有第二段拼装逻辑。</p>
 *
 * <p>身份全部由令牌解析（{@link TenantContextService}），入参不接受 tenantId ——
 * 否则就成了"替别人登记加工工序"。</p>
 */
@RestController
@RequestMapping("/api/v1/production/process")
public class ProcessController {

    private final ProcessServiceImpl processService;

    public ProcessController(ProcessServiceImpl processService) {
        this.processService = processService;
    }

    /** 某采收批次的全部加工工序（批次主键或批次号都可）。 */
    @GetMapping("/batch/{batchKey}")
    public ApiResponse<List<ProcessVO>> listByBatch(@PathVariable String batchKey) {
        return ApiResponse.success(processService.listByBatch(TenantContextService.currentTenantId(), batchKey));
    }

    /** 本主体的加工记录分页（可按批次号 / 类型 / 状态筛）。 */
    @GetMapping("/records")
    public ApiResponse<PageResult<ProcessVO>> page(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String batchNo,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status) {
        return ApiResponse.success(processService.page(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10),
                batchNo, type, status, TenantContextService.currentTenantId()));
    }

    /** 登记一道加工工序。 */
    @PostMapping
    public ApiResponse<ProcessVO> create(@Valid @RequestBody ProcessSaveDTO dto) {
        return ApiResponse.success(processService.create(TenantContextService.currentTenantId(), dto));
    }

    /** 编辑加工工序（整表单保存，可选字段清空即清掉）。 */
    @PutMapping("/{id:\\d+}")
    public ApiResponse<ProcessVO> update(@PathVariable Long id, @Valid @RequestBody ProcessSaveDTO dto) {
        return ApiResponse.success(processService.update(TenantContextService.currentTenantId(), id, dto));
    }

    /** 删除加工工序（逻辑删除）。 */
    @DeleteMapping("/{id:\\d+}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        processService.delete(TenantContextService.currentTenantId(), id);
        return ApiResponse.success();
    }

    private static int firstNonNull(Integer first, Integer second, int fallback) {
        return first != null ? first : (second != null ? second : fallback);
    }
}
