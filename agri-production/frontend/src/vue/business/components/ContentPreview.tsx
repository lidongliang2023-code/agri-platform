import { defineComponent, h } from 'vue'
import { contentHtml } from '@/components/richTextContent'
export { CONTENT_LIMIT, hasContent, normalizeContent, safeContentUrl } from '@/components/richTextContent'
export const ContentPreview = defineComponent({
  name:'ProductionVueContentPreview',
  props:{value:String,content:String,format:String},
  setup(props){return()=>h('div',{class:'production-content-preview',innerHTML:contentHtml(props.value??props.content??'')})},
})
