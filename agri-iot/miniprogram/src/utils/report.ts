function csvCell(value:unknown):string {
 const raw=String(value??'')
 const safe=/^[=+\-@\t\r]/.test(raw)?"'"+raw:raw
 return '"'+safe.replace(/"/g,'""')+'"'
}
/** 微信端生成真实 CSV 文件并调用原生分享；其他端保留可复制文本。 */
export async function shareCsv(name:string,rows:unknown[][]):Promise<void>{
 const csv='\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')
 // #ifdef MP-WEIXIN
 const fs=uni.getFileSystemManager()
 const filePath=`${(uni as unknown as {env:{USER_DATA_PATH:string}}).env.USER_DATA_PATH}/${name}.csv`
 await new Promise<void>((resolve,reject)=>fs.writeFile({filePath,data:csv,encoding:'utf8',success:()=>resolve(),fail:()=>reject(new Error('报表写入失败，请检查存储空间'))}))
 if(!uni.canIUse('shareFileMessage'))throw new Error('当前微信版本不支持文件分享，请更新微信后重试')
 await new Promise<void>((resolve,reject)=>uni.shareFileMessage({filePath,fileName:name+'.csv',success:()=>resolve(),fail:e=>reject(new Error(e.errMsg?.includes('cancel')?'已取消分享，报表未发送':'报表分享失败，请重试'))}))
 return
 // #endif
 // #ifndef MP-WEIXIN
 await new Promise<void>((resolve,reject)=>uni.setClipboardData({data:csv,success:()=>resolve(),fail:()=>reject(new Error('无法复制报表'))}))
 uni.showToast({title:'CSV内容已复制',icon:'none'})
 // #endif
}
