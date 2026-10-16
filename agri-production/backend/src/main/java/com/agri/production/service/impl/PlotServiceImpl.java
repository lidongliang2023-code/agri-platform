package com.agri.production.service.impl;

import com.agri.production.dto.PlotPageDTO;
import com.agri.production.dto.PlotSaveDTO;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.CropInfo;
import com.agri.production.entity.Plot;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.util.BeanCopyUtils;
import com.agri.production.mapper.CropInfoMapper;
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

@Service
public class PlotServiceImpl extends ServiceImpl<PlotMapper, Plot> implements IPlotService {

    /** 作物主数据：地块的「当前作物」从这里选，落 crop_id + current_crop（名称）两列。 */
    private final CropInfoMapper cropMapper;

    public PlotServiceImpl(CropInfoMapper cropMapper) {
        this.cropMapper = cropMapper;
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
        return BeanCopyUtils.copy(plot, PlotVO.class);
    }

    @Override
    @Transactional
    public PlotVO update(PlotSaveDTO dto, String tenantId) {
        Plot plot = getById(dto.getId());
        if (plot == null || !tenantId.equals(plot.getTenantId())) {
            throw new RuntimeException("地块不存在");
        }
        BeanCopyUtils.copy(dto, plot);
        resolveCrop(plot, dto, tenantId);
        updateById(plot);
        return BeanCopyUtils.copy(plot, PlotVO.class);
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
            throw new RuntimeException("地块不存在");
        }
        removeById(id);
    }

    @Override
    public PlotVO getById(Long id, String tenantId) {
        Plot plot = getById(id);
        if (plot == null || !tenantId.equals(plot.getTenantId())) {
            throw new RuntimeException("地块不存在");
        }
        return BeanCopyUtils.copy(plot, PlotVO.class);
    }

    @Override
    public PageResult<PlotVO> pageQuery(PlotPageDTO dto, String tenantId) {
        Page<Plot> page = new Page<>(dto.getPageNum(), dto.getPageSize());
        IPage<Plot> result = baseMapper.pageQuery(page, dto, tenantId);
        List<PlotVO> voList = BeanCopyUtils.copyList(result.getRecords(), PlotVO.class);
        return PageResult.of(voList, result.getTotal(), dto.getPageNum(), dto.getPageSize());
    }

    @Override
    public List<PlotVO> listByFarmId(Long farmId, String tenantId) {
        List<Plot> plots = baseMapper.selectByFarmId(farmId, tenantId);
        return BeanCopyUtils.copyList(plots, PlotVO.class);
    }

    @Override
    public PlotVO getByCode(String plotCode, String tenantId) {
        Plot plot = baseMapper.selectByCode(plotCode, tenantId);
        if (plot == null) {
            throw new RuntimeException("地块不存在");
        }
        return BeanCopyUtils.copy(plot, PlotVO.class);
    }

    private String generatePlotCode(String tenantId) {
        return "PLT" + System.currentTimeMillis() % 1000000;
    }
}
