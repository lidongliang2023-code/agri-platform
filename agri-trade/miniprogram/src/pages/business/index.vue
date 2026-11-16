<script setup lang="ts">
import {computed,ref} from 'vue'
import {onLoad,onShow,onPullDownRefresh} from '@dcloudio/uni-app'
import {request,query} from '../../api'
import {requireTradeLogin,getTradeRole} from '../../auth'
declare const plus:any
import {modules,asRows,allPages,fillPath,getOptions,type Row,type Action,type Field,type Context} from '../../business'
import RecordView from '../../components/RecordView.vue'
import ProductFields from '../../components/ProductFields.vue'
const key=ref('overview'), ctx=ref<Context>({role:getTradeRole(),merchantId:'',merchantIds:[]})
const mod=computed(()=>modules(ctx.value)[key.value])
const rows=ref<Row[]>([]),loading=ref(false),error=ref(''),keyword=ref(''),page=ref(1),total=ref(0),references=ref<Row[]>([]),summary=ref<Row|null>(null)
const editing=ref<Action|null>(null),form=ref<Row>({}),selected=ref<Row>({}),choices=ref<Record<string,{label:string;value:any}[]>>({}),busy=ref(false),formError=ref('')
const viewing=ref(false),details=ref<Row[]>([]),viewTitle=ref('详情'),chatPath=ref(''),message=ref(''),detailActions=ref(false)
let prefill:Row={},ready=false,serial=0
onLoad((p?:Record<string,string>)=>{key.value=p?.key||'overview';ctx.value.role=getTradeRole();if(p?.productId)prefill.productId=p.productId;if(p?.orderId)prefill.orderId=p.orderId;ready=true;if(mod.value)uni.setNavigationBarTitle({title:mod.value.title})})
onShow(()=>{
 if(!ready)return
 const role=getTradeRole()
 if(ctx.value.role!==role){serial++;ctx.value.role=role;rows.value=[];references.value=[];summary.value=null;editing.value=null;viewing.value=false;details.value=[];prefill={};page.value=1;keyword.value=''}
 if(!mod.value){uni.redirectTo({url:'/pages/workspace/index?role='+role});return}
 uni.setNavigationBarTitle({title:mod.value.title})
 void load()
})
onPullDownRefresh(()=>void load().finally(()=>uni.stopPullDownRefresh()))
function go(k:string){uni.navigateTo({url:'/pages/business/index?key='+k+'&role='+ctx.value.role})}
function fail(e:unknown){return e instanceof Error?e.message:'请求失败，请重试'}
function toast(e:unknown){uni.showToast({title:fail(e),icon:'none'})}
async function load(){if(!requireTradeLogin()||!mod.value)return;const token=++serial;loading.value=true;error.value='';try{const merchants=asRows(await request('/identity/my-merchants'));ctx.value.merchantIds=merchants.map(m=>String(m.merchantId));const saved=String(uni.getStorageSync('trade_merchant')||'');ctx.value.merchantId=ctx.value.merchantIds.includes(saved)?saved:ctx.value.merchantIds[0]||'';if(!mod.value.path){rows.value=[];return}if(!ctx.value.merchantId&&['demand-list','match','rate'].includes(key.value)){rows.value=[];total.value=0;return}const params:Row=mod.value.paged?{pageNum:page.value,pageSize:20}:{};if(mod.value.search&&keyword.value.trim())params[mod.value.search]=keyword.value.trim();if(key.value==='demand-list')params.buyerId=ctx.value.merchantId;if(key.value==='rate')params[ctx.value.role==='buyer'?'evaluatorId':'evaluateeId']=ctx.value.merchantId;if(prefill.orderId&&['contract','ship','after','rate'].includes(key.value))params.orderId=prefill.orderId;const path=mod.value.path;const suffix=query(params);const data=key.value==='customer'?await allPages(path):await request<any>(path+(path.includes('?')?suffix.replace('?','&'):suffix));if(token!==serial)return;summary.value=null;if(key.value==='agent'||key.value==='sessions'){references.value=data.references||[];rows.value=data[key.value==='agent'?'mandates':'sessions']||[]}else if(key.value==='overview'){rows.value=data[ctx.value.role]?[data[ctx.value.role]]:[];if(data.message)error.value=data.message}else if(key.value==='settlement'){summary.value=data.summary;rows.value=[...(data.pending||[]).map((r:Row)=>({...r,settleStatus:'待结算'})),...(data.settled||[]).map((r:Row)=>({...r,settleStatus:'已结算'}))]}else if(key.value==='customer'){const groups=new Map<string,Row>();for(const order of asRows(data)){const id=String(order.buyerId);const entry=groups.get(id)||{buyerName:order.buyerName,purchaseCount:0,totalPurchase:0,lastPurchase:''};entry.purchaseCount++;entry.totalPurchase+=Number(order.totalAmount||0);entry.lastPurchase=entry.lastPurchase>order.createTime?entry.lastPurchase:order.createTime;groups.set(id,entry)}rows.value=[...groups.values()].sort((a,b)=>b.totalPurchase-a.totalPurchase)}else rows.value=asRows(data);if(key.value==='chat')rows.value=rows.value.filter(r=>r.role===ctx.value.role.toUpperCase());total.value=Number(data?.total??rows.value.length)}catch(e){if(token===serial)error.value=fail(e)}finally{if(token===serial)loading.value=false}}
function search(){page.value=1;void load()}
function turn(step:number){page.value+=step;void load()}
function available(a:Action,r:Row){return !a.when||a.when(r,ctx.value)}
async function view(path:string,title:string,chat=false,actions=false){busy.value=true;try{details.value=asRows(await request(path));viewTitle.value=title;chatPath.value=chat?path:'';detailActions.value=actions;viewing.value=true}catch(e){toast(e)}finally{busy.value=false}}
async function run(a:Action,row:Row={}){if(busy.value)return;try{if(a.navigate){uni.navigateTo({url:fillPath(a.navigate,row)});return}if(a.fields?.length){busy.value=true;selected.value={...row};let initial:Row={...a.defaults,...prefill};if(a.method==='PUT'&&mod.value?.detail){initial={...await request<Row>(fillPath(mod.value.detail,row)),...initial}}else{for(const field of a.fields)if(row[field.key]!=null)initial[field.key]=row[field.key]};if(key.value==='goods')initial.certificationsText=(initial.certifications||[]).join('，');form.value=initial;choices.value={};formError.value='';await Promise.all(a.fields.filter(f=>f.type==='select').map(async f=>{choices.value[f.key]=f.options||await getOptions(f.source,ctx.value,references.value);if(form.value[f.key]==null&&choices.value[f.key].length===1)form.value[f.key]=choices.value[f.key][0].value}));editing.value=a;return}if(a.view){await view(fillPath(a.view,row),a.label,key.value==='chat',key.value==='inquiry');return}selected.value=row;form.value={...a.defaults};await execute(a)}catch(e){toast(e)}finally{busy.value=false}}
function pick(field:Field,e:any){form.value[field.key]=(choices.value[field.key]||[])[Number(e.detail.value)]?.value}
function choiceLabel(field:Field){return (choices.value[field.key]||[]).find(o=>String(o.value)===String(form.value[field.key]))?.label||'请选择'+field.label}
async function execute(a:Action){if(busy.value)return;formError.value='';let body:Row={...a.defaults};try{for(const f of a.fields||[]){const value=form.value[f.key];if(f.required&&(value==null||String(value).trim()===''))throw new Error('请填写'+f.label);if(value==null||value==='')continue;if(f.type==='number'){const n=Number(value);if(!Number.isFinite(n)||(f.min!=null&&n<f.min)||(f.max!=null&&n>f.max))throw new Error(f.label+'超出有效范围');if((f.key.startsWith('rating')||f.key==='maxRounds'||f.key==='validDays')&&!Number.isInteger(n))throw new Error(f.label+'必须是整数');body[f.key]=n}else body[f.key]=typeof value==='string'?value.trim():value}if(body.priceMin!=null&&body.priceMax!=null&&body.priceMax<body.priceMin)throw new Error('最高价格不能低于最低价格');if(key.value==='agent'&&body.targetPrice!=null&&((ctx.value.role==='buyer'&&body.limitPrice<body.targetPrice)||(ctx.value.role==='seller'&&body.limitPrice>body.targetPrice)))throw new Error('价格边界与期望单价不符');if(key.value==='goods'&&a.fields?.length){body={...form.value,...body};body.certifications=String(body.certificationsText||'').split(/[，,\n]/).map((v:string)=>v.trim()).filter(Boolean);delete body.certificationsText;body.categoryName=choices.value.categoryId?.find(o=>String(o.value)===String(body.categoryId))?.label||body.categoryName;if(!body.images?.length)throw new Error('请上传至少一张商品图片');for(const sku of body.skus||[]){for(const k of ['price','stockQuantity','minOrderQuantity'])sku[k]=Number(sku[k]);if(!sku.skuName?.trim()||!sku.unit?.trim()||!Number.isFinite(sku.price)||sku.price<=0||!Number.isFinite(sku.stockQuantity)||sku.stockQuantity<0||!Number.isFinite(sku.minOrderQuantity)||sku.minOrderQuantity<=0)throw new Error('请完整填写规格、价格、库存和起订量')}}if(key.value==='demand-list'&&body.categoryId)body.categoryName=choices.value.categoryId?.find(o=>String(o.value)===String(body.categoryId))?.label;if(key.value==='inquiry'&&a.path==='/negotiation/quote')body.inquiryId=Number(selected.value.id);if(key.value==='following'&&a.path?.endsWith('/open'))body.sellerId=selected.value.sellerId;if(key.value==='sessions'&&a.path?.endsWith('/confirm'))body.revision=selected.value.revision;if(key.value==='after'&&a.path==='/dispute'){const order=await request<Row>('/order/'+body.orderId);const buyer=ctx.value.role==='buyer';body.complainantId=buyer?order.buyerId:order.sellerId;body.complainantName=buyer?order.buyerName:order.sellerName;body.respondentId=buyer?order.sellerId:order.buyerId;body.respondentName=buyer?order.sellerName:order.buyerName;body.complainantType=buyer?'buyer':'seller';body.respondentType=buyer?'seller':'buyer'}const target=fillPath(a.path||a.view||'',{...selected.value,...form.value,...body});if(a.view){await view(target,a.label);editing.value=null;return}const confirmed=await new Promise<boolean>(resolve=>uni.showModal({title:a.label,content:'确认'+a.label+'？提交后将更新实际业务数据。',success:r=>resolve(r.confirm),fail:()=>resolve(false)}));if(!confirmed)return;busy.value=true;const result=await request<any>(target,a.method||'POST',body);editing.value=null;uni.showToast({title:'操作成功',icon:'success'});if(key.value==='following'&&result?.id){await view('/shop-interactions/negotiations/'+result.id+'/messages','洽谈消息',true)}else if(result&&typeof result==='object'){details.value=asRows(result);viewTitle.value=a.label;viewing.value=true;chatPath.value='';detailActions.value=false}await load()}catch(e){formError.value=fail(e);toast(e)}finally{busy.value=false}}
async function send(){if(busy.value||!chatPath.value||!message.value.trim())return;const path=chatPath.value;busy.value=true;try{await request(path,'POST',{content:message.value.trim(),messageType:'TEXT'});message.value='';details.value=asRows(await request(path))}catch(e){toast(e)}finally{busy.value=false}}
function closeView(){if(busy.value)return;viewing.value=false;chatPath.value='';void load()}
function fromMessage(r:Row){if(ctx.value.role==='buyer'&&r.businessType==='ORDER_REQUEST'&&r.businessId)uni.navigateTo({url:'/pages/checkout/index?id='+r.businessId+'&quantity='+encodeURIComponent(r.businessQuantity||'')})}
function openProduction(){const url=String(import.meta.env.VITE_PRODUCTION_MOBILE_URL||'');if(!/^https:\/\//.test(url)){uni.showToast({title:'请配置生产管理移动端地址',icon:'none'});return}
// #ifdef H5
window.location.assign(url)
// #endif
// #ifdef APP-PLUS
plus.runtime.openURL(url)
// #endif
// #ifdef MP-WEIXIN
uni.setClipboardData({data:url})
// #endif
}
function hasActions(row:Row){return (mod.value?.actions||[]).some(a=>available(a,row))}
function closeEdit(){if(!busy.value)editing.value=null}
const subtitle=computed(()=>loading.value?'正在加载…':mod.value?.path?`共 ${total.value} 条记录`:(ctx.value.role==='buyer'?'买家中心':'卖家中心'))
const overviewFields=computed(()=>['totalOrders',ctx.value.role==='buyer'?'totalSpent':'totalRevenue','pendingOrders','completedOrders'])
</script>

<template>
  <view v-if="mod" class="page">
    <view class="page-head">
      <view class="grow"><text class="page-title">{{ mod.title }}</text><text class="page-sub">{{ subtitle }}</text></view>
      <button class="btn btn-line btn-sm" :disabled="loading || busy" @tap="load">刷新</button>
    </view>

    <view v-if="!ctx.merchantIds.length && !loading && key !== 'identity'" class="notice">当前账号尚未绑定经营主体，相关业务需要先完成主体绑定。<text class="link" @tap="go('identity')">去绑定 ›</text></view>

    <scroll-view v-if="mod.children" scroll-x class="children-scroll" :show-scrollbar="false">
      <view class="children">
        <view v-for="child in mod.children" :key="child.key" class="child tap-row" @tap="go(child.key)"><text class="ellipsis">{{ child.label }}</text><text class="arrow">›</text></view>
      </view>
    </scroll-view>

    <view v-if="mod.search" class="mobile-toolbar">
      <view class="search-bar">
        <text class="search-icon">⌕</text>
        <input v-model="keyword" placeholder="输入关键词查询" confirm-type="search" @confirm="search" />
        <button @tap="search">查询</button>
      </view>
      <button v-if="mod.create" class="btn btn-primary btn-sm toolbar-create" :disabled="busy" @tap="run(mod.create)">＋</button>
    </view>

    <button v-else-if="mod.create" class="btn btn-primary btn-block create" :disabled="busy" @tap="run(mod.create)">{{ mod.create.label }}</button>

    <view v-if="loading && !rows.length" class="loading">正在加载…</view>
    <view v-else-if="error && !rows.length" class="load-error"><text>{{ error }}</text><button class="btn btn-ghost" @tap="load">重新加载</button></view>
    <template v-else>
      <view v-if="error" class="notice error" @tap="load">{{ error }} · 点击重试</view>
      <view v-if="summary" class="card"><text class="card-title">汇总</text><RecordView :data="summary" /></view>
      <view v-for="(row, index) in rows" :key="row.id || row.orderId || index" class="card record-card">
        <RecordView :data="row" :fields="key === 'overview' ? overviewFields : mod.fields" />
        <view v-if="mod.detail || hasActions(row)" class="action-row">
          <button v-if="mod.detail" class="btn btn-line btn-sm" :disabled="busy" @tap="view(fillPath(mod.detail, row), '业务详情')">查看详情</button>
          <template v-for="(a, i) in mod.actions || []" :key="i">
            <button v-if="available(a, row)" class="btn btn-ghost btn-sm" :disabled="busy" @tap="run(a, row)">{{ a.label }}</button>
          </template>
        </view>
      </view>
      <view v-if="!rows.length && mod.path" class="empty">暂无记录</view>
      <view v-if="mod.paged && total > 0" class="pager">
        <button class="btn btn-sm" :disabled="page <= 1 || loading" @tap="turn(-1)">上一页</button>
        <text class="tiny">第 {{ page }} 页 · 共 {{ total }} 条</text>
        <button class="btn btn-sm" :disabled="page * 20 >= total || loading" @tap="turn(1)">下一页</button>
      </view>
    </template>

    <view v-if="key === 'iot'" class="card">
      <text class="muted">在生产管理工作台绑定基地、地块和设备，并在商品中关联采收批次与溯源资料。</text>
      <button class="btn btn-primary btn-block iot-btn" @tap="openProduction">进入生产管理</button>
    </view>

    <view v-if="editing" class="sheet-mask">
      <view class="sheet tall">
        <view class="sheet-head"><text class="sheet-title ellipsis">{{ editing.label }}</text><view class="sheet-close" @tap="closeEdit">×</view></view>
        <scroll-view scroll-y class="sheet-body">
          <view class="sheet-body-inner">
            <view v-for="field in editing.fields || []" :key="field.key" class="form-item">
              <text class="form-label">{{ field.label }}<text v-if="field.required" class="req"> *</text></text>
              <picker v-if="field.type === 'select'" :range="choices[field.key] || []" range-key="label" @change="pick(field, $event)">
                <view class="input" :class="{ placeholder: form[field.key] == null || form[field.key] === '' }"><text class="ellipsis grow">{{ choiceLabel(field) }}</text><text class="picker-arrow">›</text></view>
              </picker>
              <picker v-else-if="field.type === 'date'" mode="date" :value="form[field.key] || ''" @change="form[field.key] = $event.detail.value">
                <view class="input" :class="{ placeholder: !form[field.key] }"><text class="grow">{{ form[field.key] || '选择日期' }}</text><text class="picker-arrow">›</text></view>
              </picker>
              <textarea v-else-if="field.type === 'textarea'" v-model="form[field.key]" :maxlength="4000" class="textarea" :placeholder="'请输入' + field.label" />
              <input v-else v-model="form[field.key]" :type="field.type === 'number' ? 'digit' : 'text'" class="input" :placeholder="'请输入' + field.label" />
            </view>
            <ProductFields v-if="key === 'goods'" :model="form" />
          </view>
        </scroll-view>
        <view class="sheet-foot">
          <view v-if="formError" class="notice error">{{ formError }}</view>
          <button class="btn btn-primary btn-block" :loading="busy" :disabled="busy" @tap="execute(editing)">{{ editing.label }}</button>
        </view>
      </view>
    </view>

    <view v-if="viewing" class="sheet-mask">
      <view class="sheet tall">
        <view class="sheet-head"><text class="sheet-title ellipsis">{{ viewTitle }}</text><view class="sheet-close" @tap="closeView">×</view></view>
        <scroll-view scroll-y class="sheet-body">
          <view class="sheet-body-inner">
            <view v-for="(r, i) in details" :key="r.id || i" class="card">
              <RecordView :data="r" />
              <view v-if="(chatPath && ctx.role === 'buyer' && r.businessType === 'ORDER_REQUEST') || detailActions" class="action-row">
                <button v-if="chatPath && ctx.role === 'buyer' && r.businessType === 'ORDER_REQUEST'" class="btn btn-ghost btn-sm" @tap="fromMessage(r)">查看采购商品</button>
                <button v-if="detailActions" class="btn btn-ghost btn-sm" @tap="go('quotes')">进入报价管理</button>
              </view>
            </view>
            <view v-if="!details.length" class="empty">暂无记录</view>
          </view>
        </scroll-view>
        <view v-if="chatPath" class="sheet-foot chat-foot">
          <textarea v-model="message" class="textarea chat-input" placeholder="输入洽谈消息" :maxlength="2000" auto-height />
          <view class="chat-actions">
            <button class="btn btn-sm" :disabled="busy" @tap="view(chatPath, '洽谈消息', true)">刷新</button>
            <button class="btn btn-primary btn-sm" :disabled="busy || !message.trim()" @tap="send">发送</button>
          </view>
        </view>
      </view>
    </view>
  </view>
  <view v-else class="page"><view class="empty">该功能不存在，请返回工作台</view></view>
</template>

<style scoped lang="scss">
.link { margin-left: 8rpx; color: var(--c-primary); font-weight: 600; }
.children-scroll { margin: -4rpx 0 20rpx; }
.children { display: inline-flex; gap: 16rpx; white-space: nowrap; }
.child { display: flex; min-width: 180rpx; min-height: 76rpx; align-items: center; justify-content: space-between; gap: 8rpx; padding: 0 22rpx; border: 1rpx solid #dce9e0; border-radius: 38rpx; background: #fff; color: var(--c-primary); font-size: 26rpx; font-weight: 600; }
.mobile-toolbar { margin-bottom: 20rpx; }
.toolbar-create { flex: 0 0 72rpx; padding: 0; }
.create { margin-bottom: 20rpx; }
.record-card { padding: 20rpx 24rpx 24rpx; }
.record-card .action-row { padding-top: 4rpx; }
.pager { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; margin-top: 8rpx; }
.pager .btn { min-width: 140rpx; }
.iot-btn { margin-top: 24rpx; }
.sheet.tall { height: 88vh; }
.sheet-close { font-size: 40rpx; }
.chat-foot { display: flex; align-items: flex-end; gap: 16rpx; }
.chat-input { min-width: 0; flex: 1; min-height: 88rpx; max-height: 240rpx; padding: 20rpx 24rpx; }
.chat-actions { display: flex; flex-shrink: 0; flex-direction: column; gap: 12rpx; }
@media (max-width: 350px) {
  .child { min-width: 156rpx; }
  .record-card .action-row .btn { flex-basis: 100%; }
}
</style>
