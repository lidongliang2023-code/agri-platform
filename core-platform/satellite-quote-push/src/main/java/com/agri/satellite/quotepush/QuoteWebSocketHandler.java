package com.agri.satellite.quotepush;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 行情 WebSocket 会话管理：客户端连接即订阅；消息帧 {"type":"quote","data":{...}}。
 */
@Slf4j
@Component
public class QuoteWebSocketHandler extends TextWebSocketHandler {

    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
        log.info("行情订阅接入: {}（在线 {}）", session.getId(), sessions.size());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, org.springframework.web.socket.CloseStatus status) {
        sessions.remove(session);
        log.info("行情订阅断开: {}（在线 {}）", session.getId(), sessions.size());
    }

    public int broadcast(String json) {
        int sent = 0;
        TextMessage message = new TextMessage(json);
        for (WebSocketSession session : sessions) {
            if (session.isOpen()) {
                try {
                    synchronized (session) {
                        session.sendMessage(message);
                    }
                    sent++;
                } catch (IOException e) {
                    log.warn("推送失败，关闭会话: {}", session.getId());
                    try {
                        session.close();
                    } catch (IOException ignored) {
                    }
                    sessions.remove(session);
                }
            }
        }
        return sent;
    }

    public int onlineCount() {
        return sessions.size();
    }
}
