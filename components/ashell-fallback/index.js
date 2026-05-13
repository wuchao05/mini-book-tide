const { getCurrentMiniAppProfile } = require('../../utils/runtime-miniapp')

Component({
  data: {
    appName: ''
  },

  lifetimes: {
    attached() {
      const profile = getCurrentMiniAppProfile()

      this.setData({
        appName: (profile && profile.appName) || '账本'
      })
    }
  }
})
