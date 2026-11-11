package com.agri.ai.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

/** 数据库CAS配置：保留完整提示词版本，读取时同步跨实例变更。 */
@Service
public class AiSceneManagement {
    public record Version(int number, String systemPrompt, String userPrompt, String note,
                          String createdAt, String createdBy, String publishedAt) {}
    public record Event(String action, Integer version, String time, String operator,
                        String beforeProviderId, String afterProviderId) {
        public Event(String action, Integer version, String time, String operator) { this(action,version,time,operator,null,null); }
    }
    public record Config(String code, String name, String description, String exampleJson, boolean enabled,
                         long revision, Integer publishedVersion, List<Version> versions, List<Event> events, String providerId,
                         String bizSystem, String domain, boolean custom) {}
    public record ModelEdit(Long revision, String providerId) {}
    public record ModelTarget(String code, Long revision) {}
    public record BatchModelEdit(List<ModelTarget> scenes, String providerId) {}
    public record BatchModelResult(int requested, int changed, int unchanged, String providerId,
                                   List<Map<String,Object>> scenes) {}
    public record CreateScene(String code, String name, String bizSystem, String description, String exampleJson,
                              Boolean enabled, String providerId, String systemPrompt, String userPrompt, String note) {}
    public record SceneEdit(long revision, String name, String description, String exampleJson, boolean enabled) {}
    public record DraftEdit(long revision, String systemPrompt, String userPrompt, String note) {}
    public record VersionAction(long revision, int version) {}
    public record Preview(Integer version, Map<String,Object> input, String bizId) {}
    private static final Pattern VARIABLE = Pattern.compile("\\{\\{\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*}}");
    private final AiSceneCatalog catalog;
    private final ModelProviderSettings providers;
    private final ObjectMapper json;
    private final Path file;
    private final AiConfigurationStore store;
    private long databaseRevision;
    private Map<String,Config> configs = new LinkedHashMap<>();

