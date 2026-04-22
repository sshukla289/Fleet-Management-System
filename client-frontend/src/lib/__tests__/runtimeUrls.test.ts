jest.mock('../readViteEnv', () => ({
  readViteEnv: jest.fn(),
}))

import { readViteEnv } from '../readViteEnv'
import { resolveApiBaseUrl, resolveHttpBaseUrl } from '../runtimeUrls'

const mockedReadViteEnv = readViteEnv as jest.MockedFunction<typeof readViteEnv>

describe('runtimeUrls', () => {
  beforeEach(() => {
    mockedReadViteEnv.mockReset()
    delete (globalThis as { __API_BASE_URL__?: string }).__API_BASE_URL__
  })

  it('falls back to the repo backend port when env values are unavailable', () => {
    mockedReadViteEnv.mockReturnValue(undefined)

    expect(resolveApiBaseUrl()).toBe('http://localhost:8081/api')
    expect(resolveHttpBaseUrl()).toBe('http://localhost:8081')
  })

  it('prefers the runtime API override when it is present', () => {
    mockedReadViteEnv.mockReturnValue(undefined)
    ;(globalThis as { __API_BASE_URL__?: string }).__API_BASE_URL__ = 'http://127.0.0.1:8081/api/'

    expect(resolveApiBaseUrl()).toBe('http://127.0.0.1:8081/api')
    expect(resolveHttpBaseUrl()).toBe('http://127.0.0.1:8081')
  })
})
