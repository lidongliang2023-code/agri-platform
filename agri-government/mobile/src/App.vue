<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { getGovToken, handleGovUnauthorized } from './auth'
onShow(() => {
  if (!getGovToken()) handleGovUnauthorized()
})
</script>
<style lang="scss">
page{min-height:100%;background:#f5f6fa;color:#0b1a12;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;font-size:28rpx}
view,text,button,input,textarea,scroll-view{box-sizing:border-box}
button{margin:0;padding:0;border:0;background:transparent;color:inherit;font-size:inherit;line-height:inherit}button::after{display:none;border:0}
.page{min-height:100vh;padding-bottom:32rpx}.pad{padding:24rpx}.row{display:flex;align-items:center}.between{display:flex;align-items:center;justify-content:space-between}.muted{color:#666666;font-size:24rpx}.tiny{color:#666666;font-size:24rpx}.strong{font-weight:650}
.card{margin-bottom:20rpx;padding:24rpx;border:1rpx solid #e1e9e3;border-radius:22rpx;background:#fff;box-shadow:0 8rpx 25rpx rgba(20,64,40,.03)}
.card-head{display:flex;align-items:center;justify-content:space-between;gap:14rpx;margin-bottom:16rpx}.card-title{font-size:29rpx;font-weight:700}.card-sub{color:#666666;font-size:24rpx}
.btn{display:flex;min-height:78rpx;align-items:center;justify-content:center;padding:0 24rpx;border:1rpx solid #dce7df;border-radius:17rpx;background:#fff;color:#34473b;font-size:24rpx;font-weight:600}.btn-primary{border-color:#12764a;background:linear-gradient(135deg,#159a5e,#12764a);color:#fff;box-shadow:0 8rpx 22rpx rgba(18,118,74,.2)}.btn-ghost{border-color:#a9d6ba;background:#f2fbf5;color:#0e5233}.btn-danger{border-color:#efcccc;background:#fff2f2;color:#b71c1c}.btn-sm{display:inline-flex;min-height:56rpx;padding:0 18rpx;border-radius:11rpx;font-size:24rpx}.btn-block{width:100%}
.tag{display:inline-flex;padding:4rpx 11rpx;border-radius:7rpx;font-size:24rpx}.tag.green{background:#e5f5eb;color:#0e5233}.tag.orange{background:#fff3dd;color:#8f4500}.tag.red{background:#feebeb;color:#b71c1c}.tag.blue{background:#e7f3fa;color:#176c93}.tag.gray{background:#eef2ef;color:#666666}.tag.purple{background:#f2eafa;color:#6b418d}
.progress{height:8rpx;overflow:hidden;border-radius:5rpx;background:#e7eee9}.progress>view{height:100%;border-radius:inherit;background:linear-gradient(90deg,#12764a,#3bbb79)}
.field{display:flex;min-height:78rpx;align-items:center;justify-content:space-between;border-bottom:1rpx solid #edf2ee}.field:last-child{border-bottom:0}.field-label{color:#666666;font-size:24rpx}.field-value{max-width:63%;font-size:24rpx;text-align:right}
.form-item{margin-bottom:20rpx}.form-label{display:block;margin-bottom:9rpx;color:#53665a;font-size:24rpx;font-weight:600}.input,.textarea{width:100%;padding:19rpx 21rpx;border:1rpx solid #dfe8e2;border-radius:15rpx;background:#fff;font-size:24rpx}.textarea{min-height:140rpx}.grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:14rpx}
.empty{display:flex;min-height:360rpx;align-items:center;justify-content:center;flex-direction:column;gap:10rpx;color:#666666;font-size:24rpx}.empty-icon{font-size:52rpx}.loading{padding:30rpx;color:#666666;text-align:center}.hero{position:relative;overflow:hidden;padding:34rpx 28rpx;border-radius:0 0 38rpx 38rpx;background:radial-gradient(circle at 90% 0,rgba(83,213,138,.28),transparent 430rpx),linear-gradient(145deg,#073821,#0d5d3b);color:#fff}.hero-title{margin-top:8rpx;font-size:42rpx;font-weight:750}.hero-desc{margin-top:8rpx;color:rgba(255,255,255,.6);font-size:24rpx;line-height:1.65}
.safe-bottom{padding-bottom:calc(24rpx + env(safe-area-inset-bottom))}
.custom-nav{display:flex;height:88rpx;align-items:center;justify-content:space-between;padding:0 26rpx}.custom-nav .back{width:64rpx;font-size:52rpx;font-weight:300}.custom-nav .title{font-size:31rpx;font-weight:700}.custom-nav .right{min-width:100rpx;color:#12764a;font-size:24rpx;text-align:right}
@media(min-width:768px){page{background:#e4ebe6}.page{width:750rpx;max-width:750px;margin:0 auto;min-height:100vh;background:#f5f6fa}}

/* 移动执法：单列阅读、44px触控、安全区与长文本换行。 */
page{line-height:1.55;color:#20382b}
.page{padding-bottom:calc(32rpx + env(safe-area-inset-bottom));overflow-wrap:anywhere}
.pad{padding:28rpx 24rpx calc(32rpx + env(safe-area-inset-bottom))}
.page-heading{display:flex;flex-direction:column;gap:8rpx;margin-bottom:24rpx}.page-title{display:block;font-size:38rpx;font-weight:700;line-height:1.35}
.between{gap:16rpx}.between>view:first-child{min-width:0;flex:1}.between>.tag{flex-shrink:0}
.card-head{align-items:flex-start;flex-wrap:wrap}.card-title{font-size:30rpx}.card-sub,.tiny{color:#666666}
.btn{min-height:88rpx;font-size:28rpx;line-height:1.4;padding:16rpx 24rpx}.btn-sm{min-height:88rpx;padding:12rpx 20rpx;font-size:26rpx}.btn-primary{background:#12764a;box-shadow:none}
button[disabled]{opacity:.5}.input{height:96rpx;min-height:96rpx;padding:16rpx 20rpx;font-size:28rpx}.textarea{font-size:28rpx;line-height:1.65;min-height:180rpx;padding:20rpx;height:220rpx}
.form-label{font-size:27rpx}.field{gap:24rpx;padding:18rpx 0;min-height:88rpx;align-items:flex-start}.field-value{font-size:27rpx;overflow-wrap:anywhere}.field-label{flex-shrink:0;font-size:26rpx}
.state-panel{display:flex;flex-direction:column;gap:20rpx;padding:32rpx 24rpx;margin:20rpx 0;border-radius:20rpx;background:#fff;color:#53665a}.state-panel .btn{align-self:flex-start}
.select-field{display:flex;justify-content:space-between;align-items:center;gap:16rpx;min-height:96rpx;padding:18rpx 20rpx;border:1rpx solid #dfe8e2;border-radius:14rpx;background:#f7faf8;font-size:28rpx}
.notice{padding:22rpx;margin-bottom:24rpx;border-radius:16rpx;background:#fff6e5;color:#805d18;font-size:26rpx;line-height:1.7}
.action-page{padding-bottom:calc(180rpx + env(safe-area-inset-bottom))}
.bottom-action{position:fixed;left:0;right:0;bottom:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:20rpx;padding:20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));border-top:1rpx solid #dce7df;background:#fff}.bottom-action>view{display:flex;flex:1;min-width:0;flex-direction:column}.bottom-action>.muted{flex:1;min-width:0}.bottom-action .btn{flex-shrink:0;min-width:240rpx}
.tabs{white-space:nowrap;padding-bottom:8rpx}.tabs button{min-height:88rpx;flex-shrink:0}
.custom-nav{height:auto;min-height:96rpx;padding-top:env(safe-area-inset-top)}
@media(min-width:768px){.page{width:100%;max-width:750px}.bottom-action{max-width:750px;margin:0 auto}}
/* 原生页面长文阅读与键盘/安全区适配。 */
.detail-content{display:block;margin-top:20rpx;white-space:pre-wrap;word-break:break-all;line-height:1.8;font-size:29rpx}
.input,.textarea{min-width:0}.bottom-action{flex-wrap:wrap}.bottom-action>.btn{max-width:100%}
.card,.field-value,.muted,.tiny{word-break:break-word}.filter-scroll{min-width:0}
@import '../../../shared/mobile-ui-v1.scss';
</style>
