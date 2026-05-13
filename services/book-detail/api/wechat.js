const request = require('../request')

function createMchOrder(data) {
  return request({
    url: '/wechat/order/mchCreate',
    method: 'POST',
    data,
  })
}

module.exports = {
  createMchOrder,
}
