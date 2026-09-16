import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { createScheduler } from './scheduler.js'

describe('#createScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('does not run the task until started', () => {
    const task = vi.fn()
    createScheduler({ intervalMs: 1000, task })
    vi.advanceTimersByTime(5000)
    expect(task).not.toHaveBeenCalled()
  })

  test('runs the task after the configured initial delay', async () => {
    const task = vi.fn().mockResolvedValue()
    const scheduler = createScheduler({
      intervalMs: 1000,
      initialDelayMs: 500,
      task
    })
    scheduler.start()

    await vi.advanceTimersByTimeAsync(499)
    expect(task).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(task).toHaveBeenCalledTimes(1)
  })

  test('reschedules the next run only after the current run completes', async () => {
    const task = vi.fn().mockResolvedValue()
    const scheduler = createScheduler({
      intervalMs: 1000,
      initialDelayMs: 1000,
      task
    })
    scheduler.start()

    await vi.advanceTimersByTimeAsync(1000)
    expect(task).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1000)
    expect(task).toHaveBeenCalledTimes(2)
  })

  test('stop() prevents further scheduled runs', async () => {
    const task = vi.fn().mockResolvedValue()
    const scheduler = createScheduler({
      intervalMs: 1000,
      initialDelayMs: 1000,
      task
    })
    scheduler.start()

    await vi.advanceTimersByTimeAsync(1000)
    expect(task).toHaveBeenCalledTimes(1)

    scheduler.stop()
    await vi.advanceTimersByTimeAsync(5000)
    expect(task).toHaveBeenCalledTimes(1)
  })

  test('a failed task invokes onError and scheduling continues', async () => {
    const onError = vi.fn()
    const task = vi.fn().mockRejectedValue(new Error('boom'))
    const scheduler = createScheduler({
      intervalMs: 1000,
      initialDelayMs: 1000,
      task,
      onError
    })
    scheduler.start()

    await vi.advanceTimersByTimeAsync(1000)
    expect(onError).toHaveBeenCalledWith(expect.any(Error))

    await vi.advanceTimersByTimeAsync(1000)
    expect(task).toHaveBeenCalledTimes(2)
  })

  test('isRunning reflects start/stop state', () => {
    const scheduler = createScheduler({ intervalMs: 1000, task: vi.fn() })
    expect(scheduler.isRunning()).toBe(false)
    scheduler.start()
    expect(scheduler.isRunning()).toBe(true)
    scheduler.stop()
    expect(scheduler.isRunning()).toBe(false)
  })

  test('calling start() twice does not create overlapping schedules', async () => {
    const task = vi.fn().mockResolvedValue()
    const scheduler = createScheduler({
      intervalMs: 1000,
      initialDelayMs: 1000,
      task
    })
    scheduler.start()
    scheduler.start()

    await vi.advanceTimersByTimeAsync(1000)
    expect(task).toHaveBeenCalledTimes(1)
  })
})
