import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSnapshotPersistence } from '../useSnapshotPersistence'

const mocks = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
  saveSnapshot: vi.fn(),
}))

vi.mock('~/lib/api/documents', () => ({
  getSnapshot: mocks.getSnapshot,
  saveSnapshot: mocks.saveSnapshot,
}))

describe('useSnapshotPersistence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.getSnapshot.mockReset()
    mocks.saveSnapshot.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not lose edits that arrive while a save is in flight', async () => {
    let revision = 0
    const engine = {
      exportSnapshot: () => Uint8Array.from([++revision]),
    }
    const persistence = useSnapshotPersistence(
      'doc',
      () => engine,
      () => true,
    )
    persistence.markLoaded()

    let resolveFirst: (value: { version: number }) => void = () => {}
    const firstSave = new Promise<{ version: number }>((resolve) => {
      resolveFirst = resolve
    })
    mocks.saveSnapshot
      .mockReturnValueOnce(firstSave)
      .mockResolvedValueOnce({ version: 2 })

    persistence.schedule()
    vi.advanceTimersByTime(800)
    await Promise.resolve()
    expect(mocks.saveSnapshot).toHaveBeenCalledTimes(1)
    expect(mocks.saveSnapshot.mock.calls[0][1]).toEqual(Uint8Array.from([1]))

    persistence.schedule()
    resolveFirst({ version: 1 })
    await Promise.resolve()
    await Promise.resolve()

    await vi.advanceTimersByTimeAsync(800)
    await Promise.resolve()

    expect(mocks.saveSnapshot).toHaveBeenCalledTimes(2)
    expect(mocks.saveSnapshot.mock.calls[1][1]).toEqual(Uint8Array.from([2]))
    expect(persistence.saveState.value).toBe('saved')
  })
})
