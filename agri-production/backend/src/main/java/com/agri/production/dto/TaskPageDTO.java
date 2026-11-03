package com.agri.production.dto;

import lombok.Data;

@Data
public class TaskPageDTO {

    private String taskName;

    /**
     * 关键字（任务名称 / 任务编号模糊匹配）。
     *
     * <p>前端列表页的搜索框传的是 {@code keyword}，早先 DTO 只有 {@code taskName}，
     * Spring 把未声明参数直接丢掉 —— 用户输入关键字点查询，返回的却是全量。</p>
     */
    private String keyword;

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

    private Long planId;

    private Long stageId;

    private Long executorId;

    /**
     * 执行人筛选（前端列表页传的是成员业务标识 {@code MEMB...} 或数字主键）。
     *
     * <p>服务层按「纯数字当主键、否则查 member_id」归一成 {@link #executorId} 后再进 SQL ——
     * 直接把它当 Long 绑定会在参数绑定阶段 400，和农场筛选同一类问题。</p>
     */
    private String assigneeId;

    private String status;

    private String priority;

    private java.time.LocalDate startDate;

    private java.time.LocalDate endDate;

    private Integer pageNum = 1;

    private Integer pageSize = 10;
}
