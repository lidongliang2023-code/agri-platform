package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;
import java.util.*;

/** 生产只经交易域接口引用公开行情，不直接读写交易库。 */
@Service
public class YieldMarketPriceClient {
 private final RestTemplate http;
 private final String base;
 public YieldMarketPriceClient(@Value("${services.trade.url:http://localhost:8089}") String base){
  this.base=base;var factory=new SimpleClientHttpRequestFactory();factory.setConnectTimeout(5000);factory.setReadTimeout(65000);this.http=new RestTemplate(factory);
 }
 public Object quotes(String crop){return call("",HttpMethod.GET,crop,null);}
 public Object sync(String source){return call("/sync",HttpMethod.POST,null,source);}
 public Object batches(){return call("/batches",HttpMethod.GET,null,null);}
 @SuppressWarnings("unchecked")
 public Map<String,Object> resolve(String id,String crop){
  if(id==null || !id.matches("[a-fA-F0-9-]{36}"))throw new BusinessException(400,"行情引用编号无效");
  Object data=call("/"+id,HttpMethod.GET,crop,null);
  if(!(data instanceof Map<?,?>))throw new BusinessException(502,"交易行情返回格式无效");
  Map<String,Object> quote=(Map<String,Object>)data;
  if(Boolean.TRUE.equals(quote.get("stale")) || !"元/kg".equals(quote.get("unit")) || !"OBSERVED_WHOLESALE_PRICE".equals(quote.get("kind"))) throw new BusinessException(400,"行情已失效或口径不支持");
  return quote;
 }
 private Object call(String path,HttpMethod method,String crop,String source){
  TenantContextService.currentTenantId();
  var builder=UriComponentsBuilder.fromHttpUrl(base+"/api/trade/price/official"+path);if(crop!=null)builder.queryParam("crop",crop);if(source!=null)builder.queryParam("source",source);
  var headers=new HttpHeaders();headers.set(HttpHeaders.AUTHORIZATION,TenantContextService.currentAuthorization());
  try{
   Map<?,?> response=http.exchange(builder.build().encode().toUri(),method,new HttpEntity<>(null,headers),Map.class).getBody();
   if(response==null || !Set.of("200","0").contains(String.valueOf(response.get("code"))))throw new BusinessException(502,response==null?"交易行情返回空响应":String.valueOf(response.get("message")));
   return response.get("data");
  }catch(BusinessException e){throw e;}catch(Exception e){throw new BusinessException(502,"真实行情服务暂不可用，请稍后重试；不会以模拟行情替代");}
 }
}
