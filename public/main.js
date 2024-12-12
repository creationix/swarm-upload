document.getElementById('drop_zone').addEventListener('dragover', function (event) {
  event.preventDefault()
  event.stopPropagation()
  this.classList.add('dragging')
})

document.getElementById('drop_zone').addEventListener('dragleave', function (event) {
  event.preventDefault()
  event.stopPropagation()
  this.classList.remove('dragging')
})
const HASH = 'SHA-256'
const HASH_SIZE = 32
const BLOCK_POWER = 18
const BLOCK_SIZE = 2 ** BLOCK_POWER

document.getElementById('drop_zone').addEventListener('drop', async function (event) {
  event.preventDefault()
  event.stopPropagation()
  this.classList.remove('dragging')
  for (const file of event.dataTransfer.files) {
    processFile(file).then(({ name, type, size, hash, level }) => {
      console.log(`Upload Complete:\n  ${name}\n  ${type} (${humanize(size)})\n  ${hash}/${level}`)
    })
  }
})

const MAX_CONCURRENT_UPLOADS = 10

/** @typedef {string[]} UploadResult */
/** @typedef {(needs:UploadResult|PromiseLike<UploadResult>)=>void} UploadResolve */
/** @typedef {(reason?:string)=>void} UploadReject */

/**
 * @typedef {Object} UploadQueueItem
 * @property {string} hash
 * @property {number} level
 * @property {Uint8Array} bytes
 * @property {UploadResolve} resolve
 * @property {UploadReject} reject
 */

/** @type {UploadQueueItem[]} */
const uploadQueue = []

/** @type {Set<string>} */
const uploadingHashes = new Set()

/**
 * @param {string} hash
 * @param {number} level
 * @param {Uint8Array} bytes
 * @returns {Promise<UploadResult>}
 */
function uploadChunk(hash, level, bytes) {
  if (uploadingHashes.has(hash)) {
    return Promise.resolve([])
  }
  return new Promise((resolve, reject) => {
    uploadQueue.push({ hash, bytes, level, resolve, reject })
    checkUploads()
  })
}

function checkUploads() {
  if (uploadQueue.length > 0 && uploadingHashes.size < MAX_CONCURRENT_UPLOADS) {
    const next = uploadQueue.pop()
    Promise.resolve().then(() => startUpload(next))
  }
}

function startUpload({ hash, bytes, level, resolve, reject }) {
  uploadingHashes.add(hash)
  try {
    resolve(uploadRequest(hash, level, bytes))
  } catch (err) {
    reject(err)
  } finally {
    uploadingHashes.delete(hash)
    checkUploads()
  }
}

/**
 * @type {Record<string, Uint8Array>}
 */
const chunks = {}

/**
 * @param {string} hash
 * @param {number} level
 * @param {Uint8Array} bytes
 * @returns {Promise<UploadResult>}
 */
async function uploadRequest(hash, level, bytes) {
  console.log(`Uploading chunk (${humanize(bytes.length)})`, hash, level)
  const res = await fetch(`/api/upload?hash=${hash}&level=${level}`, {
    method: 'POST',
    headers: {
      'content-type': level > 0 ? 'application/x-swarm-manifest' : 'application/octet-stream',
    },
    body: bytes,
  })
  if (!res.ok) {
    throw new Error(res.statusText)
  }
  if (res.status === 200) {
    const needsManifest = new Uint8Array(await res.arrayBuffer())
    const count = Math.floor(needsManifest.byteLength / HASH_SIZE)
    if (count * HASH_SIZE !== needsManifest.byteLength) {
      throw new Error('Invalid manifest length')
    }
    const needs = new Array(count)
    for (let i = 0; i < count; i++) {
      const o = i * HASH_SIZE
      needs[i] = bytesTohex(needsManifest.slice(o, o + HASH_SIZE))
    }
    return needs
  }
  if (res.status === 204) {
    return []
  }
  throw new Error(`Unespected HTTP status: ${res.status}`)
}

/**
 * @param {File} file
 */
async function processFile(file) {
  const data = new Uint8Array(await file.arrayBuffer())
  const size = data.byteLength
  const { hash, level } = await processData(data)
  const { name, type } = file
  fullUploadChunk(hash, level)
  return { name, type, size, hash, level }
}

/**
 *
 * @param {string} hash
 * @param {number} level
 */
async function fullUploadChunk(hash, level) {
  const chunk = chunks[hash]
  if (!chunk) {
    throw new Error(`Chunk not found: ${hash}`)
  }
  for (const need of await uploadChunk(hash, level, chunk)) {
    await fullUploadChunk(need, level - 1)
  }
}

/**
 * @param {Uint8Array} data
 * @param {number} level
 * @returns {Promise<{hash:string,level:number}>}
 */
async function processData(data, level = 0) {
  // If the data fits in a chunk already, hash it and we're done.
  const len = data.byteLength
  if (len <= BLOCK_SIZE) {
    const hash = new Uint8Array(await window.crypto.subtle.digest(HASH, data))
    const hex = bytesTohex(hash)
    chunks[hex] = data
    return { hash: hex, level }
  }

  // If it's larger than a chunk, split it into chunks and process each one.
  // Store the hashes as a new doc and recurse the algorithm.
  const chunksNeeded = Math.ceil(len / BLOCK_SIZE)
  console.log({ chunksNeeded })
  const metaFile = new Uint8Array(chunksNeeded * HASH_SIZE)
  for (let i = 0; i < chunksNeeded; i++) {
    const chunk = data.subarray(i * BLOCK_SIZE, i * BLOCK_SIZE + BLOCK_SIZE)
    const hash = new Uint8Array(await window.crypto.subtle.digest(HASH, chunk))
    metaFile.set(new Uint8Array(hash), i * HASH_SIZE)
    const hex = bytesTohex(hash)
    chunks[hex] = chunk
  }
  return processData(metaFile, level + 1)
}

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesTohex(bytes) {
  const octets = new Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) {
    octets[i] = bytes[i].toString(16).padStart(2, '0')
  }
  return octets.join('')
}

/**
 * Convert a byte length to a human readable string
 * @param {number} byteLength
 * @returns {string}
 */
function humanize(byteLength) {
  if (byteLength < 1024) {
    return `${byteLength} bytes`
  }
  if (byteLength < 1024 ** 2) {
    return `${(byteLength / 1024).toFixed(2)} KiB`
  }
  if (byteLength < 1024 ** 3) {
    return `${(byteLength / 1024 ** 2).toFixed(2)} MiB`
  }
  if (byteLength < 1024 ** 4) {
    return `${(byteLength / 1024 ** 3).toFixed(2)} GiB`
  }
  return `${(byteLength / 1024 ** 4).toFixed(2)} TiB`
}