package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.common.constant.CropCategoryDict;
import com.agri.production.entity.CropInfo;
import com.agri.production.entity.PlantingPlan;
import com.agri.production.mapper.CropInfoMapper;
import com.agri.production.mapper.PlantingPlanMapper;
import com.agri.production.vo.CropVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 作物主数据（页面「作物管理」+ 种养计划的作物下拉）。

 *
 * <p>为什么要有这个服务：作物此前是自由文本，计划的 {@code crop_id} 恒空、只能靠 {@code crop_name}
 * 兜着，按作物做统计 / 关联都无从谈起（前端只能拿一份硬编码的作物图标表当候选，口径钉在代码里）。
 * 现在作物是租户级主数据，计划与地块从这里选。</p>

 *
 * <p>名字唯一性**不用数据库唯一索引**：本服务的逻辑删除不参与唯一索引，软删过的同名作物会把新行挡死
 * （计划的 {@code plan_code} 上踩过这个坑）。这里在服务层按"未删除行里不重名"校验 —— 报错清晰、可恢复。</p>
 */
@Service
public class CropMasterService {

    private final CropInfoMapper cropMapper;
    private final PlantingPlanMapper planMapper;

    public CropMasterService(CropInfoMapper cropMapper, PlantingPlanMapper planMapper) {
        this.cropMapper = cropMapper;
        this.planMapper = planMapper;
    }

    /**
     * 分页查询作物。
     *
     * @param pageNum 页码（从 1 起）
     * @param pageSize 每页条数
     * @param keyword 名称 / 编码关键字（可空）
     * @param status 1 启用 / 0 停用 / null 全部
     * @param tenantId 当前租户
     * @returns 分页结果
     */
    public PageResult<CropVO> page(int pageNum, int pageSize, String keyword, Integer status, String tenantId) {
        LambdaQueryWrapper<CropInfo> wrapper = new LambdaQueryWrapper<CropInfo>()
                .eq(CropInfo::getTenantId, tenantId);
        String kw = keyword == null ? null : keyword.trim();
        if (kw != null && !kw.isEmpty()) {
            wrapper.and(q -> q.like(CropInfo::getCropName, kw).or().like(CropInfo::getCropCode, kw));
        }
        if (status != null) {
            wrapper.eq(CropInfo::getStatus, status);
        }
        wrapper.orderByAsc(CropInfo::getSortNo).orderByAsc(CropInfo::getId);

        int safePage = pageNum > 0 ? pageNum : 1;
        int safeSize = pageSize > 0 ? pageSize : 10;
        Page<CropInfo> page = cropMapper.selectPage(new Page<>(safePage, safeSize), wrapper);
        return PageResult.of(CropVO.listOf(page.getRecords()), page.getTotal(), safePage, safeSize);
    }

