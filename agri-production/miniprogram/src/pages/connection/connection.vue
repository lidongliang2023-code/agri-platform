<template><view class="page"><view class="card"><view class="card-title">生产服务地址</view><text class="muted">填写生产管理统一网关地址，账号和全部业务通过此地址访问。</text><input class="origin-input" v-model="origin" placeholder="https://你的生产业务域名" /><view v-if="error" class="error-box">{{ error }}</view><button class="btn-primary" :disabled="busy" @tap="save">{{busy?'检测中…':'检测并保存'}}</button><text class="muted">切换地址将退出当前账号，避免混用不同环境的数据。</text></view><view class="card"><view class="card-title">各端连接要求</view><text class="connection-note">H5：与 PC 共用 Vue 3 业务页面。
微信小程序：在微信后台登记 HTTPS request 合法域名及 web-view 业务域名，配置真实 AppID。
App：填写可达的网关地址，安装包发布需配置应用标识与签名。
本机联调：手机与电脑需处于同一局域网，服务地址使用电脑局域网地址。</text></view></view></template>
<script setup lang="ts">
import { ref } from 'vue'
import { serviceOrigin, saveServiceOrigin, validateServiceOrigin } from '@/utils/runtime'
import { TOKEN_KEY, clearProductionContext } from '@/utils/request'
const origin=ref(serviceOrigin());const busy=ref(false);const error=ref('')
async function save():Promise<void>{if(busy.value)return;busy.value=true;error.value='';try{
 const next=validateServiceOrigin(origin.value);
 await new Promise<void>((resolve,reject)=>uni.request({url:next+'/api/v1/auth/me',timeout:10000,success:r=>{const body=r.data as any;if((r.statusCode===401||r.statusCode===200)&&typeof body==='object'&&body&&'code' in body)resolve();else reject(new Error('该地址不是有效生产网关'))},fail:()=>reject(new Error('无法连接，请检查地址、网络和合法域名配置'))}));
 const changed=next!==serviceOrigin();saveServiceOrigin(next);if(changed){clearProductionContext();uni.removeStorageSync(TOKEN_KEY);uni.removeStorageSync('agri_user');uni.removeStorageSync('agri_session_expires')}uni.showToast({title:'连接已保存',icon:'success'});uni.reLaunch({url:'/pages/login/login'});
 }catch(e:any){error.value=e.message||'保存失败'}finally{busy.value=false}}
</script>
<style scoped>.origin-input{border:1rpx solid #d8e4dc;border-radius:12rpx;padding:22rpx 16rpx;margin:24rpx 0;font-size:26rpx}.connection-note{white-space:pre-line;line-height:1.9;color:#647569;font-size:26rpx}.btn-primary{margin:24rpx 0}.muted{line-height:1.8}</style>
