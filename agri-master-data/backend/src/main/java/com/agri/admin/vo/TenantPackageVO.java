package com.agri.admin.vo;

import lombok.Data;

@Data
public class TenantPackageVO {

    private Long id;
    
    private String packageCode;
    
    private String packageName;
    
    private String packageDesc;
    
    private Integer userLimit;
    
    private Integer orgLimit;
    
    private Integer productLimit;
    
    private Long storageLimit;
    
    private Integer apiLimit;
    
    private String serviceLevelDesc;

    /**
     * 服务级别：1 基础 / 2 标准 / 3 专属。
     *
     * <p>原 VO 只有 {@code serviceLevelDesc}（展示文案）而没有级别本身，
     * 于是前端按"级别 → 下拉值"映射时读到 undefined，只能落到默认值 ——
     * 三张套餐卡都显示成"基础支持"。展示文案会随文案调整而变，级别才是稳定的枚举。</p>
     */
    private Integer serviceLevel;
    
    private Double price;
    
    private Integer duration;
    
    private Integer status;
    
    private String createTime;
}