    public AiSceneManagement(AiSceneCatalog catalog, ObjectMapper json, ModelProviderSettings providers, AiConfigurationStore store,
            @Value("${ai.admin.scene-file:ops/local/data/ai-scenes.json}") String file) {
        this.providers=providers; this.catalog=catalog; this.json=json; this.file=Path.of(file).toAbsolutePath();this.store=store;
        var document=store.initialize("scenes",()-> {
            try { return Files.exists(this.file)?Files.readString(this.file):"{}"; }
            catch(Exception e) { throw new IllegalStateException("旧场景配置导入失败",e); }
        });
        load(document);
    }
    private void load(AiConfigurationStore.Document document) {
        try { configs=json.readValue(document.body(),new TypeReference<LinkedHashMap<String,Config>>(){});databaseRevision=document.revision(); }
        catch(Exception e) { throw new IllegalStateException("数据库场景配置读取失败",e); }
    }
    private int operationDepth;
    private void enterOperation() {
        if(operationDepth==0) refresh();
        operationDepth++;
    }
    private void refresh() {
        var document=store.read("scenes");
        if(document.revision()!=databaseRevision) load(document);
    }
    private Config current(String code) {
        Config stored=configs.get(code);
        if(stored!=null && stored.custom()) return stored;
        var base=catalog.require(code);
        return configs.getOrDefault(code,new Config(code,base.name(),base.description(),base.exampleJson(),true,0,null,List.of(),List.of(),"",base.bizSystem(),base.domain(),false));
    }
    public synchronized List<Map<String,Object>> list() {
        enterOperation();
        try {
        var result=new ArrayList<Map<String,Object>>();
        for(var base:catalog.list()) result.add(summary(current(base.code())));
        configs.values().stream().filter(Config::custom).forEach(c->result.add(summary(c)));
        return List.copyOf(result);

        } finally { operationDepth--; }
    }
    public synchronized AiSceneCatalog.Scene metadata(String code) {
        enterOperation();
        try {
        var c=current(code);
        if(!c.custom()) return catalog.require(code);
        return new AiSceneCatalog.Scene(c.code(),c.name(),c.bizSystem(),c.domain(),c.description(),c.exampleJson());

        } finally { operationDepth--; }
    }
    public synchronized Config create(CreateScene edit,String operator) {
        enterOperation();
        try {
        if(edit==null) throw new IllegalArgumentException("请填写自定义场景配置");
        String code=text(edit.code(),100,"场景编码");
        if(!code.matches("[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+"))
            throw new IllegalArgumentException("场景编码须以小写字母开头，使用小写字母、数字及点、下划线或短横线分段");
        if(configs.containsKey(code)||catalog.list().stream().anyMatch(c->c.code().equals(code)))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"场景编码已存在，请更换编码");
        if(configs.values().stream().filter(Config::custom).count()>=100)
            throw new IllegalArgumentException("最多新增100个自定义场景");
        var system=catalog.list().stream().filter(c->c.bizSystem().equals(edit.bizSystem())).findFirst()
            .orElseThrow(()->new IllegalArgumentException("请选择有效的业务子系统"));
        String name=text(edit.name(),80,"场景名称"), description=text(edit.description(),500,"场景说明");
        var example=inputJson(edit.exampleJson());
        String systemPrompt=text(edit.systemPrompt(),8000,"系统提示词"), userPrompt=text(edit.userPrompt(),12000,"用户提示词");
        String note=text(edit.note(),300,"版本说明"); template(systemPrompt); template(userPrompt);
        String now=Instant.now().toString();
        var draft=new Version(1,systemPrompt,userPrompt,note,now,operator,null);
        render(draft,example,"DEMO-001",true);
        String id=Objects.toString(edit.providerId(),"").trim();
        // 与通道删除使用相同的锁顺序，避免新增场景产生悬空绑定。
        synchronized(providers) {
            if(!id.isEmpty()&&!RealModelClient.isConfigured(providers.channel(id)))
                throw new IllegalArgumentException("目标通道配置不完整，请先到模型接入完善配置并验证连接");
            return save(new Config(code,name,description,edit.exampleJson(),edit.enabled()==null||edit.enabled(),1,null,
                List.of(draft),List.of(new Event("CREATE_SCENE",1,now,operator)),id,system.bizSystem(),system.domain(),true));
        }

        } finally { operationDepth--; }
    }
    private Map<String,Object> summary(Config c) {
        var base=metadata(c.code()); Map<String,Object> m=new LinkedHashMap<>();
        m.put("code",c.code()); m.put("name",c.name()); m.put("description",c.description());
        m.put("exampleJson",c.exampleJson()); m.put("bizSystem",base.bizSystem()); m.put("domain",base.domain());
        m.put("enabled",c.enabled()); m.put("revision",c.revision()); m.put("publishedVersion",c.publishedVersion());
        m.put("providerId",Objects.toString(c.providerId(),"")); m.put("modelSource",c.providerId()==null||c.providerId().isBlank()?"GLOBAL":"SCENE");
        m.put("versionCount",c.versions().size()); m.put("custom",c.custom()); m.put("mode",c.custom()?"PROMPT_MODEL":"RULE_TEMPLATE"); return m;
    }
    public synchronized Config detail(String code) {
        enterOperation();
        try { return current(code);
        } finally { operationDepth--; }
    }
    private void revision(Config c,long revision) {
        if(c.revision()!=revision) throw new ResponseStatusException(HttpStatus.CONFLICT,"配置已被更新，请刷新后重试");
    }
    private String text(String value,int max,String label) {
        if(value==null || value.isBlank() || value.length()>max) throw new IllegalArgumentException(label+"不能为空且最多"+max+"个字符");
        return value.trim();
    }
    private Map<String,Object> inputJson(String value) {
        if(value==null || value.length()>16000) throw new IllegalArgumentException("示例必须是16KB以内的JSON对象");
        try { var node=json.readTree(value); if(!node.isObject() || node.size()>50) throw new IllegalArgumentException();
            return json.convertValue(node,new TypeReference<Map<String,Object>>(){});
        } catch(Exception e) { throw new IllegalArgumentException("示例必须是JSON对象，且最多50个字段"); }
    }
    private Config changed(Config c,String name,String description,String example,boolean enabled,Integer published,
                           List<Version> versions,String action,Integer number,String operator) {
        var events=new ArrayList<>(c.events()); events.add(new Event(action,number,Instant.now().toString(),operator));
        if(events.size()>100) events.remove(0);
        return new Config(c.code(),name,description,example,enabled,c.revision()+1,published,List.copyOf(versions),List.copyOf(events),c.providerId(),c.bizSystem(),c.domain(),c.custom());
    }
    private Config save(Config next) {
        var data=new LinkedHashMap<>(configs); data.put(next.code(),next);
        saveAll(data); return next;
    }
    private void saveAll(Map<String,Config> data) {
        try {
            String body=json.writeValueAsString(data);
            var saved=store.save("scenes",databaseRevision,body);
            configs=data;databaseRevision=saved.revision();
        } catch(ResponseStatusException e) { throw e; }
        catch(Exception e) { throw new IllegalStateException("场景数据库写入失败，变更未生效",e); }
    }
    public synchronized Config edit(String code,SceneEdit edit,String operator) {
        enterOperation();
        try {
        var c=current(code); revision(c,edit.revision());
        String name=text(edit.name(),80,"场景名称"), description=text(edit.description(),500,"场景说明");
        inputJson(edit.exampleJson());
        if(c.publishedVersion()!=null) {
            var v=version(c,c.publishedVersion()); render(v,inputJson(edit.exampleJson()),"DEMO-001",true);
        }
        return save(changed(c,name,description,edit.exampleJson(),edit.enabled(),c.publishedVersion(),c.versions(),"EDIT_SCENE",null,operator));

        } finally { operationDepth--; }
    }
    /** 与删除通道共用场景锁，避免绑定与删除并发留下悬空引用。 */
    public synchronized Config bindModel(String code, ModelEdit edit, String operator) {
        enterOperation();
        try {
        if(edit==null || edit.revision()==null || edit.revision()<0 || edit.providerId()==null)
            throw new IllegalArgumentException("请提供配置修订号和模型通道，跟随全局请使用空通道标识");
        var c=current(code); revision(c,edit.revision());
        String id=edit.providerId().trim();
        if(!id.isEmpty()) {
            var channel=providers.channel(id);
            if(!RealModelClient.isConfigured(channel)) throw new IllegalArgumentException("目标通道配置不完整，请先到模型接入完善配置并验证连接");
        }
        String before=Objects.toString(c.providerId(),"");
        if(before.equals(id)) return c;
        var events=new ArrayList<>(c.events());
        events.add(new Event("BIND_MODEL",null,Instant.now().toString(),operator,before,id));
        if(events.size()>100) events.remove(0);
        return save(new Config(c.code(),c.name(),c.description(),c.exampleJson(),c.enabled(),c.revision()+1,
                c.publishedVersion(),c.versions(),List.copyOf(events),id,c.bizSystem(),c.domain(),c.custom()));

        } finally { operationDepth--; }
    }
    /** 全量校验后一次原子写入，与单场景编辑和通道删除共用锁。 */
    public synchronized BatchModelResult bindModels(BatchModelEdit edit, String operator) {
        enterOperation();
        try {
        if(edit==null || edit.scenes()==null || edit.scenes().isEmpty() || edit.scenes().size()>100 || edit.providerId()==null)
            throw new IllegalArgumentException("请选择1至100个场景并提供目标模型通道，跟随全局请使用空通道标识");
        String id=edit.providerId().trim();
        synchronized(providers) {
            if(!id.isEmpty() && !RealModelClient.isConfigured(providers.channel(id)))
                throw new IllegalArgumentException("目标通道配置不完整，请先到模型接入完善配置并验证连接");
            var selected=new ArrayList<Config>(); var codes=new HashSet<String>();
            for(var target:edit.scenes()) {
                if(target==null || target.code()==null || target.code().isBlank() || target.revision()==null || target.revision()<0)
                    throw new IllegalArgumentException("请提供每个场景的有效编码和修订号");
                if(!codes.add(target.code())) throw new IllegalArgumentException("场景不能重复选择");
                var c=current(target.code());
                if(c.revision()!=target.revision()) throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "场景“"+c.name()+"”已被更新，整批未保存，请刷新配置后重试");
                selected.add(c);
            }
            String now=Instant.now().toString(); int changed=0;
            var data=new LinkedHashMap<>(configs); var result=new ArrayList<Map<String,Object>>();
            for(var c:selected) {
                String before=Objects.toString(c.providerId(),""); var next=c;
                if(!before.equals(id)) {
                    var events=new ArrayList<>(c.events());
                    events.add(new Event("BATCH_BIND_MODEL",null,now,operator,before,id));
                    if(events.size()>100) events.remove(0);
                    next=new Config(c.code(),c.name(),c.description(),c.exampleJson(),c.enabled(),c.revision()+1,
                            c.publishedVersion(),c.versions(),List.copyOf(events),id,c.bizSystem(),c.domain(),c.custom());
                    data.put(next.code(),next); changed++;
                }
                result.add(summary(next));
            }
            if(changed>0) saveAll(data);
            return new BatchModelResult(selected.size(),changed,selected.size()-changed,id,List.copyOf(result));
        }

        } finally { operationDepth--; }
    }
    public synchronized List<String> modelReferences(String id) {
        enterOperation();
        try {
        return configs.values().stream().filter(c->id.equals(c.providerId())).map(Config::name).toList();

        } finally { operationDepth--; }
    }
    public ModelProviderSettings.Channel resolveChannel(Config scene) {
        return scene.providerId()==null||scene.providerId().isBlank()?providers.selectedChannel():providers.channel(scene.providerId());
    }
    private void template(String value) {
        String rest=VARIABLE.matcher(value).replaceAll("");
        if(rest.contains("{{") || rest.contains("}}")) throw new IllegalArgumentException("变量格式应为 {{字段名}}，只支持顶层英文标识；完整对象使用 {{input}}");
    }
    public synchronized Config draft(String code,DraftEdit edit,String operator) {
        enterOperation();
        try {
        var c=current(code); revision(c,edit.revision());
        if(c.versions().size()>=200) throw new IllegalArgumentException("单场景最多保留200个版本");
        String system=text(edit.systemPrompt(),8000,"系统提示词"), user=text(edit.userPrompt(),12000,"用户提示词");
        String note=text(edit.note(),300,"版本说明"); template(system); template(user);
        var versions=new ArrayList<>(c.versions()); int number=versions.size()+1;
        versions.add(new Version(number,system,user,note,Instant.now().toString(),operator,null));
        return save(changed(c,c.name(),c.description(),c.exampleJson(),c.enabled(),c.publishedVersion(),versions,"CREATE_DRAFT",number,operator));

        } finally { operationDepth--; }
    }
    private Version version(Config c,int number) { return c.versions().stream().filter(v->v.number()==number).findFirst()
        .orElseThrow(()->new IllegalArgumentException("提示词版本不存在")); }
    public synchronized Config activate(String code,VersionAction edit,String operator,boolean rollback) {
        enterOperation();
        try {
        var c=current(code); revision(c,edit.revision()); var selected=version(c,edit.version());
        if(Objects.equals(c.publishedVersion(),selected.number())) throw new IllegalArgumentException("该版本已是当前发布版本");
        if(rollback && selected.publishedAt()==null) throw new IllegalArgumentException("只能回滚到曾发布的版本");
        if(!rollback && selected.publishedAt()!=null) throw new IllegalArgumentException("历史发布版本请使用回滚操作");
        render(selected,inputJson(c.exampleJson()),"DEMO-001",true);
        var versions=c.versions().stream().map(v->v.number()==selected.number() && v.publishedAt()==null
            ? new Version(v.number(),v.systemPrompt(),v.userPrompt(),v.note(),v.createdAt(),v.createdBy(),Instant.now().toString()) : v).toList();
        return save(changed(c,c.name(),c.description(),c.exampleJson(),c.enabled(),selected.number(),versions,rollback?"ROLLBACK":"PUBLISH",selected.number(),operator));

        } finally { operationDepth--; }
    }
    private String replace(String text,Map<String,Object> values,Set<String> missing) {
        var matcher=VARIABLE.matcher(text); var out=new StringBuffer();
        while(matcher.find()) {
            String key=matcher.group(1); Object value=values.get(key);
            if(value==null) missing.add(key);
            String encoded=value instanceof String s?s:encode(value);
            matcher.appendReplacement(out,java.util.regex.Matcher.quoteReplacement(value==null?matcher.group():encoded));
        }
        matcher.appendTail(out); return out.toString();
    }
    private String encode(Object value) { try{return json.writeValueAsString(value);}catch(Exception e){throw new IllegalArgumentException("参数不可序列化");} }
    private Map<String,Object> render(Version v,Map<String,Object> input,String bizId,boolean strict) {
        if(input==null || input.size()>50 || encode(input).length()>16000) throw new IllegalArgumentException("请输入16KB以内、最多50个字段的JSON对象");
        var values=new LinkedHashMap<>(input); values.put("input",encode(input)); values.put("bizId",Objects.toString(bizId,""));
        Set<String> missing=new LinkedHashSet<>(); String system=replace(v.systemPrompt(),values,missing), user=replace(v.userPrompt(),values,missing);
        if(strict && !missing.isEmpty()) throw new IllegalArgumentException("参数示例缺少提示词变量："+String.join("、",missing));
        Map<String,Object> result=new LinkedHashMap<>(); result.put("version",v.number());result.put("systemPrompt",system);result.put("userPrompt",user);
        result.put("missingVariables",missing);result.put("mode","PREVIEW_ONLY");result.put("modelInvoked",false);return result;
    }
    public synchronized Map<String,Object> preview(String code,Preview request) {
        enterOperation();
        try {
        var c=current(code); Integer number=request.version()==null?c.publishedVersion():request.version();
        if(number==null) throw new IllegalArgumentException("请先选择草稿或发布一个提示词版本");
        return render(version(c,number),request.input(),request.bizId(),false);

        } finally { operationDepth--; }
    }
    /** 为真实模型调度渲染已发布版本；没有发布版本时拒绝进入真实推理。 */
    public synchronized Map<String,Object> promptsForDispatch(String code,Map<String,Object> input,String bizId) {
        enterOperation();
        try {
        var c=current(code);
        if(c.publishedVersion()==null) throw new IllegalArgumentException("该场景尚未发布提示词版本");
        return render(version(c,c.publishedVersion()),input,bizId,true);

        } finally { operationDepth--; }
    }
    public synchronized Config forDispatch(String code,String bizSystem) {
        providers.ids(); // 同步数据库中的全局推理开关，再由调度器读取AIConfig。
        enterOperation();
        try {
        var c=current(code); if(!c.enabled()) throw new IllegalArgumentException("该业务场景已停用");
        if(!Objects.equals(metadata(code).bizSystem(),bizSystem)) throw new IllegalArgumentException("场景与业务子系统不匹配");
        return c;

        } finally { operationDepth--; }
    }
}
