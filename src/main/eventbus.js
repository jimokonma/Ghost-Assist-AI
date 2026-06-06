import { EventEmitter } from 'events'

class EventBus extends EventEmitter {
  constructor() {
    super()
    this.setMaxListeners(50)
  }
}

export default new EventBus()
