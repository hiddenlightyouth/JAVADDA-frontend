import { handleTts, TTS_PATH, type TtsEnv } from './tts'

/**
 * 배포용 Worker예요. 화면과 파일은 `wrangler.toml`의 assets가 바로 내보내고, 이 코드는 /tts 요청만 받아요.
 * API 키는 `wrangler secret put ELEVENLABS_API_KEY`로 넣어요.
 */

interface Env extends TtsEnv {
  TTS_LIMIT?: { limit: (input: { key: string }) => Promise<{ success: boolean }> }
}

interface Context {
  waitUntil: (work: Promise<unknown>) => void
}

export default {
  async fetch(request: Request, env: Env, context: Context): Promise<Response> {
    if (new URL(request.url).pathname !== TTS_PATH) return new Response('Not found', { status: 404 })
    return handleTts(request, env, {
      cache: (caches as unknown as { default: Cache }).default,
      // 같은 주소에서 너무 많이 만들지 못하게 해요. 이미 만든 음성을 다시 듣는 것은 세지 않아요.
      allow: async (item) => {
        if (!env.TTS_LIMIT) return true
        const { success } = await env.TTS_LIMIT.limit({ key: item.headers.get('CF-Connecting-IP') ?? 'unknown' })
        return success
      },
      defer: (work) => context.waitUntil(work),
    })
  },
}
