package com.agri.platform.internal.permission;

import com.agri.core.infra.util.JsonUtil;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;

/**
 * 角色权限读写（落 {@code platform_role.permissions}，权限码 JSON 数组）。
 *
 * <p>此前这个能力根本不存在：前端 {@code production-view.ts} 调的
 * {@code PUT /members/roles/{roleCode}/permissions} 后端没有，调用失败被 {@code catch} 静默吞掉后
 * {@code return true}，于是页面永远提示「权限已保存」——典型假成功。权限实际只写进了 localStorage，
 * 换台机器就没了。这里补真实落库端点。</p>
 *
 * <p>归属说明：{@code platform_role} 是平台域表（前缀 {@code platform_}），按 ADR-001 表前缀隔离
 * 纪律只能由 mod-platform 写，因此端点不放在生产域的 {@code /members/...} 路径下。</p>
 */
@Service
@RequiredArgsConstructor
public class RolePermissionService {

    /** {@code platform_role.permissions} 列宽（VARCHAR(1000)），超出即明确失败而非静默截断 */
    private static final int MAX_STORAGE_LENGTH = 1000;

    private final RoleMapper roleMapper;

    /**
     * 读取角色已配置的权限码。
     *
     * @param code 角色编码
     * @return 权限码列表；未配置返回空列表
     */
    public List<String> permissions(String code) {
        return parseStored(requireRole(code).getPermissions());
    }

    /**
     * 覆盖写入角色权限码。
     *
     * @param code    角色编码
     * @param request 请求体
     * @return 更新后的角色
     */
    @Transactional
    public RoleEntity updatePermissions(String code, RolePermissionRequest request) {
        RoleEntity role = requireRole(code);
        List<String> raw = request == null ? null : request.resolve();
        if (raw == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "请求体必须包含 permissions（或 permissionIds）权限码数组");
        }
        List<String> normalized = normalize(raw);
        String json = JsonUtil.write(normalized);
        if (json.length() > MAX_STORAGE_LENGTH) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    String.format(Locale.ROOT, "权限码过多：序列化后 %d 字符，超出列宽上限 %d",
                            json.length(), MAX_STORAGE_LENGTH));
        }
        role.setPermissions(json);
        roleMapper.updateById(role);
        return role;
    }

    /**
     * 按编码定位角色；找不到就明确失败——不静默创建、不返回成功。
     *
     * @param code 角色编码
     * @return 角色实体
     */
    private RoleEntity requireRole(String code) {
        if (code == null || code.isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "角色编码不能为空");
        }
        RoleEntity role = roleMapper.selectOne(new LambdaQueryWrapper<RoleEntity>()
                .eq(RoleEntity::getCode, code.trim()));
        if (role == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND,
                    "角色不存在：" + code.trim() + "（权限只能写到已存在的角色上）");
        }
        return role;
    }

    /**
     * 解析列里的权限码 JSON 数组；空值视为未配置。
     *
     * @param json 列值
     * @return 权限码列表
     */
    private List<String> parseStored(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        List<String> codes;
        try {
            codes = JsonUtil.MAPPER.readValue(json, new TypeReference<List<String>>() {
            });
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.BIZ_ERROR,
                    "角色权限存储格式非法，无法解析为权限码数组：" + json);
        }
        return normalize(codes == null ? List.of() : codes);
    }

    /**
     * 归一化：去空、去空白、去重并保持原有顺序。
     *
     * @param raw 原始权限码
     * @return 归一化后的权限码列表
     */
    private List<String> normalize(List<String> raw) {
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String item : raw) {
            if (item != null && !item.isBlank()) {
                unique.add(item.trim());
            }
        }
        return new ArrayList<>(unique);
    }
}
