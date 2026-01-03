import toast from 'react-hot-toast';

class ToastQueue {
  constructor(maxVisible = 3) {
    this.maxVisible = maxVisible;
    this.queue = [];
    this.active = [];
    this.history = [];
    this.maxHistory = 20;
    this.dedupeMap = new Map();
    this.dedupeTimeout = 2000;
  }

  _isDuplicate(message) {
    const key = `toast_${message}`;
    if (this.dedupeMap.has(key)) {
      const lastTime = this.dedupeMap.get(key);
      if (Date.now() - lastTime < this.dedupeTimeout) {
        return true;
      }
    }
    this.dedupeMap.set(key, Date.now());
    return false;
  }

  _addToHistory(message, type) {
    this.history.unshift({
      id: Date.now(),
      message,
      type,
      timestamp: new Date(),
      read: false
    });
    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }
    localStorage.setItem('notification_history', JSON.stringify(this.history));
  }

  _processQueue() {
    if (this.active.length < this.maxVisible && this.queue.length > 0) {
      const next = this.queue.shift();
      this.active.push(next);
      
      const toastId = toast(next.message, {
        icon: next.icon,
        duration: next.duration || 3000,
        position: 'top-right'
      });

      setTimeout(() => {
        this.active = this.active.filter(t => t !== next);
        this._processQueue();
      }, next.duration || 3000);
    }
  }

  show(message, type = 'info', options = {}) {
    if (this._isDuplicate(message)) {
      return;
    }

    const icon = this._getIcon(type);
    const duration = options.duration || this._getDuration(type);

    const toastItem = {
      message,
      type,
      icon,
      duration,
      ...options
    };

    this._addToHistory(message, type);
    
    if (this.active.length < this.maxVisible) {
      this.active.push(toastItem);
      toast(message, {
        icon,
        duration,
        position: 'top-right'
      });

      setTimeout(() => {
        this.active = this.active.filter(t => t !== toastItem);
        this._processQueue();
      }, duration);
    } else {
      this.queue.push(toastItem);
    }
  }

  success(message, options) {
    this.show(message, 'success', options);
  }

  error(message, options) {
    this.show(message, 'error', options);
  }

  warning(message, options) {
    this.show(message, 'warning', options);
  }

  info(message, options) {
    this.show(message, 'info', options);
  }

  _getIcon(type) {
    const icons = {
      success: '',
      error: '',
      warning: '',
      info: '?',
      loading: ''
    };
    return icons[type] || '';
  }

  _getDuration(type) {
    const durations = {
      success: 3000,
      error: 4000,
      warning: 3500,
      info: 3000,
      loading: 0
    };
    return durations[type] || 3000;
  }

  getHistory() {
    return this.history;
  }

  clearHistory() {
    this.history = [];
    localStorage.removeItem('notification_history');
  }

  getActive() {
    return this.active;
  }

  getQueueSize() {
    return this.queue.length;
  }
}

const toastQueue = new ToastQueue(3);
export default toastQueue;
