package com.agri.produce.internal.common;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 生产域业务主键生成器：{@code 前缀 + yyyyMMddHHmmss + 4 位随机}，长度控制在 32 字符内。
 */
public final class ProduceIds {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private ProduceIds() {
    }

    /**
     * 生成业务主键。
     *
     * @param prefix 业务前缀，如 FARM / PLOT / TASK
     * @return 全局足够离散的业务主键
     */
    public static String newId(String prefix) {
        String safePrefix = prefix == null ? "" : prefix;
        return safePrefix + FORMATTER.format(LocalDateTime.now())
                + ThreadLocalRandom.current().nextInt(1000, 9999);
    }
}
