import { FactoryReportEditor } from './FactoryReportEditor'
import { useEffect, useState } from 'react'
import { App, Alert, Button, Form, Input, Modal, Select, Space, Table, Tabs, Tag, Typography } from 'antd'
import { cloudFactoryRequest as request } from '../api'
type Factory = {id:number;name:string;enterprise:string;region:string;category:string;description:string;baseRef:string;productKeyword:string;traceCode:string;status:string;media:Media[]}
type Media = {title:string;kind:string;url:string;capturedAt:string;description:string}
type Visit = {id:number;factoryName:string;contact:string;phone:string;purpose:string;requestedAt:string;status:string;note:string}
const states: Record<string,string>={draft:'草稿',published:'已发布',offline:'已下线',pending:'待确认',confirmed:'已确认',completed:'已完成',rejected:'未通过',cancelled:'已取消'}
const categories=['粮油产业','果蔬产业','畜禽产业','茶药产业','饲料农资','水产产业','预制菜','冷链物流']
export function CloudFactoriesPage(): JSX.Element {
  const { message, modal }=App.useApp()
  const [rows,setRows]=useState<Factory[]>([]),[visits,setVisits]=useState<Visit[]>([]),[busy,setBusy]=useState(false),[editing,setEditing]=useState<Factory|Partial<Factory>|null>(null),[handling,setHandling]=useState<Visit|null>(null)
  const [reportVisit,setReportVisit]=useState<Visit|null>(null)
  const [form]=Form.useForm(),[handleForm]=Form.useForm()
  const report=(e:unknown):void=>{void message.error((e as Error).message)}
  async function load():Promise<void>{setBusy(true);try{const [a,b]=await Promise.all([request<Factory[]>('/cloud-factories'),request<Visit[]>('/cloud-factory-visits')]);setRows(a);setVisits(b)}catch(e){report(e)}finally{setBusy(false)}}
  useEffect(()=>{void load()},[])
  async function edit(id?:number):Promise<void>{try{const d=id?await request<Factory>(`/cloud-factories/${id}`):{media:[]};setEditing(d);form.setFieldsValue(d)}catch(e){report(e)}}
  async function save():Promise<void>{try{const b=await form.validateFields();setBusy(true);await request(editing?.id?`/cloud-factories/${editing.id}`:'/cloud-factories',{...b,media:b.media||[]},editing?.id?'PUT':'POST');setEditing(null);form.resetFields();void message.success('已保存为草稿，请复核后发布');await load()}catch(e){report(e)}finally{setBusy(false)}}
  function publish(row:Factory,status:string):void{modal.confirm({title:status==='published'?'确认审核发布基地实景？':'确认下线基地？',content:status==='published'?'请确认素材获得公开展示授权，拍摄时间准确，内容不包含设备密钥、人员隐私或内部经营资料。':'下线后门户不再展示，已有预约仍可处理。',onOk:async()=>{try{await request(`/cloud-factories/${row.id}/status`,{status});await load()}catch(e){report(e);throw e}}})}
  async function handle():Promise<void>{if(!handling)return;try{const b=await handleForm.validateFields();setBusy(true);await request(`/cloud-factory-visits/${handling.id}/status`,b);setHandling(null);handleForm.resetFields();await load()}catch(e){report(e)}finally{setBusy(false)}}
  return <div><Space style={{width:'100%',justifyContent:'space-between',marginBottom:20}}><div><Typography.Title level={3}>VR 云工厂</Typography.Title><Typography.Text type="secondary">实景资料审核、在线看货入口与远程验厂预约</Typography.Text></div><Space><Button onClick={()=>void load()} loading={busy}>刷新</Button><Button type="primary" onClick={()=>void edit()}>新增基地展示</Button></Space></Space>
    <Alert type="info" showIcon message="领域边界与素材要求" description="基地引用关联生产域标识；物联网管理设备及媒体分发，交易域维护货源，溯源域核验单品码。这里只编排公开资料和验厂服务，不把预约完成标为认证通过。全景采用2:1等距柱状图；外部素材需允许跨域读取；视频/直播须提供浏览器可播放且不含密钥的媒体地址。" style={{marginBottom:20}}/>
    <Tabs items={[{key:'factories',label:'基地展示',children:<Table rowKey="id" loading={busy} dataSource={rows} pagination={{pageSize:10}} scroll={{x:950}} columns={[
      {title:'基地',dataIndex:'name'},{title:'企业',dataIndex:'enterprise'},{title:'地区',dataIndex:'region'},{title:'产业',dataIndex:'category'},{title:'状态',dataIndex:'status',render:(s:string)=><Tag color={s==='published'?'green':'default'}>{states[s]}</Tag>},
      {title:'操作',render:(_:unknown,r:Factory)=><Space><Button type="link" onClick={()=>void edit(r.id)}>编辑</Button><Button type="link" onClick={()=>publish(r,r.status==='published'?'offline':'published')}>{r.status==='published'?'下线':'审核发布'}</Button></Space>}
    ]}/>},{key:'visits',label:`验厂预约（待确认 ${visits.filter(v=>v.status==='pending').length}）`,children:<Table rowKey="id" dataSource={visits} loading={busy} pagination={{pageSize:10}} scroll={{x:1100}} columns={[
      {title:'基地',dataIndex:'factoryName'},{title:'联系人',dataIndex:'contact'},{title:'联系电话',dataIndex:'phone'},{title:'预约时间（北京时间）',dataIndex:'requestedAt'},{title:'核验需求',dataIndex:'purpose',ellipsis:true},{title:'状态',dataIndex:'status',render:(s:string)=>states[s]||s},{title:'处理说明',dataIndex:'note',ellipsis:true},{title:'操作',render:(_:unknown,r:Visit)=><Space><Button type="link" disabled={!['pending','confirmed'].includes(r.status)} onClick={()=>{setHandling(r);handleForm.resetFields()}}>处理预约</Button><Button type="link" disabled={!['confirmed','completed'].includes(r.status)} onClick={()=>setReportVisit(r)}>验厂报告</Button></Space>}
    ]}/>}]} />
    {reportVisit&&<FactoryReportEditor visit={reportVisit} onClose={()=>setReportVisit(null)}/>}
    <Modal width={850} title={editing?.id?'编辑基地展示（保存后重新审核）':'新增基地展示'} open={editing!==null} destroyOnClose onCancel={()=>{setEditing(null);form.resetFields()}} onOk={()=>void save()} confirmLoading={busy}>
      <Form form={form} layout="vertical">
        {[['name','基地名称',120],['enterprise','所属企业',120],['region','地区',120]].map(([key,label,max])=><Form.Item key={key} name={key} label={label} rules={[{required:true,message:'请填写'}]}><Input maxLength={Number(max)}/></Form.Item>)}
        <Form.Item name="category" label="产业分类" rules={[{required:true}]}><Select options={categories.map(value=>({value,label:value}))}/></Form.Item>
        <Form.Item name="description" label="公开基地介绍" rules={[{required:true}]}><Input.TextArea maxLength={2000} rows={3} showCount/></Form.Item>
        <Form.Item name="baseRef" label="生产域基地标识（引用，不代表已自动绑定）"><Input maxLength={100}/></Form.Item>
        <Form.Item name="productKeyword" label="关联货源搜索关键词（不是库存承诺）"><Input maxLength={80}/></Form.Item>
        <Form.Item name="traceCode" label="关联公开溯源码（由溯源页独立核验）"><Input maxLength={100}/></Form.Item>
        <Typography.Title level={5}>已授权实景素材</Typography.Title>
        <Form.List name="media">{(fields,{add,remove})=><>{fields.map(field=><div key={field.key} style={{border:'1px solid #e1e9e3',padding:16,marginBottom:16,borderRadius:10}}><Space style={{width:'100%',justifyContent:'space-between'}}><strong>素材 {field.name+1}</strong><Button danger type="link" onClick={()=>remove(field.name)}>移除本条</Button></Space>
          <Form.Item name={[field.name,'title']} label="素材标题" rules={[{required:true}]}><Input maxLength={120}/></Form.Item>
          <Form.Item name={[field.name,'kind']} label="素材类型" rules={[{required:true}]}><Select options={[{value:'panorama',label:'360° 全景图（2:1）'},{value:'image',label:'实景照片'},{value:'video',label:'实景录像'},{value:'live',label:'直播媒体信号'}]}/></Form.Item>
          <Form.Item name={[field.name,'url']} label="平台资源路径 / HTTPS 媒体地址（不含密钥和查询参数）" rules={[{required:true}]}><Input maxLength={1500}/></Form.Item>
          <Form.Item name={[field.name,'capturedAt']} label="拍摄时间 / 直播配置时间（北京时间，YYYY-MM-DD HH:mm:ss）" rules={[{required:true}]}><Input maxLength={40}/></Form.Item>
          <Form.Item name={[field.name,'description']} label="场景说明 / 素材授权说明"><Input.TextArea maxLength={300}/></Form.Item>
        </div>)}<Button disabled={fields.length>=20} onClick={()=>add({kind:'panorama'})}>添加实景素材（最多20项）</Button></>}</Form.List>
      </Form>
    </Modal>
    <Modal title={`处理验厂预约 · ${handling?.factoryName||''}`} open={handling!==null} onCancel={()=>setHandling(null)} onOk={()=>void handle()} confirmLoading={busy} destroyOnClose><p>{handling?.purpose}</p><Form form={handleForm} layout="vertical"><Form.Item name="status" label="处理结果" rules={[{required:true}]}><Select options={(handling?.status==='pending'?['confirmed','rejected']:['completed','cancelled']).map(value=>({value,label:states[value]}))}/></Form.Item><Form.Item name="note" label="用户可见的安排 / 材料核验结果与处理说明" rules={[{required:true,whitespace:true}]}><Input.TextArea rows={5} maxLength={1000} showCount/></Form.Item></Form></Modal>
  </div>
}
