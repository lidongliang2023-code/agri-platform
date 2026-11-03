package com.agri.platform.internal.uc;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 推送投递名单：任务创建后先把人群固化下来，投递一条删一条。
 *
 * <p>为什么不直接在任务上记游标：人群口径是跨表条件（已实名 / 企业成员 / 30 天未登录），
 * 用游标每批重算既慢、又会因为用户状态中途变化导致同一批人反复进出。
 * 固定名单后，投递只是"读一批、发一批、删一批"，进程重启也能接着发。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_uc_push_target")
public class PushTargetEntity extends BaseEntity {

    private Long taskId;
    private Long userId;
}
