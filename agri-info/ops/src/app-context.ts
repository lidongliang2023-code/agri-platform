import {defineStore} from 'pinia';import {ref,computed} from 'vue';import type {OpsPageKey} from './types';
export interface RouteState{page:OpsPageKey;id?:number;query:URLSearchParams}
const PAGE_KEYS: OpsPageKey[] = [
  'green-supply',
  'cloud-factories',
  'dashboard',
  'contents',
  'channels',
  'courses',
  'quotes',
  'supply-demands',
  'recommend',
  'ai',
  'reports',
  'experts',
  'attestations',
  'stats',
  'audit-logs',
]

export function parseRoute(hash: string): RouteState {
  const raw = hash.replace(/^#\/?/, '')
  const [pathPart, search = ''] = raw.split('?')
  const segments = pathPart.split('/').filter(Boolean)
  const candidate = (segments[0] || 'dashboard') as OpsPageKey
  const page = PAGE_KEYS.includes(candidate) ? candidate : 'dashboard'
  const numericId = segments[1] ? Number(segments[1]) : undefined
  return {
    page,
    id: Number.isFinite(numericId) ? numericId : undefined,
    query: new URLSearchParams(search),
  }
}

export const useApp=defineStore('info-ops-app',()=>{const hash=ref(window.location.hash);const route=computed(()=>parseRoute(hash.value));const page=computed(()=>route.value.page),id=computed(()=>route.value.id),query=computed(()=>route.value.query);function syncFromWindow(){hash.value=window.location.hash}function navigate(page:OpsPageKey,id?:number,query?:Record<string,string>){const q=new URLSearchParams(query).toString();window.location.hash='/'+page+(id===undefined?'':'/'+id)+(q?'?'+q:'');syncFromWindow()}function navigatePath(p:string){window.location.hash='/'+p.replace(/^#?\/?/,'');syncFromWindow()}return{hash,page,id,query,syncFromWindow,navigate,navigatePath,openSearch:(keyword:string)=>navigate('search' as OpsPageKey,undefined,keyword?{q:keyword}:undefined),openMarket:(id:number)=>navigate('market-detail' as OpsPageKey,id)}})
