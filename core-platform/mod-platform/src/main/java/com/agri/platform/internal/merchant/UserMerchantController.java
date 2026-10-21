package com.agri.platform.internal.merchant;

import com.agri.core.infra.web.MarketContext;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 用户与经营主体绑定（身份基建）。
 *
 * <p><b>它解决的问题</b>：此前平台没有任何"用户 ↔ 经营主体"的关系，
 * 子系统无法回答"这个登录用户是哪个买家/卖家"—— 交易模块只能退化成
 * "由前端自报参与方"，而自报就等于谁都能看别人的单据。</p>
 *
 * <p>两个入口分开是有意的：
 * <ul>
 *   <li>{@code /api/v1/platform/merchants/mine}：给子系统用的**解析**接口，
 *       只返回调用者自己的主体（身份从令牌来，不接受参数指定"查谁的"）；</li>
 *   <li>{@code /api/v1/admin/user-merchants}：运营端维护绑定用。</li>
 * </ul>
 * 若把两者合成一个"传 userId 就返回该用户主体"的接口，那么任何调用方只要换个
 * userId 就能拿到别人的身份关系 —— 与前面刚修掉的越权面是同一类问题。</p>
 */
@RestController
@RequiredArgsConstructor
public class UserMerchantController {

    private final UserMerchantMapper userMerchantMapper;
    private final MerchantMapper merchantMapper;
    private final ActiveMerchantService activeMerchantService;

    /** 当前登录用户绑定的经营主体（子系统据此解析数据范围）。 */
    @GetMapping("/api/v1/platform/merchants/mine")
    public ApiResponse<List<Map<String, Object>>> mine() {
        Long userId = MarketContext.currentUserId();
        if (userId == null) {
            return ApiResponse.fail(ErrorCode.UNAUTHORIZED);
        }
        Long activeMerchantId = activeMerchantService.resolve(userId,
                com.agri.core.infra.web.MarketContext.currentMarketId());
        if (activeMerchantId == null) {
            return ApiResponse.ok(List.of());
        }
        UserMerchantEntity active = userMerchantMapper.selectOne(
                new LambdaQueryWrapper<UserMerchantEntity>()
                        .eq(UserMerchantEntity::getUserId, userId)
                        .eq(UserMerchantEntity::getMerchantId, activeMerchantId)
                        .eq(UserMerchantEntity::getStatus, 1)
                        .last("LIMIT 1"));
        return ApiResponse.ok(active == null ? List.of() : List.of(toView(active)));
    }

    /** 运营端：绑定列表（可按用户 / 主体筛）。 */
    @GetMapping("/api/v1/admin/user-merchants")
    public ApiResponse<PageResult<Map<String, Object>>> page(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) Long merchantId) {
        LambdaQueryWrapper<UserMerchantEntity> wrapper = new LambdaQueryWrapper<>();
        if (userId != null) {
            wrapper.eq(UserMerchantEntity::getUserId, userId);
        }
        if (merchantId != null) {
            wrapper.eq(UserMerchantEntity::getMerchantId, merchantId);
        }
        wrapper.orderByDesc(UserMerchantEntity::getId);
        Page<UserMerchantEntity> page = userMerchantMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (UserMerchantEntity row : page.getRecords()) {
            rows.add(toView(row));
        }
        return ApiResponse.ok(new PageResult<>(rows, page.getTotal(), page.getCurrent(), page.getSize()));
    }

    /** 运营端：新增绑定。 */
    @PostMapping("/api/v1/admin/user-merchants")
    public ApiResponse<Map<String, Object>> create(@RequestBody BindRequest request) {
        if (request.getUserId() == null || request.getMerchantId() == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "用户与经营主体都必须指定");
        }
        if (merchantMapper.selectById(request.getMerchantId()) == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "经营主体不存在");
        }
        // 同一对(user, merchant)只能有一条：重复绑定会让"我的主体"出现重复项
        Long exists = userMerchantMapper.selectCount(new LambdaQueryWrapper<UserMerchantEntity>()
                .eq(UserMerchantEntity::getUserId, request.getUserId())
                .eq(UserMerchantEntity::getMerchantId, request.getMerchantId()));
        if (exists != null && exists > 0) {
            throw new BusinessException(ErrorCode.CONFLICT, "该用户已绑定这家经营主体");
        }

        UserMerchantEntity entity = new UserMerchantEntity();
        entity.setUserId(request.getUserId());
        entity.setMerchantId(request.getMerchantId());
        entity.setRoleInMerchant(request.getRoleInMerchant() == null ? "buyer" : request.getRoleInMerchant());
        entity.setStatus(1);
        entity.setCreatedAt(LocalDateTime.now());
        userMerchantMapper.insert(entity);
        return ApiResponse.ok(toView(entity));
    }

    /** 运营端：启停绑定（停用不移除记录 —— 任职历史本身是要留痕的）。 */
    @PutMapping("/api/v1/admin/user-merchants/{id}/status")
    public ApiResponse<Void> changeStatus(@PathVariable Long id, @RequestParam Integer status) {
        UserMerchantEntity entity = userMerchantMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "绑定记录不存在");
        }
        entity.setStatus(status);
        entity.setUpdatedAt(LocalDateTime.now());
        userMerchantMapper.updateById(entity);
        return ApiResponse.ok();
    }

    private List<Map<String, Object>> listByUser(Long userId) {
        List<UserMerchantEntity> bindings = userMerchantMapper.selectList(
                new LambdaQueryWrapper<UserMerchantEntity>()
                        .eq(UserMerchantEntity::getUserId, userId)
                        .eq(UserMerchantEntity::getStatus, 1));
        List<Map<String, Object>> rows = new ArrayList<>();
        for (UserMerchantEntity binding : bindings) {
            rows.add(toView(binding));
        }
        return rows;
    }

    private Map<String, Object> toView(UserMerchantEntity entity) {
        MerchantEntity merchant = merchantMapper.selectById(entity.getMerchantId());
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", entity.getId());
        view.put("userId", entity.getUserId());
        view.put("merchantId", entity.getMerchantId());
        view.put("merchantName", merchant == null ? null : merchant.getName());
        view.put("merchantType", merchant == null ? null : merchant.getType());
        view.put("memberType", merchant == null ? null : merchant.getMemberType());
        view.put("verifyStatus", merchant == null ? null : merchant.getVerifyStatus());
        view.put("verifyTime", merchant == null ? null : merchant.getVerifyTime());
        view.put("roleInMerchant", entity.getRoleInMerchant());
        view.put("status", entity.getStatus());
        view.put("createdAt", entity.getCreatedAt());
        return view;
    }

    @Data
    public static class BindRequest {
        private Long userId;
        private Long merchantId;
        private String roleInMerchant;
    }
}
