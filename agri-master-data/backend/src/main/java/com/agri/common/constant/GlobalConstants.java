package com.agri.common.constant;

public class GlobalConstants {

    // JWT相关
    public static final String JWT_SECRET = "AgriPlatformSecretKey2024";
    public static final Long JWT_EXPIRATION = 604800000L; // 7天

    // 分页默认值
    public static final Integer DEFAULT_PAGE_NUM = 1;
    public static final Integer DEFAULT_PAGE_SIZE = 10;
    public static final Integer MAX_PAGE_SIZE = 100;

    // 缓存前缀
    public static final String CACHE_PREFIX = "agri:";
    public static final String USER_CACHE_PREFIX = CACHE_PREFIX + "user:";
    public static final String PERMISSION_CACHE_PREFIX = CACHE_PREFIX + "permission:";
    public static final String TOKEN_CACHE_PREFIX = CACHE_PREFIX + "token:";

    // 超级管理员
    public static final String SUPER_ADMIN = "admin";

    // 状态
    public static final Integer STATUS_NORMAL = 1;
    public static final Integer STATUS_DISABLE = 0;

    // 删除标记
    public static final Integer DEL_FLAG_NORMAL = 0;
    public static final Integer DEL_FLAG_DELETE = 1;

    // 日期格式
    public static final String DATE_FORMAT = "yyyy-MM-dd";
    public static final String DATETIME_FORMAT = "yyyy-MM-dd HH:mm:ss";
    public static final String TIME_FORMAT = "HH:mm:ss";
}
