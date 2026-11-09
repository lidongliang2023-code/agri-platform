package com.agri.info.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.net.URI;
import java.time.*;

/** 云工厂公开资料与远程验厂编排；生产台账、设备凭证和溯源事实由原业务域管理。 */
@Service
public class CloudFactoryService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    public CloudFactoryService(JdbcTemplate jdbc,ObjectMapper json){this.jdbc=jdbc;this.json=json;}
    private static final String FIELDS="id,name,enterprise,region,category,description,base_ref AS baseRef,product_keyword AS productKeyword,trace_code AS traceCode,status,updated_at AS updatedAt";
    private static final String MEDIA="id,title,kind,url,captured_at AS capturedAt,description";
    static String text(Map<String,Object> b,String key,int max,boolean required){
        String v=Objects.toString(b.get(key),"").trim();
        if(v.length()>max || (required&&v.isEmpty()))throw new IllegalArgumentException(key+" 必填或超过长度限制");return v;
    }
    public static String mediaUrl(String value){
        if(value.isEmpty())return value;
        if(value.startsWith("/uploads/")&&!value.contains("..")&&!value.contains("\\")&&!value.contains("%")&&!value.contains("?")&&!value.contains("#"))return value;
        try{URI u=URI.create(value);if("https".equals(u.getScheme())&&u.getHost()!=null&&u.getUserInfo()==null&&u.getQuery()==null&&u.getFragment()==null)return value;}catch(Exception ignored){}
        throw new IllegalArgumentException("素材须为平台上传资源或不含密钥、参数的 HTTPS 地址");
    }
    public List<Map<String,Object>> list(boolean ops,String keyword,String category){
        String k=keyword==null?"":keyword.trim(), c=category==null?"":category.trim();
        if(k.length()>80||c.length()>60)throw new IllegalArgumentException("筛选条件过长");
        return jdbc.queryForList("SELECT "+FIELDS+" FROM info_cloud_factory WHERE "+(ops?"1=1":"status='published'")+" AND (name LIKE ? OR enterprise LIKE ? OR region LIKE ? OR product_keyword LIKE ?) AND (?='' OR category=?) ORDER BY id DESC LIMIT 200","%"+k+"%","%"+k+"%","%"+k+"%","%"+k+"%",c,c);
    }
    public Map<String,Object> detail(long id,boolean ops){
        var rows=jdbc.queryForList("SELECT "+FIELDS+" FROM info_cloud_factory WHERE id=?"+(ops?"":" AND status='published'"),id);
        if(rows.isEmpty())throw new IllegalArgumentException("基地不存在或未发布");
        var result=rows.get(0);result.put("media",jdbc.queryForList("SELECT "+MEDIA+" FROM info_cloud_factory_media WHERE factory_id=? ORDER BY sort_no,id",id));return result;
    }
    private void audit(String actor,String action,String target,String detail){jdbc.update("INSERT INTO info_audit_log(operator_name,action_name,target_name,detail) VALUES(?,?,?,?)",actor,action,target,detail);}
    @Transactional
    public Map<String,Object> save(Long id,Map<String,Object>b,String actor){
        String name=text(b,"name",120,true),enterprise=text(b,"enterprise",120,true),region=text(b,"region",120,true),category=text(b,"category",60,true),description=text(b,"description",2000,true);
        String base=text(b,"baseRef",100,false),product=text(b,"productKeyword",80,false),trace=text(b,"traceCode",100,false);
        Object raw=b.get("media");if(!(raw instanceof List<?> media)||media.size()>20)throw new IllegalArgumentException("素材须为数组且不超过20项");
        if(id==null){
            org.springframework.jdbc.support.GeneratedKeyHolder keys=new org.springframework.jdbc.support.GeneratedKeyHolder();
            jdbc.update(conn->{var p=conn.prepareStatement("INSERT INTO info_cloud_factory(name,enterprise,region,category,description,base_ref,product_keyword,trace_code,status) VALUES(?,?,?,?,?,?,?,?,'draft')",new String[]{"id"});Object[] args={name,enterprise,region,category,description,base,product,trace};for(int i=0;i<args.length;i++)p.setObject(i+1,args[i]);return p;},keys);
            id=Objects.requireNonNull(keys.getKey()).longValue();
        }else{detail(id,true);jdbc.update("UPDATE info_cloud_factory SET name=?,enterprise=?,region=?,category=?,description=?,base_ref=?,product_keyword=?,trace_code=?,status='draft',updated_at=CURRENT_TIMESTAMP WHERE id=?",name,enterprise,region,category,description,base,product,trace,id);}
        jdbc.update("DELETE FROM info_cloud_factory_media WHERE factory_id=?",id);
        int order=0;
        for(Object item:media){if(!(item instanceof Map<?,?> m))throw new IllegalArgumentException("素材格式无效");Map<String,Object> v=new HashMap<>();m.forEach((k,val)->v.put(k.toString(),val));
            String kind=text(v,"kind",20,true);if(!Set.of("panorama","video","live","image").contains(kind))throw new IllegalArgumentException("素材类型无效");
            String captured=text(v,"capturedAt",40,true);try{LocalDateTime t=LocalDateTime.parse(captured.replace(' ','T'));if(t.isAfter(LocalDateTime.now(ZoneId.of("Asia/Shanghai")).plusMinutes(5)))throw new Exception();}catch(Exception ex){throw new IllegalArgumentException("素材拍摄/直播配置时间无效");}
            jdbc.update("INSERT INTO info_cloud_factory_media(factory_id,title,kind,url,captured_at,description,sort_no) VALUES(?,?,?,?,?,?,?)",id,text(v,"title",120,true),kind,mediaUrl(text(v,"url",1500,true)),captured,text(v,"description",300,false),order++);
        }
        audit(actor,"保存云工厂资料","基地#"+id,"保存后回到草稿，需重新审核发布");return detail(id,true);
    }
    @Transactional
    public void publish(long id,String status,String actor){
        var d=detail(id,true);if(!Set.of("published","offline").contains(status))throw new IllegalArgumentException("发布状态无效");
        if("published".equals(status)&&((List<?>)d.get("media")).isEmpty())throw new IllegalArgumentException("至少配置一项已授权实景素材再发布");
        jdbc.update("UPDATE info_cloud_factory SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",status,id);audit(actor,"审核云工厂发布","基地#"+id,status);
    }
    @Transactional
    public Map<String,Object> book(long id,String owner,Map<String,Object>b){
        // 锁基地行，保证同一用户对该基地只有一个进行中的预约。
        if(jdbc.queryForList("SELECT id FROM info_cloud_factory WHERE id=? AND status='published' FOR UPDATE",id).isEmpty())throw new IllegalArgumentException("基地已下线或不存在");
        String contact=text(b,"contact",60,true),phone=text(b,"phone",30,true),purpose=text(b,"purpose",600,true),slot=text(b,"requestedAt",40,true);
        if(!phone.matches("[+0-9 ()-]{6,30}"))throw new IllegalArgumentException("联系电话格式无效");
        try{var t=LocalDateTime.parse(slot.replace(' ','T'));var now=LocalDateTime.now(ZoneId.of("Asia/Shanghai"));if(!t.isAfter(now)||t.isAfter(now.plusDays(90)))throw new Exception();}catch(Exception e){throw new IllegalArgumentException("预约时间须为未来90天内的北京时间");}
        if(jdbc.queryForObject("SELECT COUNT(*) FROM info_cloud_factory_visit WHERE factory_id=? AND owner_id=? AND status IN ('pending','confirmed')",Integer.class,id,owner)>0)throw new IllegalArgumentException("该基地已有待处理预约，请先查看或取消");
        jdbc.update("INSERT INTO info_cloud_factory_visit(factory_id,owner_id,contact,phone,purpose,requested_at,status) VALUES(?,?,?,?,?,?,'pending')",id,owner,contact,phone,purpose,slot);
        audit(owner,"提交远程验厂预约","基地#"+id,"待运营确认");return Map.of("message","预约已提交，请在我的预约中查看处理结果");
    }
    public List<Map<String,Object>> visits(String owner){return jdbc.queryForList("SELECT v.id,v.factory_id AS factoryId,f.name AS factoryName,v.contact,v.phone,v.purpose,v.requested_at AS requestedAt,v.status,v.note,v.updated_at AS updatedAt FROM info_cloud_factory_visit v JOIN info_cloud_factory f ON f.id=v.factory_id"+(owner==null?"":" WHERE v.owner_id=?")+" ORDER BY v.id DESC LIMIT 200",owner==null?new Object[]{}:new Object[]{owner});}
    @Transactional
    public void transition(long id,String status,String note,String owner,String actor){
        var rows=jdbc.queryForList("SELECT status FROM info_cloud_factory_visit WHERE id=?"+(owner==null?"":" AND owner_id=?")+" FOR UPDATE",owner==null?new Object[]{id}:new Object[]{id,owner});
        if(rows.isEmpty())throw new IllegalArgumentException("预约不存在");String from=rows.get(0).get("status").toString();
        boolean allowed=owner!=null?Set.of("pending","confirmed").contains(from)&&"cancelled".equals(status):("pending".equals(from)&&Set.of("confirmed","rejected").contains(status))||("confirmed".equals(from)&&Set.of("completed","cancelled").contains(status));
        if(!allowed)throw new IllegalArgumentException("当前状态不能执行此操作");
        if(note==null||note.isBlank()||note.length()>1000)throw new IllegalArgumentException("请填写处理说明，最多1000字");
        jdbc.update("UPDATE info_cloud_factory_visit SET status=?,note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",status,note,id);audit(actor,"处理远程验厂预约","预约#"+id,from+" → "+status+"；"+note.substring(0,Math.min(note.length(),180)));
    }
}
