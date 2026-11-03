export interface ChinaRegionCenter {
  longitude: number
  latitude: number
}

const REGION_CENTERS: Record<string, ChinaRegionCenter> = {
  北京: { longitude: 116.407, latitude: 39.904 },
  天津: { longitude: 117.2, latitude: 39.084 },
  河北: { longitude: 114.514, latitude: 38.042 },
  山西: { longitude: 112.549, latitude: 37.857 },
  内蒙古: { longitude: 111.749, latitude: 40.842 },
  辽宁: { longitude: 123.431, latitude: 41.805 },
  吉林: { longitude: 125.324, latitude: 43.886 },
  黑龙江: { longitude: 126.535, latitude: 45.803 },
  上海: { longitude: 121.474, latitude: 31.23 },
  江苏: { longitude: 118.797, latitude: 32.06 },
  浙江: { longitude: 120.155, latitude: 30.274 },
  安徽: { longitude: 117.227, latitude: 31.821 },
  福建: { longitude: 119.296, latitude: 26.074 },
  江西: { longitude: 115.858, latitude: 28.683 },
  山东: { longitude: 117.12, latitude: 36.651 },
  河南: { longitude: 113.625, latitude: 34.746 },
  湖北: { longitude: 114.305, latitude: 30.593 },
  湖南: { longitude: 112.939, latitude: 28.228 },
  广东: { longitude: 113.264, latitude: 23.129 },
  广西: { longitude: 108.366, latitude: 22.817 },
  海南: { longitude: 110.199, latitude: 20.044 },
  重庆: { longitude: 106.551, latitude: 29.563 },
  四川: { longitude: 104.066, latitude: 30.572 },
  贵州: { longitude: 106.63, latitude: 26.647 },
  云南: { longitude: 102.833, latitude: 24.88 },
  西藏: { longitude: 91.132, latitude: 29.66 },
  陕西: { longitude: 108.94, latitude: 34.341 },
  甘肃: { longitude: 103.834, latitude: 36.061 },
  青海: { longitude: 101.778, latitude: 36.617 },
  宁夏: { longitude: 106.23, latitude: 38.487 },
  新疆: { longitude: 87.617, latitude: 43.792 },
  香港: { longitude: 114.169, latitude: 22.319 },
  澳门: { longitude: 113.543, latitude: 22.199 },
  台湾: { longitude: 121.565, latitude: 25.033 },
}

/** 将生产管理返回的省 / 自治区名称归一为稳定键。 */
export function normalizeChinaRegionName(name: string): string {
  return name
    .trim()
    .replace(/特别行政区$/u, '')
    .replace(/壮族自治区$/u, '')
    .replace(/回族自治区$/u, '')
    .replace(/维吾尔自治区$/u, '')
    .replace(/自治区$/u, '')
    .replace(/[省市]$/u, '')
}

/** 省级行政区代表点。返回 undefined 时不在地图上伪造位置。 */
export function chinaRegionCenter(name: string): ChinaRegionCenter | undefined {
  return REGION_CENTERS[normalizeChinaRegionName(name)]
}
