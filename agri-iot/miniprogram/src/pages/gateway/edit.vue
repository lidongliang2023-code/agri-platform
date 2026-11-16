<script setup lang="ts">
import {ref,computed} from 'vue'
import {onLoad} from '@dcloudio/uni-app'
import {api,type Row} from '../../api/iot'
import BusinessForm,{type Field} from '../../components/BusinessForm.vue'
import {showError} from '../../utils/ui'
const id=ref(0),form=ref<Row>({gatewayCode:'',gatewayName:'',farmId:null,model:'通用边缘网关',protocol:'MQTT',firmwareVersion:'v1.0.0',ipAddress:''}),farms=ref<Row[]>([]),busy=ref(false),loaded=ref(false),error=ref('')
const fields=computed<Field[]>(()=>[{key:'gatewayCode',label:'网关编码',required:true},{key:'gatewayName',label:'网关名称',required:true},{key:'farmId',label:'所属农场',required:true,type:'select',options:farms.value.map(f=>({value:f.id,label:f.farmName}))},{key:'model',label:'型号'},{key:'protocol',label:'接入协议',required:true},{key:'firmwareVersion',label:'固件版本'},{key:'ipAddress',label:'IP 地址'}])
onLoad(o=>{id.value=Number(o?.id||0);uni.setNavigationBarTitle({title:id.value?'编辑网关':'新增网关'});void load()})
async function load(){busy.value=true;try{farms.value=await api.farms();if(id.value)form.value={...form.value,...await api.gateway(id.value)};error.value='';loaded.value=true}catch(e){error.value=e instanceof Error?e.message:'加载失败'}finally{busy.value=false}}
async function save(){if(busy.value)return;try{if(!/^[A-Z0-9][A-Z0-9_-]{2,49}$/.test(form.value.gatewayCode))throw new Error('编码须为 3～50 位大写字母、数字、横线或下划线');if(!form.value.gatewayName.trim()||!form.value.protocol.trim()||!form.value.farmId)throw new Error('请填写网关名称、协议并选择农场');busy.value=true;if(id.value)await api.updateGateway(id.value,form.value);else await api.createGateway(form.value);uni.showToast({title:'网关已保存'});uni.navigateBack()}catch(e){showError(e)}finally{busy.value=false}}
</script><template><view class="page pad has-footer"><view v-if="error" class="error" @tap="load">{{error}}<text class="retry">点击重试</text></view><view v-if="!loaded&&!error" class="loading">正在加载…</view><view v-if="loaded" class="card"><BusinessForm v-model="form" :fields="fields" :busy="busy" :submit-text="id?'保存修改':'保存网关'" @save="save"/></view></view></template>
