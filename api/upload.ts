import { put, head } from '@vercel/blob'

export function POST(req: Request) {
  const url = new URL(req.url)

  const hash = url.searchParams.get('hash')
  const level = url.searchParams.get('level')
  const command = level === '0' ? 'chunk' : 'manifest'
  console.log({ hash, level, command })
  return Response.json({ hash, level, command })
}
    //   if (command === 'manifest') {
    //     const body = new Uint8Array(await req.arrayBuffer())
    //     await writeChunk(hash, body)
    //     const needs = []
    //     for (let o = 0; o < body.length; o += 32) {
    //       const subHash = body.subarray(o, o + 32)
    //       if (!(await hasChunk(bytesToHex(subHash)))) {
    //         needs.push(subHash)
    //       }
    //     }
    //     const needsManifest = new Uint8Array(needs.length * 32)
    //     for (let i = 0; i < needs.length; i++) {
    //       needsManifest.set(needs[i], i * 32)
    //     }
    //     return new Response(needsManifest, {
    //       status: 200,
    //       headers: {
    //         'Content-Type': 'application/x-swarm-manifest',
    //       },
    //     })
    //   }
    //   if (command === 'chunk') {
    //     const body = new Uint8Array(await req.arrayBuffer())
    //     await writeChunk(hash, body)
    //     return new Response(null, { status: 204 })
    //   }
    // }

    // if (req.method === 'GET') {
    //   // Render static files from the public directory
    //   const path = url.pathname === '/' ? '/index.html' : url.pathname
    //   const filePath = `${PUBLIC_PATH}/${path}`
    //   const file = Bun.file(filePath)
    //   try {
    //     await file.text() // Attempt to read the file to check if it exists
    //     return new Response(file)
    //   } catch (error) {}
    // }

    // return new Response('Not found', { status: 404 })
//   }

