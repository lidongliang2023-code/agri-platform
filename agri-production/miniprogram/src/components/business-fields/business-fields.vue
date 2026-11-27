<template>
  <view class="fields">
    <view v-for="field in fields" :key="field.key" class="field-block">
      <text class="label">{{ field.label }}<text v-if="field.required" class="required"> *</text></text>
      <view v-if="field.type === 'array'"><view v-for="(row,index) in modelValue[field.key] || []" :key="index" class="array-row"><text class="label">{{field.label}} {{Number(index)+1}}</text><business-fields :fields="field.children || []" :model-value="row" :disabled="disabled" :farm-id="farmId" @update:model-value="updateRow(field,Number(index),$event)"/><button size="mini" :disabled="disabled" @click="removeRow(field,Number(index))">移除此项</button></view><button size="mini" :disabled="disabled" @click="addRow(field)">添加{{field.label}}</button></view>
      <switch v-else-if="field.type === 'boolean'" :checked="!!modelValue[field.key]" color="#0f7a45" :disabled="disabled" @change="eventChange(field.key, $event)" />
      <view v-else-if="field.type === 'images'"><view class="photos"><view v-for="(photo,index) in modelValue[field.key] || []" :key="index"><image :src="photo" mode="aspectFill" @click="preview(photo,field)"/><text v-if="!disabled" @click="removePhoto(field,index)">移除</text></view></view><button size="mini" :disabled="disabled || uploading" @click="choosePhoto(field)">{{ uploading ? '读取照片中…' : '拍照 / 选择照片' }}</button><text class="hint">最多3张，每张JPEG或PNG不超过1MB</text></view>
      <checkbox-group v-else-if="field.type === 'select' && field.multiple" @change="multi(field,$event)"><label v-for="item in options[field.key] || field.options || []" :key="String(item.value)" class="multi"><checkbox :value="String(item.value)" :checked="(modelValue[field.key] || []).map(String).includes(String(item.value))" :disabled="disabled" color="#0f7a45"/>{{item.label}}</label></checkbox-group>
      <picker v-else-if="field.type === 'select'" :disabled="disabled || loading" :range="options[field.key] || field.options || []" range-key="label" @change="pick(field, $event)"><view class="input picker">{{ selected(field) }}<text>⌄</text></view></picker>
      <picker v-else-if="field.type === 'date' || field.type === 'time'" :mode="field.type" :value="modelValue[field.key] || ''" :disabled="disabled" @change="eventChange(field.key, $event)"><view class="input picker">{{ modelValue[field.key] || '请选择' }}<text>⌄</text></view></picker>
      <textarea v-else-if="field.type === 'textarea'" class="textarea" :value="String(modelValue[field.key] ?? '')" :disabled="disabled" :maxlength="4000" auto-height :placeholder="'请输入' + field.label" @input="eventChange(field.key, $event)" />
      <input v-else class="input" :type="field.type === 'number' ? 'digit' : 'text'" :value="String(modelValue[field.key] ?? '')" :disabled="disabled || field.readonly" :placeholder="'请输入' + field.label" @input="eventChange(field.key, $event)" />
      <text v-if="field.hint" class="hint">{{ field.hint }}</text>
    </view>
    <view v-if="error" class="error" @click="loadOptions">{{ error }} · 点击重试</view>
    <text v-if="loading" class="hint">正在加载可选数据…</text>
  </view>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { call } from '@/api/native-business'
import type { Field, Row, Choice } from '@/api/native-business'
const props = defineProps<{ fields: Field[]; modelValue: Row; disabled?: boolean; farmId?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: Row): void; (e:'ready', value:boolean):void }>()
const options = ref<Record<string,Choice[]>>({}), error = ref(''), loading = ref(false)
let version = 0
const uploading=ref(false)
function addRow(field:Field){change(field.key,[...(props.modelValue[field.key]||[]),Object.fromEntries((field.children||[]).map(f=>[f.key,f.default??(f.type==='array'?[]:'')]))])}
function updateRow(field:Field,index:number,value:Row){const rows=[...(props.modelValue[field.key]||[])];rows[index]=value;change(field.key,rows)}
function removeRow(field:Field,index:number){change(field.key,(props.modelValue[field.key]||[]).filter((_:any,i:number)=>i!==index))}
function multi(field:Field,event:any){const values:string[]=event.detail.value;const existing:any[]=Array.isArray(props.modelValue[field.key])?props.modelValue[field.key]:[];const ordered=existing.filter(i=>values.includes(String(i)));const added=values.filter(i=>!ordered.some(x=>String(x)===i));const items=options.value[field.key]||field.options||[];change(field.key,[...ordered,...added.map(v=>items.find(i=>String(i.value)===v)?.value??v)])}
function removePhoto(field:Field,index:number){change(field.key,(props.modelValue[field.key]||[]).filter((_:any,i:number)=>i!==index))}
function preview(photo:string,field:Field){uni.previewImage({current:photo,urls:props.modelValue[field.key]||[]})}
async function photoData(path:string):Promise<string>{
 // #ifdef H5
 const response=await fetch(path);const blob=await response.blob();if(blob.size>1048576||!['image/jpeg','image/png'].includes(blob.type))throw new Error('请选择1MB以内的JPEG或PNG照片');return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('照片读取失败'));reader.readAsDataURL(blob)})
 // #endif
 // #ifdef MP-WEIXIN
 return await new Promise((resolve,reject)=>{uni.getFileSystemManager().readFile({filePath:path,encoding:'base64',success:r=>resolve('data:image/'+(path.toLowerCase().endsWith('.png')?'png':'jpeg')+';base64,'+r.data),fail:reject})})
 // #endif
 // #ifdef APP-PLUS
 return await new Promise((resolve,reject)=>{(globalThis as any).plus.io.resolveLocalFileSystemURL(path,(entry:any)=>entry.file((file:any)=>{const reader=new (globalThis as any).plus.io.FileReader();reader.onloadend=(event:any)=>resolve(event.target.result);reader.onerror=reject;reader.readAsDataURL(file)},reject),reject)})
 // #endif
 throw new Error('当前环境不支持读取照片')
}
function choosePhoto(field:Field){if(uploading.value||props.disabled)return;const count=(props.modelValue[field.key]||[]).length;if(count>=3){uni.showToast({title:'最多添加3张照片',icon:'none'});return}uni.chooseImage({count:3-count,sizeType:['compressed'],success:async result=>{uploading.value=true;emit('ready',false);try{const files=result.tempFiles as Array<{path:string;size:number}>;if(files.some(f=>f.size>1048576||!f.size))throw new Error('每张照片需为1MB以内');const data=await Promise.all((Array.isArray(result.tempFilePaths)?result.tempFilePaths:[result.tempFilePaths]).map(photoData));change(field.key,[...(props.modelValue[field.key]||[]),...data])}catch(e:any){error.value=e.message||'照片读取失败'}finally{uploading.value=false;emit('ready',!error.value)}}})}

