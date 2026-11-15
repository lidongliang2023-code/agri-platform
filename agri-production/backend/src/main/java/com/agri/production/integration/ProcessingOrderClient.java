package com.agri.production.integration;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.service.TenantContextService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import java.util.*;

@Component
public class ProcessingOrderClient {
    private final RestTemplate http; private final String base;
    public ProcessingOrderClient(@Value("${services.trade.url:http://localhost:8089}") String base) {
        this.base=base;var factory=new SimpleClientHttpRequestFactory();factory.setConnectTimeout(3000);factory.setReadTimeout(8000);http=new RestTemplate(factory);
    }
    @SuppressWarnings("unchecked") private Object get(String tenant,String path) {
        String auth=TenantContextService.currentAuthorization();
        if(auth==null||!tenant.matches("[0-9]+"))throw new BusinessException(401,"请登录并选择有效经营主体");
        var headers=new HttpHeaders();headers.set(HttpHeaders.AUTHORIZATION,auth);
        try {Map<String,Object> body=http.exchange(base+"/api/trade/processing-orders"+path+"?merchantId="+tenant,HttpMethod.GET,new HttpEntity<>(headers),Map.class).getBody();
            if(body==null || !List.of("0","200").contains(String.valueOf(body.get("code"))))throw new BusinessException(403,"订单服务拒绝当前主体访问");
            return body.get("data");
        }catch(BusinessException e){throw e;}catch(Exception e){throw new BusinessException(503,"交易订单暂不可读取，请稍后重试，未使用缓存订单放行");}
    }
    @SuppressWarnings("unchecked") public List<Map<String,Object>> list(String tenant){return (List<Map<String,Object>>)get(tenant,"");}
    @SuppressWarnings("unchecked") public Map<String,Object> detail(String tenant,String id){if(!id.matches("[0-9]+"))throw new BusinessException(400,"订单编号无效");return (Map<String,Object>)get(tenant,"/"+id);}
}
