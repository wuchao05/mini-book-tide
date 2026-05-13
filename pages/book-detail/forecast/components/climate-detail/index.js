Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
    },
    episodes: {
      type: Array,
      value: [],
    },
    episodeDetail: {
      type: Object,
      value: null,
    },
    currentIndex: {
      type: Number,
      value: 0,
    },
  },

  data: {
    activeTabIndex: 0,
    tabOffset: 0,
    tabs: [],
    currentEpisodes: [],
    itemClasses: [],
    episodesPerPage: 30,
    isTapping: false,
  },

  observers: {
    episodes(val) {
      this.buildTabs(val)
    },
    'activeTabIndex, currentIndex'() {
      this.updateCurrentEpisodes(this.data.activeTabIndex)
    },
  },

  methods: {
    noop() {},

    closeModal() {
      this.triggerEvent('close')
    },

    buildTabs(episodes) {
      if (!episodes || !episodes.length) {
        this.setData({
          tabs: [],
          currentEpisodes: [],
          itemClasses: [],
        })
        return
      }

      const perPage = this.data.episodesPerPage
      const pageCount = Math.ceil(episodes.length / perPage)
      const tabs = []
      let defaultTabIndex = Math.floor(this.data.currentIndex / perPage)
      defaultTabIndex = Math.min(defaultTabIndex, pageCount - 1)

      for (let index = 0; index < pageCount; index += 1) {
        const start = index * perPage + 1
        const end = Math.min((index + 1) * perPage, episodes.length)
        tabs.push({
          label: `${start}-${end}`,
          start: index * perPage,
          end: (index + 1) * perPage,
        })
      }

      this.setData(
        {
          tabs,
          activeTabIndex: defaultTabIndex,
        },
        () => {
          this.updateCurrentEpisodes(defaultTabIndex)
        },
      )
    },

    updateCurrentEpisodes(tabIndex) {
      const tabs = this.data.tabs || []
      const tab = tabs[tabIndex]
      if (!tab) {
        return
      }

      const episodes = this.data.episodes.slice(tab.start, tab.end)
      const itemClasses = episodes.map((episode, index) => {
        const absoluteIndex = tab.start + index
        const isCurrent = absoluteIndex === this.data.currentIndex
        const isLocked = episode && Number(episode.lock_status) === 1
        let className = 'episode-item'
        if (isCurrent) {
          className += ' current'
        }
        if (isLocked) {
          className += ' locked'
        }
        if (isCurrent && isLocked) {
          className += ' current-locked'
        }
        return className
      })

      this.setData({
        currentEpisodes: episodes,
        tabOffset: tab.start,
        itemClasses,
      })
    },

    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index)
      if (index === this.data.activeTabIndex) {
        return
      }
      this.setData({
        activeTabIndex: index,
      })
    },

    onEpisodeTap(event) {
      if (this.data.isTapping) {
        return
      }

      const index = Number(event.currentTarget.dataset.index)
      const tab = this.data.tabs[this.data.activeTabIndex]
      if (!tab) {
        return
      }

      const absoluteIndex = tab.start + index
      const episode = this.data.episodes[absoluteIndex]

      this.setData({
        isTapping: true,
      })

      this.triggerEvent('episodechange', {
        index: absoluteIndex,
        episode,
      })

      setTimeout(() => {
        this.setData({
          isTapping: false,
        })
      }, 300)
    },
  },
})
