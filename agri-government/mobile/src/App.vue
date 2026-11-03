<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
onLaunch(() => {
  if (!uni.getStorageSync('gov_unified_token')) {
    setTimeout(() => uni.reLaunch({ url: '/pages/login/index' }), 0)
  }
})
</script>
<style lang="scss">
page{min-height:100%;background:#f4f7f5;color:#0b1a12;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;font-size:28rpx}
view,text,button,input,textarea,scroll-view{box-sizing:border-box}
button{margin:0;padding:0;border:0;background:transparent;color:inherit;font-size:inherit;line-height:inherit}button::after{display:none;border:0}
.page{min-height:100vh;padding-bottom:32rpx}.pad{padding:24rpx}.row{display:flex;align-items:center}.between{display:flex;align-items:center;justify-content:space-between}.muted{color:#718277;font-size:22rpx}.tiny{color:#94a198;font-size:19rpx}.strong{font-weight:650}
.card{margin-bottom:20rpx;padding:24rpx;border:1rpx solid #e1e9e3;border-radius:22rpx;background:#fff;box-shadow:0 8rpx 25rpx rgba(20,64,40,.03)}
.card-head{display:flex;align-items:center;justify-content:space-between;gap:14rpx;margin-bottom:16rpx}.card-title{font-size:29rpx;font-weight:700}.card-sub{color:#94a198;font-size:20rpx}
.btn{display:flex;min-height:78rpx;align-items:center;justify-content:center;padding:0 24rpx;border:1rpx solid #dce7df;border-radius:17rpx;background:#fff;color:#34473b;font-size:24rpx;font-weight:600}.btn-primary{border-color:#12764a;background:linear-gradient(135deg,#159a5e,#12764a);color:#fff;box-shadow:0 8rpx 22rpx rgba(18,118,74,.2)}.btn-ghost{border-color:#a9d6ba;background:#f2fbf5;color:#0e5233}.btn-danger{border-color:#efcccc;background:#fff2f2;color:#c54b4b}.btn-sm{display:inline-flex;min-height:56rpx;padding:0 18rpx;border-radius:11rpx;font-size:20rpx}.btn-block{width:100%}
.tag{display:inline-flex;padding:4rpx 11rpx;border-radius:7rpx;font-size:18rpx}.tag.green{background:#e5f5eb;color:#0e5233}.tag.orange{background:#fff3dd;color:#a96a08}.tag.red{background:#feebeb;color:#c54b4b}.tag.blue{background:#e7f3fa;color:#176c93}.tag.gray{background:#eef2ef;color:#718277}.tag.purple{background:#f2eafa;color:#6b418d}
.progress{height:8rpx;overflow:hidden;border-radius:5rpx;background:#e7eee9}.progress>view{height:100%;border-radius:inherit;background:linear-gradient(90deg,#12764a,#3bbb79)}
.field{display:flex;min-height:78rpx;align-items:center;justify-content:space-between;border-bottom:1rpx solid #edf2ee}.field:last-child{border-bottom:0}.field-label{color:#718277;font-size:22rpx}.field-value{max-width:63%;font-size:22rpx;text-align:right}
.form-item{margin-bottom:20rpx}.form-label{display:block;margin-bottom:9rpx;color:#53665a;font-size:22rpx;font-weight:600}.input,.textarea{width:100%;padding:19rpx 21rpx;border:1rpx solid #dfe8e2;border-radius:15rpx;background:#fff;font-size:24rpx}.textarea{min-height:140rpx}.grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:14rpx}
.empty{display:flex;min-height:360rpx;align-items:center;justify-content:center;flex-direction:column;gap:10rpx;color:#94a198;font-size:22rpx}.empty-icon{font-size:52rpx}.loading{padding:30rpx;color:#718277;text-align:center}.hero{position:relative;overflow:hidden;padding:34rpx 28rpx;border-radius:0 0 38rpx 38rpx;background:radial-gradient(circle at 90% 0,rgba(83,213,138,.28),transparent 430rpx),linear-gradient(145deg,#073821,#0d5d3b);color:#fff}.hero-title{margin-top:8rpx;font-size:42rpx;font-weight:750}.hero-desc{margin-top:8rpx;color:rgba(255,255,255,.6);font-size:21rpx;line-height:1.65}
.safe-bottom{padding-bottom:calc(24rpx + env(safe-area-inset-bottom))}
.custom-nav{display:flex;height:88rpx;align-items:center;justify-content:space-between;padding:0 26rpx}.custom-nav .back{width:64rpx;font-size:52rpx;font-weight:300}.custom-nav .title{font-size:31rpx;font-weight:700}.custom-nav .right{min-width:100rpx;color:#12764a;font-size:22rpx;text-align:right}
@media(min-width:768px){page{background:#e4ebe6}.page{width:750rpx;max-width:750px;margin:0 auto;min-height:100vh;background:#f4f7f5}}
</style>
