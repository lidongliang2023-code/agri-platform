import { useEffect, useState } from 'react'
import { App, Alert, Button, Form, Input, Modal, Select, Space, Tag, Typography } from 'antd'
import { cloudFactoryRequest as request } from '../api'
type Report = {status:string;revision?:number;review_note?:string;reportNo?:string;[key:string]:unknown}
const statusLabels:Record<string,string>={empty:'尚未编写',draft:'草稿',review:'待审核',returned:'已退回 / 撤回',published:'已发布'}
const results=[{value:'consistent',label:'核验一致'},{value:'issue',label:'发现问题'},{value:'unverified',label:'未能核验'},{value:'na',label:'不适用'}]
export function FactoryReportEditor({visit,onClose}:{visit:{id:number;factoryName:string;status:string};onClose:()=>void}):JSX.Element{
  const {message}=App.useApp(),[form]=Form.useForm(),[report,setReport]=useState<Report>({status:'empty'}),[busy,setBusy]=useState(true),[note,setNote]=useState('')
  const path=`/cloud-factory-visits/${visit.id}/report`,locked=['review','published'].includes(report.status)
  function apply(r:Report):void{setReport(r);form.resetFields();form.setFieldsValue(r.status==='empty'?{method:'combined',conclusion:'insufficient',items:[{name:'生产环境与设施',result:'unverified'},{name:'产品与批次资料',result:'unverified'},{name:'质量材料与溯源',result:'unverified'}]}:r)}
  useEffect(()=>{let active=true;request<Report>(path).then(r=>{if(active)apply(r)}).catch(e=>{void message.error((e as Error).message)}).finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[path])
  async function save():Promise<void>{try{const body=await form.validateFields();setBusy(true);apply(await request<Report>(path,{...body,revision:report.revision||0}));void message.success('报告草稿已保存')}catch(e){void message.error((e as Error).message||'请完善表单')}finally{setBusy(false)}}
  async function transition(status:string):Promise<void>{if(!note.trim()){void message.warning('请填写审核或流转说明');return}setBusy(true);try{apply(await request<Report>(`${path}/status`,{status,note,revision:report.revision}));setNote('');void message.success('报告状态已更新')}catch(e){void message.error((e as Error).message)}finally{setBusy(false)}}
  return <Modal open width={950} title={`验厂报告 · ${visit.factoryName}`} onCancel={onClose} footer={<Button onClick={onClose}>关闭</Button>}>
    <Alert showIcon type="info" message="报告描述本次远程核验范围，不等同于认证或检测结论" description="证据仅填写已授权且可向预约人展示的资源。编写人与审核人须不同；预约完成后方可发布。"/>
    <Space style={{margin:'16px 0'}}><Tag>{statusLabels[report.status]}</Tag><span>{report.reportNo} · 版本 {report.revision||0}</span></Space>
    {report.review_note&&<p>流转说明：{report.review_note}</p>}
    <Form form={form} layout="vertical" disabled={busy||locked}>
      <Form.Item name="title" label="报告标题" rules={[{required:true,whitespace:true}]}><Input maxLength={120}/></Form.Item>
      <Space align="start"><Form.Item name="inspector" label="核验人员 / 团队" rules={[{required:true}]}><Input maxLength={120}/></Form.Item><Form.Item name="inspectedAt" label="实际核验时间（北京时间）" rules={[{required:true}]}><Input placeholder="YYYY-MM-DD HH:mm:ss"/></Form.Item><Form.Item name="method" label="核验方式" rules={[{required:true}]}><Select style={{width:180}} options={[{value:'video',label:'远程视频核验'},{value:'materials',label:'材料核验'},{value:'combined',label:'视频与材料综合核验'}]}/></Form.Item></Space>
      <Form.Item name="scope" label="核验范围、产品及批次" rules={[{required:true}]}><Input.TextArea maxLength={2000} rows={2}/></Form.Item>
      <Typography.Title level={5}>逐项核验记录</Typography.Title>
      <Form.List name="items">{(fields,{add,remove})=><>{fields.map(field=><div key={field.key} style={{borderTop:'1px solid #ddd',paddingTop:16}}><Space><strong>核验项 {field.name+1}</strong><Button onClick={()=>remove(field.name)} danger>移除</Button></Space><Form.Item name={[field.name,'name']} label="检查项" rules={[{required:true}]}><Input maxLength={1000}/></Form.Item><Form.Item name={[field.name,'result']} label="核验结果" rules={[{required:true}]}><Select options={results}/></Form.Item><Form.Item name={[field.name,'finding']} label="事实与发现" rules={[{required:true}]}><Input.TextArea maxLength={1000}/></Form.Item><Form.Item name={[field.name,'evidence']} label="证据地址（平台资源或不含参数的HTTPS地址）"><Input maxLength={1500}/></Form.Item><Form.Item name={[field.name,'action']} label="整改要求（发现问题时必填）"><Input.TextArea maxLength={1000}/></Form.Item><Form.Item name={[field.name,'dueDate']} label="整改期限（YYYY-MM-DD）"><Input maxLength={10}/></Form.Item></div>)}<Button disabled={fields.length>=30||locked||busy} onClick={()=>add({result:'unverified'})}>添加核验项</Button></>}</Form.List>
      <Form.Item name="conclusion" label="总体结果" rules={[{required:true}]}><Select options={[{value:'consistent',label:'核验范围内一致'},{value:'rectification',label:'需整改 / 复核'},{value:'insufficient',label:'证据不足，暂不能判断'}]}/></Form.Item>
      {([['summary','总体说明'],['limitations','核验局限与未覆盖事项'],['followUp','后续跟进安排']] as const).map(([key,label])=><Form.Item key={key} name={key} label={label} rules={[{required:key!=='followUp'}]}><Input.TextArea rows={3} maxLength={2000}/></Form.Item>)}
      {!locked&&<Button type="primary" loading={busy} onClick={()=>void save()}>保存草稿</Button>}
    </Form>
    {report.status!=='empty'&&<div style={{marginTop:20}}><Input.TextArea value={note} onChange={e=>setNote(e.target.value)} maxLength={1000} placeholder="填写提交、审核、退回或撤回说明"/><Space wrap style={{marginTop:12}}>{['draft','returned'].includes(report.status)&&<Button disabled={busy||form.isFieldsTouched()} onClick={()=>void transition('review')}>提交审核（先保存修改）</Button>}{report.status==='review'&&<><Button disabled={busy} onClick={()=>void transition('returned')}>退回修改</Button><Button type="primary" disabled={busy||visit.status!=='completed'} onClick={()=>void transition('published')}>审核并发布</Button></>}{report.status==='published'&&<Button danger disabled={busy} onClick={()=>void transition('returned')}>撤回报告</Button>}</Space></div>}
  </Modal>
}
