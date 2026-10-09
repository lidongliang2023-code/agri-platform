package com.agri.produce.internal.member;

import com.agri.produce.internal.common.ProduceIds;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 生产团队成员（农场主/农技员/巡检员/操作员） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class MemberService {

    private static final String ID_PREFIX = "MEMB";

    private final MemberMapper memberMapper;

    /**
     * 分页查询。
     *
     * @param keyword memberName 模糊关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<MemberEntity> page(long page, long size, String keyword, Integer status) {
        Page<MemberEntity> result = memberMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<MemberEntity>()
                        .like(keyword != null && !keyword.isBlank(), MemberEntity::getMemberName, keyword)
                        .eq(status != null, MemberEntity::getStatus, status)
                        .orderByDesc(MemberEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public MemberEntity detail(String id) {
        MemberEntity entity = memberMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return entity;
    }

    /**
     * 新增，缺省业务主键时自动生成。
     *
     * @param entity 实体
     * @return 落库后的实体
     */
    @Transactional
    public MemberEntity create(MemberEntity entity) {
        if (entity.getMemberId() == null || entity.getMemberId().isBlank()) {
            entity.setMemberId(ProduceIds.newId(ID_PREFIX));
        }
        memberMapper.insert(entity);
        return entity;
    }

    /**
     * 更新（以路径上的业务主键为准）。
     *
     * @param id     业务主键
     * @param entity 待更新内容
     * @return 更新后的实体
     */
    @Transactional
    public MemberEntity update(String id, MemberEntity entity) {
        entity.setMemberId(id);
        memberMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        memberMapper.deleteById(id);
    }

    /** 农场成员 */
    public List<MemberEntity> listByFarm(String farmId) {
        return memberMapper.selectList(new LambdaQueryWrapper<MemberEntity>()
                .eq(MemberEntity::getFarmId, farmId)
                .eq(MemberEntity::getStatus, 1)
                .orderByAsc(MemberEntity::getMemberId));
    }

    /** 绑定平台账号 */
    @Transactional
    public MemberEntity bindUser(String memberId, String userId) {
        MemberEntity member = detail(memberId);
        member.setUserId(userId);
        memberMapper.updateById(member);
        return member;
    }

    /** 角色列表：按角色编码聚合在职人数 */
    public List<Map<String, Object>> roles() {
        List<MemberEntity> members = memberMapper.selectList(new LambdaQueryWrapper<MemberEntity>()
                .eq(MemberEntity::getStatus, 1));
        Map<String, Long> buckets = new LinkedHashMap<>();
        for (MemberEntity member : members) {
            buckets.merge(member.getRoleCode() == null ? "UNKNOWN" : member.getRoleCode(), 1L, Long::sum);
        }
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        buckets.forEach((code, count) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("roleCode", code);
            row.put("memberCount", count);
            result.add(row);
        });
        return result;
    }

    /** 角色权限（骨架：真实权限由平台域 platform_role 承载） */
    public List<Map<String, Object>> rolePermissions(String roleCode) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("roleCode", roleCode == null ? "ALL" : roleCode);
        row.put("permissions", List.of("produce:read", "produce:write", "produce:admin"));
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        result.add(row);
        return result;
    }
}
