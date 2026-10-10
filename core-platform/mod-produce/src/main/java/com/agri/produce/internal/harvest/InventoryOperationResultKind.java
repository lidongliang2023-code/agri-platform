package com.agri.produce.internal.harvest;

/**
 * 库存写操作对台账行的作用方式。
 *
 * <p>为什么不能只用 {@code boolean ledgerCreated} 表达：一次入库对台账的作用其实有
 * <b>三种</b>，而布尔只能表达两种，剩下的那一种会被挤进一个语义错误的格子里。
 *
 * <ul>
 *   <li>{@link #CREATED} —— 该库位此前<b>不存在</b>台账（连墓碑都没有），本次 INSERT 了新行。</li>
 *   <li>{@link #UPDATED} —— 命中已有在用台账，在当前库存上<b>累加/扣减</b>，
 *       {@code inventoryId} 是原有主键。</li>
 *   <li>{@link #RESURRECTED} —— 该库位存在<b>墓碑行</b>（V16 唯一键
 *       {@code uk_inventory_slot(batch_id, warehouse_name, location_code, deleted)} 中
 *       {@code deleted=1} 的那一格），本次 UPDATE 复活它并写入，
 *       {@code inventoryId} 是<b>墓碑行的旧主键</b>，不是新生成的。</li>
 * </ul>
 *
 * <p><b>为什么必须把 RESURRECTED 单列出来。</b>它最容易误导人：
 * <ul>
 *   <li>从调用方视角「多了一条在用的台账」，很像 CREATED；</li>
 *   <li>但 {@code inventoryId} 是旧主键、且数量被<b>清零</b>后重写 ——
 *       若按 CREATED 去理解，会误以为是一个全新的空行，而忽略它可能带着旧主键；</li>
 *   <li>若误判成 UPDATED，又会以为库存是在旧值上累加，实际不是（见下）。</li>
 * </ul>
 * 数量清零是刻意的：复活时若保留上次作废台账的库存，等于「台账删了但库存还在」，
 * 那是另一种静默错误。因此 RESURRECTED 的 {@code beforeQty} 恒为 0，
 * {@code currentQty} 等于本次变动量，<b>不是</b>旧库存 + 本次变动量。
 */
public enum InventoryOperationResultKind {

    /** 新建台账行（此前该库位无任何台账） */
    CREATED,

    /** 在已有在用台账上累加 / 扣减 */
    UPDATED,

    /** 复活墓碑行后写入（数量已清零，beforeQty 恒为 0） */
    RESURRECTED
}
