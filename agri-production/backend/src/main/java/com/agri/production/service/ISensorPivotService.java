package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.EnvTrendVO;
import com.agri.production.vo.EnvironmentDataVO;
import com.agri.production.vo.IotReadingVO;

import java.util.List;

/**
 * 传感器长表 → 页面宽表的透视（growth 与 iot 两个模块**共用这一份**）。
 *
 * <p>为什么单独抽一个服务而不是在 growth 里写一遍：{@code /growth/environment}、
 * {@code /growth/environment/history}、{@code /iot/readings/latest}、{@code /iot/readings/series}
 * 四条端点读的是同一张长表、同一套指标别名、同一套"缺采留 null"口径。
 * 写两遍必然在某一处漂移（别名表缺一项、时间边界差一天），而漂移的表现是
 * "同一个地块在环境数据页有值、在设备页没值"这种极难定位的不一致。</p>
 *
 * <p>本服务只读，不校验/不写入长表；租户过滤由调用方传入（与同域其它用户端服务同口径）。</p>
 */
public interface ISensorPivotService {

    /**
     * 环境数据宽表分页。
     *
     * @param tenantId  当前租户（必填，由控制器从 TenantContextService 取）
     * @param plotId    地块筛选，可为空（数字按本地地块主键、或地块编码）
     * @param deviceId  设备筛选，可为空（数字按本地设备主键、或设备编码）
     * @param startDate 起始日期 yyyy-MM-dd（含），可为空
     * @param endDate   结束日期 yyyy-MM-dd（含），可为空
     * @param pageNum   页码（从 1 开始）
     * @param pageSize  每页条数
     * @return 宽表分页结果（按采集时间倒序）
     */
    PageResult<EnvironmentDataVO> environmentPage(String tenantId, String plotId, String deviceId,
                                                  String startDate, String endDate, int pageNum, int pageSize);

    /**
     * 环境趋势（按天聚合，多指标）。
     *
     * @param tenantId  当前租户
     * @param plotId    地块筛选，可为空
     * @param deviceId  设备筛选，可为空
     * @param metrics   逗号分隔指标名（规范码 / camelCase / 常用别名均可），可为空（默认空气温度）
     * @param startDate 起始日期 yyyy-MM-dd（含），可为空
     * @param endDate   结束日期 yyyy-MM-dd（含），可为空
     * @return 日期 × 指标的趋势（同日取均值；极值明细在 stats 里）
     */
    EnvTrendVO history(String tenantId, String plotId, String deviceId, String metrics,
                       String startDate, String endDate);

    /**
     * 设备最新一条读数（窄表行，不透视）。
     *
     * @param tenantId 当前租户
     * @param deviceId 设备标识（数字主键或设备编码）
     * @return 最新读数；该设备没有任何读数时返回 null（前端契约允许 null，页面显示空态）
     */
    IotReadingVO latest(String tenantId, String deviceId);

    /**
     * 设备读数时序（窄表行，按采集时间升序）。
     *
     * <p>与宽表透视的分工：这里要的是"一行一指标"的原始读数（画曲线时自己做聚合），
     * 而 {@link #environmentPage} 要的是"同一时刻多指标合成一行"的宽表。</p>
     *
     * @param tenantId  当前租户
     * @param deviceId  设备标识（数字主键或设备编码）
     * @param metric    指标筛选，可为空（规范码 / camelCase / 常用别名）
     * @param startDate 起始日期 yyyy-MM-dd（含），可为空
     * @param endDate   结束日期 yyyy-MM-dd（含），可为空
     */
    List<IotReadingVO> series(String tenantId, String deviceId, String metric,
                              String startDate, String endDate);

    /**
     * 指标别名 → 规范 snake_case 码。
     *
     * <p>给 iot 段复用（设备读数按指标过滤时要走同一套别名），未识别的返回 null。</p>
     *
     * @param raw 原始指标名/传感器类型
     * @return 规范码（{@code air_temperature} 等），识别不了为 null
     */
    String canonicalMetric(String raw);

    /**
     * 规范码清单（顺序即趋势序列的键顺序）。
     *
     * @return 七个规范指标码
     */
    List<String> canonicalMetrics();
}
