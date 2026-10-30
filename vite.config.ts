import { existsSync, readFileSync } from 'node:fs'
import type { IncomingMessage } from 'node:http'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { handleTts, TTS_PATH, type TtsEnv } from './worker/tts'

/** wrangler와 같은 .dev.vars를 읽어요. 키는 브라우저 코드에 들어가지 않아요. */
function readDevVars(): TtsEnv {
  if (!existsSync('.dev.vars')) return {}
  const entries = readFileSync('.dev.vars', 'utf8')
    .split('\n')
    .map((line) => /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line))
    .filter((match) => match !== null)
    .map((match) => [match[1], match[2].replace(/^["']|["']$/g, '')])
  return Object.fromEntries(entries)
}

const readBody = async (request: IncomingMessage) => {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

/** 개발 서버에서도 배포의 Worker처럼 /tts를 받아요. */
const ttsDevServer = (): Plugin => ({
  name: 'tts-dev-server',
  configureServer(server) {
    server.middlewares.use(TTS_PATH, (request, response, next) => {
      void (async () => {
        const web = new Request(`http://${request.headers.host}${TTS_PATH}`, {
          method: request.method,
          headers: { Origin: String(request.headers.origin ?? '') },
          body: request.method === 'POST' ? await readBody(request) : undefined,
        })
        const result = await handleTts(web, { ...readDevVars(), ...process.env })
        response.statusCode = result.status
        result.headers.forEach((value, name) => response.setHeader(name, value))
        response.end(Buffer.from(await result.arrayBuffer()))
      })().catch(next)
    })
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), ttsDevServer()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
