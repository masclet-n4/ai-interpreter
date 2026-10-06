import { afterEach, describe, expect, it } from 'bun:test'
import { handleRequest } from './server.js'

const originalFetch = globalThis.fetch
const originalEnv = {
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
  RUSTFS_ENDPOINT: process.env.RUSTFS_ENDPOINT,
  INTERPRETER_MAX_TEXT_BYTES: process.env.INTERPRETER_MAX_TEXT_BYTES,
}

afterEach(() => {
  globalThis.fetch = originalFetch
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

function post(path: string, body: unknown): Request {
  return new Request('http://interpreter.local' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('interpreter API', () => {
  it('validates caller schemas before the OCR job starts', async () => {
    const response = await handleRequest(post('/validate-schema', {
      schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ valid: true })

    const invalid = await handleRequest(post('/validate-schema', { schema: { type: 'not-json-schema-type' } }))
    expect(invalid.status).toBe(400)
  })

  it('downloads only from configured RustFS and validates OpenRouter output with AJV', async () => {
    process.env.RUSTFS_ENDPOINT = 'http://rustfs.local:9000'
    process.env.OPENROUTER_API_KEY = 'test-key'
    process.env.OPENROUTER_MODEL = 'test/model'
    const requests: Array<{ url: string; body?: Record<string, unknown> }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : undefined
      requests.push({ url, body })
      if (url.startsWith('http://rustfs.local:9000/')) return new Response('Nombre: Ada')
      return Response.json({
        id: 'gen-123',
        model: 'test/model',
        provider: 'test-provider',
        usage: {
          prompt_tokens: 12,
          completion_tokens: 5,
          total_tokens: 17,
          cost: 0.0002,
          prompt_tokens_details: { cached_tokens: 2 },
        },
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ name: 'Ada' }) } }],
      })
    }) as typeof fetch

    const response = await handleRequest(post('/interpret', {
      text_url: 'http://rustfs.local:9000/ocr-results/doc.txt?signature=private',
      schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      result: { name: 'Ada' },
      usage: { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17, cost: 0.0002 },
    })
    expect(requests).toHaveLength(2)
    expect(requests[1].url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(requests[1].body?.provider).toEqual({ require_parameters: true })
    expect(requests[1].body?.usage).toEqual({ include: true })
  })

  it('rejects arbitrary download URLs and output that fails AJV', async () => {
    process.env.RUSTFS_ENDPOINT = 'http://rustfs.local:9000'
    process.env.OPENROUTER_API_KEY = 'test-key'
    let fetchCount = 0
    globalThis.fetch = (async () => {
      fetchCount++
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ name: 'wrong type' }) } }] })
    }) as typeof fetch

    const blocked = await handleRequest(post('/interpret', {
      text_url: 'http://127.0.0.1:8080/secret',
      schema: { type: 'object' },
    }))
    expect(blocked.status).toBe(400)
    expect(fetchCount).toBe(0)

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      fetchCount++
      return String(input).startsWith('http://rustfs.local:9000/')
        ? new Response('document')
        : Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ name: 5 }) } }] })
    }) as typeof fetch
    const invalidOutput = await handleRequest(post('/interpret', {
      text_url: 'http://rustfs.local:9000/ocr-results/doc.txt?signature=private',
      schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    }))
    expect(invalidOutput.status).toBe(502)
    expect((await invalidOutput.json()).detail).toContain('no cumple el schema')
  })

  it('limits downloaded OCR text size', async () => {
    process.env.RUSTFS_ENDPOINT = 'http://rustfs.local:9000'
    process.env.OPENROUTER_API_KEY = 'test-key'
    process.env.INTERPRETER_MAX_TEXT_BYTES = '3'
    globalThis.fetch = (async () => new Response('large')) as typeof fetch

    const response = await handleRequest(post('/interpret', {
      text_url: 'http://rustfs.local:9000/ocr-results/doc.txt?signature=private',
      schema: { type: 'string' },
    }))
    expect(response.status).toBe(413)
  })
})
