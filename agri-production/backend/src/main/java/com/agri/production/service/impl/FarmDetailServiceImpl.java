package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.AlertRecord;
import com.agri.production.entity.Farm;
import com.agri.production.entity.FarmCert;
import com.agri.production.entity.HarvestBatch;
import com.agri.production.entity.IoTDevice;
import com.agri.production.entity.Plot;
import com.agri.production.entity.Task;
import com.agri.production.mapper.AlertRecordMapper;
import com.agri.production.mapper.FarmCertMapper;
import com.agri.production.mapper.FarmMapper;
import com.agri.production.mapper.HarvestBatchMapper;
import com.agri.production.mapper.IoTDeviceMapper;
import com.agri.production.mapper.PlotMapper;
import com.agri.production.mapper.TaskMapper;
import com.agri.production.common.constant.AlertDict;
import com.agri.production.vo.FarmCertVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 农场详情：资质证照 + 汇总 + 启停（页面「农场详情」）。

 *
 * <p>农场标识经 FarmIdResolver 换算成本地主键（认不出报 404，不静默丢筛选）。</p>
 */
@Slf4j
@Service
public class FarmDetailServiceImpl {

    private static final List<String> TASK_DONE = List.of("completed", "done");
    private static final DateTimeFormatter ID_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final FarmCertMapper certMapper;
    private final FarmMapper farmMapper;
    private final PlotMapper plotMapper;
    private final TaskMapper taskMapper;
    private final HarvestBatchMapper harvestMapper;
    private final AlertRecordMapper alertMapper;
    private final IoTDeviceMapper deviceMapper;

    public FarmDetailServiceImpl(FarmCertMapper certMapper, FarmMapper farmMapper, PlotMapper plotMapper,
                                 TaskMapper taskMapper, HarvestBatchMapper harvestMapper,
                                 AlertRecordMapper alertMapper, IoTDeviceMapper deviceMapper) {
        this.certMapper = certMapper;
        this.farmMapper = farmMapper;
        this.plotMapper = plotMapper;
        this.taskMapper = taskMapper;
        this.harvestMapper = harvestMapper;
        this.alertMapper = alertMapper;
        this.deviceMapper = deviceMapper;
    }