const change = (key:string,value:any) => emit('update:modelValue', { ...props.modelValue, [key]: value })
function eventChange(key:string,event:any){change(key,event.detail?.value ?? event.target?.value ?? '')}
function selected(field: Field) { return (options.value[field.key] || field.options || []).find(item => String(item.value) === String(props.modelValue[field.key]))?.label || '请选择' }
function pick(field:Field,event:any) { const item=(options.value[field.key] || field.options || [])[Number(event.detail.value)]; if(item) change(field.key,item.value) }
async function loadOptions() {
  const current=++version; error.value=''; loading.value=true; emit('ready',false)
  try {
    const loaded: Record<string,Choice[]>={}
    for (const field of props.fields.filter(f=>f.source)) {
      if(field.key==='marketQuoteId'&&!field.sourceParams?.crop){loaded[field.key]=[];continue}
      const choices:Choice[]=[]
      for(let page=1;page<=500;page++) {
        const raw = await call(field.source!,'GET',undefined,{...field.sourceParams,farmId:props.farmId,pageNum:page,pageSize:100,page,size:100})
        if(current!==version)return
        const rows=field.sourceArray?raw?.[field.sourceArray]:Array.isArray(raw)?raw:raw?.records ?? raw?.list
        if(!Array.isArray(rows))throw new Error(field.label+'选项格式异常')
        choices.push(...rows.map((row:Row)=>({value:row[field.id!],label:field.key==='marketQuoteId'?`${row.market || ''} · ${row.quoteDate || ''} · ${row.priceKg ?? '—'}元/kg · ${row.sourceUrl || ''}`:String(row[field.name!] || row[field.id!] || '未命名')})))
        if(Array.isArray(raw) || choices.length>=Number(raw.total ?? choices.length))break
        if(!rows.length || page===500)throw new Error(field.label+'选项未加载完整，请缩小范围')
      }
      loaded[field.key]=choices
    }
    if(current===version){ options.value=loaded;emit('ready',true) }
  }catch(e:any){if(current===version)error.value=e.message || '选项加载失败'}
  finally{if(current===version)loading.value=false}
}
watch(()=>JSON.stringify([props.fields.map(f=>[f.key,f.source,f.sourceParams,f.sourceArray,f.id,f.name,f.options]),props.farmId]),loadOptions,{immediate:true})
</script>
<style scoped>
.array-row{padding:20rpx;border-left:5rpx solid #d6e5d0;background:#f9fbf6;margin:20rpx 0}.photos{display:flex;gap:20rpx;flex-wrap:wrap}.photos image{width:150rpx;height:150rpx;border-radius:12rpx}.photos text{display:block;text-align:center;padding:14rpx;color:#a33}.multi{display:flex;align-items:center;min-height:84rpx;font-size:27rpx;gap:14rpx}.field-block{padding:24rpx 0;border-bottom:1rpx solid #edf1ed}.label{display:block;font-size:27rpx;font-weight:600;color:#294333;margin-bottom:14rpx}.required{color:#b84b36}.input,.textarea{box-sizing:border-box;width:100%;background:#f3f6f2;border:1rpx solid #e0e7df;border-radius:12rpx;padding:20rpx 22rpx;font-size:29rpx;min-height:88rpx;height:88rpx;color:#183c29}.textarea{height:auto;min-height:160rpx;line-height:1.6}.picker{display:flex;justify-content:space-between;align-items:center}.hint{display:block;color:#728076;font-size:24rpx;margin-top:12rpx;line-height:1.5}.error{color:#ac3c27;background:#fff1ea;padding:22rpx;margin-top:20rpx;border-radius:12rpx;font-size:26rpx}
</style>
