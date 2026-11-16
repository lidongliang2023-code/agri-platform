<script setup lang="ts">
import {ref,computed} from 'vue'
import {onLoad} from '@dcloudio/uni-app'
import {api,type Row} from '../../api/iot'
import BusinessForm,{type Field} from '../../components/BusinessForm.vue'
import {showError} from '../../utils/ui'
const form=ref<Row>({deviceId:null,orderType:'设备故障',priority:'normal',description:''}),devices=ref<Row[]>([]),busy=ref(false),error=ref(''),loaded=ref(false)
const fields=computed<Field[]>(()=>[{key:'deviceId',label:'报修设备',type:'select',required:true,options:devices.value.map(d=>({value:d.id,label:d.deviceName}))},{key:'orderType',label:'故障类型',required:true},{key:'priority',label:'优先级',type:'select',options:[{value:'normal',label:'一般'},{value:'major',label:'重要'},{value:'critical',label:'紧急'}]},{key:'description',label:'故障描述（最多500字）',type:'textarea',required:true}])
onLoad(o=>{if(o?.deviceId)form.value.deviceId=Number(o.deviceId);void load()})
async function load(){try{devices.value=await api.devices();loaded.value=true;error.value=''}catch(e){error.value=e instanceof Error?e.message:'设备加载失败'}}
async function save(){if(busy.value)return;try{if(!form.value.deviceId||!form.value.orderType.trim())throw new Error('请选择设备并填写故障类型');if(form.value.description.trim().length<4||form.value.description.length>500)throw new Error('请填写 4～500 字的实际故障描述');busy.value=true;await api.createWorkOrder({...form.value,source:'移动端报修'});uni.showToast({title:'工单已创建'});uni.navigateBack()}catch(e){showError(e)}finally{busy.value=false}}
</script><template><view class="page pad has-footer"><view v-if="error" class="error" @tap="load">{{error}}<text class="retry">点击重试</text></view><view v-if="!loaded&&!error" class="loading">正在加载…</view><view v-if="loaded" class="card"><BusinessForm v-model="form" :fields="fields" :busy="busy" submit-text="提交报修工单" @save="save"/></view></view></template>
