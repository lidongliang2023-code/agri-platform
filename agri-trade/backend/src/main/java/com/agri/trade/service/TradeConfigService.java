package com.agri.trade.service;

import com.agri.trade.entity.TradeConfig;
import com.agri.trade.mapper.TradeConfigMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;

/**
 * 运营配置的读取与修改。
 *
 * <p><b>取值优先级：库里的配置 &gt; 配置文件</b>。调用方（如结算）把自己的默认值传进来，
 * 库里没有这一行就用默认值 —— 这样换环境或升级时，行为不会因为"库里少一行"而变。</p>
 *
 * <p><b>不做内存缓存</b>：这张表就几行、面也不大，每次都查库反而不会出现
 * "运营改了、进程还拿着旧值"这种最难查的问题。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TradeConfigService {

    private final TradeConfigMapper configMapper;

    /** 列出所有配置（运营端页面用）。 */
    public List<TradeConfig> list() {
        LambdaQueryWrapper<TradeConfig> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeConfig::getDelFlag, 0)
                .orderByAsc(TradeConfig::getConfigGroup)
                .orderByAsc(TradeConfig::getConfigKey);
        return configMapper.selectList(wrapper);
    }

    /** 取字符串配置；库里没有则返回调用方给的默认值。 */
    public String getString(String key, String defaultValue) {
        TradeConfig config = find(key);
        if (config == null || config.getConfigValue() == null || config.getConfigValue().isEmpty()) {
            return defaultValue;
        }
        return config.getConfigValue();
    }

    /** 取数值配置；库里没有或值不合法则返回默认值（不抛异常打断业务）。 */
    public BigDecimal getDecimal(String key, BigDecimal defaultValue) {
        String raw = getString(key, null);
        if (raw == null) {
            return defaultValue;
        }
        try {
            return new BigDecimal(raw.trim());
        } catch (NumberFormatException e) {
            log.warn("配置 {} 的值不是合法数字（{}），回退到默认值 {}", key, raw, defaultValue);
            return defaultValue;
        }
    }

    /** 取布尔配置；库里没有或值不合法则返回默认值。 */
    public boolean getBoolean(String key, boolean defaultValue) {
        String raw = getString(key, null);
        if (raw == null) {
            return defaultValue;
        }
        String text = raw.trim();
        if ("true".equalsIgnoreCase(text) || "1".equals(text)) {
            return true;
        }
        if ("false".equalsIgnoreCase(text) || "0".equals(text)) {
            return false;
        }
        log.warn("配置 {} 的值不是布尔值（{}），回退到默认值 {}", key, raw, defaultValue);
        return defaultValue;
    }

    /**
     * 修改配置值。
     *
     * @return 失败原因；成功时返回 null
     */
    @Transactional
    public String update(String key, String value) {
        TradeConfig config = find(key);
        if (config == null) {
            return "配置项不存在：" + key;
        }
        if (config.getEditable() != null && config.getEditable() == 0) {
            return "该项为只读配置，请在配置文件中调整";
        }
        String error = validate(config.getValueType(), value);
        if (error != null) {
            return error;
        }
        config.setConfigValue(value == null ? null : value.trim());
        config.setUpdateTime(new Date());
        configMapper.updateById(config);
        log.info("运营配置变更：{} = {}", key, value);
        return null;
    }

    private TradeConfig find(String key) {
        return configMapper.selectOne(new LambdaQueryWrapper<TradeConfig>()
                .eq(TradeConfig::getConfigKey, key)
                .eq(TradeConfig::getDelFlag, 0)
                .last("LIMIT 1"));
    }

    /** 按声明类型校验 —— 免得运营把费率填成"千分之五"这种字符串，等到结算那一刻才炸。 */
    private String validate(String valueType, String value) {
        if (value == null || value.trim().isEmpty()) {
            return "配置值不能为空";
        }
        String text = value.trim();
        if ("number".equals(valueType)) {
            try {
                new BigDecimal(text);
            } catch (NumberFormatException e) {
                return "该项是数值类型，请输入数字（例如 0.005）";
            }
        } else if ("boolean".equals(valueType)) {
            if (!"true".equalsIgnoreCase(text) && !"false".equalsIgnoreCase(text)) {
                return "该项是布尔类型，只能填 true 或 false";
            }
        }
        return null;
    }
}
