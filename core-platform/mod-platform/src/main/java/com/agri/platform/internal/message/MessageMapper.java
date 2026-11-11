package com.agri.platform.internal.message;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface MessageMapper extends BaseMapper<MessageEntity> {
    @com.baomidou.mybatisplus.annotation.InterceptorIgnore(tenantLine = "true")
    @org.apache.ibatis.annotations.Select("SELECT COUNT(*) FROM platform_message WHERE push_task_id=#{taskId}")
    int countDeliveredPush(@org.apache.ibatis.annotations.Param("taskId") Long taskId);

    /** 仅用于后台群发；市场来自持久化任务，不能使用调度线程的默认市场。 */
    @com.baomidou.mybatisplus.annotation.InterceptorIgnore(tenantLine = "true")
    @org.apache.ibatis.annotations.Insert("INSERT INTO platform_message(id,market_id,tenant_id,user_id,push_task_id,title,content,read_flag,created_at,updated_at,deleted) " +
        "VALUES(#{id},#{marketId},#{tenantId},#{userId},#{pushTaskId},#{title},#{content},0,NOW(),NOW(),0) " +
        "ON DUPLICATE KEY UPDATE push_task_id=VALUES(push_task_id)")
    int insertPushOnce(MessageEntity message);

}
