package com.agri.production.mapper;

import com.agri.production.dto.TaskPageDTO;
import com.agri.production.entity.Task;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface TaskMapper extends BaseMapper<Task> {

    /**
     * 分页查询。
     *
     * @param farmId **解析后**的本地农场主键（由 FarmIdResolver 从 dto.farmId 换算而来）；
     *               不单独传就会去用 dto.farmId（那是平台侧标识字符串），
     *               MySQL 会把 'DEMO-FARM-001' 当 0 比较 —— 静默查不到，比报错更难发现。
     */
    IPage<Task> pageQuery(Page<Task> page, @Param("dto") TaskPageDTO dto,
                         @Param("farmId") Long farmId, @Param("tenantId") String tenantId);

    List<Task> selectByFarmId(@Param("farmId") Long farmId, @Param("tenantId") String tenantId);

    List<Task> selectByExecutorId(@Param("executorId") Long executorId, @Param("tenantId") String tenantId);

    Task selectByCode(@Param("taskCode") String taskCode, @Param("tenantId") String tenantId);
}
