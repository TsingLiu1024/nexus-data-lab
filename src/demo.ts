import { parseCsv } from './data'

// Deterministic synthetic data; no real customer information.
export function createDemo() {
  const channels = ['官网商城', '线下门店', '天猫旗舰店', '微信小程序']
  const regions = ['华东', '华南', '华北', '西南']
  const products = ['智能音箱', '无线耳机', '机械键盘', '便携显示器', '智能手表']
  const lines = ['订单编号,日期,渠道,地区,产品,销售额,订单量,状态']
  for (let day = 0; day < 90; day++) {
    for (let channel = 0; channel < 4; channel++) {
      const i = day * 4 + channel
      const date = new Date(Date.UTC(2026, 6, 1 + day)).toISOString().slice(0, 10)
      const orders = 12 + ((i * 17) % 39)
      const amount = Math.round((1500 + day * 34 + Math.sin(day / 4) * 680 + ((i * 131) % 2400)) * [1.4, 0.85, 1.15, 0.7][channel])
      lines.push([`NX${String(i + 1).padStart(6, '0')}`, date, channels[channel], regions[(day + channel) % 4], products[i % 5], amount, orders, i % 29 === 0 ? '处理中' : '已完成'].join(','))
    }
  }
  return parseCsv(lines.join('\n'), '零售经营数据.csv')
}
