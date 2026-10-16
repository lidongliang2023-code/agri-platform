package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

/**
 * 农场。
 *
 * <p><b>{@code platformFarmId} 是"平台侧农场标识"</b>（{@code agri_core.prod_farm_info.farm_id}，
 * 形如 {@code DEMO-FARM-001}）：页面的"当前农场"取自平台侧的 {@code /farms}，传回来的就是这个
 * 标识，本服务靠它把自己的农场主键换算出来（见 {@code FarmIdResolver}）。</p>
 *
 * <p>为什么平台标识单独一列而不是复用本表的 {@code farm_id} 列：实体基类
 * {@link BaseEntity} 已经把 {@code farm_id} 映射成 {@code Long}（所有生产实体通用的"所属农场"），
 * 而本表那一列是 {@code VARCHAR(191)} —— 在 Farm 里再声明一个 String 类型的 {@code farmId}
 * 会因 getter 返回类型冲突直接编译不过。所以这里用 {@code platform_farm_id}。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_farm_info")
public class Farm extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("farm_code")
    private String farmCode;

    /** 平台侧农场标识（如 DEMO-FARM-001）。历史数据可能为 NULL —— 没有这一层映射 */
    @TableField("platform_farm_id")
    private String platformFarmId;

    @TableField("farm_name")
    private String farmName;

    @TableField("farm_type")
    private String farmType;

    @TableField("legal_person")
    private String legalPerson;

    @TableField("contact_phone")
    private String contactPhone;

    @TableField("province")
    private String province;

    @TableField("city")
    private String city;

    @TableField("district")
    private String district;

    @TableField("address")
    private String address;

    @TableField("longitude")
    private BigDecimal longitude;

    @TableField("latitude")
    private BigDecimal latitude;

    @TableField("total_area")
    private BigDecimal totalArea;

    /** 农场负责人（页面 managerName；用户手填，见 schema 里该列的注释）。 */
    @TableField("manager_name")
    private String managerName;

    @TableField("plot_count")
    private Integer plotCount;

    @TableField("farm_type_detail")
    private String farmTypeDetail;

    @TableField("main_products")
    private String mainProducts;

    @TableField("certifications")
    private String certifications;

    @TableField("certification_expire_date")
    private java.time.LocalDate certificationExpireDate;

    @TableField("certifications_json")
    private String certificationsJson;

    @TableField("logo_url")
    private String logoUrl;

    @TableField("intro")
    private String intro;

    @TableField("register_date")
    private java.time.LocalDate registerDate;

    @TableField("audit_status")
    private String auditStatus;

    @TableField("status")
    private String status;

    @TableField("remark")
    private String remark;
}
