package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.util.BeanCopyUtils;
import com.agri.production.entity.Farm;
import com.agri.production.entity.TeamMember;
import com.agri.production.mapper.FarmMapper;
import com.agri.production.mapper.TeamMemberMapper;
import com.agri.production.service.TenantContextService;
import com.agri.production.vo.FarmVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 全量农场列表（{@code GET /farms/all}）：头部农场切换器与「新建地块」的农场下拉在用。

 *
 * <p>契约是**裸数组**（页面 {@code listAllFarms(): Promise<Farm[]>}），不是分页结构 ——
 * 这里照契约给数组，不套 PageResult；出参用 {@link FarmVO}（已带 farmId/areaTotal 的页面口径别名）。</p>
 */
@RestController
@RequestMapping("/api/v1/production/farms")
public class FarmAllController {

    private final FarmMapper farmMapper;
    private final TeamMemberMapper memberMapper;

    public FarmAllController(FarmMapper farmMapper, TeamMemberMapper memberMapper) {
        this.farmMapper = farmMapper;
        this.memberMapper = memberMapper;
    }

    /** 当前租户的全部农场（按主键升序，便于下拉稳定排序）。 */
    @GetMapping("/all")
    public ApiResponse<List<FarmVO>> all() {
        String tenantId = TenantContextService.currentTenantId();
        List<Farm> farms = farmMapper.selectList(new LambdaQueryWrapper<Farm>()
                .eq(Farm::getTenantId, tenantId)
                .orderByAsc(Farm::getId));
        List<FarmVO> result = FarmVO.listOf(farms);
        // 负责人：平台侧没有这一列，本服务从团队成员里取该农场的 OWNER（member_type=OWNER）——
        // 这是**有来源的派生**（成员台账里写着谁是农场负责人），比固定显示 "-" 有用，也不是编数据；
        // 该农场没有 OWNER 成员时留空，页面照旧显示 "-"。
        for (FarmVO vo : result) {
            if (vo.getId() == null) {
                continue;
            }
            List<TeamMember> owners = memberMapper.selectList(new LambdaQueryWrapper<TeamMember>()
                    .eq(TeamMember::getTenantId, tenantId)
                    .eq(TeamMember::getFarmId, String.valueOf(vo.getId()))
                    .eq(TeamMember::getMemberType, "OWNER")
                    .orderByAsc(TeamMember::getMemberId)
                    .last("LIMIT 1"));
            if (!owners.isEmpty()) {
                vo.setManagerName(owners.get(0).getMemberName());
            }
        }
        return ApiResponse.success(result);
    }
}
