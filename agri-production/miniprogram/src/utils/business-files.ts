import { call, type Row, type Resource, fetchResource } from '@/api/native-business'
import { productionContextVersion, TOKEN_KEY, SUBJECT_KEY } from './request'
import { apiBase, serviceOrigin } from './runtime'
declare const wx: any
declare const plus: any
export interface Column { key: string; label: string }
export function csv(rows: Row[], columns: Column[]): string {
 const cell=(v:any)=>{let s=v==null?'':typeof v==='object'?JSON.stringify(v):String(v);if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
 return '\uFEFF'+[columns.map(c=>cell(c.label)).join(','),...rows.map(r=>columns.map(c=>cell(r[c.key])).join(','))].join('\r\n')
}
export function parseCsv(input:string):Row[]{
 const source=input.replace(/^\uFEFF/,'');const lines:string[][]=[];let line:string[]=[],cell='',quoted=false,closed=false
 for(let i=0;i<source.length;i++){const c=source[i];if(quoted){if(c==='"'){if(source[i+1]==='"'){cell+='"';i++}else{quoted=false;closed=true}}else cell+=c;continue}
 if(c==='"'){if(cell||closed)throw new Error('CSV 引号位置无效');quoted=true}else if(c===','){line.push(cell);cell='';closed=false}else if(c==='\n'||c==='\r'){if(c==='\r'&&source[i+1]==='\n')i++;line.push(cell);if(line.some(x=>x.trim()))lines.push(line);line=[];cell='';closed=false}else{if(closed&&!/\s/.test(c))throw new Error('CSV 引号后应为分隔符');if(!closed)cell+=c}}
 if(quoted)throw new Error('CSV 引号未闭合');line.push(cell);if(line.some(x=>x.trim()))lines.push(line)
 if(!lines.length)throw new Error('文件内容为空');const headers=lines.shift()!.map(x=>x.trim());if(new Set(headers).size!==headers.length||headers.some(x=>!x))throw new Error('表头不能为空或重复')
 if(lines.length>500)throw new Error('单次最多导入500行，请拆分文件');return lines.map((row,i)=>{if(row.length!==headers.length)throw new Error(`第${i+2}行列数与表头不一致`);return Object.fromEntries(headers.map((h,j)=>[h,row[j].trim()]))})
}
export function contextGuard(){const v=productionContextVersion(),token=uni.getStorageSync(TOKEN_KEY),subject=uni.getStorageSync(SUBJECT_KEY);return ()=>{if(v!==productionContextVersion()||token!==uni.getStorageSync(TOKEN_KEY)||subject!==uni.getStorageSync(SUBJECT_KEY))throw new Error('账号、主体或农场已变化，请重新打开页面')}}
export async function allRows(resource:Resource,params:Row={},guard=contextGuard()):Promise<Row[]>{
 const rows:Row[]=[];const ids=new Set<string>();let expected:number|undefined
 for(let page=1;page<=2500;page++){guard();const data=await fetchResource(resource,params,page);guard();if(expected===undefined)expected=data.total;else if(expected!==data.total)throw new Error('查询期间总数变化，请重新导出');if(expected>50000)throw new Error('超过5万条，请缩小筛选范围')
 for(const row of data.list){const key=String(row[resource.id||'id']??JSON.stringify(row));if(ids.has(key))throw new Error('分页结果重复，请刷新后重试');ids.add(key);rows.push(row)}
 if(rows.length===expected)return rows;if(!data.list.length||rows.length>expected)throw new Error('分页数据不完整，已停止导出')}
 throw new Error('数据过多，请缩小筛选范围')
}
export async function saveText(name:string,content:string):Promise<void>{
 const filename=(Date.now()+'-'+name).replace(/[\\/:*?"<>|]/g,'_')
 // #ifdef H5
 const url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return
 // #endif
 // #ifdef MP-WEIXIN
 const path=wx.env.USER_DATA_PATH+'/'+filename;await new Promise<void>((resolve,reject)=>wx.getFileSystemManager().writeFile({filePath:path,data:content,encoding:'utf8',success:()=>resolve(),fail:reject}));await new Promise<void>((resolve,reject)=>wx.shareFileMessage({filePath:path,fileName:filename,success:()=>resolve(),fail:reject}));return
 // #endif
 // #ifdef APP-PLUS
 const entry:any=await new Promise((resolve,reject)=>plus.io.resolveLocalFileSystemURL('_doc/',resolve,reject));const file:any=await new Promise((resolve,reject)=>entry.getFile(filename,{create:true},resolve,reject));const writer:any=await new Promise((resolve,reject)=>file.createWriter(resolve,reject));await new Promise<void>((resolve,reject)=>{writer.onerror=reject;writer.onwrite=()=>{writer.onwrite=()=>resolve();writer.seek(0);writer.write(content)};writer.truncate(0)});await new Promise<void>((resolve,reject)=>plus.share.sendWithSystem({type:'file',files:[file.toLocalURL()]},resolve,reject));return
 // #endif
 throw new Error('当前平台不支持文件保存')
}
export async function chooseCsv():Promise<string>{
 // #ifdef H5
 return new Promise((resolve,reject)=>{const input=document.createElement('input');input.type='file';input.accept='.csv,text/csv';input.oncancel=()=>reject(new Error('已取消选择'));input.onchange=async()=>{try{const f=input.files?.[0];if(!f)throw new Error('未选择文件');if(f.size>2*1024*1024)throw new Error('文件不得超过2MB');const b=await f.arrayBuffer();let s=new TextDecoder('utf-8').decode(b);if(s.includes('\uFFFD'))s=new TextDecoder('gbk').decode(b);resolve(s)}catch(e){reject(e)}};input.click()})
 // #endif
 // #ifdef MP-WEIXIN
 const result:any=await new Promise((resolve,reject)=>wx.chooseMessageFile({count:1,type:'file',extension:['csv'],success:resolve,fail:reject}));if(result.tempFiles[0].size>2*1024*1024)throw new Error('文件不得超过2MB');const data:any=await new Promise((resolve,reject)=>wx.getFileSystemManager().readFile({filePath:result.tempFiles[0].path,encoding:'utf8',success:resolve,fail:reject}));if(data.data.includes('\uFFFD'))throw new Error('请先将文件保存为UTF-8 CSV');return data.data
 // #endif
 throw new Error('请将 UTF-8 CSV 内容粘贴到下方输入框后预览')
}
export async function downloadBinary(path:string):Promise<string>{
 if(!path.startsWith('/api/v1/production/'))throw new Error('下载地址不在生产服务内');const guard=contextGuard();guard();const header:Row={Authorization:'Bearer '+uni.getStorageSync(TOKEN_KEY)};const subject=uni.getStorageSync(SUBJECT_KEY);if(subject)header['X-Merchant-Id']=subject
 const r:any=await new Promise((resolve,reject)=>uni.downloadFile({url:apiBase()+path,header,timeout:60000,success:resolve,fail:reject}));guard();if(r.statusCode!==200)throw new Error('下载失败（HTTP '+r.statusCode+'）');return r.tempFilePath
}
export async function downloadReport(id:string){const guard=contextGuard();const result=await call('/analytics/reports/'+encodeURIComponent(id)+'/export');guard();const origin=serviceOrigin();let path=String(result.fileUrl||'');if(path.startsWith(origin+'/'))path=path.slice(origin.length);if(!new RegExp('^/api/v1/production/analytics/reports/'+encodeURIComponent(id)+'/file\\?').test(path))throw new Error('报表下载地址无效')
 const response:any=await new Promise((resolve,reject)=>uni.request({url:origin+path,method:'GET',dataType:'text',timeout:60000,success:resolve,fail:reject}));guard();if(response.statusCode!==200||typeof response.data!=='string'||response.data.trimStart().startsWith('{'))throw new Error('报表下载失败');await saveText('生产报表-'+id+'.csv',response.data)
}
