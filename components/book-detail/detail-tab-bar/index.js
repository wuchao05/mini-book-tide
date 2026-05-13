Component({
  properties: {
    tabs: {
      type: Array,
      value: [],
    },
  },

  data: {
    selectedPath: '',
  },

  lifetimes: {
    attached() {
      this.syncSelectedPath()
    },
  },

  pageLifetimes: {
    show() {
      this.syncSelectedPath()
    },
  },

  methods: {
    syncSelectedPath() {
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1]
      const route = currentPage && currentPage.route ? `/${currentPage.route}` : ''

      this.setData({
        selectedPath: route,
      })
    },

    handleTabTap(event) {
      const path = event.currentTarget.dataset.path || ''

      if (!path || path === this.data.selectedPath) {
        return
      }

      wx.reLaunch({
        url: path,
      })
    },
  },
})
