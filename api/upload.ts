import { put, head } from '@vercel/blob'

export async function POST(req: Request) {
  const url = new URL(req.url)

  const hash = url.searchParams.get('hash')
  const level = url.searchParams.get('level')
  const command = level === '0' ? 'chunk' : 'manifest'
  console.log({ hash, level, command })
  if (command === 'manifest') {
    const buffer = await req.arrayBuffer()
    const body = new Uint8Array(buffer)
    await put(hash, buffer, {
      contentType: 'application/x-swarm-manifest',
      access: 'public',
    })

    const needs: Uint8Array[] = []
    for (let o = 0; o < body.length; o += 32) {
      const subHash = body.subarray(o, o + 32)
      if (!(await hasChunk(bytesToHex(subHash)))) {
        needs.push(subHash)
      }
    }
    const needsManifest = new Uint8Array(needs.length * 32)
    for (let i = 0; i < needs.length; i++) {
      needsManifest.set(needs[i], i * 32)
    }
    return new Response(needsManifest, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-swarm-manifest',
      },
    })
  }
  return Response.json({ hash, level, command })
}

async function hasChunk(hash: string) {
  try {
    await head(hash)
    return true
  } catch (err) {
    console.log(err)
    return false
  }
}

function bytesToHex(bytes: Uint8Array): string {
  const octets = new Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) {
    octets[i] = bytes[i].toString(16).padStart(2, '0')
  }
  return octets.join('')
}