    /** 证照分页（keyword 匹配名称/编号，status 过滤）。 */
    public PageResult<FarmCertVO> pageCerts(String tenantId, Long farmId, int pageNum, int pageSize,
                                            String keyword, Integer status) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<FarmCert> w = new LambdaQueryWrapper<FarmCert>()
                .eq(FarmCert::getTenantId, tenantId).eq(FarmCert::getFarmId, farmId);
        String kw = blank(keyword);
        if (kw != null) {
            w.and(q -> q.like(FarmCert::getCertName, kw).or().like(FarmCert::getCertNo, kw));
        }
        if (status != null) {
            w.eq(FarmCert::getStatus, status);
        }
        w.orderByAsc(FarmCert::getExpireDate).orderByAsc(FarmCert::getCertId);
        Page<FarmCert> page = certMapper.selectPage(new Page<>(p, s), w);
        return PageResult.of(page.getRecords().stream().map(FarmCertVO::of).toList(), page.getTotal(), p, s);
    }

    /** 新增证照，返回新编号。 */
    @Transactional(rollbackFor = Exception.class)
    public String createCert(String tenantId, Long farmId, Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            throw new BusinessException(400, "请求体不能为空");
        }
        FarmCert entity = new FarmCert();
        entity.setCertId("CERT" + LocalDateTime.now().format(ID_FORMAT)
                + String.format("%04d", ThreadLocalRandom.current().nextInt(10000)));
        entity.setFarmId(farmId);
        entity.setTenantId(tenantId);
        entity.setCertType(require(str(payload.get("certType")), "证照类型"));
        entity.setCertName(require(str(payload.get("certName")), "证照名称"));
        // 证书编号**不是必填**：新建农场页的「资质认证」只有一个多选框（页面 Create.tsx 的 certNames），
        // 用户在建场时拿不到证书编号；此前这里 require 必填 → 该端点在页面唯一的调用点上恒 400
        // （「证书编号为必填」），而页面用 Promise.allSettled 吞掉了失败，于是勾选的资质被静默丢弃。
        // 口径：用户勾了「有机认证」就如实记一条 cert_name/cert_type，编号留空（库里本列可空），
        // 等拿到真实编号再补 —— 不编造证书编号。
        entity.setCertNo(str(payload.get("certNo")));
        entity.setIssuer(str(payload.get("issuer")));
        entity.setIssueDate(date(payload.get("issueDate"), "issueDate"));
        entity.setExpireDate(date(payload.get("expireDate"), "expireDate"));
        entity.setAttachUrl(str(payload.get("attachUrl")));
        Object status = payload.get("status");
        entity.setStatus(status == null ? 1 : Integer.valueOf(String.valueOf(status).trim()));
        certMapper.insert(entity);
        log.info("农场证照新增：{}（农场 {} / {}）", entity.getCertId(), farmId, entity.getCertName());
        return entity.getCertId();
    }

    /** 农场汇总（页面汇总卡；数字全部现查本服务库，缺数据源的项不出现）。 */
    public Map<String, Object> summary(String tenantId, Long farmId) {
        Map<String, Object> result = new LinkedHashMap<>();
        List<Plot> plots = plotMapper.selectList(new LambdaQueryWrapper<Plot>()
                .eq(Plot::getTenantId, tenantId).eq(Plot::getFarmId, farmId));
        result.put("plotCount", plots.size());
        BigDecimal area = BigDecimal.ZERO;
        boolean anyArea = false;
        for (Plot plot : plots) {
            if (plot.getArea() != null) {
                area = area.add(plot.getArea());
                anyArea = true;
            }
        }
        result.put("plantingArea", anyArea ? area : null);
        result.put("taskTotal", taskMapper.selectCount(new LambdaQueryWrapper<Task>()
                .eq(Task::getTenantId, tenantId).eq(Task::getFarmId, farmId)));
        result.put("taskDone", taskMapper.selectCount(new LambdaQueryWrapper<Task>()
                .eq(Task::getTenantId, tenantId).eq(Task::getFarmId, farmId).in(Task::getStatus, TASK_DONE)));
        List<HarvestBatch> batches = harvestMapper.selectList(new LambdaQueryWrapper<HarvestBatch>()
                .eq(HarvestBatch::getTenantId, tenantId).eq(HarvestBatch::getFarmId, farmId));
        result.put("harvestBatchCount", batches.size());
        BigDecimal qty = BigDecimal.ZERO;
        for (HarvestBatch batch : batches) {
            if (batch.getQuantity() != null) {
                qty = qty.add(batch.getQuantity());
            }
        }
        result.put("harvestQty", qty);
        result.put("alertPending", alertMapper.selectCount(new LambdaQueryWrapper<AlertRecord>()
                .eq(AlertRecord::getTenantId, tenantId).eq(AlertRecord::getFarmId, farmId)
                .in(AlertRecord::getStatus, AlertDict.statusValuesOf(AlertDict.STATUS_PENDING))));
        result.put("deviceCount", deviceMapper.selectCount(new LambdaQueryWrapper<IoTDevice>()
                .eq(IoTDevice::getTenantId, tenantId).eq(IoTDevice::getFarmId, farmId)));
        result.put("certCount", certMapper.selectCount(new LambdaQueryWrapper<FarmCert>()
                .eq(FarmCert::getTenantId, tenantId).eq(FarmCert::getFarmId, farmId)));
        return result;
    }

    /**
     * 启停农场。
     *
     * <p>页面传的是数字状态（0/1），而库里 status 是文本 —— 直接写数字会让列表页的状态列渲染不出中文；
     * 这里映射成 active/inactive 后再落库（口径与本地地块表的 status 一致）。</p>
     */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> changeStatus(String tenantId, Long farmId, Integer status) {
        Farm farm = farmMapper.selectById(farmId);
        if (farm == null || !tenantId.equals(farm.getTenantId())) {
            throw new BusinessException(404, "农场不存在：" + farmId);
        }
        if (status == null || (status != 0 && status != 1)) {
            throw new BusinessException(400, "农场状态应为 1 启用 / 0 停用：" + status);
        }
        farm.setStatus(status == 1 ? "active" : "inactive");
        farm.setUpdateTime(LocalDateTime.now());
        farmMapper.updateById(farm);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("farmId", String.valueOf(farm.getId()));
        result.put("farmName", farm.getFarmName());
        result.put("status", status);
        log.info("农场启停：{}（{}）", farm.getFarmName(), farm.getStatus());
        return result;
    }

    private static String require(String value, String field) {
        if (value == null) {
            throw new BusinessException(400, field + "为必填");
        }
        return value;
    }

    private static LocalDate date(Object value, String field) {
        String text = str(value);
        if (text == null) {
            return null;
        }
        try {
            return LocalDate.parse(text.length() > 10 ? text.substring(0, 10) : text);
        } catch (DateTimeParseException e) {
            throw new BusinessException(400, field + " 格式应为 yyyy-MM-dd：" + text);
        }
    }

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static String blank(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
