package com.agri.production.dto;

import lombok.Data;

@Data
public class TaskPageDTO {

    private String taskName;

    private String taskType;

    /**
     * 农场筛选原值（**原样接前端传来的东西**）。
     *
     * <p>类型是 String 而不是 Long，因为页面上的"当前农场"取自平台侧的 {@code /farms}，
     * 值是 {@code DEMO-FARM-001} 这种字符串；写成 Long 的话 Spring 在**绑定阶段**就 400
     * （「参数类型不匹配: farmId」），连"筛错了"都说不清。
     * 解析成本地农场主键由 {@code FarmIdResolver} 负责，SQL 过滤用的是解析结果，
     * 不是这个字段本身 —— 见 TaskMapper#pageQuery 的 farmId 参数。</p>
     */
    private String farmId;

    private Long plotId;

    private Long executorId;

    private String status;

    private String priority;

    private java.time.LocalDate startDate;

    private java.time.LocalDate endDate;

    private Integer pageNum = 1;

    private Integer pageSize = 10;
}
