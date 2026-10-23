import { Col, Form, Select } from 'antd'
import type { ColProps, FormInstance } from 'antd'
import { getChinaCities, PROVINCE_OPTIONS } from '@/data/chinaRegions'

interface ProvinceCityFieldsProps {
  form: FormInstance
  provinceName?: string
  cityName?: string
  provinceLabel?: string
  cityLabel?: string
  required?: boolean
  provinceColProps?: ColProps
  cityColProps?: ColProps
}

/** 省市联动字段。省份变化时清空已选城市，避免留下不匹配的组合。 */
export default function ProvinceCityFields({
  form,
  provinceName = 'deliveryProvince',
  cityName = 'deliveryCity',
  provinceLabel = '省份',
  cityLabel = '城市',
  required = false,
  provinceColProps = { xs: 24, md: 8 },
  cityColProps = { xs: 24, md: 8 },
}: ProvinceCityFieldsProps): JSX.Element {
  const province = Form.useWatch(provinceName, form) as string | undefined
  const currentCity = Form.useWatch(cityName, form) as string | undefined
  const knownCities = getChinaCities(province)
  const cityOptions = [...knownCities.map((city) => ({ value: city, label: city }))]
  if (currentCity && !knownCities.includes(currentCity)) {
    cityOptions.unshift({ value: currentCity, label: `${currentCity}（历史值）` })
  }

  return (
    <>
      <Col {...provinceColProps}>
        <Form.Item
          label={provinceLabel}
          name={provinceName}
          rules={required ? [{ required: true, message: `请选择${provinceLabel}` }] : undefined}
        >
          <Select
            showSearch
            allowClear={!required}
            optionFilterProp="label"
            placeholder={`请选择${provinceLabel}`}
            options={PROVINCE_OPTIONS}
            onChange={() => form.setFieldValue(cityName, undefined)}
          />
        </Form.Item>
      </Col>
      <Col {...cityColProps}>
        <Form.Item
          label={cityLabel}
          name={cityName}
          rules={required ? [{ required: true, message: `请选择${cityLabel}` }] : undefined}
        >
          <Select
            showSearch
            allowClear={!required}
            optionFilterProp="label"
            disabled={!province}
            placeholder={province ? `请选择${cityLabel}` : `请先选择${provinceLabel}`}
            options={cityOptions}
          />
        </Form.Item>
      </Col>
    </>
  )
}
