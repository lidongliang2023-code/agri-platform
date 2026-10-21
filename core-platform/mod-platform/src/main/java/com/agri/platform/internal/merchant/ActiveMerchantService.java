package com.agri.platform.internal.merchant;

import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 登录态中的唯一当前主体。
 *
 * <p>一个账号可以绑定多家经营主体，但一次登录只能以一家主体参与业务。
 * 选择保存在服务端 Redis 中，不使用前端 localStorage：交易、生产等子系统
 * 都是通过访问令牌调用 {@code /api/v1/platform/merchants/mine} 解析范围，
 * 只有服务端统一保存才能保证它们拿到同一个主体。</p>
 *
 * <p>每次读取都会校验绑定仍有效、主体未停用；选择失效时自动回落到
 * 负责人主体或最早绑定的主体，避免账号被卡死在已删除的主体上。</p>
 */
@Service
@RequiredArgsConstructor
public class ActiveMerchantService {

    private static final String KEY_PREFIX = "agri:active-merchant:";
    private static final Duration ACTIVE_TTL = Duration.ofDays(7);

    private final StringRedisTemplate redis;
    private final UserMerchantMapper userMerchantMapper;
    private final MerchantMapper merchantMapper;

    /** 获取当前主体；没有有效绑定返回 null，有绑定但未选择时自动选一个并保存。 */
    public Long resolve(Long userId, Long marketId) {
        List<UserMerchantEntity> bindings = validBindings(userId, marketId);
        if (bindings.isEmpty()) {
            clear(userId, marketId);
            return null;
        }
        String key = key(userId, marketId);
        String saved = redis.opsForValue().get(key);
        Long savedId = parseLong(saved);
        if (savedId != null && bindings.stream().anyMatch(item -> savedId.equals(item.getMerchantId()))) {
            redis.expire(key, ACTIVE_TTL);
            return savedId;
        }
        Long selected = bindings.stream()
                .min(Comparator.comparing((UserMerchantEntity item) ->
                                !"owner".equalsIgnoreCase(item.getRoleInMerchant()))
                        .thenComparing(UserMerchantEntity::getId))
                .map(UserMerchantEntity::getMerchantId)
                .orElse(null);
        if (selected != null) {
            redis.opsForValue().set(key, String.valueOf(selected), ACTIVE_TTL);
        }
        return selected;
    }

    /** 登录成功后确保有一个当前主体。 */
    public Long ensure(Long userId, Long marketId) {
        return resolve(userId, marketId);
    }

    /** 切换当前主体；必须是当前账号有效绑定的主体。 */
    public MerchantEntity switchTo(Long userId, Long marketId, Long merchantId) {
        if (merchantId == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请选择要切换的经营主体");
        }
        UserMerchantEntity binding = validBindings(userId, marketId).stream()
                .filter(item -> merchantId.equals(item.getMerchantId()))
                .findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN, "你无权切换到该经营主体"));
        MerchantEntity merchant = merchantMapper.selectById(binding.getMerchantId());
        if (merchant == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "经营主体不存在");
        }
        redis.opsForValue().set(key(userId, marketId), String.valueOf(merchantId), ACTIVE_TTL);
        return merchant;
    }

    /** 单点退出时清除，下一次登录重新按默认规则选择主体。 */
    public void clear(Long userId, Long marketId) {
        if (userId != null) {
            redis.delete(key(userId, marketId));
        }
    }

    private List<UserMerchantEntity> validBindings(Long userId, Long marketId) {
        if (userId == null) {
            return List.of();
        }
        LambdaQueryWrapper<UserMerchantEntity> bindingQuery = new LambdaQueryWrapper<UserMerchantEntity>()
                .eq(UserMerchantEntity::getUserId, userId)
                .eq(UserMerchantEntity::getStatus, 1)
                .orderByAsc(UserMerchantEntity::getId);
        if (marketId != null) {
            bindingQuery.and(item -> item.eq(UserMerchantEntity::getMarketId, marketId)
                    .or().isNull(UserMerchantEntity::getMarketId));
        }
        List<UserMerchantEntity> bindings = userMerchantMapper.selectList(bindingQuery);
        if (bindings.isEmpty()) {
            return List.of();
        }
        List<Long> merchantIds = bindings.stream().map(UserMerchantEntity::getMerchantId).distinct().toList();
        Map<Long, MerchantEntity> merchants = new LinkedHashMap<>();
        for (MerchantEntity merchant : merchantMapper.selectList(
                new LambdaQueryWrapper<MerchantEntity>().in(MerchantEntity::getId, merchantIds))) {
            merchants.put(merchant.getId(), merchant);
        }
        return bindings.stream()
                .filter(item -> {
                    MerchantEntity merchant = merchants.get(item.getMerchantId());
                    return merchant != null && !Integer.valueOf(0).equals(merchant.getStatus());
                })
                .toList();
    }

    private String key(Long userId, Long marketId) {
        return KEY_PREFIX + userId + ":" + (marketId == null ? 1L : marketId);
    }

    private Long parseLong(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}
