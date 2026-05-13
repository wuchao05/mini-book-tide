const { getCurrentMiniAppProfile } = require('../../utils/runtime-miniapp')

Page({
  data: {
    appName: ''
  },

  onShow() {
    const profile = getCurrentMiniAppProfile()
    const appName = (profile && profile.appName) || '账本'

    this.setData({
      appName
    })
    wx.setNavigationBarTitle({
      title: '关于' + appName
    })
  }
})
