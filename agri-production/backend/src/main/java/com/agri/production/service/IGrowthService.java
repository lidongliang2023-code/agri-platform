package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.GrowthRecordVO;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 用户端：生长监测（{@code /api/v1/production/growth}）。
 *
 * <p>与同域其它用户端服务同口径：租户由控制器从 {@link TenantContextService} 取后传入，
 * 本接口只负责查询与字段校验。</p>
 */
public interface IGrowthService {

    /**
     * 生长记录分页。
     *
     * @param farmId      本服务农场主键（页面传回的农场标识已由 {@link FarmIdResolver} 换算），可为空
     * @param plotId      地块标识（页面口径），可为空
     * @param planId      种养计划标识，可为空
     * @param growthStage 生育期，可为空
     * @param startDate   记录日期起（yyyy-MM-dd，含），可为空
     * @param endDate     记录日期止（yyyy-MM-dd，含），可为空
     */
    PageResult<GrowthRecordVO> page(int pageNum, int pageSize, String tenantId, Long farmId, String plotId,
                                    String planId, String growthStage, String startDate, String endDate);

    /**
     * 记录详情。
     *
     * @throws com.agri.production.common.exception.BusinessException 记录不存在（404）
     */
    GrowthRecordVO detail(String tenantId, String recordId);

    /**
     * 新增记录。
     *
     * @return 新记录编号
     * @throws com.agri.production.common.exception.BusinessException 必填缺失或取值非法（400）
     */
    String create(String tenantId, GrowthPayload payload);

    /**
     * 更新记录（只改传了的字段）。
     *
     * @throws com.agri.production.common.exception.BusinessException 参数非法（400）/ 记录不存在（404）
     */
    GrowthRecordVO update(String tenantId, String recordId, GrowthPayload payload);

    /**
     * 删除记录（逻辑删除）。
     *
     * @throws com.agri.production.common.exception.BusinessException 记录不存在（404）
     */
    void delete(String tenantId, String recordId);

    /**
     * 某地块的全部记录（页面「长势对比」，按记录日期升序）。
     *
     * @param plotId 地块标识（必填）
     */
    List<GrowthRecordVO> byPlot(String tenantId, String plotId);

    /**
     * 病虫害记录（页面「生长监测总览」的 AI 诊断列表）。
     *
     * <p>口径与平台侧一致：{@code pest_level >= level}（0 无 / 1 轻 / 2 中 / 3 重），
     * 即 level=1 表示"至少轻度"。</p>
     *
     * @param level 病虫害等级下限
     */
    List<GrowthRecordVO> pest(String tenantId, int level);

    /**
     * 地块生长总览。
     *
     * @param plotId 地块标识，可为空（为空时按当前租户全部记录统计）
     * @return recordCount / pestCount / avgHeight / latestStage / latestPestLevel / latestRecordDate 等
     */
    Map<String, Object> overview(String tenantId, String plotId);

    /**
     * 生长记录写操作的入参（页面按后端字段名发送）。
     *
     * @param plotId        地块标识（必填）
     * @param plotName      地块名称（页面冗余回传，便于列表直接展示）
     * @param farmId        农场标识（页面传的是平台侧标识，由控制器换算）
     * @param planId        种养计划标识
     * @param cropId        作物标识
     * @param cropName      作物名称
     * @param growthStage   生育期（必填）
     * @param plantHeight   株高 cm
     * @param leafCount     叶片数
     * @param leafAreaIndex 叶面积指数
     * @param growthLevel   长势评级 1~4（必填）
     * @param pestLevel     病虫害等级 0~3
     * @param pestInfo      病虫害描述
     * @param weather       天气
     * @param recorderId    记录人标识
     * @param recorderName  记录人姓名
     * @param recordDate    记录日期 yyyy-MM-dd（必填）
     * @param photoUrls     照片地址列表（页面主用）
     * @param photos        照片原始字符串（页面同时会发，作兜底）
     * @param remark        备注
     * @param status        1 有效 0 停用
     */
    record GrowthPayload(String plotId, String plotName, String farmId, String planId, String cropId,
                         String cropName, String growthStage, BigDecimal plantHeight, Integer leafCount,
                         BigDecimal leafAreaIndex, Integer growthLevel, Integer pestLevel, String pestInfo,
                         String weather, String recorderId, String recorderName, String recordDate,
                         List<String> photoUrls, String photos, String remark, Integer status) {
    }
}
