import { apiBase } from '@/utils/runtime'
import { TOKEN_KEY,SUBJECT_KEY,productionContextVersion,productionAdmission } from '@/utils/request'
export async function uploadVoice(farmId:string,transcript:string,audio?:string):Promise<any>{
 const token=String(uni.getStorageSync(TOKEN_KEY)||''),subject=String(uni.getStorageSync(SUBJECT_KEY)||''),version=productionContextVersion()
 const admission=await productionAdmission(subject);if(!admission.granted)throw new Error(admission.reason||'当前主体没有写入权限')
 const valid=()=>token===String(uni.getStorageSync(TOKEN_KEY)||'')&&version===productionContextVersion()
 if(!valid())throw new Error('业务范围已变更，请重新录入')
 const data={farmId,transcript,requestId:'mobile-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)}
 const header:Record<string,string>={Authorization:'Bearer '+token};if(subject)header['X-Merchant-Id']=subject
 const result=await new Promise<any>((resolve,reject)=>{
 // #ifdef H5
 if(!audio){const body=new FormData();Object.entries(data).forEach(([k,v])=>body.append(k,v));const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),65000);fetch(apiBase()+'/api/v1/production/voice-records',{method:'POST',body,headers:header,signal:abort.signal}).then(async response=>{const res=await response.json();if(!response.ok||res.code!==0)throw new Error(res.message||'保存失败');resolve(res.data)}).catch(reject).finally(()=>clearTimeout(timeout));return}
 // #endif
 if(!audio){const boundary='agri'+Date.now();const body=Object.entries(data).map(([k,v])=>'--'+boundary+'\r\nContent-Disposition: form-data; name="'+k+'"\r\n\r\n'+v+'\r\n').join('')+'--'+boundary+'--\r\n';uni.request({url:apiBase()+'/api/v1/production/voice-records',method:'POST',header:{...header,'Content-Type':'multipart/form-data; boundary='+boundary},data:body,timeout:65000,success:r=>{const res=r.data as any;if(r.statusCode>=400||res.code!==0)reject(new Error(res.message||'保存失败'));else resolve(res.data)},fail:reject});return}
 uni.uploadFile({url:apiBase()+'/api/v1/production/voice-records',filePath:audio,name:'audio',header,formData:data,timeout:65000,success:r=>{try{const res=JSON.parse(r.data);if(r.statusCode>=400||res.code!==0)throw new Error(res.message||'上传失败');resolve(res.data)}catch(e){reject(e)}},fail:reject})
 })
 if(!valid())throw new Error('业务范围已变更，请返回原主体查看保存结果')
 return result
}
