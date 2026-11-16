<script setup lang="ts">
import type { Row } from '../api/iot'
export interface Field{key:string;label:string;type?:string;required?:boolean;options?:Array<{value:any;label:string}>;hint?:string;disabled?:boolean}
const props=withDefaults(defineProps<{modelValue:Row;fields:Field[];busy?:boolean;submitText?:string}>(),{busy:false,submitText:'保存'})
const emit=defineEmits<{(e:'update:modelValue',value:Row):void;(e:'save'):void}>()
function update(key:string,value:any){emit('update:modelValue',{...props.modelValue,[key]:value})}
function eventValue(event:any){return event?.detail?.value}
function select(field:Field,event:any){update(field.key,field.options?.[Number(eventValue(event))]?.value)}
</script>
<template>
  <view>
    <view v-for="field in fields" :key="field.key" class="form-item" :class="{ 'switch-item': field.type==='switch' }">
      <text class="form-label">{{field.label}}<text v-if="field.required" class="required"> *</text></text>
      <picker v-if="field.type==='select'" :disabled="busy||field.disabled" :range="field.options||[]" range-key="label" :value="Math.max(0,(field.options||[]).findIndex(o=>o.value===modelValue[field.key]))" @change="select(field,$event)">
        <view class="input select" :class="{ placeholder: !field.options?.find(o=>o.value===modelValue[field.key]) }"><text>{{field.options?.find(o=>o.value===modelValue[field.key])?.label||'请选择'}}</text><text class="chev">›</text></view>
      </picker>
      <switch v-else-if="field.type==='switch'" color="#12764a" :checked="!!modelValue[field.key]" :disabled="busy||field.disabled" @change="update(field.key,eventValue($event))"/>
      <textarea v-else-if="field.type==='textarea'" class="textarea" :maxlength="5000" :value="String(modelValue[field.key]??'')" :disabled="busy||field.disabled" @input="update(field.key,eventValue($event))"/>
      <input v-else class="input" :type="field.type==='number'?'digit':'text'" :value="String(modelValue[field.key]??'')" :disabled="busy||field.disabled" :placeholder="'请输入'+field.label" @input="update(field.key,eventValue($event))"/>
      <text v-if="field.hint" class="tiny hint">{{field.hint}}</text>
    </view>
    <view class="footer-bar"><button class="btn btn-primary" :disabled="busy" :loading="busy" @tap="emit('save')">{{submitText}}</button></view>
  </view>
</template>
<style scoped>
.required{color:#c54b4b}.select{display:flex;align-items:center;justify-content:space-between;height:76rpx;padding-top:0;padding-bottom:0}.select.placeholder{color:#94a198}.hint{display:block;margin-top:8rpx}
.switch-item{display:flex;align-items:center;justify-content:space-between}.switch-item .form-label{margin-bottom:0}
</style>