    /**
     * 下拉选项：**只给启用中的**作物，按排序号 + 主键升序。
     *
     * <p>停用的作物历史引用仍能显示（详情页读的是 {@code crop_name}），但不再出现在新计划的选项里。</p>
     *
     * @param tenantId 当前租户
     * @returns 选项列表：{@code {cropId, cropCode, cropName, cropCategory}}
     */
    public List<Map<String, Object>> options(String tenantId) {
        List<CropInfo> rows = cropMapper.selectList(new LambdaQueryWrapper<CropInfo>()
                .eq(CropInfo::getTenantId, tenantId)
                .eq(CropInfo::getStatus, 1)
                .orderByAsc(CropInfo::getSortNo)
                .orderByAsc(CropInfo::getId));
        return rows.stream().map(crop -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("cropId", String.valueOf(crop.getId()));
            row.put("cropCode", crop.getCropCode());
            row.put("cropName", crop.getCropName());
            row.put("cropCategory", crop.getCropCategory());
            return row;
        }).toList();
    }

    /**
     * 新增作物。
     *
     * @param payload 入参（cropName 必填；cropCode 可空，留空自动生成）
     * @param tenantId 当前租户
     * @returns 新增行实体
     */
    @Transactional(rollbackFor = Exception.class)
    public CropInfo create(Map<String, Object> payload, String tenantId) {
        String name = requireName(payload);
        assertNameFree(name, tenantId, null);

        CropInfo crop = new CropInfo();
        crop.setTenantId(tenantId);
        crop.setCropName(name);
        crop.setCropCode(generateCode(tenantId));
        applyOptionalFields(crop, payload);
        if (crop.getStatus() == null) {
            crop.setStatus(1);
        }
        if (crop.getSortNo() == null) {
            crop.setSortNo(0);
        }
        crop.setCreateTime(LocalDateTime.now());
        crop.setUpdateTime(LocalDateTime.now());
        crop.setDeleted(0);
        // 并发下两个请求可能算出同一个 next：撞唯一索引就换下一个编号重试，不把 500 抛给用户
        for (int attempt = 0; ; attempt++) {
            try {
                cropMapper.insert(crop);
                break;
            } catch (DuplicateKeyException e) {
                if (attempt >= 4) {
                    throw new BusinessException(409, "作物编码生成冲突，请重试");
                }
                crop.setId(null);
                crop.setCropCode("CROP-" + String.format("%04d",
                        System.currentTimeMillis() % 100000 + attempt));
            }
        }
        return crop;
    }

    /**
     * 修改作物。
     *
     * @param cropId 作物主键（页面 cropId 可能是业务编码，调用方先换算）
     * @param payload 入参（未下发的字段保持原值）
     * @param tenantId 当前租户
     * @returns 修改后的实体
     */
    @Transactional(rollbackFor = Exception.class)
    public CropInfo update(Long cropId, Map<String, Object> payload, String tenantId) {
        CropInfo crop = getOwned(cropId, tenantId);
        if (payload.containsKey("cropName")) {
            String name = requireName(payload);
            assertNameFree(name, tenantId, crop.getId());
            crop.setCropName(name);
        }
        applyOptionalFields(crop, payload);
        crop.setUpdateTime(LocalDateTime.now());
        cropMapper.updateById(crop);
        return crop;
    }

    /**
     * 启用 / 停用。
     *
     * @param cropId 作物主键
     * @param status 1 启用 / 0 停用
     * @param tenantId 当前租户
     * @returns 修改后的实体
     */
    @Transactional(rollbackFor = Exception.class)
    public CropInfo changeStatus(Long cropId, Integer status, String tenantId) {
        if (status == null || (status != 0 && status != 1)) {
            throw new BusinessException(400, "作物状态应为 1 启用 / 0 停用：" + status);
        }
        CropInfo crop = getOwned(cropId, tenantId);
        crop.setStatus(status);
        crop.setUpdateTime(LocalDateTime.now());
        cropMapper.updateById(crop);
        return crop;
    }

    /**
     * 删除（逻辑删除）。
     *
     * <p>已建计划还引用着它就不给删 —— 删了会让那些计划的作物列指向一条查不到的主数据。
     * 想让它从下拉里消失，用「停用」。</p>
     *
     * @param cropId 作物主键
     * @param tenantId 当前租户
     */
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long cropId, String tenantId) {
        CropInfo crop = getOwned(cropId, tenantId);
        Long used = planMapper.selectCount(new LambdaQueryWrapper<PlantingPlan>()
                .eq(PlantingPlan::getTenantId, tenantId)
                .eq(PlantingPlan::getCropId, crop.getId()));
        if (used != null && used > 0) {
            throw new BusinessException(400, "该作物已被 " + used + " 个种养计划使用，不能删除；如需停用请改状态");
        }
        cropMapper.deleteById(crop.getId());
    }

    /**
     * 按主键取作物并校验租户归属。
     *
     * @param cropId 主键
     * @param tenantId 当前租户
     * @returns 作物实体
     */
    public CropInfo getOwned(Long cropId, String tenantId) {
        CropInfo crop = cropId == null ? null : cropMapper.selectById(cropId);
        if (crop == null || !tenantId.equals(crop.getTenantId())) {
            throw new BusinessException(404, "作物不存在：" + cropId);
        }
        return crop;
    }

    private void applyOptionalFields(CropInfo crop, Map<String, Object> payload) {
        if (payload.containsKey("cropCode")) {
            String code = text(payload.get("cropCode"));
            if (code != null) {
                crop.setCropCode(code);
            }
        }
        if (payload.containsKey("cropCategory")) {
            crop.setCropCategory(category(payload.get("cropCategory")));
        }
        if (payload.containsKey("growthCycleDays")) {
            crop.setGrowthCycleDays(integer(payload.get("growthCycleDays"), "生长周期"));
        }
        if (payload.containsKey("measurementUnit")) {
            crop.setMeasurementUnit(text(payload.get("measurementUnit")));
        }
        if (payload.containsKey("sortNo")) {
            crop.setSortNo(integer(payload.get("sortNo"), "排序号"));
        }
        if (payload.containsKey("remark")) {
            crop.setRemark(text(payload.get("remark")));
        }
        if (payload.containsKey("status")) {
            crop.setStatus(integer(payload.get("status"), "状态"));
        }
    }

    private String requireName(Map<String, Object> payload) {
        String name = text(payload.get("cropName"));
        if (name == null) {
            throw new BusinessException(400, "作物名称不能为空");
        }
        return name;
    }

    private void assertNameFree(String name, String tenantId, Long selfId) {
        List<CropInfo> same = cropMapper.selectList(new LambdaQueryWrapper<CropInfo>()
                .eq(CropInfo::getTenantId, tenantId)
                .eq(CropInfo::getCropName, name));
        boolean taken = same.stream().anyMatch(crop -> selfId == null || !selfId.equals(crop.getId()));
        if (taken) {
            throw new BusinessException(400, "作物名称已存在：" + name);
        }
    }

    /**
     * 生成同租户内唯一的作物编码：CROP-0001 起顺序编号。

     *
     * <p>编号起点取"**含逻辑删除**的最大序号 + 1"（见 {@link CropInfoMapper#maxCropCodeSeq}）。
     * 首版按"当前行数 + 1"生成，而 {@code selectCount} 会被 {@code @TableLogic} 加上 {@code deleted = 0}
     * —— 软删一行后计数回退、编码撞上那条软删行的唯一索引，新增直接 500
     * （实测：删掉 CROP-0004 后再新增报 {@code Duplicate entry '2001-CROP-0004'}）。</p>

     *
     * <p>并发下仍可能撞（两个请求同时算出同一个 next）：插入撞唯一索引就换下一个编号重试，
     * 不把 500 抛给用户。</p>
     */
    private String generateCode(String tenantId) {
        Long used = cropMapper.maxCropCodeSeq(tenantId);
        long next = (used == null ? 0L : used) + 1;
        return "CROP-" + String.format("%04d", next);
    }

    private static String text(Object value) {
        if (value == null) {
            return null;
        }
        String str = String.valueOf(value).trim();
        return str.isEmpty() ? null : str;
    }

    /**
     * 作物类别：受控取值（见 {@link CropCategoryDict}）。
     *
     * <p>可空；传了值就必须在受控范围内 —— 否则"蔬菜 / 蔬菜类 / 叶菜"会同时进库，
     * 类别统计立刻失去意义（这正是引入这个字典的原因）。</p>
     *
     * @param value 前端下发的原值
     * @returns 归一化后的类别；null = 不设置
     */
    private static String category(Object value) {
        try {
            return CropCategoryDict.normalize(value == null ? null : String.valueOf(value));
        } catch (IllegalArgumentException e) {
            throw new BusinessException(400, e.getMessage());
        }
    }

    private static Integer integer(Object value, String field) {
        if (value == null || String.valueOf(value).isBlank()) {
            return null;
        }
        try {
            return Integer.valueOf(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            throw new BusinessException(400, field + "应为整数：" + value);
        }
    }
}
