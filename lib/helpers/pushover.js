import axios from 'axios'

export default class Pushover {

  constructor() {
    this.payload = {
      user: '',
      token: '',
      message: ''
    }
  }

  cleanPayload() {
    for (const key in this.payload) {
      if (this.payload[key] === '' || this.payload[key] === 0) {
        delete this.payload[key]
      }
    }
  }

  resetPayload() {
    this.payload = {
      user: '',
      token: '',
      message: ''
    }
  }

  setUser(user) {
    this.payload.user = user
  }

  setToken(token) {
    this.payload.token = token
  }

  setTitle(title) {
    this.payload.title = title
  }

  setMessage(message) {
    this.payload.message = message
  }

  setSound(sound) {
    this.payload.sound = sound
  }

  setPriority(priority) {
    this.payload.priority = priority
    // If priority is 2 (emergency), expire and retry must be set
    if (priority === 2) {
      if (!this.payload.expire || this.payload.expire <= 0) {
        this.payload.expire = 3600 // default 1 hour
      }
      if (!this.payload.retry || this.payload.retry <= 0) {
        this.payload.retry = 60 // default 1 minute
      }
    }
  }

  setURL(url, url_title) {
    this.payload.url = url
    this.payload.url_title = url_title
  }

  setHtml() {
    this.payload.html = 1
  }

  setExpire(expire) {
    this.payload.expire = expire
  }

  setRetry(retry) {
    this.payload.retry = retry
  }

  async send(title, message) {
    if (title) {
      this.payload.title = title
    }
    if (message) {
      this.payload.message = message
    }

    try {
      this.cleanPayload()
      const response = await axios.post('https://api.pushover.net/1/messages.json', this.payload)
      return response.data
    } catch (error) {
      throw new Error(`Pushover send error: ${error.response.data.errors[0]}`)
    }
  }
}
