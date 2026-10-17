package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.exception.BusinessException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 移动端基础设施（PRD §5.2 离线 / §5.3 推送 / §5.5 定位）：**策略已定，实现未做**。

 *
 * <p>这三条与 AI 那批不同：它们不做不是"没有模型"，而是需要先定业务口径。2026-10-17 已按
 * 产品确认的方向把口径定下来（见 {@code docs/生产管理模块_移动端接口契约_2026-10-17.md} 第 5 节）：</p>
 * <ul>
 *   <li><b>推送</b>：小程序走**微信订阅消息**（用户主动订阅的模板消息），PC/App 走站内消息；
 *       不接厂商推送通道。要落地需要模板 ID 与订阅授权，本部署两者都没有。</li>
 *   <li><b>离线</b>：只读缓存 + **三类写操作的离线队列**（任务过程记录 / 投入品使用 / 采收登记），
 *       冲突以服务端为准、客户端按队列重放并做幂等；不追求"任意表单都能离线写"。</li>
 *   <li><b>定位</b>：只采集**打卡点**（地块中心 + 当前坐标 + 时间），不采集连续轨迹；
 *       上报前需用户显式授权。</li>
 * </ul>
 *
 * <p>为什么不假装实现：这三条一旦"接口能调通但什么都没有发生"，离线就会丢数据、
 * 推送就会永远收不到、定位就会静默不落库 —— 比明确 501 更糟。所以这里统一 501 并把
 * **已定的口径**写进 message，前端可以照契约接，接上后用户看到的是"为什么还没上"。</p>
 */
@RestController
@RequestMapping("/api/v1/production/mobile")
public class MobileOpsController {

    /** 推送设备注册（PRD 6.2.1）。 */
    @PostMapping("/push/register")
    public ApiResponse<Map<String, Object>> registerPush(@RequestBody(required = false) Map<String, Object> body) {
        throw new BusinessException(501,
                "推送注册未接入：口径已定为「小程序走微信订阅消息、PC/App 走站内消息」，"
                        + "但本部署没有小程序模板 ID 与订阅授权，注册了也发不出消息，故不落库、不假装成功。"
                        + "可用的替代：站内消息（GET /messages）。");
    }

    /** 离线数据同步（PRD 6.2.2）。 */
    @PostMapping("/sync")
    public ApiResponse<Map<String, Object>> sync(@RequestBody(required = false) Map<String, Object> body) {
        throw new BusinessException(501,
                "离线同步未接入：口径已定为「只读缓存 + 任务过程记录/投入品使用/采收登记三类写操作离线队列，"
                        + "冲突以服务端为准并做幂等重放」，但服务端还没有幂等键与冲突合并的实现，"
                        + "此时接收队列会静默丢数据，故不接收。");
    }

    /** 定位上报（PRD 6.2.3，打卡点口径）。 */
    @PostMapping("/location/report")
    public ApiResponse<Map<String, Object>> reportLocation(@RequestBody(required = false) Map<String, Object> body) {
        throw new BusinessException(501,
                "定位上报未接入：口径已定为「只采集打卡点（地块中心 + 当前坐标 + 时间），不采连续轨迹」，"
                        + "但还没有对应的落库表与授权流程，故不接收坐标（位置属敏感数据，不落一条没有归属的记录）。"
                        + "可用的替代：地块台账里的中心经纬度（GET /plots/{id}）。");
    }
}
