Component({
  properties: {
    icon: String,
    title: String,
    description: String,
    showButton: Boolean,
    buttonText: String,
  },

  methods: {
    handleTap() {
      this.triggerEvent('action')
    },
  },
})
