<template>
  <div class="page-stack">
    <PageTitle eyebrow="认证审核" :title="title" :description="description" />
    <section class="surface-card">
      <div class="list-toolbar">
        <a-input v-if="kind === 'identity'" v-model:value="draft" placeholder="搜申请人 / 主体名称 / 信用代码 / 联系电话" style="width:280px" @press-enter="search" />
        <a-button v-if="kind === 'identity'" type="primary" @click="search">搜索</a-button>
        <a-select v-if="kind === 'identity'" :value="identityType" :options="[{label:'全部身份',value:''},...IDENTITY_TYPE_OPTIONS]" style="width:160px" @change="changeType" />
        <a-select :value="status" :options="statusOptions" style="width:160px" @change="changeStatus" />
      </div>
      <ErrorBlock v-if="error" :message="error" @retry="load" />
      <a-table row-key="id" :columns="columns" :data-source="rows" :loading="loading" :scroll="{x:1100}" :pagination="{current:pageNum,pageSize:20,total,showSizeChanger:false,showTotal:(n:number)=>`共 ${n} 条`,onChange:(p:number)=>pageNum=p}">
        <template #bodyCell="{column,record,text}">
          <StatusTag v-if="column.key === 'status'" :status="text" />
          <template v-else-if="column.key === 'time'">{{formatTime(text || record.createdAt)}}</template>
          <template v-else-if="column.key === 'identityType'">{{identityTypeText(text)}}</template>
          <template v-else-if="column.key === 'verification'">
            <a-tag :class="`soft-tag tone-${record.policeVerified?'green':'default'}`">公安{{record.policeVerified?'通过':'未过'}}</a-tag>
            <a-tag :class="`soft-tag tone-${record.livenessVerified?'green':'default'}`">活体{{record.livenessVerified?'通过':'未过'}}</a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button v-if="kind === 'org'" type="link" @click="app.navigate('org-detail',String(record.id))">查看详情</a-button>
            <a-button v-else-if="kind === 'identity' || canReview(record)" :type="canReview(record)?'primary':'link'" :ghost="canReview(record)" size="small" @click="open(record)">{{canReview(record)?'审核':'查看'}}</a-button>
            <span v-else class="small muted">{{record.reviewerName || record.reviewer || '已处理'}}</span>
          </template>
          <template v-else-if="column.key === 'name'">
            <b>{{kind==='identity' ? record.applicantName || `用户 ${record.userId}` : text || record.companyName || '—'}}</b>
            <div class="small muted">{{kind==='identity'?`单号 ${record.id}`:record.code || ''}}</div>
          </template>
          <template v-else-if="column.key === 'subject'"><b>{{text || '—'}}</b><div class="small muted">{{record.creditCode || '未填信用代码'}}</div></template>
          <template v-else-if="column.key === 'contact'">{{text || '—'}}<div class="small muted">{{record.contactPhone || '—'}}</div></template>
          <template v-else>{{text ?? '—'}}</template>
        </template>
      </a-table>
    </section>
    <a-modal :open="!!target" :width="kind==='identity'?760:560" :title="`${title}：${target?.subjectName || target?.merchantName || target?.realName || ''}`" :confirm-loading="submitting" ok-text="提交审核" :ok-button-props="{danger:!approved,disabled:!target || !canReview(target)}" @cancel="target=null" @ok="submit">
      <template v-if="target">
        <a-descriptions v-if="kind==='identity'" :column="2" bordered size="small">
          <a-descriptions-item v-for="field in detailFields" :key="field.key" :label="field.label" :span="field.span || 1">{{detailValue(field.key)}}</a-descriptions-item>
        </a-descriptions>
        <div v-if="!canReview(target)" class="small muted" style="margin-top:12px">审核人：{{target.reviewerName || '—'}}　审核时间：{{formatTime(target.reviewTime)}}<br />审核意见：{{target.reviewRemark || '—'}}</div>
        <div v-else class="stack" style="margin-top:12px">
          <a-select :value="approved?'pass':'reject'" :options="[{label:'通过',value:'pass'},{label:'驳回',value:'reject'}]" @change="(v:unknown)=>approved=v==='pass'" />
          <a-textarea v-model:value="remark" :rows="4" :placeholder="approved?'审核意见（可选）':'驳回理由（会回传给申请人）'" />
          <p class="small muted">审核结果记录审核人、时间和意见。{{kind==='identity'?'通过后申请状态变为 approved，不自动开通 RBAC 权限。':'沿用原有审核接口。'}}</p>
        </div>
      </template>
      <template v-if="target && !canReview(target)" #footer><a-button @click="target=null">关闭</a-button></template>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {message} from 'ant-design-vue'
