package com.agri.common.constant;

public class RedisKeys {

    public static String getUserKey(String userId) {
        return GlobalConstants.USER_CACHE_PREFIX + userId;
    }

    public static String getTokenKey(String token) {
        return GlobalConstants.TOKEN_CACHE_PREFIX + token;
    }

    public static String getPermissionKey(String userId) {
        return GlobalConstants.PERMISSION_CACHE_PREFIX + userId;
    }

    public static String getCaptchaKey(String uuid) {
        return GlobalConstants.CACHE_PREFIX + "captcha:" + uuid;
    }

    public static String getConfigKey(String configKey) {
        return GlobalConstants.CACHE_PREFIX + "config:" + configKey;
    }

    public static String getDictKey(String dictType) {
        return GlobalConstants.CACHE_PREFIX + "dict:" + dictType;
    }
}
