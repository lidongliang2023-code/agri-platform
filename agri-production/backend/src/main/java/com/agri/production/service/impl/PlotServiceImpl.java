package com.agri.production.service.impl;

import com.agri.production.dto.PlotPageDTO;
import com.agri.production.dto.PlotSaveDTO;
import com.agri.production.common.constant.PlanStatusDict;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.CropInfo;
import com.agri.production.entity.PlantingPlan;
import com.agri.production.entity.Plot;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.util.BeanCopyUtils;
import com.agri.production.mapper.CropInfoMapper;
import com.agri.production.mapper.PlantingPlanMapper;
import com.agri.production.mapper.PlotMapper;
import com.agri.production.service.IPlotService;
import com.agri.production.vo.PlotVO;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class PlotServiceImpl extends ServiceImpl<PlotMapper, Plot> implements IPlotService {

    /** 作物主数据：地块的「当前作物」从这里选，落 crop_id + current_crop（名称）两列。 */
    private final CropInfoMapper cropMapper;
    /** 计划台账：地块的「在种 / 空闲」由它决定（地块表本身只有启用与否）。 */
    private final PlantingPlanMapper planMapper;

    public PlotServiceImpl(CropInfoMapper cropMapper, PlantingPlanMapper planMapper) {
        this.cropMapper = cropMapper;
        this.planMapper = planMapper;
    }

    @Override
    @Transactional
    public PlotVO save(PlotSaveDTO dto, String tenantId) {
        Plot plot = BeanCopyUtils.copy(dto, Plot.class);
        plot.setTenantId(tenantId);
        plot.setPlotCode(generatePlotCode(tenantId));
        plot.setStatus("active");
        resolveCrop(plot, dto, tenantId);
        save(plot);
        return PlotVO.of(plot, plantingPlotIds(tenantId));
    }

    @Override
    @Transactional
    public PlotVO update(PlotSaveDTO dto, String tenantId) {
        Plot plot = getById(dto.getId());
        if (plot == null || !tenantId.equals(plot.getTenantId())) {
            throw new BusinessException(404, "地块不存在：" + dto.getId());
        }
        BeanCopyUtils.copy(dto, plot);
        resolveCrop(plot, dto, tenantId);
        updateById(plot);
        return PlotVO.of(plot, plantingPlotIds(tenantId));
    }

    /**
     * 「当前作物」落到 {@code crop_id}（主数据主键）+ {@code current_crop}（名称，页面直接显示）。

     *
     * <p>为什么两列都要写：页面各处显示的是名称（地块列表的作物列、详情页"当前作物"、
     * 农场详情的地块缩略卡），而"按作物统计 / 关联主数据"要靠 ID。只写名称等于又退回文本
     * （地块此前就是这样：{@code current_crop} 有名字、没有 ID）。</p>

     *
     * <p>下发的是主键（数字）或作物名都能认；认不出报 400 —— 既然作物已是主数据，
     * 就不该再往地块上写一个主数据里没有的作物名。本次请求没下发作物则保持原值。</p>
     */
    private void resolveCrop(Plot plot, PlotSaveDTO dto, String tenantId) {
        String rawId = dto.getCropId() == null ? null : dto.getCropId().trim();
        String rawName = dto.getCurrentCrop() == null ? null : dto.getCurrentCrop().trim();
        if ((rawId == null || rawId.isEmpty()) && (rawName == null || rawName.isEmpty())) {
            // 没下发作物 = 这次就是"不要作物"。地块更新是**整表提交**语义（DTO 里省略的字段本来就会被
            // BeanCopyUtils 清空），所以这里显式把两列一起清掉 —— 只清名字、留着 crop_id，
            // 会留下"有 ID 没名字"的半截状态（实测踩到过）。
            plot.setCropId(null);
            plot.setCurrentCrop(null);
            return;
        }
        Long pk = parseLong(rawId);
        CropInfo crop = pk != null
                ? cropMapper.selectById(pk)
                : cropMapper.selectOne(new LambdaQueryWrapper<CropInfo>()
                        .eq(CropInfo::getTenantId, tenantId)
                        .eq(CropInfo::getCropName, rawName != null && !rawName.isEmpty() ? rawName : rawId)
                        .last("LIMIT 1"));
        if (crop == null || !tenantId.equals(crop.getTenantId())) {
            throw new BusinessException(400, "作物不存在（请先在「作物管理」里维护）："
                    + (rawId != null && !rawId.isEmpty() ? rawId : rawName));
        }
        plot.setCropId(crop.getId());
        plot.setCurrentCrop(crop.getCropName());
    }

    private static Long parseLong(String text) {
        if (text == null || text.isEmpty() || !text.chars().allMatch(Character::isDigit)) {
            return null;
        }
        try {
            return Long.valueOf(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    @Override
    @Transactional
    public void delete(Long id, String tenantId) {
        Plot plot = getById(id);
        if (plot == null || !tenantId.equals(plot.getTenantId())) {
            // 2026-10-19：原来抛 RuntimeException，全局处理器只能映射成 500「系统繁忙」——
            // 软删后按旧 id 访问时，调用方分不清"数据没了"和"服务挂了"。改回 404。
            throw new BusinessException(404, "地块不存在：" + id);
        }
        removeById(id);
    }

    @Override
    public PlotVO getById(Long id, String tenantId) {
        Plot plot = getById(id);
        if (plot == null || !tenantId.equals(plot.getTenantId())) {
            throw new BusinessException(404, "地块不存在：" + id);
        }
        return PlotVO.of(plot, plantingPlotIds(tenantId));
    }

    @Override
    public PageResult<PlotVO> pageQuery(PlotPageDTO dto, String tenantId) {
        Page<Plot> page = new Page<>(dto.getPageNum(), dto.getPageSize());
        IPage<Plot> result = baseMapper.pageQuery(page, dto, tenantId);
        List<PlotVO> voList = PlotVO.listOf(result.getRecords(), plantingPlotIds(tenantId));
        return PageResult.of(voList, result.getTotal(), dto.getPageNum(), dto.getPageSize());
    }

    @Override
    public List<PlotVO> listByFarmId(Long farmId, String tenantId) {
        List<Plot> plots = baseMapper.selectByFarmId(farmId, tenantId);
        return PlotVO.listOf(plots, plantingPlotIds(tenantId));
    }

    @Override
    public PlotVO getByCode(String plotCode, String tenantId) {
        Plot plot = baseMapper.selectByCode(plotCode, tenantId);
        if (plot == null) {
            throw new BusinessException(404, "地块不存在：" + plotCode);
        }
        return PlotVO.of(plot, plantingPlotIds(tenantId));
    }

    /**
     * 启用 / 停用地块。

     *
     * <p><b>停用的前置条件：该地块上没有"在种"计划</b>（{@code plan_status = 'active'}）。
     * 否则等于把正在种的地停掉、计划还挂着一块不再种植的地 —— 后续任务 / 采收 / 统计都会对着一块"停用地块"。
     * 所以这里直接拒（400，消息带上计划名让用户知道该先去终止哪条计划），
     * 而不是"允许但提示"或"顺手把计划也终止了"（后者更危险：用户只是想停块地，结果计划被终止）。
     * 这条口径若要改，改这里一处即可。</p>
     *
     * @param id 地块主键
     * @param status 1 启用 / 0 停用
     * @param tenantId 当前租户
     * @returns 变更后的出参
     */
    @Override
    @Transactional
    public PlotVO changeStatus(Long id, Integer status, String tenantId) {
        if (status == null || (status != 0 && status != 1)) {
            throw new BusinessException(400, "地块状态应为 1 启用 / 0 停用：" + status);
        }
        Plot plot = getById(id);
        if (plot == null || !tenantId.equals(plot.getTenantId())) {
            throw new BusinessException(404, "地块不存在：" + id);
        }
        if (status == 0) {
            List<PlantingPlan> activePlans = planMapper.selectList(new LambdaQueryWrapper<PlantingPlan>()
                    .eq(PlantingPlan::getTenantId, tenantId)
                    .eq(PlantingPlan::getPlotId, id)
                    .eq(PlantingPlan::getPlanStatus, PlanStatusDict.ACTIVE)
                    .last("LIMIT 1"));
            if (!activePlans.isEmpty()) {
                PlantingPlan plan = activePlans.get(0);
                throw new BusinessException(400, "该地块上有在种计划，不能停用："
                        + plan.getPlanName() + "（planId=" + plan.getId() + "）；请先终止该计划或等它结束");
            }
        }
        // 库内是文本口径（active / inactive），页面给的是 1 / 0 —— 换算在这里收口
        plot.setStatus(status == 1 ? "active" : "inactive");
        plot.setUpdateTime(java.time.LocalDateTime.now());
        updateById(plot);
        return PlotVO.of(plot, plantingPlotIds(tenantId));
    }

    /**
     * 当前租户下**有在种计划**的地块主键集合。

     *
     * <p>为什么要有它：地块表的状态列只有"启用 / 停用"，而页面要区分"空闲 / 在种"。
     * 这个区分在本平台有权威口径 —— 计划的 {@code plan_status = 'active'}（进行中 / 在种），
     * 计划模块自己的冲突校验（{@code assertNoGrowingConflict}）用的就是它（"同一地块同时段只允许一个在种计划"）。
     * 所以这里照同一口径取集合，**不猜**：没有在种计划的地块就是空闲。</p>

     *
     * <p>按请求取一次、在内存里比对，避免"一页 29 个地块查 29 次"。</p>
     *
     * @param tenantId 当前租户
     * @returns 地块主键集合
     */
    private Set<Long> plantingPlotIds(String tenantId) {
        return planMapper.selectList(new LambdaQueryWrapper<PlantingPlan>()
                        .eq(PlantingPlan::getTenantId, tenantId)
                        .eq(PlantingPlan::getPlanStatus, PlanStatusDict.ACTIVE))
                .stream()
                .map(PlantingPlan::getPlotId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
    }

    private String generatePlotCode(String tenantId) {
        return "PLT" + System.currentTimeMillis() % 1000000;
    }
}
