Component({
  methods: {
    handleContact(event) {
      this.triggerEvent('success', event.detail || {})
    },

    handleError(event) {
      wx.showToast({
        title: '客服启动失败，请稍后再试',
        icon: 'none',
      })
      this.triggerEvent('error', event.detail || {})
    },
  },
})
