import { put, head, BlobNotFoundError } from '@vercel/blob'

export async function POST(req: Request) {
  const url = new URL(req.url)

  const hash = url.searchParams.get('hash')
  const level = parseInt(url.searchParams.get('level'), 10)
  console.log(`Uploading ${hash}/${level}...`)
  const buffer = await req.arrayBuffer()

  await put(hash, buffer, {
    access: 'public',
    contentType: level > 0 ? 'application/x-swarm-manifest' : 'application/octet-stream',
    cacheControlMaxAge: 300,
  })

  if (level === 0) {
    return new Response(null, { status: 204 })
  }

  const body = new Uint8Array(buffer)
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

async function hasChunk(hash: string) {
  try {
    await head(hash)
    return true
  } catch (err) {
    if (err instanceof BlobNotFoundError) {
      return false
    }
    throw err
  }
}

function bytesToHex(bytes: Uint8Array): string {
  const octets = new Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) {
    octets[i] = bytes[i].toString(16).padStart(2, '0')
  }
  return octets.join('')
}
