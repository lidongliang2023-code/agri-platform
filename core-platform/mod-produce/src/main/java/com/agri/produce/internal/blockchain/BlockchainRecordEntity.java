package com.agri.produce.internal.blockchain;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDateTime;

/**
 * 区块链存证记录（溯源关键数据锚定）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_blockchain_record")
public class BlockchainRecordEntity extends ProduceBaseEntity {

    @TableId(value = "record_id", type = IdType.INPUT)
    private String recordId;

    /** 业务类型 TRACE/INSPECTION/HARVEST */
    private String bizType;

    /** 业务单号 */
    private String bizNo;

    /** 批次ID */
    private String batchId;

    /** 溯源码 */
    private String traceCode;

    /** 链类型 如 TrustChain/FISCO */
    private String chainType;

    /** 链网络标识 */
    private String chainNetwork;

    /** 交易哈希 */
    private String txHash;

    /** 区块高度 */
    private Long blockHeight;

    /** 存证内容哈希 */
    private String payloadHash;

    /** 上链时间 */
    private LocalDateTime anchorAt;

    /** 状态 PENDING/SUCCESS/FAILED */
    private String status;
}
