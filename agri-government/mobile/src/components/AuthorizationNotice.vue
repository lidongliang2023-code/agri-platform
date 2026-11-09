<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api, type AuthorizationStatus } from '../api'
const props=defineProps<{duty?:string;context?:string}>()
const data=ref<AuthorizationStatus|null>(null),loading=ref(false),error=ref(''),expanded=ref(false)
let sequence=0
const labels:Record<string,string>={inspection:'执法检查',sampling:'监督抽检',case:'案件处置',credit:'信用监管',complaint:'举报处理',statistics:'监管统计',subsidy:'补贴审核'}
const effective=computed(()=>data.value?.grants.filter(g=>g.effective)??[])
const capable=computed(()=>effective.value.some(g=>g.regions.some(r=>!props.duty||r.duties.includes(props.duty))))
const title=computed(()=>error.value?'授权状态加载失败':loading.value?'正在核对辖区授权…':!data.value?.bound?'尚未绑定有效监管人员档案':!data.value.grants.length?'尚未登记辖区授权':!effective.value.length?'当前没有生效的辖区授权':!capable.value?`缺少「${labels[props.duty||'']||'本项业务'}」职责授权`:'当前已有生效的辖区授权')
const guidance=computed(()=>error.value?'暂时无法判断授权状态，请检查网络后重试。':!data.value?.bound?'请联系监管运营管理员，在“组织与权限”中绑定当前账号与启用的人员档案。':!data.value.grants.length?'请联系管理员先登记机构与辖区，再在“监管人员授权”中配置职责和有效期。':!effective.value.length?'展开明细查看停用、到期或机构范围变化原因，请管理员核实后调整。':!capable.value?'已有其他职责不代表可以办理本项业务，请管理员核实授权依据。':'仅可查看授权辖区内、符合职责及承办关系的记录；空列表不代表全平台没有数据。')
async function refresh(){const run=++sequence;loading.value=true;error.value='';data.value=null;try{const result=await api.authorizationStatus();if(run===sequence)data.value=result}catch(e){if(run===sequence)error.value=e instanceof Error?e.message:'网络异常'}finally{if(run===sequence)loading.value=false}}
onShow(refresh)
</script>
<template>
 <view class="authorization-notice" :class="{warning:!loading&&!capable,error:!!error}" aria-label="当前辖区授权">
  <view class="notice-head"><text class="notice-title">{{title}}</text><button class="notice-refresh" :disabled="loading" @click="refresh">{{loading?'读取中':'刷新'}}</button></view>
  <text v-if="!loading" class="notice-text">{{guidance}}</text>
  <text v-if="error" class="notice-error">{{error}}</text>
  <template v-if="data&&!loading">
   <text class="notice-meta">{{data.personnelName||'当前账号'}} · 服务端日期 {{data.serverDate}}</text>
   <text class="notice-text">管理员身份不自动获得执法权，实际办理以服务端即时校验为准。</text>
   <text v-if="context==='scan'" class="notice-text">跨域溯源明细尚无可核实的辖区映射，暂不开放；扫码成功不代表获得办理授权。</text>
   <text v-if="context==='evidence'" class="notice-text">取证还须关联本人承办且辖区、职责匹配的任务或案件。</text>
   <text v-if="context==='workbench'" class="notice-text">工作台指标按相应职责及本人承办范围统计，部分指标可能为空。</text>
   <button v-if="data.grants.length" class="notice-toggle" @click="expanded=!expanded">{{expanded?'收起':'查看'}}授权明细（{{data.grants.length}} 条）{{expanded?' ↑':' ↓'}}</button>
   <view v-if="expanded" class="notice-details">
    <view v-for="g in data.grants" :key="g.id" class="notice-record">
     <text class="notice-title">{{g.organizationName}}</text><text class="notice-state" :class="{valid:g.effective}">{{g.effective?'授权有效':g.reason}}</text>
     <text class="notice-meta">{{g.validFrom||'未设置'}} 至 {{g.validUntil||'未设置'}}</text>
     <view v-for="r in g.regions" :key="r.code" class="notice-region"><text>{{r.name}}（{{r.code}}） · {{r.includeChildren?'含下级地区':'仅本级'}}</text><text>{{r.duties.map(d=>labels[d]||d).join('、')||'未配置职责'}}</text></view>
    </view>
   </view>
  </template>
 </view>
</template>
<style scoped>
.authorization-notice{margin:20rpx 24rpx;padding:24rpx;border:1rpx solid #cee3d6;border-radius:22rpx;background:#f2f8f4;color:#274c39;overflow-wrap:anywhere;min-width:0}.authorization-notice.warning{background:#fffbf0;border-color:#eddfb7;color:#735821}.authorization-notice.error{background:#fff4f2;border-color:#efcec7}.notice-head{display:flex;align-items:center;justify-content:space-between;gap:16rpx}.notice-title{font-size:27rpx;font-weight:650;display:block}.notice-refresh{flex-shrink:0;margin:0;padding:0 18rpx;line-height:52rpx;font-size:24rpx;color:#12764a;background:#fff;border-radius:14rpx}.notice-text,.notice-meta,.notice-error{display:block;margin-top:12rpx;font-size:24rpx;line-height:1.65}.notice-meta{color:#687b70;font-size:22rpx}.notice-error{color:#b63829}.notice-toggle{margin:18rpx 0 0;padding:0;background:transparent;color:#12764a;text-align:left;line-height:48rpx;font-size:24rpx}.notice-toggle::after,.notice-refresh::after{border:0}.notice-record{margin-top:18rpx;border-top:1rpx solid #dfe7df;padding-top:18rpx}.notice-state{display:inline-block;margin-top:10rpx;color:#8b631e;font-size:23rpx}.notice-state.valid{color:#12764a}.notice-region{margin-top:12rpx;background:#ffffff99;padding:14rpx;border-radius:12rpx}.notice-region text{display:block;line-height:1.6;font-size:23rpx}
</style>
