// Recursive setTimeout scheduling (not setInterval) so the next run is only
// scheduled after the current one finishes — this guarantees the scheduler itself
// can never overlap a run, independent of any additional guard the task provides.
export function createScheduler({
  intervalMs,
  initialDelayMs = 0,
  task,
  onError
}) {
  let timer = null
  let running = false

  function scheduleNext(delay) {
    if (!running) {
      return
    }
    timer = setTimeout(() => {
      Promise.resolve()
        .then(task)
        .catch((cause) => onError?.(cause))
        .finally(() => scheduleNext(intervalMs))
    }, delay)
    timer.unref?.()
  }

  function start() {
    if (running) {
      return
    }
    running = true
    scheduleNext(initialDelayMs)
  }

  function stop() {
    running = false
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function isRunning() {
    return running
  }

  return { start, stop, isRunning }
}
