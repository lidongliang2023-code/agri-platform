package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.AiDiagnosisVO;
import com.agri.production.vo.AiMessageVO;
import com.agri.production.vo.AiSessionVO;

import java.util.List;

/**
 * AI 助手（{@code /api/v1/production/ai}）：诊断记录列表 + 问答会话与消息。
 *
 * <p><b>本部署没有大模型</b>：助手回复走**规则式应答** —— 从本服务已有数据里检索后如实回答，
 * 回复消息上标注 {@code engine=rule-based}；认不出意图时明确说"答不了"并列出能问什么，不编答案。
 * 识别（病虫害）与预测（产量）类端点刻意未实现，见方案第五节。</p>
 */
public interface IAiChatService {

    /**
     * 诊断记录分页（页面「病虫害识别」列表）。
     *
     * @param keyword 关键字（结果/作物/模型名模糊匹配），可为空
     * @param status  状态过滤（PENDING/SUCCESS/FAILED），可为空
     */
    PageResult<AiDiagnosisVO> pageDiagnoses(String tenantId, int pageNum, int pageSize,
                                            String keyword, String status);

    /** 会话列表（按更新时间倒序，带最后一条消息摘要）。 */
    List<AiSessionVO> listSessions(String tenantId);

    /** 新建会话（标题为空时给一个可改的默认名，不编造内容）。 */
    AiSessionVO createSession(String tenantId, String title);

    /** 重命名会话；返回是否真的改了（页面按返回值提示）。 */
    boolean renameSession(String tenantId, String sessionId, String title);

    /** 删除会话（连同其消息，逻辑删除）。 */
    void deleteSession(String tenantId, String sessionId);

    /** 会话消息（按时间升序）。 */
    List<AiMessageVO> messages(String tenantId, String sessionId);

    /**
     * 发一条消息：落库提问 + 生成规则式回复并落库，返回**回复**消息。
     *
     * @param sessionId 会话编号；为空时自动新建一个会话（标题取提问前 20 字）
     * @param content   提问内容
     */
    AiMessageVO send(String tenantId, String sessionId, String content);
}
