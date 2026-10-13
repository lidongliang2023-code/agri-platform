package com.agri.platform.internal.merchant;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 用户与经营主体绑定。
 *
 * <p>多对多 + 主体内角色：一个用户可以在多家主体里任职，且在不同主体里的角色可能不同
 * （既是卖家又是买家在撮合场景里很常见）。</p>
 */
@Data
@TableName("platform_user_merchant")
public class UserMerchantEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private Long merchantId;

    /**
     * 市场ID。
     *
     * <p>必须显式声明：平台按 ADR-005「market_id 内建于核心实体、框架层统一注入」，
     * 会给核心实体的查询自动追加 market_id 条件；实体上没有这个字段、表里也不会有这一列，
     * 查询就会报 Unknown column 'market_id'（第一次接进来时就是这么炸的）。</p>
     */
    private Long marketId;

    /** owner 负责人 / buyer 采购 / seller 销售 / finance 财务 */
    private String roleInMerchant;

    private Integer status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
