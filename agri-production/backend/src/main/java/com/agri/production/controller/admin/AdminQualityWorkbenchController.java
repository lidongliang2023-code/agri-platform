package com.agri.production.controller.admin;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.*;
import com.agri.production.mapper.*;
import com.agri.production.service.*;
import com.agri.production.vo.AdminQualityLabVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.time.LocalDate;

/** 监管只读聚合与批次管控；检测登记、结果出具仍复用经营主体质量服务。 */
@RestController
@RequestMapping("/api/v1/production/admin/quality/workbench")
public class AdminQualityWorkbenchController {
    private final InspectionMapper inspections;
    private final HarvestBatchMapper batches;
    private final FarmMapper farms;
    private final InventoryMapper stocks;
    private final TraceCodeMapper codes;
    private final TestingLabMapper labs;
    private final P2tService p2t;
    private final IQualityService quality;
    private final IAdminQualityService admin;
    public AdminQualityWorkbenchController(InspectionMapper inspections, HarvestBatchMapper batches,
            FarmMapper farms, InventoryMapper stocks, TraceCodeMapper codes, TestingLabMapper labs,
            IQualityService quality, IAdminQualityService admin, P2tService p2t) {
        this.p2t=p2t;
        this.inspections=inspections;this.batches=batches;this.farms=farms;this.stocks=stocks;
        this.codes=codes;this.labs=labs;this.quality=quality;this.admin=admin;
    }
    @GetMapping("/inspections")
    public ApiResponse<PageResult<Map<String,Object>>> page(
        @RequestParam(defaultValue="1") int pageNum,@RequestParam(defaultValue="20") int pageSize,
        @RequestParam(required=false) String keyword,@RequestParam(required=false) String result,
        @RequestParam(required=false) String status,@RequestParam(required=false) String labName,
        @RequestParam(required=false) Long farmId,@RequestParam(required=false) Long batchId,
        @RequestParam(required=false) String tenantId,@RequestParam(required=false) String startDate,
        @RequestParam(required=false) String endDate) {
        LambdaQueryWrapper<Inspection> w=new LambdaQueryWrapper<>();
        if(text(keyword))w.and(q->q.like(Inspection::getInspectionNo,keyword.trim()).or()
            .like(Inspection::getBatchNo,keyword.trim()).or().like(Inspection::getCropName,keyword.trim()));
        if(text(result)) {
            if("PENDING".equalsIgnoreCase(result))w.and(q->q.isNull(Inspection::getResult).or().eq(Inspection::getResult,""));
            else w.eq(Inspection::getResult,result.trim().toUpperCase());
        }
        if(text(status))w.eq(Inspection::getStatus,status.trim().toUpperCase());
        if(text(labName))w.like(Inspection::getLabName,labName.trim());
        if(farmId!=null)w.eq(Inspection::getFarmId,farmId);
        if(batchId!=null)w.eq(Inspection::getBatchId,batchId);
        if(text(tenantId))w.eq(Inspection::getTenantId,tenantId.trim());
        try {
            if(text(startDate))w.ge(Inspection::getSampleAt,LocalDate.parse(startDate).atStartOfDay());
            if(text(endDate))w.lt(Inspection::getSampleAt,LocalDate.parse(endDate).plusDays(1).atStartOfDay());
        }catch(java.time.format.DateTimeParseException e){throw new BusinessException(400,"日期格式应为 yyyy-MM-dd");}
        int p=Math.max(1,pageNum),s=Math.min(200,Math.max(1,pageSize));
        Page<Inspection> page=inspections.selectPage(new Page<>(p,s),w.orderByDesc(Inspection::getSampleAt).orderByDesc(Inspection::getInspectionId));
        return ApiResponse.success(PageResult.of(page.getRecords().stream().map(this::snapshot).toList(),page.getTotal(),p,s));
    }
    @GetMapping("/inspections/{id}")
    public ApiResponse<Map<String,Object>> detail(@PathVariable Long id){return ApiResponse.success(snapshot(requireInspection(id)));}
    private Inspection requireInspection(Long id){Inspection i=inspections.selectById(id);if(i==null)throw new BusinessException(404,"检测单不存在");return i;}
    private Map<String,Object> snapshot(Inspection i){
        Map<String,Object> m=new LinkedHashMap<>();
        m.put("inspection",i);
        Farm farm=i.getFarmId()==null?null:farms.selectById(i.getFarmId());
        m.put("farmName",farm!=null&&Objects.equals(farm.getTenantId(),i.getTenantId())?farm.getFarmName():null);
        HarvestBatch batch=i.getBatchId()==null?null:batches.selectById(i.getBatchId());
        if(batch!=null&&!Objects.equals(batch.getTenantId(),i.getTenantId()))batch=null;
        if(batch!=null) i.setBatchNo(batch.getBatchNo());
        m.put("batch",batch);
        m.put("sales",batch==null?null:p2t.traceByBatch(batch.getBatchNo(),i.getTenantId(),true));
        if(batch!=null){
            m.put("traceTotal",codes.selectCount(new LambdaQueryWrapper<TraceCode>().eq(TraceCode::getTenantId,i.getTenantId()).eq(TraceCode::getBatchNumber,batch.getBatchNo())));
            m.put("unrevokedCodeCount",codes.selectCount(new LambdaQueryWrapper<TraceCode>().eq(TraceCode::getTenantId,i.getTenantId()).eq(TraceCode::getBatchNumber,batch.getBatchNo()).and(q->q.isNull(TraceCode::getStatus).or().ne(TraceCode::getStatus,"revoked"))));
            m.put("inventoryCount",stocks.selectCount(new LambdaQueryWrapper<Inventory>().eq(Inventory::getTenantId,i.getTenantId()).eq(Inventory::getBatchId,batch.getBatchId())));
            m.put("frozenInventoryCount",stocks.selectCount(new LambdaQueryWrapper<Inventory>().eq(Inventory::getTenantId,i.getTenantId()).eq(Inventory::getBatchId,batch.getBatchId()).eq(Inventory::getFrozen,1)));
            m.put("traceCodes",codes.selectList(new LambdaQueryWrapper<TraceCode>().eq(TraceCode::getTenantId,i.getTenantId()).eq(TraceCode::getBatchNumber,batch.getBatchNo()).orderByDesc(TraceCode::getId).last("LIMIT 20")).stream().map(c->{Map<String,Object>x=new LinkedHashMap<>();x.put("code",c.getTraceCode());x.put("status",c.getStatus());return x;}).toList());
        }else{m.put("traceCodes",List.of());}
        return m;
    }
    @PostMapping("/recalls")
    @Transactional(rollbackFor=Exception.class)
    public ApiResponse<Map<String,Object>> recall(@RequestBody RecallRequest request){
        if(request.inspectionId()==null||!text(request.reason())||request.reason().trim().length()>200)
            throw new BusinessException(400,"请选择不合格检测单并填写 1–200 字处置依据");
        Inspection i=requireInspection(request.inspectionId());
        if(!"FAIL".equalsIgnoreCase(i.getResult())||i.getBatchId()==null)throw new BusinessException(400,"仅可管控已关联批次的不合格检测单");
        HarvestBatch batch=batches.lockOwned(i.getBatchId(),i.getTenantId());
        if(batch==null)throw new BusinessException(404,"同主体采收批次不存在");
        if(batch.getRemark()==null||!batch.getRemark().contains("监管管控：")){
            String old=batch.getRemark()==null?"":batch.getRemark();
            String note="\n监管管控：检测单 "+i.getInspectionNo()+"；处置依据："+request.reason().trim()+"；操作人："+TenantContextService.currentOperator()+"；时间："+java.time.LocalDateTime.now();
            if(old.length()+note.length()>500)throw new BusinessException(400,"批次历史说明较长，请先整理后再处置");
            batch.setRemark(old+note);batches.updateById(batch);
        }
        admin.recallBatch(String.valueOf(i.getBatchId()));
        return ApiResponse.success(snapshot(i));
    }
    public record RecallRequest(Long inspectionId,String reason){}
    @PostMapping("/labs")
    @Transactional(rollbackFor=Exception.class)
    public ApiResponse<AdminQualityLabVO> createLab(@RequestBody TestingLab lab){
        validateLab(lab);return ApiResponse.success(AdminQualityLabVO.of(quality.createLab(lab,"PLATFORM")));
    }
    @PutMapping("/labs/{id}")
    @Transactional(rollbackFor=Exception.class)
    public ApiResponse<AdminQualityLabVO> updateLab(@PathVariable Long id,@RequestBody TestingLab lab){
        if(lab==null)throw new BusinessException(400,"机构内容不能为空");lab.setLabId(id);validateLab(lab);TestingLab saved=labs.selectById(id);if(saved==null)throw new BusinessException(404,"检测机构不存在");
        return ApiResponse.success(AdminQualityLabVO.of(quality.updateLab(id,lab,saved.getTenantId())));
    }
    private void validateLab(TestingLab lab){
        if(lab==null||!text(lab.getLabName())||lab.getLabName().trim().length()>200)throw new BusinessException(400,"机构名称必填且不超过200字");
        if(lab.getLabLevel()!=null&&(lab.getLabLevel()<1||lab.getLabLevel()>3))throw new BusinessException(400,"请选择有效资质等级");
        if(lab.getStatus()!=null&&!List.of(0,1,2).contains(lab.getStatus()))throw new BusinessException(400,"机构状态无效");
        if(lab.getLabCode()!=null&&labs.selectCount(new LambdaQueryWrapper<TestingLab>().eq(TestingLab::getLabCode,lab.getLabCode().trim()).ne(lab.getLabId()!=null,TestingLab::getLabId,lab.getLabId()))>0)throw new BusinessException(409,"机构编码已存在");
    }
    private static boolean text(String s){return s!=null&&!s.isBlank();}
}
