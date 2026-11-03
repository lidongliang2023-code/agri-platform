package com.agri.platform.internal.uc;

import com.baomidou.mybatisplus.annotation.InterceptorIgnore;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * 推送投递名单 Mapper。
 *
 * <p>用户中心是平台级数据，不按 market_id 隔离（与其它 platform_uc_* 一致）。</p>
 */
@Mapper
@InterceptorIgnore(tenantLine = "true")
public interface PushTargetMapper extends BaseMapper<PushTargetEntity> {

    /**
     * 物理删除已投递的名单（task_id + id 上界）。
     *
     * <p><b>不能用 {@code deleteBatchIds}</b>：实体继承 BaseEntity，{@code deleted} 带
     * {@code @TableLogic}，那个方法会执行 {@code UPDATE ... SET deleted=1} ——
     * 名单行永远留在表里。每次群发几万行，表会无限膨胀，正好违背"投完就清"的初衷。</p>
     *
     * <p>按 id 上界删而不是 IN 列表：这批就是按 id 升序取的，一个范围条件即可，
     * 语句长度与批次大小无关。</p>
     */
    @Delete("DELETE FROM platform_uc_push_target WHERE task_id = #{taskId} AND id <= #{maxId}")
    int deleteUpTo(@Param("taskId") Long taskId, @Param("maxId") Long maxId);
}
