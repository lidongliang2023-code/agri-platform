package com.agri.ai.service;

import com.agri.ai.config.AIConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.nio.file.*;
import java.nio.file.attribute.*;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;

/** 服务端加密配置；密钥不通过管理查询接口返回。 */
@Service
public class ModelProviderSettings {
    public record Edit(long revision, String baseUrl, String model, String apiKey, boolean clearKey,
                       boolean selected, boolean inferenceEnabled, boolean fallbackToRuleTemplate,
                       String name, String authType) {
        public Edit(long revision, String baseUrl, String model, String apiKey, boolean clearKey,
                    boolean selected, boolean inferenceEnabled, boolean fallbackToRuleTemplate) {
            this(revision, baseUrl, model, apiKey, clearKey, selected, inferenceEnabled, fallbackToRuleTemplate, null, null);
        }
    }
    public record FailoverPolicy(boolean enabled, List<String> providerIds, int timeoutMs) {}
    public record FailoverEdit(Long revision, Boolean enabled, List<String> providerIds, Integer timeoutMs) {}
    public record CircuitPolicy(boolean enabled, int failureThreshold, int cooldownSeconds) {}
    public record CircuitEdit(Long revision, Boolean enabled, Integer failureThreshold, Integer cooldownSeconds) {}
    private Map<String,CircuitPolicy> circuits = new LinkedHashMap<>();
    public record Route(List<Channel> channels, int timeoutMs) {}
    private Map<String,FailoverPolicy> failovers = new LinkedHashMap<>();
    public record Change(long revision, Map<String, Object> before, Map<String, Object> after) {}
    public record Channel(String id, String name, String baseUrl, String model, String apiKey, String authType, boolean custom) {
        @Override public String toString() { return "Channel[id=" + id + ", model=" + model + "]"; }
    }
    private final AIConfig config;
    private final ObjectMapper json;
    private final Path file, keyFile;
    private final AiConfigurationStore store;
    private long databaseRevision;
    private boolean loading;
    private Map<String,Channel> customProviders = new LinkedHashMap<>();
    private long revision;
    private String updatedAt = "", updatedBy = "";
    public ModelProviderSettings(AIConfig config, ObjectMapper json, AiConfigurationStore store,
            @Value("${ai.admin.provider-file:${user.home}/.agri-platform/ai-models/providers.enc}") String file) {
        this.config=config; this.json=json; this.file=Path.of(file).toAbsolutePath();this.store=store;
        this.keyFile=this.file.resolveSibling("providers.key");
        var document=store.initialize("providers",()-> {
            try {
                if(Files.exists(this.file)) {
                    byte[] packed=Files.readAllBytes(this.file);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
                    cipher.init(Cipher.DECRYPT_MODE,new SecretKeySpec(Files.readAllBytes(keyFile),"AES"),new GCMParameterSpec(128,Arrays.copyOfRange(packed,0,12)));
                    return new String(cipher.doFinal(Arrays.copyOfRange(packed,12,packed.length)),java.nio.charset.StandardCharsets.UTF_8);
                }
                return json.writeValueAsString(Map.of("config",config,"customProviders",List.of(),"failovers",Map.of(),"circuits",Map.of(),"revision",0));
            } catch(Exception e) { throw new IllegalStateException("旧模型配置导入失败，保留旧文件且停止初始化",e); }
        });
        load(document);
    }
    private void load(AiConfigurationStore.Document document) {
        loading=true;
        try {
            var root=json.readTree(document.body());
            var nextProviders=new LinkedHashMap<String,Channel>();
            for(var node:root.path("customProviders")) { var channel=json.treeToValue(node,Channel.class);nextProviders.put(channel.id(),channel); }
            var nextFailovers=new LinkedHashMap<String,FailoverPolicy>();var f=root.path("failovers").fields();
            while(f.hasNext()) { var e=f.next();nextFailovers.put(e.getKey(),json.treeToValue(e.getValue(),FailoverPolicy.class)); }
            var nextCircuits=new LinkedHashMap<String,CircuitPolicy>();var c=root.path("circuits").fields();
            while(c.hasNext()) { var e=c.next();nextCircuits.put(e.getKey(),json.treeToValue(e.getValue(),CircuitPolicy.class)); }
            apply(json.treeToValue(root.path("config"),AIConfig.class));
            customProviders=nextProviders;failovers=nextFailovers;circuits=nextCircuits;
            revision=root.path("revision").asLong();updatedAt=root.path("updatedAt").asText();updatedBy=root.path("updatedBy").asText();
            databaseRevision=document.revision();channel(config.getProvider());
        } catch(Exception e) { throw new IllegalStateException("数据库模型配置读取失败",e); }
        finally { loading=false; }
    }
    private int operationDepth;
    private void enterOperation() {
        if(operationDepth==0 && !loading) refresh();
        operationDepth++;
    }
    private void refresh() {
        if(loading) return;
        var document=store.read("providers");if(document.revision()!=databaseRevision) load(document);
    }
    public synchronized List<String> ids() {
        enterOperation();
        try {
        var ids=new ArrayList<>(List.of("tongyi","openai")); ids.addAll(customProviders.keySet()); return ids;

        } finally { operationDepth--; }
    }
    public synchronized Channel channel(String id) {
        enterOperation();
        try {
        synchronized(config) {
            if("tongyi".equals(id)) return new Channel(id,"服务通道 A",text(config.getTongyi().getBaseUrl()),text(config.getTongyi().getModel()),text(config.getTongyi().getApiKey()),"BEARER",false);
            if("openai".equals(id)) return new Channel(id,"服务通道 B",text(config.getOpenai().getBaseUrl()),text(config.getOpenai().getModel()),text(config.getOpenai().getApiKey()),"BEARER",false);
            Channel found=customProviders.get(id);
            if(found==null) throw new IllegalArgumentException("模型通道不存在，请刷新列表");
            return found;
        }

        } finally { operationDepth--; }
    }
    public synchronized Channel selectedChannel() {
        enterOperation();
        try { return channel(config.getProvider());
        } finally { operationDepth--; }
    }
    public synchronized Map<String,Object> describe(String id) {
        enterOperation();
        try {
        Channel c=channel(id);
        Map<String,Object> data=new LinkedHashMap<>(summary(c,config));
        data.put("id",id); data.put("revision",revision); data.put("custom",c.custom());
        data.put("circuit",circuitPolicy(id)); data.put("failover",policy(id)); data.put("protocol","CHAT_COMPLETIONS"); data.put("updatedAt",updatedAt); data.put("updatedBy",updatedBy);
        data.put("configurationSource",revision>0?"管理端配置":"部署环境");
        return data;

        } finally { operationDepth--; }
    }
    public synchronized FailoverPolicy policy(String id) {
        enterOperation();
        try {
        channel(id); return failovers.getOrDefault(id,new FailoverPolicy(false,List.of(),10000));

        } finally { operationDepth--; }
    }
    public synchronized CircuitPolicy circuitPolicy(String id) {
        enterOperation();
        try {
        channel(id); return circuits.getOrDefault(id,new CircuitPolicy(false,3,30));

        } finally { operationDepth--; }
    }
    public synchronized Map<String,Object> saveCircuit(String id, CircuitEdit edit, String operator) {
        enterOperation();
        try {
        channel(id);
        if(edit==null||edit.revision()==null||edit.enabled()==null||edit.failureThreshold()==null||edit.cooldownSeconds()==null)
            throw new IllegalArgumentException("请提供完整的熔断恢复配置及修订号");
        checkRevision(edit.revision());
        if(edit.failureThreshold()<1||edit.failureThreshold()>20||edit.cooldownSeconds()<5||edit.cooldownSeconds()>600)
            throw new IllegalArgumentException("连续失败阈值为1至20次，冷却时间为5至600秒");
        var before=circuitPolicy(id); var after=new CircuitPolicy(edit.enabled(),edit.failureThreshold(),edit.cooldownSeconds());
        if(!before.equals(after)) {
            var next=new LinkedHashMap<>(circuits); next.put(id,after); String now=Instant.now().toString();
            try { persist(Map.of("config",copyConfig(),"customProviders",new ArrayList<>(customProviders.values()),
                "failovers",failovers,"circuits",next,"revision",revision+1,"updatedAt",now,"updatedBy",operator)); }
            catch(ResponseStatusException e) { throw e; }
            catch(Exception e) { throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"熔断配置保存失败，原配置未变更"); }
            circuits=next;revision++;updatedAt=now;updatedBy=operator;
        }
        return Map.of("before",Map.of("circuit",before),"after",Map.of("circuit",after),"revision",revision);

        } finally { operationDepth--; }
    }
    public synchronized Route route(Channel primary) {
        enterOperation();
        try {
        var policy=policy(primary.id()); var channels=new ArrayList<Channel>(); channels.add(primary);
        if(policy.enabled()) for(String id:policy.providerIds()) channels.add(channel(id));
        return new Route(List.copyOf(channels),policy.enabled()?policy.timeoutMs():config.getRequestTimeoutMs());

        } finally { operationDepth--; }
    }
    public synchronized Map<String,Object> saveFailover(String id, FailoverEdit edit, String operator) {
        enterOperation();
        try {
        channel(id);
        if(edit==null||edit.revision()==null||edit.enabled()==null||edit.providerIds()==null||edit.timeoutMs()==null)
            throw new IllegalArgumentException("请提供完整的故障切换配置及修订号");
        checkRevision(edit.revision());
        if(edit.providerIds().size()>3||edit.timeoutMs()<1000||edit.timeoutMs()>15000)
            throw new IllegalArgumentException("最多3个备用通道，单通道超时应为1000至15000毫秒");
        var unique=new HashSet<String>();
        for(String target:edit.providerIds()) {
            if(target==null||id.equals(target)||!unique.add(target)) throw new IllegalArgumentException("备用通道不能重复或包含主通道");
            if(!RealModelClient.isConfigured(channel(target))) throw new IllegalArgumentException("备用通道配置不完整，请先完善并验证连接");
        }
        if(edit.enabled()&&edit.providerIds().isEmpty()) throw new IllegalArgumentException("开启故障切换至少需要1个备用通道");
        var before=policy(id); var after=new FailoverPolicy(edit.enabled(),List.copyOf(edit.providerIds()),edit.timeoutMs());
        if(!before.equals(after)) {
            var next=new LinkedHashMap<>(failovers); next.put(id,after);
            try { persist(Map.of("config",copyConfig(),"customProviders",new ArrayList<>(customProviders.values()),
                "failovers",next,"circuits",circuits,"revision",revision+1,"updatedAt",Instant.now().toString(),"updatedBy",operator)); }
            catch(ResponseStatusException e) { throw e; }
            catch(Exception e) { throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"故障切换配置保存失败，原配置未变更"); }
            failovers=next; revision++; updatedAt=Instant.now().toString(); updatedBy=operator;
        }
        return Map.of("before",Map.of("failover",before),"after",Map.of("failover",after),"revision",revision);

        } finally { operationDepth--; }
    }
    public synchronized Change save(String id, Edit edit, String operator) {
        enterOperation();
        try { return mutate(id,edit,operator,false);
        } finally { operationDepth--; }
    }
    public synchronized Change create(Edit edit, String operator) {
        enterOperation();
        try {
        if(customProviders.size()>=50) throw new IllegalArgumentException("最多支持 50 个自定义通道");
        return mutate("custom-"+UUID.randomUUID(),edit,operator,true);

        } finally { operationDepth--; }
    }
    private Change mutate(String id, Edit edit, String operator, boolean create) {
        if(edit==null) throw new IllegalArgumentException("请提供配置内容");
        checkRevision(edit.revision());
        synchronized(config) {
            Channel previous=create?null:channel(id);
            boolean custom=create||previous.custom();
            String name=custom?text(edit.name()==null&&previous!=null?previous.name():edit.name()):previous.name();
            if(name.isBlank()||name.length()>80||name.chars().anyMatch(Character::isISOControl)) throw new IllegalArgumentException("通道名称不能为空，最多 80 个字符");
            if(ids().stream().filter(other->!other.equals(id)).map(this::channel).anyMatch(c->c.name().equalsIgnoreCase(name))) throw new IllegalArgumentException("通道名称已存在");
            String auth=custom?(edit.authType()==null?(previous==null?"BEARER":previous.authType()):edit.authType()):"BEARER";
            if(!List.of("BEARER","NONE").contains(auth)) throw new IllegalArgumentException("不支持的鉴权方式");
            String url=text(edit.baseUrl()).replaceAll("/+$", ""), model=text(edit.model()), key=text(edit.apiKey());
            try {
                URI uri=URI.create(url);
                if(url.length()>2048 || !("https".equalsIgnoreCase(uri.getScheme())||"http".equalsIgnoreCase(uri.getScheme())) || uri.getHost()==null || uri.getUserInfo()!=null || uri.getQuery()!=null || uri.getFragment()!=null || uri.getPort()>65535 || url.chars().anyMatch(Character::isISOControl)) throw new Exception();
                if(uri.getPath()!=null&&uri.getPath().toLowerCase(Locale.ROOT).endsWith("/chat/completions")) throw new IllegalArgumentException("请填写 API 基础地址，不要附加 /chat/completions");
            } catch(IllegalArgumentException e) { throw new IllegalArgumentException("Base URL 必须是 HTTP(S) 基础地址，不能附加 /chat/completions、凭据、查询参数或片段"); }
              catch(Exception e) { throw new IllegalArgumentException("Base URL 必须是有效的 HTTP(S) 基础地址，不能包含凭据、查询参数或片段"); }
            if(model.isBlank()||model.length()>200||model.chars().anyMatch(Character::isISOControl)) throw new IllegalArgumentException("模型名称不能为空，最多 200 个字符且不能含控制字符");
            if(key.length()>4096||key.chars().anyMatch(Character::isWhitespace)||key.chars().anyMatch(Character::isISOControl)) throw new IllegalArgumentException("API Key 格式不正确");
            if(edit.clearKey()&&!key.isEmpty()) throw new IllegalArgumentException("清除密钥时请留空 API Key");
            String savedKey=edit.clearKey()?"":key.isEmpty()?(previous==null?"":previous.apiKey()):key;
            Channel nextChannel=new Channel(id,name,url,model,savedKey,auth,custom);
            Map<String,Object> before=create?Map.of():summary(previous,config);
            AIConfig next=copyConfig();
            Map<String,Channel> nextCustom=new LinkedHashMap<>(customProviders);
            if(custom) nextCustom.put(id,nextChannel);
            else if("tongyi".equals(id)) { next.getTongyi().setApiKey(savedKey); next.getTongyi().setBaseUrl(url); next.getTongyi().setModel(model); }
            else { next.getOpenai().setApiKey(savedKey); next.getOpenai().setBaseUrl(url); next.getOpenai().setModel(model); }
            if(edit.selected()) next.setProvider(id);
            next.setRealInferenceEnabled(edit.inferenceEnabled()); next.setFallbackToRuleTemplate(edit.fallbackToRuleTemplate());
            commit(next,nextCustom,operator);
            Map<String,Object> after=summary(channel(id),config);
            return new Change(revision,before,after);
        }
    }
    /** 只切换路由，保持所有通道凭据和全局推理策略不变。 */
    public synchronized Change switchTo(String id, long expectedRevision, String operator) {
        enterOperation();
        try {
        checkRevision(expectedRevision);
        synchronized(config) {
            Channel target=channel(id), previous=selectedChannel();
            Map<String,Object> before=summary(previous,config);
            if(previous.id().equals(target.id())) return new Change(revision,before,before);
            if(target.baseUrl().isBlank() || target.model().isBlank() ||
                    (!"NONE".equals(target.authType()) && (target.apiKey().isBlank() || "your-api-key".equalsIgnoreCase(target.apiKey()))))
                throw new IllegalArgumentException("目标模型配置不完整，请先配置通道并验证连接");
            AIConfig next=copyConfig(); next.setProvider(id);
            commit(next,new LinkedHashMap<>(customProviders),operator);
            return new Change(revision,before,summary(channel(id),config));
        }

        } finally { operationDepth--; }
    }
    public synchronized Change delete(String id, long expectedRevision, String operator) {
        enterOperation();
        try {
        checkRevision(expectedRevision);
        synchronized(config) {
            Channel c=channel(id);
            if(failovers.entrySet().stream().anyMatch(e->!e.getKey().equals(id)&&e.getValue().providerIds().contains(id)))
                throw new ResponseStatusException(HttpStatus.CONFLICT,"该通道被故障切换策略引用，请先移除备用配置");
            if(!c.custom()) throw new IllegalArgumentException("内置通道不能删除");
            if(id.equals(config.getProvider())) throw new ResponseStatusException(HttpStatus.CONFLICT,"请先切换当前通道，再删除此模型");
            Map<String,Object> before=summary(c,config);
            var nextCustom=new LinkedHashMap<>(customProviders); nextCustom.remove(id);
            var previousPolicies=failovers; failovers=new LinkedHashMap<>(failovers); failovers.remove(id);
            var previousCircuits=circuits; circuits=new LinkedHashMap<>(circuits);circuits.remove(id);
            try { commit(copyConfig(),nextCustom,operator); } catch(RuntimeException e) { failovers=previousPolicies;circuits=previousCircuits; throw e; }
            return new Change(revision,before,Map.of());
        }

        } finally { operationDepth--; }
    }
    private AIConfig copyConfig() {
        AIConfig next=new AIConfig();
        next.getTongyi().setApiKey(config.getTongyi().getApiKey()); next.getTongyi().setBaseUrl(config.getTongyi().getBaseUrl()); next.getTongyi().setModel(config.getTongyi().getModel());
        next.getOpenai().setApiKey(config.getOpenai().getApiKey()); next.getOpenai().setBaseUrl(config.getOpenai().getBaseUrl()); next.getOpenai().setModel(config.getOpenai().getModel());
        next.setProvider(config.getProvider()); next.setRealInferenceEnabled(config.isRealInferenceEnabled()); next.setFallbackToRuleTemplate(config.isFallbackToRuleTemplate());
        next.setConnectTimeoutMs(config.getConnectTimeoutMs()); next.setRequestTimeoutMs(config.getRequestTimeoutMs()); return next;
    }
    private void checkRevision(long expected) {
        if(expected!=revision) throw new ResponseStatusException(HttpStatus.CONFLICT,"配置已更新，请关闭表单并刷新后重试");
    }
    private void commit(AIConfig next, Map<String,Channel> nextCustom, String operator) {
        String now=Instant.now().toString();
        try { persist(Map.of("config",next,"customProviders",new ArrayList<>(nextCustom.values()),"failovers",failovers,"circuits",circuits,"revision",revision+1,"updatedAt",now,"updatedBy",operator)); }
        catch(ResponseStatusException e) { throw e; }
            catch(Exception e) { throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"模型配置保存失败，原配置未变更，请检查数据库连接"); }
        apply(next); customProviders=nextCustom; revision++; updatedAt=now; updatedBy=operator;
    }
    private Map<String,Object> summary(Channel c, AIConfig value) {
        Map<String,Object> data=new LinkedHashMap<>();
        data.put("id",c.id()); data.put("name",c.name()); data.put("baseUrl",c.baseUrl()); data.put("model",c.model()); data.put("authType",c.authType());
        data.put("keyConfigured",!c.apiKey().isBlank()&&!"your-api-key".equalsIgnoreCase(c.apiKey()));
        data.put("selected",c.id().equalsIgnoreCase(value.getProvider())); data.put("inferenceEnabled",value.isRealInferenceEnabled());
        data.put("fallbackToRuleTemplate",value.isFallbackToRuleTemplate()); return data;
    }
    private void persist(Object data) throws Exception {
        var saved=store.save("providers",databaseRevision,json.writeValueAsString(data));
        databaseRevision=saved.revision();
    }
    private void apply(AIConfig next) {
        // 保留已注入旧版客户端的通道对象引用。
        config.getTongyi().setApiKey(next.getTongyi().getApiKey()); config.getTongyi().setBaseUrl(next.getTongyi().getBaseUrl()); config.getTongyi().setModel(next.getTongyi().getModel());
        config.getOpenai().setApiKey(next.getOpenai().getApiKey()); config.getOpenai().setBaseUrl(next.getOpenai().getBaseUrl()); config.getOpenai().setModel(next.getOpenai().getModel());
        config.setProvider(next.getProvider()); config.setRealInferenceEnabled(next.isRealInferenceEnabled()); config.setFallbackToRuleTemplate(next.isFallbackToRuleTemplate());
    }
    private String text(String value) { return value==null?"":value.trim(); }
}