import {ucApi} from '../api'
import {useAppStore} from '../app-context'
import PageTitle from './PageTitle.vue'
import ErrorBlock from './ErrorBlock.vue'
import StatusTag from './StatusTag.vue'
import {formatTime,identityTypeText,IDENTITY_TYPE_OPTIONS} from './ui-constants'
import type {IdentityApplication,IdentityRecord,CertificationRecord,OrgRecord} from '../types'
type Row = IdentityApplication | IdentityRecord | CertificationRecord | OrgRecord
const props=defineProps<{kind:'identity'|'realname'|'qualification'|'org'}>()
const app=useAppStore()
const rows=ref<Row[]>([]),total=ref(0),pageNum=ref(1),status=ref('pending'),identityType=ref(''),keyword=ref(''),draft=ref(''),loading=ref(false),error=ref('')
// The detail panel contains fields from several audited record types.
const target=ref<Record<string,any>|null>(null),approved=ref(true),remark=ref(''),submitting=ref(false)
const title=computed(()=>({identity:'身份申请审核',realname:'实名认证审核',qualification:'资质审核',org:'组织认证审核'}[props.kind]))
const description=computed(()=>({identity:'审核业务身份申请；通过不自动开通 RBAC 权限',realname:'证件号已转为掩码与哈希，运营端不显示明文',qualification:'经营主体材料审核；通过后主体认证状态变 approved',org:'主体认证状态总览；具体材料审核请进入资质审核'}[props.kind]))
const statusOptions=computed(()=>[{label:props.kind==='org'?'待认证':'待审核',value:'pending'},{label:'已通过',value:props.kind==='realname'?'verified':'approved'},{label:'已驳回',value:'rejected'},...(props.kind==='identity'?[{label:'已撤回',value:'cancelled'}]:[]),{label:'全部状态',value:''}])
const c=(title:string,dataIndex:string,key=dataIndex,width=150)=>({title,dataIndex,key,width})
const columns=computed(()=>{
 const tail=[c('状态',props.kind==='qualification'?'certStatus':props.kind==='org'?'verifyStatus':'status','status',110),c('操作','','action',110)]
 if(props.kind==='identity')return [c('申请人','applicantName','name',170),c('申请身份','identityType','identityType',120),c('主体名称 / 信用代码','subjectName','subject',220),c('联系人','contactName','contact'),c('申请时间','applyTime','time'),...tail]
 if(props.kind==='realname')return [c('真实姓名','realName','name',130),c('证件号（掩码）','idNoMasked','idNoMasked',180),c('公安库 / 活体','','verification',170),c('联系方式','contactPhone'),c('提交时间','submitTime','time'),...tail]
 if(props.kind==='qualification')return [c('主体名称','merchantName','subject',220),c('证书编号','certNo'),c('法人','legalPerson'),c('联系人','contactName','contact'),c('提交时间','submitTime','time'),...tail]
 return [c('组织','name','name',240),c('信用代码','creditCode',undefined,200),c('联系人','contactName'),c('创建时间','createdAt','time'),...tail]
})
const detailFields=[{key:'applicantName',label:'申请人'},{key:'id',label:'申请单号'},{key:'identityType',label:'申请身份'},{key:'status',label:'当前状态'},{key:'subjectName',label:'主体名称'},{key:'creditCode',label:'统一社会信用代码'},{key:'businessPlace',label:'经营地'},{key:'businessCategory',label:'经营范围'},{key:'annualVolume',label:'年交易量'},{key:'contactName',label:'联系人'},{key:'contactPhone',label:'联系电话',span:2},{key:'applyTime',label:'提交时间',span:2},{key:'applyNote',label:'申请说明',span:2}]
function detailValue(key:string){if(!target.value)return '—';if(key==='identityType')return identityTypeText(target.value[key]);if(key==='applyTime')return formatTime(target.value.applyTime??target.value.createdAt);if(key==='applicantName')return target.value[key]||`用户 ${target.value.userId}`;return target.value[key]??'—'}
let requestId=0
async function load(){const id=++requestId;loading.value=true;error.value='';try{const p={pageNum:pageNum.value,pageSize:20};const result=props.kind==='identity'?await ucApi.identityApplications({...p,status:status.value||undefined,identityType:identityType.value||undefined,keyword:keyword.value||undefined}):props.kind==='realname'?await ucApi.realnameList({...p,status:status.value||undefined}):props.kind==='qualification'?await ucApi.certifications({...p,certStatus:status.value||undefined}):await ucApi.orgs({...p,verifyStatus:status.value||undefined});if(id===requestId){rows.value=result.records;total.value=result.total}}catch(e){if(id===requestId)error.value=e instanceof Error?e.message:'读取失败'}finally{if(id===requestId)loading.value=false}}
watch([pageNum,status,identityType,keyword,()=>props.kind],load,{immediate:true})
function search(){const same=keyword.value===draft.value.trim()&&pageNum.value===1;keyword.value=draft.value.trim();pageNum.value=1;if(same)void load()}
function changeStatus(v:unknown){status.value=String(v);pageNum.value=1}
function changeType(v:unknown){identityType.value=String(v);pageNum.value=1}
function canReview(row:Record<string,any>){return props.kind==='qualification'?['pending','submitted','reviewing'].includes(row.certStatus):props.kind!=='org'&&row.status==='pending'}
function open(row:Record<string,any>){target.value=row;approved.value=true;remark.value=''}
async function submit(){if(!target.value||!canReview(target.value)||submitting.value)return;submitting.value=true;try{const id=String(target.value.id);if(props.kind==='identity')await ucApi.reviewIdentityApplication(id,approved.value,remark.value);else if(props.kind==='realname')await ucApi.reviewRealname(id,approved.value,remark.value);else if(props.kind==='qualification')await ucApi.auditCertification(id,approved.value?'approved':'rejected',remark.value);message.success(approved.value?'审核已通过':'已驳回');target.value=null;await load()}catch(e){message.error(e instanceof Error?e.message:'审核失败')}finally{submitting.value=false}}
</script>
