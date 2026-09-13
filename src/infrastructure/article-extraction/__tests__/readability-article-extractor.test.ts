import { describe, it, expect, vi } from 'vitest'
import {
  ARTICLE_FETCH_USER_AGENT,
  ReadabilityArticleExtractor,
  extractImageFromHtml,
} from '@/infrastructure/article-extraction/readability-article-extractor'

const ARTICLE_HTML = `<!doctype html><html><head><title>Doc</title>
<meta property="og:image" content="https://cdn.example.com/og.jpg" />
</head><body><article><h1>Heading</h1><p>${'A meaningful sentence. '.repeat(30)}</p></article></body></html>`

describe('extractImageFromHtml', () => {
  it('优先取 og:image', () => {
    expect(
      extractImageFromHtml('<meta property="og:image" content="https://x/og.jpg"><img src="https://x/i.jpg">'),
    ).toBe('https://x/og.jpg')
  })

  it('没有 og:image 时取首个 img', () => {
    expect(extractImageFromHtml('<p>x</p><img src="https://x/i.jpg" alt="a">')).toBe('https://x/i.jpg')
  })

  it('都没有时返回 null', () => {
    expect(extractImageFromHtml('<p>no images</p>')).toBeNull()
  })
})

describe('ReadabilityArticleExtractor', () => {
  it('提供 html 时直接抽取，不发起 HTTP 请求', async () => {
    const fetchImpl = vi.fn()
    const extractor = new ReadabilityArticleExtractor({ fetchImpl: fetchImpl as unknown as typeof fetch })

    const result = await extractor.extract({ url: 'https://example.com/a', html: ARTICLE_HTML })

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result.textContent).toContain('Heading')
    expect(result.htmlContent.length).toBeGreaterThan(0)
    expect(result.imageUrl).toBe('https://cdn.example.com/og.jpg')
  })

  it('没有 html 时以固定 UA 抓取', async () => {
    const fetchImpl = vi.fn(async () => new Response(ARTICLE_HTML, { status: 200 }))
    const extractor = new ReadabilityArticleExtractor({ fetchImpl: fetchImpl as unknown as typeof fetch })

    await extractor.extract({ url: 'https://example.com/a' })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://example.com/a')
    expect((init.headers as Record<string, string>)['User-Agent']).toBe(ARTICLE_FETCH_USER_AGENT)
  })

  it('非 2xx 抛出与迁移前一致的文案', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 503 }))
    const extractor = new ReadabilityArticleExtractor({ fetchImpl: fetchImpl as unknown as typeof fetch })

    await expect(extractor.extract({ url: 'https://example.com/a' })).rejects.toThrow(
      'HTTP 503 for https://example.com/a',
    )
  })

  it('抽取不到正文时抛出与迁移前一致的文案', async () => {
    const extractor = new ReadabilityArticleExtractor()

    await expect(
      extractor.extract({ url: 'https://example.com/empty', html: '<html><body></body></html>' }),
    ).rejects.toThrow('Readability failed to parse content')
  })
})
