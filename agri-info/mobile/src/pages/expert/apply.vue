<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { infoApi, toast, money, toArray, statusLabel, type Report, type Expert, type Attestation, type Knowledge, type QaRecord, type Quote } from '../../api'
import PageState from '../../components/PageState.vue'
import { useNativePage, useFavorite } from '../../useNativePage'

const form=ref({name:'',certNo:'',field:'',title:'',orgName:'',region:'',level:'平台认证',intro:''}), submitting=ref(false)
const records=ref<Expert[]>([])
const pending=computed(()=>records.value.some(r=>r.status==='pending'))
const {loading,error,load}=useNativePage(async()=>{records.value=await infoApi.myExpert()})
onShow(load)
const fields=[{key:'name',label:'姓名',required:true},{key:'certNo',label:'专业证书编号',required:true},{key:'field',label:'专业领域',required:true},{key:'title',label:'职称',required:false},{key:'orgName',label:'单位',required:false},{key:'region',label:'服务地区',required:false}] as const
async function submit(){if(submitting.value||pending.value||loading.value||error.value)return;if(!form.value.name.trim()||!form.value.certNo.trim()||!form.value.field.trim()){toast('请填写姓名、专业证书编号和专业领域');return}submitting.value=true;try{const result=await infoApi.applyExpert({...form.value});records.value=result.records;toast(result.message||'申请已提交');uni.redirectTo({url:'/pages/expert/cert'})}catch(e){toast(e instanceof Error?e.message:'申请失败')}finally{submitting.value=false}}

</script>
<template><view class="native-page"><view class="native-heading"><text class="native-title">专家认证申请</text><text class="native-muted">填写专业资质信息，提交后由平台审核</text></view><PageState :loading="loading" :error="error" @retry="load" /><template v-if="!loading && !error"><view v-if="pending" class="native-note">已有申请正在审核，请在“我的认证”查看进度，无需重复提交。</view><view class="native-card"><view v-for="field in fields" :key="field.key" class="native-field"><text>{{field.label}}{{field.required?' *':''}}</text><input v-model="form[field.key]" :disabled="pending||submitting" :maxlength="100" :placeholder="'请输入'+field.label"/></view><view class="native-field"><text>专业介绍</text><textarea v-model="form.intro" :disabled="pending||submitting" maxlength="1000" placeholder="介绍研究领域、实践经验与成果"/></view></view><view class="native-note">当前申请接收文字资料。提交材料前请与平台管理员确认补充方式。</view><button class="btn btn-primary" :disabled="pending||submitting" @tap="submit">{{submitting?'提交中…':pending?'审核中':'提交认证申请'}}</button></template></view></template>
