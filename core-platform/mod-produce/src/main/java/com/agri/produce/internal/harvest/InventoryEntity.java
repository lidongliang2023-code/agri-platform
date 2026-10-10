package com.agri.produce.internal.harvest;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 库存台账（按 批次 + 仓库 + 库位 聚合当前库存）。
 *
 * <p><b>为什么必须单独建这张表。</b>此前库里只有 {@code prod_inventory_flow}
 * （出入库流水，每一次变动一行），没有任何台账表，于是 {@code GET /harvests/inventory}
 * 只能返回流水实体，前端 {@code InventoryRecord} 契约里的 {@code inventoryId /
 * warehouseName / currentQty / frozenQty / productName / category / safeQty /
 * expireDate / healthStatus / locationCode} 十个字段全部取不到（工单 BT-01）。
 * 台账是「当前状态」，流水是「变化历史」，两者语义不同，不能互相替代。
 *
 * <p><b>healthStatus 的口径。</b>与前端 {@code resolveInventoryHealth} 完全同序：
 * 不足（{@code currentQty <= safeQty * 0.5}）→ 临期（{@code expireDate} 距今 ≤ 3 天）
 * → 预警（{@code currentQty <= safeQty}）→ 正常。由
 * {@link InventoryService#resolveHealth(InventoryEntity)} 在每次写操作后重算落库，
 * 读接口不再二次加工，避免前后端口径漂移。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_inventory")
public class InventoryEntity extends ProduceBaseEntity {

    @TableId(value = "inventory_id", type = IdType.INPUT)
    private String inventoryId;

    /** 采收批次ID */
    private String batchId;

    /** 批次号（冗余，列表直接展示，免去二次查批次表） */
    private String batchNo;

    /** 仓库ID（当前无仓库主数据表，预留） */
    private String warehouseId;

    /** 仓库名称 */
    private String warehouseName;

    /** 库位编号 */
    private String locationCode;

    /** 品名，如「番茄(一级)」 */
    private String productName;

    /** 品类，如 番茄 / 黄瓜 / 辣椒 */
    private String category;

    /** 质量等级（冗余自批次 grade） */
    private String grade;

    /** 当前库存数量 */
    private BigDecimal currentQty;

    /** 冻结数量 */
    private BigDecimal frozenQty;

    /** 安全库存 */
    private BigDecimal safeQty;

    /** 计量单位，默认 kg */
    private String unit;

    /** 累计损耗数量 */
    private BigDecimal lossQty;

    /** 最近损耗原因 */
    private String lossReason;

    /** 最近入库时间 */
    private LocalDateTime lastInAt;

    /** 最近出库时间 */
    private LocalDateTime lastOutAt;

    /** 保质期至 */
    private LocalDate expireDate;

    /** 库存健康状态 normal / warning / shortage / expiring */
    private String healthStatus;

    /** 是否冻结 0否 1是 */
    private Boolean frozen;

    /** 关联采收批次号 */
    private String relatedBatchNo;

    /** 备注 */
    private String remark;
}
