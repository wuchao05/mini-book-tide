const request = require('../request')
const appStore = require('../../../stores/book-detail/app-store')

function createMchOrder(data) {
  return request({
    url: '/wechat/order/mchCreate',
    method: 'POST',
    data,
  })
}

function createQingmpayOrder(data) {
  return request({
    url: '/qingmpay/order/create',
    method: 'POST',
    data: Object.assign({ raw: 0 }, data || {}),
    header: {
      'content-type': 'application/json',
      token: appStore.state.token || '',
    },
  })
}

module.exports = {
  createMchOrder,
  createQingmpayOrder,
}
