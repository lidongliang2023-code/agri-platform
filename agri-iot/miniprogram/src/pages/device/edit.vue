<script setup lang="ts">
import {ref,computed,watch} from 'vue'
import {onLoad} from '@dcloudio/uni-app'
import {api,type Row} from '../../api/iot'
import BusinessForm,{type Field} from '../../components/BusinessForm.vue'
import {showError} from '../../utils/ui'
const id=ref(0),form=ref<Row>({deviceName:'',deviceCode:'',typeId:null,farmId:null,gatewayId:null,groupId:null,plotId:null,firmwareVersion:'v1.0.0',controlCapable:false,config:'{}'}),types=ref<Row[]>([]),farms=ref<Row[]>([]),gateways=ref<Row[]>([]),groups=ref<Row[]>([]),plots=ref<Row[]>([]),busy=ref(false),error=ref(''),loaded=ref(false)
const opts=(rows:Row[],label:string)=>rows.map(x=>({value:x.id,label:x[label]}))
const fields=computed<Field[]>(()=>[
 {key:'deviceCode',label:'设备编码',required:true,disabled:!!id.value}, {key:'deviceName',label:'设备名称',required:true},
 {key:'farmId',label:'生产农场',type:'select',required:true,disabled:!!id.value,options:opts(farms.value,'farmName')},
 ...(!id.value?[{key:'typeId',label:'设备类型',type:'select',required:true,options:opts(types.value.filter(x=>x.status==='active'),'name')}]:[]),
 {key:'gatewayId',label:'接入网关',type:'select',required:true,options:opts(gateways.value.filter(x=>x.farmId===form.value.farmId),'gatewayName')},
 {key:'groupId',label:'设备分组',type:'select',required:true,options:opts(groups.value,'name')},
 {key:'plotId',label:'生产地块',type:'select',options:[{value:null,label:'不绑定地块'},...opts(plots.value.filter(x=>x.farmId===form.value.farmId),'plotName')]},
 {key:'firmwareVersion',label:'固件版本'},{key:'controlCapable',label:'支持远程控制',type:'switch'},{key:'config',label:'扩展配置 JSON',type:'textarea'},
 {key:'latitude',label:'纬度',hint:'可留空，范围 -90～90'},{key:'longitude',label:'经度',hint:'可留空，范围 -180～180'}])
watch(()=>form.value.farmId,(next,old)=>{if(old!=null&&next!==old&&!id.value){form.value.gatewayId=null;form.value.plotId=null}})
onLoad(async o=>{id.value=Number(o?.id||0);uni.setNavigationBarTitle({title:id.value?'编辑设备':'注册设备'});await load()})
async function load(){busy.value=true;try{[types.value,farms.value,gateways.value,groups.value,plots.value]=await Promise.all([api.deviceTypes(),api.farms(),api.gateways(),api.groups(),api.plots()]);if(id.value)form.value={...form.value,...await api.device(id.value)};error.value='';loaded.value=true}catch(e){error.value=e instanceof Error?e.message:'加载失败'}finally{busy.value=false}}
async function save(){if(busy.value)return;try{if(!form.value.deviceName.trim())throw new Error('请输入设备名称');if(!id.value&&!/^[A-Z0-9][A-Z0-9_-]{2,59}$/.test(form.value.deviceCode))throw new Error('设备编码须为 3～60 位大写字母、数字、横线或下划线');for(const k of ['farmId','gatewayId','groupId',...(!id.value?['typeId']:[])])if(!form.value[k])throw new Error('请选择农场、设备类型、网关和分组');const parsed=JSON.parse(form.value.config);if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw new Error('配置须为 JSON 对象');const body={...form.value};for(const [key,max] of [['latitude',90],['longitude',180]] as const){if(body[key]==null||body[key]==='')body[key]=null;else{body[key]=Number(body[key]);if(!Number.isFinite(body[key])||Math.abs(body[key])>max)throw new Error('经纬度无效')}}busy.value=true;if(id.value)await api.updateDevice(id.value,body);else await api.createDevice(body);uni.showToast({title:'设备已保存'});uni.navigateBack()}catch(e){showError(e)}finally{busy.value=false}}
</script><template><view class="page pad has-footer"><view v-if="error" class="error" @tap="load">{{error}}<text class="retry">点击重试</text></view><view v-if="!loaded&&!error" class="loading">正在加载…</view><view v-if="loaded" class="card"><BusinessForm v-model="form" :fields="fields" :busy="busy" :submit-text="id?'保存修改':'注册设备'" @save="save"/></view></view></template>
