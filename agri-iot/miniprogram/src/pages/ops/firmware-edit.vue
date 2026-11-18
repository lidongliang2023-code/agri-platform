<script setup lang="ts">
import {computed,ref} from 'vue'
import {onLoad} from '@dcloudio/uni-app'
import {identitySessionReady,canOperate,currentWorkspace,uploadIotFirmware,type Row} from '../../api/iot'
import {opsApi} from '../../api/ops'
import BusinessForm,{type Field} from '../../components/BusinessForm.vue'
import {showError} from '../../utils/ui'
const form=ref<Row>({firmwareName:'',versionName:'',firmwareType:'gateway',targetModel:'ALL',packageUrl:'',fileSizeBytes:'',sha256Text:'',releaseNotes:'',changelogText:''})
const busy=ref(false),uploaded=ref(false),progress=ref(0),expected=ref(''),ready=ref(false),error=ref('')
onLoad(async()=>{try{await identitySessionReady();if(!canOperate()||currentWorkspace()!=='ops')throw new Error('请先进入获授权的运营工作台');ready.value=true}catch(e){error.value=e instanceof Error?e.message:'权限校验失败'}})
const fields=computed<Field[]>(()=>[
 {key:'firmwareName',label:'固件名称',required:true},{key:'versionName',label:'版本号',required:true,hint:'如 v1.2.0'},
 {key:'firmwareType',label:'固件类型',type:'select',options:[{value:'gateway',label:'网关'},{value:'sensor',label:'传感器'},{value:'controller',label:'控制器'}]},
 {key:'targetModel',label:'适用型号',required:true,hint:'填写实际型号，ALL 表示全型号'},
 {key:'packageUrl',label:'HTTPS 下载地址',required:true,disabled:uploaded.value},
 {key:'fileSizeBytes',label:'文件大小（字节）',type:'number',required:true,disabled:uploaded.value},
 {key:'sha256Text',label:'SHA-256 摘要',required:true,disabled:uploaded.value},
 {key:'releaseNotes',label:'发布说明（最多500字）',type:'textarea'},{key:'changelogText',label:'变更记录（最多1000字）',type:'textarea'}])
function chooseFile():Promise<{path:string;name:string;size:number}>{return new Promise((resolve,reject)=>{
 // #ifdef MP-WEIXIN
 uni.chooseMessageFile({count:1,type:'file',extension:['bin','img','zip','fw','hex','tar','gz'],success:r=>resolve(r.tempFiles[0]),fail:e=>reject(new Error(e.errMsg?.includes('cancel')?'已取消选择':'无法选择固件文件'))})
 // #endif
 // #ifndef MP-WEIXIN
 reject(new Error('当前端请填写已托管固件的 HTTPS 地址、摘要和大小'))
 // #endif
})}
async function upload(){if(busy.value||!ready.value)return;busy.value=true;progress.value=0;try{
 const hash=expected.value.trim();if(hash&&!/^[a-fA-F0-9]{64}$/.test(hash))throw new Error('预期摘要须为64位十六进制字符')
 const file=await chooseFile();if(!/\.(bin|img|zip|fw|hex|tar|gz)$/i.test(file.name)||file.size<=0||file.size>268435456)throw new Error('请选择有效固件文件，最大256MB')
 const result=await uploadIotFirmware(file.path,hash,p=>progress.value=p)
 form.value={...form.value,packageUrl:result.packageUrl,fileSizeBytes:result.fileSizeBytes,sha256Text:result.sha256Text};uploaded.value=true;uni.showToast({title:'上传校验完成'})
}catch(e){showError(e)}finally{busy.value=false}}
async function save(){if(busy.value||!ready.value)return;busy.value=true;try{
 const body={...form.value};for(const key of ['firmwareName','versionName','targetModel','packageUrl','sha256Text'])body[key]=String(body[key]||'').trim()
 if(!body.firmwareName||body.firmwareName.length>120||!body.targetModel||body.targetModel.length>80)throw new Error('名称最多120字、型号最多80字，均不能为空')
 if(!/^v?\d+(\.\d+){1,3}(-[a-zA-Z0-9.]+)?$/.test(body.versionName)||body.versionName.length>40)throw new Error('请填写规范版本号，如 v1.2.0')
 if(!/^https:\/\/[^\s/@#]+(?:\/[^\s#]*)?$/i.test(body.packageUrl)||body.packageUrl.length>1000)throw new Error('请输入不含用户信息与片段的 HTTPS 下载地址')
 if(!/^[a-fA-F0-9]{64}$/.test(body.sha256Text))throw new Error('SHA-256 摘要须为64位十六进制字符')
 body.fileSizeBytes=Number(body.fileSizeBytes);if(!Number.isSafeInteger(body.fileSizeBytes)||body.fileSizeBytes<=0||body.fileSizeBytes>2147483648)throw new Error('文件大小须为1～2147483648的整数字节')
 if(body.releaseNotes.length>500||body.changelogText.length>1000)throw new Error('发布说明最多500字，变更记录最多1000字')
 const result=await opsApi.registerFirmware(body);uni.showToast({title:'固件草稿已登记'});uni.redirectTo({url:'/pages/ops/firmware-detail?id='+result.id})
}catch(e){showError(e)}finally{busy.value=false}}
</script>
<template><view class="page pad has-footer"><view v-if="error" class="error">{{error}}</view><template v-if="ready"><view class="card"><text class="card-title">固件文件</text><text class="muted block">可从微信会话选择文件上传，或在下方登记已有 HTTPS 文件。上传由服务端校验摘要与大小。</text><input v-model="expected" class="input block" maxlength="64" :disabled="busy" placeholder="可选：厂家提供的预期 SHA-256"/><button class="btn btn-ghost block" :disabled="busy" :loading="busy" @tap="upload">{{busy?'处理中 '+progress+'%':uploaded?'重新选择并上传':'选择固件并上传'}}</button><text class="notice block">{{uploaded?'文件地址、摘要和大小已由服务端核验并锁定。':'外部地址的实际文件未由本服务核验，请填写真实摘要和大小。'}}</text></view><view class="card"><BusinessForm v-model="form" :fields="fields" :busy="busy" submit-text="保存固件草稿" @save="save"/></view></template><view v-else-if="!error" class="loading">正在校验运营权限…</view></view></template>
