import {useEffect,useState} from 'react'
import {Alert,App,Button,Card,Empty,Form,Input,Modal,Select,Space,Spin,Switch,Tag} from 'antd'
import {PlusOutlined,ReloadOutlined} from '@ant-design/icons'
import {opsApi,type RegulatoryScope} from './api'
import './scope-config.css'

const DUTIES=[{value:'inspection',label:'执法检查'},{value:'sampling',label:'监督抽检'},{value:'case',label:'案件处置'},{value:'credit',label:'信用监管'},{value:'complaint',label:'举报处理'},{value:'statistics',label:'监管统计'}]
export default function ScopeConfig(){
  const {message}=App.useApp()
  const [rows,setRows]=useState<RegulatoryScope[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('')
  const [keyword,setKeyword]=useState(''),[status,setStatus]=useState('all'),[open,setOpen]=useState(false),[saving,setSaving]=useState(false)
  const [editing,setEditing]=useState<RegulatoryScope|null>(null)
  const [form]=Form.useForm<RegulatoryScope>()
  async function load(){setLoading(true);setError('');try{setRows(await opsApi.scopes())}catch(e){setError(e instanceof Error?e.message:'加载失败')}finally{setLoading(false)}}
  useEffect(()=>{void load()},[])
  function edit(row:RegulatoryScope|null){setEditing(row);form.resetFields();form.setFieldsValue(row?{...row,regions:row.regions.map(r=>({...r,duties:[...r.duties]}))}:{organizationCode:'',organizationName:'',status:'enabled',note:'',regions:[{code:'',name:'',includeChildren:false,duties:[]}]});setOpen(true)}
  async function save(){
    let values:RegulatoryScope
    try{values=await form.validateFields()}catch{return}
    setSaving(true)
    try{
      const saved=await opsApi.saveScope({...values,version:editing?.version},editing?.id)
      setRows(old=>[saved,...old.filter(r=>r.id!==saved.id)]);setOpen(false)
      message.success('监管范围已登记，未自动授予人员执法权限')
    }catch(e){message.error(e instanceof Error?e.message:'保存失败')}finally{setSaving(false)}
  }
  const filtered=rows.filter(r=>(status==='all'||r.status===status)&&`${r.organizationName} ${r.organizationCode} ${r.regions.map(a=>a.name+' '+a.code).join(' ')}`.toLowerCase().includes(keyword.trim().toLowerCase()))
  return <div className="scope-page">
    <div className="o-title"><div><span>监管组织与职责</span><h1>监管范围配置</h1><p>登记机构管辖地区与监管职责，建立清晰的监管边界。</p></div><Button type="primary" icon={<PlusOutlined/>} onClick={()=>edit(null)}>新增机构范围</Button></div>
    <Alert type="info" showIcon message="当前为范围配置登记" description="保存不会自动授予执法权。人员授权请前往“监管人员授权”配置；各业务接口的辖区过滤尚未全面接入本配置，登记状态不代表数据隔离已生效。行政区划代码请以正式资料为准。"/>
    <div className="scope-summary"><Card><span>已登记机构</span><strong>{rows.length}</strong></Card><Card><span>启用登记</span><strong>{rows.filter(r=>r.status==='enabled').length}</strong></Card><Card><span>辖区配置条目</span><strong>{rows.reduce((n,r)=>n+r.regions.length,0)}</strong></Card></div>
    <div className="scope-toolbar"><Input.Search allowClear placeholder="搜索机构名称、机构代码或辖区" value={keyword} onChange={e=>setKeyword(e.target.value)}/><Select aria-label="登记状态" value={status} onChange={setStatus} options={[{value:'all',label:'全部登记状态'},{value:'enabled',label:'启用登记'},{value:'disabled',label:'停用登记'}]}/><Button icon={<ReloadOutlined/>} onClick={()=>void load()} loading={loading}>刷新</Button></div>
    {error?<Alert type="error" showIcon message={error} action={<Button onClick={()=>void load()}>重试</Button>}/>:loading?<div className="scope-loading"><Spin/></div>:filtered.length===0?<Card><Empty description={rows.length?'没有匹配的配置':'尚未登记监管机构范围'}>{!rows.length&&<Button type="primary" onClick={()=>edit(null)}>登记首个机构</Button>}</Empty></Card>:<div className="scope-grid">{filtered.map(row=><Card key={row.id} className="scope-card"><div className="scope-card-heading"><div><h2>{row.organizationName}</h2><small>机构代码 · {row.organizationCode}</small></div><Tag color={row.status==='enabled'?'green':'default'}>{row.status==='enabled'?'启用登记':'停用登记'}</Tag></div><div className="scope-regions">{row.regions.map(r=><section key={r.code}><div><b>{r.name}</b><span>{r.code}</span></div><p>{r.includeChildren?'包含下级行政区域（登记范围）':'仅所选行政区域'}</p><Space size={[4,6]} wrap>{r.duties.map(d=><Tag key={d}>{DUTIES.find(x=>x.value===d)?.label||d}</Tag>)}</Space></section>)}</div>{row.note&&<p className="scope-note">{row.note}</p>}<footer><small>更新于 {row.updatedAt?.replace('T',' ').slice(0,19)} · 第 {row.version} 版</small><Button onClick={()=>edit(row)}>编辑范围</Button></footer></Card>)}</div>}
    <Modal title={editing?'编辑监管范围':'新增监管机构范围'} open={open} width={760} confirmLoading={saving} okText="保存登记" cancelText="取消" onOk={()=>void save()} onCancel={()=>{if(!saving)setOpen(false)}} maskClosable={!saving} closable={!saving} cancelButtonProps={{disabled:saving}}>
      <Form form={form} layout="vertical" disabled={saving} className="scope-form">
        <div className="scope-fields"><Form.Item name="organizationName" label="机构全称" rules={[{required:true,whitespace:true,message:'请填写机构全称'}]}><Input maxLength={160} placeholder="填写正式机构名称"/></Form.Item><Form.Item name="organizationCode" label="机构代码" extra="使用机构统一代码或稳定的内部编码，不使用市场编号" rules={[{required:true,message:'请填写机构代码'},{pattern:/^[A-Za-z0-9_-]{1,64}$/,message:'限64位以内字母、数字、下划线或短横线'}]}><Input maxLength={64}/></Form.Item></div>
        <Form.Item name="status" label="登记状态" rules={[{required:true}]}><Select options={[{value:'enabled',label:'启用登记'},{value:'disabled',label:'停用登记'}]}/></Form.Item>
        <Form.List name="regions" rules={[{validator:async(_,regions)=>{if(!regions?.length)throw new Error('请至少登记一个辖区');if(regions.length>100)throw new Error('最多登记100个辖区');const codes=regions.map((r:{code?:string})=>r?.code?.trim()).filter(Boolean);if(new Set(codes).size!==codes.length)throw new Error('辖区代码不能重复')}}]}>{(fields,{add,remove},{errors})=><><div className="scope-section-title"><b>管辖地区与职责</b><span>职责按辖区分别登记</span></div>{fields.map(({key,name,...rest})=><div className="scope-region-form" key={key}><div className="scope-card-heading"><b>辖区 {name+1}</b><Button danger type="text" disabled={fields.length===1} onClick={()=>remove(name)}>移除条目</Button></div><div className="scope-fields"><Form.Item {...rest} name={[name,'name']} label="辖区名称" rules={[{required:true,whitespace:true,message:'请填写辖区名称'}]}><Input maxLength={160} placeholder="填写完整行政区域名称"/></Form.Item><Form.Item {...rest} name={[name,'code']} label="行政区划代码" rules={[{required:true,message:'请填写代码'},{pattern:/^(?:[1-9]\d{5}|[1-9]\d{8}|[1-9]\d{11})$/,message:'请输入6、9或12位行政区划代码'}]}><Input maxLength={12}/></Form.Item></div><Form.Item {...rest} name={[name,'includeChildren']} label="包含下级行政区域" valuePropName="checked"><Switch checkedChildren="包含" unCheckedChildren="不包含"/></Form.Item><Form.Item {...rest} name={[name,'duties']} label="承担职责" rules={[{required:true,type:'array',min:1,message:'至少选择一项职责'}]}><Select mode="multiple" optionFilterProp="label" options={DUTIES} placeholder="选择该辖区内承担的职责"/></Form.Item></div>)}<Form.ErrorList errors={errors}/><Button block type="dashed" icon={<PlusOutlined/>} disabled={fields.length>=100} onClick={()=>add({code:'',name:'',includeChildren:false,duties:[]})}>增加辖区</Button></>}</Form.List>
        <Form.Item name="note" label="职责依据与备注"><Input.TextArea rows={3} maxLength={1000} showCount placeholder="可填写职责依据、授权文件编号及边界说明"/></Form.Item>
      </Form>
    </Modal>
  </div>
}
