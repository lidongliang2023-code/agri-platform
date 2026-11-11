-- 普通消息保留NULL，历史数据无需猜测任务归属。
ALTER TABLE platform_message ADD COLUMN push_task_id BIGINT NULL COMMENT '群发任务幂等引用',
 ADD UNIQUE KEY uk_message_push_user(push_task_id,user_id);
