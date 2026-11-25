<template><video ref="video" :src="nativeSrc" :poster="poster" controls playsinline preload="metadata" @loadedmetadata="resume" style="width:100%;display:block;border-radius:12px;background:#0b1a12" /></template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
const props=withDefaults(defineProps<{src:string;poster?:string;initialTime?:number}>(),{initialTime:0})
const emit=defineEmits<{progress:[position:number];ended:[];failed:[]}>()
const video=ref<HTMLVideoElement|null>(null)
let dispose: (()=>void)|undefined
let resumed=false
const nativeSrc=computed(()=>props.src.includes('.m3u8')&&video.value&&!video.value.canPlayType('application/vnd.apple.mpegurl')?undefined:props.src)
function resume(){if(!resumed&&video.value){resumed=true;if(props.initialTime>1&&Math.abs(video.value.currentTime-props.initialTime)>2)video.value.currentTime=props.initialTime}}
function bind(){dispose?.();resumed=false;const el=video.value;if(!el||!props.src)return;let timer:number|undefined, cancelled=false,hls:{destroy:()=>void}|undefined
 const flush=()=>emit('progress',Math.floor(el.currentTime))
 const play=()=>{if(timer)clearInterval(timer);timer=window.setInterval(flush,15000)}
 const pause=()=>{if(timer)clearInterval(timer);timer=undefined;flush()}
 const ended=()=>{pause();emit('ended')},failed=()=>emit('failed')
 el.addEventListener('play',play);el.addEventListener('pause',pause);el.addEventListener('ended',ended);el.addEventListener('error',failed)
 const src=props.src
 if(src.includes('.m3u8')&&!el.canPlayType('application/vnd.apple.mpegurl'))void import('hls.js').then(({default:Hls})=>{if(cancelled)return;if(!Hls.isSupported()){failed();return}const instance=new Hls({enableWorker:true,lowLatencyMode:false});hls=instance;instance.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal)failed()});instance.loadSource(src);instance.attachMedia(el)}).catch(()=>{if(!cancelled)failed()})
 dispose=()=>{cancelled=true;if(timer)clearInterval(timer);el.removeEventListener('play',play);el.removeEventListener('pause',pause);el.removeEventListener('ended',ended);el.removeEventListener('error',failed);hls?.destroy()}
}
onMounted(bind);watch(()=>props.src,bind,{flush:'post'});onBeforeUnmount(()=>dispose?.())
</script>
