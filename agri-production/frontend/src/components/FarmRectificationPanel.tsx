import '@/components/ProductionDetailCompact.css'
import '@/pages/admin/farms/FarmSupervisionCompact.css'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Drawer, Form, Input, Modal, Select, Space, Tag, DatePicker } from 'antd'
import type { ProColumns } from '@ant-design/pro-components'
import ProTable from '@/components/ProductionTable'
import useAuthStore from '@/store/auth'
import Card from '@/components/SectionCard'
import DetailInfoGrid from '@/components/DetailInfoGrid'
import { checkStates, supervisionChecks, readCheck, registerCheck, submitRectification, reviewRectification } from '@/api/admin/farm-supervision'
import type { CheckRecord } from '@/api/admin/farm-supervision'
export default function FarmRectificationPanel({farmId,user=false}:{farmId?:string;user?:boolean}):JSX.Element {
 const subject=useAuthStore(s=>s.userInfo?.tenantId)
 return <Panel key={`${subject}-${farmId}-${user}`} farmId={farmId} user={user}/>
}
function Panel({farmId,user}:{farmId?:string;user:boolean}):JSX.Element {
 const {message}=App.useApp();const [page,setPage]=useState(1);const [size,setSize]=useState(20);const [status,setStatus]=useState<string>();const [detail,setDetail]=useState<CheckRecord>();const [open,setOpen]=useState(false);const [target,setTarget]=useState<CheckRecord>();const [busy,setBusy]=useState(false);const [form]=Form.useForm();const [actionForm]=Form.useForm()
 const result=Form.useWatch('result',form)
 const queryClient=useQueryClient()
 const refresh=()=>Promise.all([queryClient.invalidateQueries({queryKey:['farm-checks']}),queryClient.invalidateQueries({queryKey:['supervision-detail']})])
 const q=useQuery({queryKey:['farm-checks',user,farmId,page,size,status],queryFn:()=>supervisionChecks({farmId,pageNum:page,pageSize:size,rectifyStatus:status},user),retry:false,refetchOnWindowFocus:true})
 const save=async()=>{let v;try{v=await form.validateFields()}catch{return}setBusy(true);let written=false;try{const saved=await registerCheck({...v,farmId,rectifyDeadline:v.rectifyDeadline?.format('YYYY-MM-DD')});written=true;await refresh();const read=await readCheck(saved.checkId);if(read.checkId!==saved.checkId||String(read.farmId)!==String(farmId))throw new Error('回读不一致');setOpen(false);message.success('检查已保存并回读确认')}catch(e){message.error(`${written?'已保存，回读未完成，请刷新核对：':''}${(e as Error).message}`)}finally{setBusy(false)}}
 const act=async()=>{let v;try{v=await actionForm.validateFields()}catch{return}if(!target)return;setBusy(true);let written=false;try{const saved=user?await submitRectification(target.checkId,v.remark):await reviewRectification(target.checkId,v.approved,v.remark);written=true;await refresh();const read=await readCheck(target.checkId,user);if(read.rectifyStatus!==saved.rectifyStatus||read.rectifyRemark!==saved.rectifyRemark)throw new Error('状态或历史回读不一致');setTarget(undefined);setDetail(undefined);message.success('处置已保存并回读确认')}catch(e){message.error(`${written?'已保存，回读未完成，请刷新核对：':''}${(e as Error).message}`)}finally{setBusy(false)}}
 const cols:ProColumns<CheckRecord>[]=[{title:'检查编号',dataIndex:'checkId',width:230,ellipsis:true},{title:'农场',dataIndex:'farmName',width:180},{title:'检查事项',dataIndex:'checkItem',width:240,ellipsis:true},{title:'结论',width:120,render:(_,r)=><Tag color={r.result===1?'green':r.result===3?'red':'orange'}>{r.result===1?'合规':r.result===2?'限期整改':r.result===3?'严重违规':'待补录'}</Tag>},{title:'整改状态',width:150,render:(_,r)=><Space direction="vertical" size={0}><span>{checkStates[r.rectifyStatus]??'未知状态'}</span>{r.rectifyDeadline&&r.rectifyDeadline<new Date().toLocaleDateString('sv-SE')&&!['rectified','none'].includes(r.rectifyStatus)&&<Tag color="red">已逾期</Tag>}</Space>},{title:'整改期限',dataIndex:'rectifyDeadline',width:140},{title:'检查人',dataIndex:'checkerName',width:180},{title:'检查时间',dataIndex:'checkedAt',width:185},{title:'操作',valueType:'option',fixed:'right',width:190,render:(_,r)=><Space><Button type="link" onClick={async()=>{try{setDetail(await readCheck(r.checkId,user))}catch(e){message.error((e as Error).message)}}}>详情</Button>{(user?['pending','processing','overdue'].includes(r.rectifyStatus):r.rectifyStatus==='reviewing')&&<Button type="link" onClick={()=>{setTarget(r);actionForm.resetFields()}}>{user?'提交整改':'复核'}</Button>}</Space>}]
 return <Space direction="vertical" size={12} style={{width:'100%'}}>
 <Alert type="info" showIcon message={user?'整改提交后由运营复核，复核通过后关闭':'检查登记 → 经营主体提交整改 → 运营复核'} description="检查结论不代替主体认证、质检判定或政府行政执法。仅登记实际检查事实；未整改问题不会因填写备注自动关闭。"/>
 {q.isError&&<Alert type="error" message="检查台账读取失败" description={(q.error as Error).message} action={<Button onClick={()=>void q.refetch()}>重试</Button>}/>}
 <Card title={user?'监管检查与整改':'检查与整改台账'}><ProTable<CheckRecord> rowKey="checkId" columns={cols} dataSource={q.isError?[]:q.data?.list??[]} loading={q.isFetching} search={false} scroll={{x:1600}} columnWidthStorageKey={`farm-checks-${user}`} columnsState={{persistenceKey:`farm-checks-columns-${user}`,persistenceType:'localStorage'}} options={{reload:()=>void q.refetch()}} toolbar={{actions:[<Select key="status" allowClear style={{width:160}} placeholder="全部整改状态" value={status} options={Object.entries(checkStates).map(([value,label])=>({value,label}))} onChange={v=>{setStatus(v);setPage(1)}}/>,...(!user&&farmId?[<Button key="create" type="primary" onClick={()=>{form.resetFields();form.setFieldsValue({checkType:'常规检查',result:1});setOpen(true)}}>登记检查</Button>]:[])]}} pagination={{current:page,pageSize:size,total:q.data?.total??0,showSizeChanger:true,onChange:(p,s)=>{setPage(s===size?p:1);setSize(s)}}}/></Card>
 <Drawer rootClassName={user ? "production-detail-compact production-detail-dialog" : "farm-supervision-compact"} title="检查与整改详情" width={720} open={!!detail} onClose={()=>setDetail(undefined)}>{detail&&<Space direction="vertical" size={12} style={{width:'100%'}}>
 <Card title="检查信息" extra={<Tag color={detail.result===1?'green':detail.result===3?'red':'orange'}>{detail.result===1?'合规':detail.result===2?'限期整改':detail.result===3?'严重违规':'待补录'}</Tag>}><DetailInfoGrid items={[
 {key:'code',label:'检查编号',value:detail.checkId},{key:'farm',label:'所属农场',value:detail.farmName},
 {key:'type',label:'检查类型',value:detail.checkType},{key:'checker',label:'检查人',value:detail.checkerName},
 {key:'time',label:'检查时间',value:detail.checkedAt},{key:'status',label:'整改状态',value:checkStates[detail.rectifyStatus]??'未知状态'},
 {key:'item',label:'检查事项与依据',value:detail.checkItem,fullWidth:true},
 ]}/></Card>
 <Card title="问题与整改"><DetailInfoGrid items={[
 {key:'problem',label:'问题事实',value:<span style={{whiteSpace:'pre-wrap'}}>{detail.problem||'—'}</span>,fullWidth:true},
 {key:'requirement',label:'整改要求',value:<span style={{whiteSpace:'pre-wrap'}}>{detail.rectifyRequirement||'—'}</span>,fullWidth:true},
 {key:'deadline',label:'整改期限',value:detail.rectifyDeadline},{key:'rectified',label:'复核通过时间',value:detail.rectifiedAt},
 {key:'history',label:'处置历史',value:<span style={{whiteSpace:'pre-wrap'}}>{detail.rectifyRemark||'暂无处置记录'}</span>,fullWidth:true},
 ]}/></Card></Space>}</Drawer>
 <Modal className="production-form-dialog" title="登记实际检查" open={open} confirmLoading={busy} closable={!busy} maskClosable={false} cancelButtonProps={{disabled:busy}} onCancel={()=>setOpen(false)} onOk={()=>void save()}><Form form={form} layout="vertical"><Form.Item name="checkType" label="检查类型" rules={[{required:true}]}><Select options={['常规检查','禁限用农资抽查','记录缺失督导'].map(value=>({value,label:value}))}/></Form.Item><Form.Item name="checkItem" label="检查事项与依据" rules={[{required:true}]}><Input.TextArea maxLength={200} showCount/></Form.Item><Form.Item name="result" label="检查结论" rules={[{required:true}]}><Select options={[{value:1,label:'合规'},{value:2,label:'限期整改'},{value:3,label:'严重违规'}]}/></Form.Item>{result>1&&<><Form.Item name="problem" label="问题事实" rules={[{required:true}]}><Input.TextArea maxLength={500}/></Form.Item><Form.Item name="rectifyRequirement" label="整改要求" rules={[{required:true}]}><Input.TextArea maxLength={500}/></Form.Item><Form.Item name="rectifyDeadline" label="整改期限" rules={[{required:true}]}><DatePicker/></Form.Item></>}</Form></Modal>
 <Modal className="production-form-dialog" title={user?'提交整改结果':'运营整改复核'} open={!!target} confirmLoading={busy} closable={!busy} maskClosable={false} cancelButtonProps={{disabled:busy}} onCancel={()=>setTarget(undefined)} onOk={()=>void act()}><Alert type="info" message="请填写实际结果及凭据编号，不要填入个人隐私信息。处置历史容量500字，超限将拒绝保存。" style={{marginBottom:16}}/><Form form={actionForm} layout="vertical">{!user&&<Form.Item name="approved" label="复核结论" rules={[{required:true}]}><Select options={[{value:true,label:'依据充分，复核通过'},{value:false,label:'依据不足，退回整改'}]}/></Form.Item>}<Form.Item name="remark" label={user?'整改事实与凭据说明':'复核事实与依据'} rules={[{required:true,whitespace:true}]}><Input.TextArea rows={4} maxLength={200} showCount/></Form.Item></Form></Modal>
 </Space>
}
