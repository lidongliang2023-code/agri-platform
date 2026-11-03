import { describe, expect, it } from 'vitest'
import {
  chinaRegionCenter,
  normalizeChinaRegionName,
} from '../src/components/chinaRegionCenters'

describe('省级行政区名称与代表点', () => {
  it('归一化省、市、自治区和特别行政区后缀', () => {
    expect(normalizeChinaRegionName(' 江苏省 ')).toBe('江苏')
    expect(normalizeChinaRegionName('内蒙古自治区')).toBe('内蒙古')
    expect(normalizeChinaRegionName('广西壮族自治区')).toBe('广西')
    expect(normalizeChinaRegionName('香港特别行政区')).toBe('香港')
  })

  it('按归一化名称返回真实代表点，未知地区不伪造坐标', () => {
    expect(chinaRegionCenter('江苏省')).toEqual({ longitude: 118.797, latitude: 32.06 })
    expect(chinaRegionCenter('未知地区')).toBeUndefined()
  })
})
