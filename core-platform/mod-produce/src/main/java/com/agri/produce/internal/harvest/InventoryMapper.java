package com.agri.produce.internal.harvest;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 库存台账 数据访问。
 *
 * <p>除 MyBatis-Plus 的 {@link BaseMapper} 外，这里额外提供两条原生 SQL：
 * 墓碑行查询与复活。原因是 {@code InventoryEntity#deleted} 带
 * {@code @TableLogic}，MyBatis-Plus 生成的任何查询都会自动追加 {@code deleted = 0}，
 * <b>用 Wrapper 永远查不到已逻辑删除的行</b>；而 V16 的唯一约束
 * {@code uk_inventory_slot(batch_id, warehouse_name, location_code, deleted)}
 * 要求「删除后同库位再入库」必须复活墓碑行而不是新插，否则撞唯一键报 500。
 * 这两个方法绕开逻辑删除过滤，是配合该约束的必要能力。
 */
@Mapper
public interface InventoryMapper extends BaseMapper<InventoryEntity> {

    /**
     * 查询指定库位上已逻辑删除的墓碑行主键。
     *
     * @param batchId       批次ID
     * @param warehouseName 仓库名称
     * @param locationCode  库位编号（已归一化，未指定为空串）
     * @return 墓碑行主键，不存在返回 null
     */
    @Select("SELECT inventory_id FROM prod_inventory "
            + "WHERE batch_id = #{batchId} AND warehouse_name = #{warehouseName} "
            + "AND location_code = #{locationCode} AND deleted = 1 "
            + "ORDER BY inventory_id LIMIT 1")
    String selectDeletedSlotId(@Param("batchId") String batchId,
                               @Param("warehouseName") String warehouseName,
                               @Param("locationCode") String locationCode);

    /**
     * 复活墓碑行：恢复为在用，并把数量类字段清零（视为一个全新的空库位）。
     *
     * <p>数量必须清零 —— 否则会把上一次作废台账的库存带回到新台账里，
     * 变成「删除了但库存还在」的另一种静默错误。
     *
     * @param inventoryId 墓碑行主键
     * @return 影响行数
     */
    @Update("UPDATE prod_inventory SET deleted = 0, current_qty = 0, frozen_qty = 0, "
            + "loss_qty = 0, loss_reason = NULL WHERE inventory_id = #{inventoryId}")
    int resurrectSlot(@Param("inventoryId") String inventoryId);
}
