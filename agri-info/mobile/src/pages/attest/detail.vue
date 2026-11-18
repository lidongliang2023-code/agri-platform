<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { infoApi, toast, money, toArray, statusLabel, attestationStatusMeta, type Report, type Expert, type Attestation, type Knowledge, type QaRecord, type Quote } from '../../api'
import PageState from '../../components/PageState.vue'
import { useNativePage, useFavorite } from '../../useNativePage'

const id=ref(0), item=ref<Attestation|null>(null), verifying=ref(false), result=ref<{valid:boolean;message:string}|null>(null)
const {loading,error,load}=useNativePage(async()=>{result.value=null;item.value=await infoApi.attestation(id.value)})
onLoad(o=>{id.value=Number(o?.id);load()})
async function verify(){if(!item.value||verifying.value)return;verifying.value=true;result.value=null;try{result.value=await infoApi.verifyAttestation(item.value.attestNo)}catch(e){toast(e instanceof Error?e.message:'验证失败')}finally{verifying.value=false}}
function copy(){if(item.value)uni.setClipboardData({data:item.value.attestNo})}

</script>
<template><view class="native-page"><PageState :loading="loading" :error="error" @retry="load" /><template v-if="item && !loading && !error"><view class="native-heading"><text class="native-title">{{item.title}}</text><text class="native-muted"><text :class="['tag', attestationStatusMeta(item.status).tone]">{{attestationStatusMeta(item.status).label}}</text> · {{item.attestedAt}}</text></view><view class="native-card"><text class="native-meta">存证编号</text><text class="native-body" selectable>{{item.attestNo}}</text><text class="native-meta">链名称 / 区块高度</text><text class="native-body">{{item.chainName||'未提供'}} / {{item.blockHeight||'未提供'}}</text><text class="native-meta">交易标识</text><text class="native-body" selectable>{{item.txId||'未提供'}}</text><text class="native-meta">内容哈希</text><text class="native-body" selectable>{{item.contentHash||'未提供'}}</text></view><view v-for="(step,i) in item.steps" :key="i" class="native-card"><text class="native-card-title">{{step.done?'已完成':'待完成'}} · {{step.title}}</text><text class="native-body">{{step.note}}</text></view><view class="native-actions"><button class="btn" @tap="copy">复制编号</button><button class="btn btn-primary" :disabled="verifying" @tap="verify">{{verifying?'验证中…':'验证记录'}}</button></view><view v-if="result" class="native-note"><text>{{result.valid?'验证通过':'未通过验证'}}：{{result.message}}</text></view><text class="native-muted">此处显示服务端记录及核验结果，不代表独立区块链节点验证。</text></template></view></template>
