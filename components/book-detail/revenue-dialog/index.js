Component({
  properties: {
    config: {
      type: Object,
      value: null,
    },
    visible: Boolean,
    hotList: {
      type: Array,
      value: [],
    },
  },

  data: {
    firstDrama: null,
    restDramas: [],
  },

  observers: {
    hotList(list) {
      const validList = list && list.length && list[0] && list[0].list ? list[0].list : []
      this.setData({
        firstDrama: validList.length ? validList[0] : null,
        restDramas: validList.length > 1 ? validList.slice(1) : [],
      })
    },
  },

  methods: {
    handleClose() {
      this.triggerEvent('close')
    },

    handlePlay(event) {
      const targetId = event.currentTarget.dataset.id
      const allDramas = []
      if (this.data.firstDrama) {
        allDramas.push(this.data.firstDrama)
      }
      ;(this.data.restDramas || []).forEach((item) => {
        allDramas.push(item)
      })
      const drama = allDramas.find((item) => String(item.id) === String(targetId))
      this.triggerEvent('playdrama', drama || null)
    },
  },
})
