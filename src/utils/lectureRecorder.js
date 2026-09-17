const MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

export function getSupportedRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  return MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

export class LectureRecorder {
  constructor(options = {}) {
    this.options = {
      timeslice: 1000,
      videoBitsPerSecond: 6000000,
      ...options,
    }
    this.mediaRecorder = null
    this.stream = null
    this.chunks = []
    this.startedAt = 0
    this.stoppedAt = 0
    this.state = 'idle'
    this.mimeType = ''
    this.stopPromise = null
    this.blob = null
  }

  get isRecording() {
    return this.state === 'recording'
  }

  async start(stream) {
    if (!stream || typeof stream.getTracks !== 'function') {
      throw new TypeError('A MediaStream is required to start recording')
    }
    if (!['idle', 'error'].includes(this.state)) {
      throw new Error(`Cannot start recording from state: ${this.state}`)
    }
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('MediaRecorder is not supported by this browser')
    }

    this.stream = stream
    this.chunks = []
    this.blob = null
    this.mimeType = getSupportedRecordingMimeType()
    const options = {
      ...(this.mimeType ? { mimeType: this.mimeType } : {}),
      videoBitsPerSecond: this.options.videoBitsPerSecond,
    }
    this.mediaRecorder = new MediaRecorder(stream, options)
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) this.chunks.push(event.data)
    }
    this.mediaRecorder.onerror = (event) => {
      const error = event.error || new Error('Recording failed')
      this.state = 'error'
      this.stopPromise?.reject(error)
      this.stopPromise = null
      this.releaseTracks()
      this.mediaRecorder = null
    }

    this.mediaRecorder.start(this.options.timeslice)
    this.startedAt = performance.now()
    this.stoppedAt = 0
    this.state = 'recording'
    return this.getStats()
  }

  stop() {
    if (this.state === 'idle') return Promise.resolve(null)
    if (this.state === 'stopping') return this.stopPromise?.promise || Promise.resolve(null)
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      return Promise.resolve(this.blob || this.buildBlob())
    }

    this.state = 'stopping'
    this.stopPromise = {}
    this.stopPromise.promise = new Promise((resolve, reject) => {
      this.stopPromise.resolve = resolve
      this.stopPromise.reject = reject
    })
    this.mediaRecorder.onstop = () => {
      this.stoppedAt = performance.now()
      this.blob = this.buildBlob()
      this.state = 'completed'
      this.stopPromise.resolve(this.blob)
      this.stopPromise = null
      this.releaseTracks()
    }
    this.mediaRecorder.stop()
    return this.stopPromise.promise
  }

  cancel() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.onstop = null
      this.mediaRecorder.stop()
    }
    this.releaseTracks()
    this.chunks = []
    this.blob = null
    this.mediaRecorder = null
    this.state = 'idle'
    this.startedAt = 0
    this.stoppedAt = 0
    this.stopPromise = null
  }

  getStats() {
    const end = this.stoppedAt || performance.now()
    return {
      durationMs: this.startedAt ? Math.max(0, end - this.startedAt) : 0,
      chunkCount: this.chunks.length,
      mimeType: this.mimeType || 'video/webm',
      state: this.state,
    }
  }

  buildBlob() {
    return new Blob(this.chunks, { type: this.mimeType || 'video/webm' })
  }

  releaseTracks() {
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
  }

  cleanup() {
    this.cancel()
  }
}

export default LectureRecorder
