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

/** 单实例控制台配置：先原子落盘再更新内存；历史版本不可覆盖。 */
@Service
public class AiSceneManagement {
    public record Version(int number, String systemPrompt, String userPrompt, String note,
                          String createdAt, String createdBy, String publishedAt) {}
    public record Event(String action, Integer version, String time, String operator) {}
    public record Config(String code, String name, String description, String exampleJson, boolean enabled,
                         long revision, Integer publishedVersion, List<Version> versions, List<Event> events) {}
    public record SceneEdit(long revision, String name, String description, String exampleJson, boolean enabled) {}
    public record DraftEdit(long revision, String systemPrompt, String userPrompt, String note) {}
    public record VersionAction(long revision, int version) {}
    public record Preview(Integer version, Map<String,Object> input, String bizId) {}
    private static final Pattern VARIABLE = Pattern.compile("\\{\\{\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*}}");
    private final AiSceneCatalog catalog;
    private final ObjectMapper json;
    private final Path file;
    private Map<String,Config> configs = new LinkedHashMap<>();

    public AiSceneManagement(AiSceneCatalog catalog, ObjectMapper json,
            @Value("${ai.admin.scene-file:ops/local/data/ai-scenes.json}") String file) {
        this.catalog=catalog; this.json=json; this.file=Path.of(file).toAbsolutePath();
        if(Files.exists(this.file)) {
            try { configs=json.readValue(Files.readString(this.file), new TypeReference<LinkedHashMap<String,Config>>(){}); }
            catch(Exception e) { throw new IllegalStateException("场景配置读取失败，请检查持久化文件",e); }
        }
    }
    private Config current(String code) {
        var base=catalog.require(code);
        return configs.getOrDefault(code,new Config(code,base.name(),base.description(),base.exampleJson(),true,0,null,List.of(),List.of()));
    }
    public synchronized List<Map<String,Object>> list() { return catalog.list().stream().map(s->summary(current(s.code()))).toList(); }
    private Map<String,Object> summary(Config c) {
        var base=catalog.require(c.code()); Map<String,Object> m=new LinkedHashMap<>();
        m.put("code",c.code()); m.put("name",c.name()); m.put("description",c.description());
        m.put("exampleJson",c.exampleJson()); m.put("bizSystem",base.bizSystem()); m.put("domain",base.domain());
        m.put("enabled",c.enabled()); m.put("revision",c.revision()); m.put("publishedVersion",c.publishedVersion());
        m.put("versionCount",c.versions().size()); m.put("mode","RULE_TEMPLATE"); return m;
    }
    public synchronized Config detail(String code) { return current(code); }
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
        return new Config(c.code(),name,description,example,enabled,c.revision()+1,published,List.copyOf(versions),List.copyOf(events));
    }
    private Config save(Config next) {
        var data=new LinkedHashMap<>(configs); data.put(next.code(),next);
        Path tmp=file.resolveSibling(file.getFileName()+".tmp");
        try {
            Files.createDirectories(file.getParent());
            Files.writeString(tmp,json.writerWithDefaultPrettyPrinter().writeValueAsString(data));
            try { Files.move(tmp,file,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING); }
            catch(AtomicMoveNotSupportedException e) { Files.move(tmp,file,StandardCopyOption.REPLACE_EXISTING); }
            configs=data; return next;
        } catch(Exception e) { throw new IllegalStateException("场景配置写入失败，变更未生效",e); }
    }
    public synchronized Config edit(String code,SceneEdit edit,String operator) {
        var c=current(code); revision(c,edit.revision());
        String name=text(edit.name(),80,"场景名称"), description=text(edit.description(),500,"场景说明");
        inputJson(edit.exampleJson());
        if(c.publishedVersion()!=null) {
            var v=version(c,c.publishedVersion()); render(v,inputJson(edit.exampleJson()),"DEMO-001",true);
        }
        return save(changed(c,name,description,edit.exampleJson(),edit.enabled(),c.publishedVersion(),c.versions(),"EDIT_SCENE",null,operator));
    }
    private void template(String value) {
        String rest=VARIABLE.matcher(value).replaceAll("");
        if(rest.contains("{{") || rest.contains("}}")) throw new IllegalArgumentException("变量格式应为 {{字段名}}，只支持顶层英文标识；完整对象使用 {{input}}");
    }
    public synchronized Config draft(String code,DraftEdit edit,String operator) {
        var c=current(code); revision(c,edit.revision());
        if(c.versions().size()>=200) throw new IllegalArgumentException("单场景最多保留200个版本");
        String system=text(edit.systemPrompt(),8000,"系统提示词"), user=text(edit.userPrompt(),12000,"用户提示词");
        String note=text(edit.note(),300,"版本说明"); template(system); template(user);
        var versions=new ArrayList<>(c.versions()); int number=versions.size()+1;
        versions.add(new Version(number,system,user,note,Instant.now().toString(),operator,null));
        return save(changed(c,c.name(),c.description(),c.exampleJson(),c.enabled(),c.publishedVersion(),versions,"CREATE_DRAFT",number,operator));
    }
    private Version version(Config c,int number) { return c.versions().stream().filter(v->v.number()==number).findFirst()
        .orElseThrow(()->new IllegalArgumentException("提示词版本不存在")); }
    public synchronized Config activate(String code,VersionAction edit,String operator,boolean rollback) {
        var c=current(code); revision(c,edit.revision()); var selected=version(c,edit.version());
        if(Objects.equals(c.publishedVersion(),selected.number())) throw new IllegalArgumentException("该版本已是当前发布版本");
        if(rollback && selected.publishedAt()==null) throw new IllegalArgumentException("只能回滚到曾发布的版本");
        if(!rollback && selected.publishedAt()!=null) throw new IllegalArgumentException("历史发布版本请使用回滚操作");
        render(selected,inputJson(c.exampleJson()),"DEMO-001",true);
        var versions=c.versions().stream().map(v->v.number()==selected.number() && v.publishedAt()==null
            ? new Version(v.number(),v.systemPrompt(),v.userPrompt(),v.note(),v.createdAt(),v.createdBy(),Instant.now().toString()) : v).toList();
        return save(changed(c,c.name(),c.description(),c.exampleJson(),c.enabled(),selected.number(),versions,rollback?"ROLLBACK":"PUBLISH",selected.number(),operator));
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
        var c=current(code); Integer number=request.version()==null?c.publishedVersion():request.version();
        if(number==null) throw new IllegalArgumentException("请先选择草稿或发布一个提示词版本");
        return render(version(c,number),request.input(),request.bizId(),false);
    }
    /** 为真实模型调度渲染已发布版本；没有发布版本时拒绝进入真实推理。 */
    public synchronized Map<String,Object> promptsForDispatch(String code,Map<String,Object> input,String bizId) {
        var c=current(code);
        if(c.publishedVersion()==null) throw new IllegalArgumentException("该场景尚未发布提示词版本");
        return render(version(c,c.publishedVersion()),input,bizId,true);
    }
    public synchronized Config forDispatch(String code,String bizSystem) {
        var c=current(code); if(!c.enabled()) throw new IllegalArgumentException("该业务场景已停用");
        if(!Objects.equals(catalog.require(code).bizSystem(),bizSystem)) throw new IllegalArgumentException("场景与业务子系统不匹配");
        return c;
    }
}
