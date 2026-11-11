package com.agri.ai.service;

import com.agri.ai.config.AIConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.Semaphore;

/** 读取兼容协议的模型目录；不保存表单、不推理、不回传凭据或上游原文。 */
@Service
public class ModelCatalogService {
    public record Query(String providerId, Long revision, String baseUrl, String authType, String apiKey, boolean clearKey) {
        @Override public String toString() { return "ModelCatalogQuery[providerId="+providerId+"]"; }
    }
    public record Result(boolean ok, String status, String message, List<String> models, boolean truncated,
                         String fetchedAt, long latencyMs, Integer httpStatus) {}
    private record Target(URI endpoint, String key, boolean bearer) {}
    private final ModelProviderSettings settings;
    private final ObjectMapper json;
    private final RestTemplate rest;
    private final Semaphore slots=new Semaphore(4);
    private final Map<String,Long> recent=new LinkedHashMap<>();
    private static final int MAX_BYTES=1024*1024, MAX_MODELS=1000;
    public ModelCatalogService(AIConfig config, ModelProviderSettings settings, ObjectMapper json) {
        this.settings=settings; this.json=json;
        var factory=new SimpleClientHttpRequestFactory() {
            @Override protected void prepareConnection(HttpURLConnection connection, String method) throws IOException {
                super.prepareConnection(connection,method);
                connection.setInstanceFollowRedirects(false);
            }
        };
        factory.setConnectTimeout(Math.max(1,Math.min(config.getConnectTimeoutMs(),3000)));
        factory.setReadTimeout(Math.max(1,Math.min(config.getRequestTimeoutMs(),8000)));
        rest=new RestTemplate(factory);
        // 错误体同样限长；所有 HTTP 状态在下方统一转换为脱敏提示。
        rest.setErrorHandler(new org.springframework.web.client.ResponseErrorHandler() {
            public boolean hasError(org.springframework.http.client.ClientHttpResponse response) { return false; }
            public void handleError(org.springframework.http.client.ClientHttpResponse response) { }
        });
    }
    public Result fetch(Query query, String operator) {
        Target target=target(query);
        synchronized(recent) {
            long now=System.nanoTime();
            Long last=recent.get(operator);
            if(last!=null && now-last<3_000_000_000L)
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"获取较频繁，请间隔 3 秒重试");
            if(!slots.tryAcquire()) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"当前获取请求较多，请稍后重试");
            recent.put(operator,now);
            while(recent.size()>256) recent.remove(recent.keySet().iterator().next());
        }
        long start=System.nanoTime();
        try {
            return rest.execute(target.endpoint(),HttpMethod.GET,request->{
                request.getHeaders().setAccept(List.of(MediaType.APPLICATION_JSON));
                if(target.bearer()) request.getHeaders().setBearerAuth(target.key());
            },response->{
                int code=response.getStatusCode().value();
                if(code<200||code>=300) return failure(code,start);
                byte[] bytes=response.getBody().readNBytes(MAX_BYTES+1);
                if(bytes.length>MAX_BYTES) return result(false,"RESPONSE_TOO_LARGE","模型列表响应超过 1MB，请手动填写模型标识",List.of(),false,start,code);
                JsonNode root;
                try { root=json.readTree(bytes); }
                catch(Exception ignored) { return invalid(start,code); }
                if(root==null || !root.path("data").isArray()) return invalid(start,code);
                SortedSet<String> models=new TreeSet<>(); boolean truncated=false;
                for(JsonNode node:root.path("data")) {
                    JsonNode raw=node.get("id");
                    if(raw==null||!raw.isTextual()) continue;
                    String id=raw.asText().trim();
                    if(id.isEmpty()||id.length()>200||id.chars().anyMatch(Character::isISOControl)) continue;
                    if(!target.key().isEmpty() && id.contains(target.key())) continue;
                    models.add(id);
                    if(models.size()>MAX_MODELS) { models.remove(models.last()); truncated=true; }
                }
                truncated=truncated||root.path("has_more").asBoolean(false);
                if(!root.path("data").isEmpty() && models.isEmpty()) return invalid(start,code);
                return result(true,models.isEmpty()?"EMPTY":"SUCCESS",models.isEmpty()?"服务未返回可用模型，请确认模型权限或手动填写":
                        "已获取 "+models.size()+" 个模型"+(truncated?"（仅展示部分，请按需手动填写）":"")+"，列表不代表全部模型均支持对话，请保存后验证连接",
                        new ArrayList<>(models),truncated,start,code);
            });
        } catch(ResourceAccessException e) {
            boolean timeout=false;
            for(Throwable cause=e;cause!=null;cause=cause.getCause()) if(cause instanceof java.net.SocketTimeoutException) timeout=true;
            return result(false,timeout?"TIMEOUT":"NETWORK_ERROR",timeout?"获取模型列表超时，请稍后重试或手动填写":"网络连接失败，请检查地址、DNS、证书与服务可用性",List.of(),false,start,null);
        } catch(RestClientResponseException e) { return failure(e.getStatusCode().value(),start); }
          catch(Exception ignored) { return result(false,"FETCH_FAILED","获取模型列表失败，可手动填写模型标识后验证连接",List.of(),false,start,null); }
        finally { slots.release(); }
    }
    private Target target(Query q) {
        if(q==null) throw new IllegalArgumentException("请提供模型服务地址和鉴权配置");
        String url=text(q.baseUrl()).replaceAll("/+$",""), auth=text(q.authType()), key=text(q.apiKey());
        URI uri;
        try {
            uri=URI.create(url);
            String path=Objects.toString(uri.getPath(),"").toLowerCase(Locale.ROOT);
            if(url.length()>2048 || !("http".equalsIgnoreCase(uri.getScheme())||"https".equalsIgnoreCase(uri.getScheme())) || uri.getHost()==null || uri.getUserInfo()!=null || uri.getQuery()!=null || uri.getFragment()!=null || uri.getPort()>65535 || url.chars().anyMatch(Character::isISOControl) || path.endsWith("/chat/completions")||path.endsWith("/models")) throw new IllegalArgumentException();
        } catch(Exception ignored) { throw new IllegalArgumentException("请填写 HTTP(S) API 基础地址，勿附加 /models、/chat/completions、凭据或查询参数"); }
        if(!List.of("BEARER","NONE").contains(auth)) throw new IllegalArgumentException("不支持的鉴权方式");
        if(key.length()>4096||key.chars().anyMatch(Character::isWhitespace)||key.chars().anyMatch(Character::isISOControl)) throw new IllegalArgumentException("API Key 格式不正确");
        if(q.clearKey()&&!key.isEmpty()) throw new IllegalArgumentException("清除密钥时请留空 API Key");
        synchronized(settings) {
            ModelProviderSettings.Channel saved=null;
            if(!text(q.providerId()).isEmpty()) {
                saved=settings.channel(q.providerId());
                if(q.revision()==null || q.revision().longValue()!=((Number)settings.describe(q.providerId()).get("revision")).longValue())
                    throw new ResponseStatusException(HttpStatus.CONFLICT,"配置已更新，请关闭表单并刷新后重试");
            }
            if("BEARER".equals(auth) && key.isEmpty()&&!q.clearKey() && saved!=null) {
                if(!url.equals(text(saved.baseUrl()).replaceAll("/+$",""))) throw new IllegalArgumentException("服务地址已变更，请重新填写 API Key 后获取列表，已有密钥不会发送到新地址");
                key=saved.apiKey();
            }
        }
        if("BEARER".equals(auth)&&(key.isBlank()||"your-api-key".equalsIgnoreCase(key))) throw new IllegalArgumentException("请先填写 API Key，或选择无需 API Key 的鉴权方式");
        return new Target(URI.create(url+"/models"),"NONE".equals(auth)?"":key,"BEARER".equals(auth));
    }
    private Result failure(int code,long start) {
        String status,message;
        if(code==401||code==403) { status="AUTH_FAILED"; message="鉴权失败，请检查 API Key、模型列表权限或 IP 白名单"; }
        else if(code==404||code==405||code==501) { status="UNSUPPORTED"; message="服务未提供兼容的 /models 接口，请手动填写模型标识"; }
        else if(code==429) { status="RATE_LIMITED"; message="模型服务限流或额度不足，请稍后重试"; }
        else if(code>=300&&code<400) { status="REDIRECT_BLOCKED"; message="模型列表接口发生重定向，请确认并填写最终 API 基础地址"; }
        else if(code>=500) { status="UPSTREAM_ERROR"; message="模型服务暂时异常，请稍后重试"; }
        else { status="REQUEST_REJECTED"; message="模型服务拒绝列表请求，请检查服务地址及接口兼容性"; }
        return result(false,status,message,List.of(),false,start,code);
    }
    private Result invalid(long start,int code) { return result(false,"INVALID_RESPONSE","服务未返回兼容的模型列表（data / id），请手动填写模型标识",List.of(),false,start,code); }
    private Result result(boolean ok,String status,String message,List<String> models,boolean truncated,long start,Integer code) {
        return new Result(ok,status,message,List.copyOf(models),truncated,Instant.now().toString(),(System.nanoTime()-start)/1_000_000,code);
    }
    private String text(String value) { return value==null?"":value.trim(); }
}
