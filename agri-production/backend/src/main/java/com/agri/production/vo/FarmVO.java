package com.agri.production.vo;

import com.agri.production.common.util.BeanCopyUtils;
import com.agri.production.entity.Farm;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class FarmVO {

    private Long id;

    private String farmCode;

    private String farmName;

    private String farmType;

    private String legalPerson;

    private String contactPhone;

    private String province;

    private String city;

    private String district;

    private String address;

    private BigDecimal longitude;

    private BigDecimal latitude;

    private BigDecimal totalArea;

    private Integer plotCount;

    private String farmTypeDetail;

    private String mainProducts;

    private String certifications;

    private LocalDate certificationExpireDate;

    private String certificationsJson;

    private String logoUrl;

    private String intro;

    private LocalDate registerDate;

    private String auditStatus;

    /**
     * 农场状态，**页面口径的数值码**：1 运营中 / 0 已停用。

     *
     * <p>⚠️ 别直接序列化库里的文本：{@code agri_prod_farm_info.status} 存的是 {@code active / inactive}
     * （启停接口 {@code PATCH /farms/{id}/status} 也是按 1/0 收进来、写库时转文本），
     * 而页面通篇按数字读 —— {@code FARM_STATUS_META[status]} 取标签、{@code farm.status === 1}
     * 决定卡片上的「启用/停用」与详情页的状态标签。切流前平台侧返回的也是数字 1。</p>

     *
     * <p>2026-10-16 实测的后果（都源自这一处形态不一致）：列表「状态」列恒显示"未知"、
     * 详情页恒显示"已停用"、卡片菜单恒显示"启用农场"。</p>
     */
    private Integer status;

    private String remark;

    private String tenantId;

    private LocalDateTime createTime;

    /**
     * 农场负责人姓名（页面 farm list 的"负责人"列）。

     *
     * <p>平台侧没有这一列：本服务在出参处从团队成员台账里取该农场的 {@code member_type=OWNER}
     * （见 FarmAllController 的说明）。取不到时留空，页面显示 "-" —— 不编一个名字。</p>
     */
    private String managerName;

    /**
     * 页面口径的农场主键（字符串）—— 页面列表直接读 {@code record.farmId}，而本 VO 的主键字段叫 {@code id}。
     * 派生 getter，理由同 {@link PlotVO#getPlotId()}。
     */
    public String getFarmId() {
        return id == null ? null : String.valueOf(id);
    }

    /**
     * 页面口径的在册面积字段名（{@code areaTotal}）；库里/本 VO 叫 {@code totalArea}。
     *
     * <p>只做改名别名，不做换算：页面要的就是"农场在册总面积"这一个数。</p>
     */
    public java.math.BigDecimal getAreaTotal() {
        return totalArea;
    }

    /**
     * 页面口径的联系电话（{@code managerPhone}）：落库列是 {@code contact_phone}，这里给别名。
     * 理由同 {@code areaTotal} —— 页面读的是它自己的字段名。
     */
    public String getManagerPhone() {
        return getContactPhone();
    }

    private LocalDateTime updateTime;

    /**
     * 由实体构造出参。
     *
     * <p>统一在这里把状态文本换算成数值码，避免每个调用点各写一遍（现在有 8 处构造 FarmVO）。
     * {@code BeanCopyUtils.copy} 靠属性名 + 类型拷贝，String 状态列到 Integer 出参字段
     * 类型不匹配会被自动跳过，所以不会拷错，只会漏 —— 漏了就在下面显式补上。</p>
     *
     * @param farm 农场实体（可为 null）
     * @returns 出参对象（入参为 null 时返回 null）
     */
    public static FarmVO of(Farm farm) {
        FarmVO vo = BeanCopyUtils.copy(farm, FarmVO.class);
        if (vo == null) {
            return null;
        }
        vo.setStatus(statusCode(farm.getStatus()));
        return vo;
    }

    /**
     * 批量构造出参，语义同 {@link #of(Farm)}。
     *
     * @param farms 农场实体列表（可为 null / 空）
     * @returns 出参列表（入参为 null 时返回空列表，与 {@code BeanCopyUtils.copyList} 口径一致）
     */
    public static List<FarmVO> listOf(List<Farm> farms) {
        return farms == null ? List.of() : farms.stream().map(FarmVO::of).toList();
    }

    /**
     * 库内状态文本 → 页面口径数值码。
     *
     * @param text 库内文本（active / inactive）
     * @returns 1 运营中 / 0 已停用；取不到时返回 null —— **不编状态**
     */
    private static Integer statusCode(String text) {
        if (text == null) {
            return null;
        }
        return "active".equalsIgnoreCase(text.trim()) ? 1 : 0;
    }
}
