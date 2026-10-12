package com.agri.common.enums;

public enum StatusEnum {

    ACTIVE("active", "正常"),
    INACTIVE("inactive", "暂停"),
    DISABLED("disabled", "禁用"),
    DELETED("deleted", "已删除");

    private final String code;
    private final String desc;

    StatusEnum(String code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public String getCode() {
        return code;
    }

    public String getDesc() {
        return desc;
    }

    public static StatusEnum fromCode(String code) {
        for (StatusEnum status : values()) {
            if (status.code.equals(code)) {
                return status;
            }
        }
        return null;
    }
}
