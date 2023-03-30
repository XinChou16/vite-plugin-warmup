import fs from 'node:fs/promises'
import path from 'node:path'
import { normalizePath } from 'vite'
import glob from 'fast-glob'

/** @type {import('./index').warmup} */
export function warmup(options) {
  return {
    name: 'warmup',
    apply: 'serve',
    configureServer(server) {
      if (options.clientFiles?.length) {
        mapFiles(options.clientFiles).then((clientFiles) => {
          for (const file of clientFiles) {
            warmupFile(server, file, false)
          }
        })
      }
      if (options.ssrFiles?.length) {
        mapFiles(options.ssrFiles).then((ssrFiles) => {
          for (const file of ssrFiles) {
            warmupFile(server, file, true)
          }
        })
      }
    }
  }
}

/** @type {import('./index').warmupFile} */
export async function warmupFile(server, file, ssr) {
  // transform html with the `transformIndexHtml` hook as Vite internals would
  // pre-transform the imported JS modules linked. this may cause `transformIndexHtml`
  // plugins to be executed twice, but that's probably fine.
  if (file.endsWith('.html')) {
    const url = htmlFileToUrl(file, server.config.root)
    if (url) {
      const html = await fs.readFile(file, 'utf-8')
      await server.transformIndexHtml(url, html)
    }
  }
  // for other files, pass it through `transformRequest`. this is what Vite uses
  // for it's `server.preTransformRequests` option.
  else {
    const url = fileToUrl(file, server.config.root)
    await server.transformRequest(url, { ssr })
  }
}

/**
 * @param {string} file
 * @param {string} root
 */
function htmlFileToUrl(file, root) {
  const url = path.relative(root, file)
  // out of root, ignore file
  if (url[0] === '.') return
  // create root-relative url
  return '/' + normalizePath(url)
}

/**
 * @param {string} file
 * @param {string} root
 */
function fileToUrl(file, root) {
  // if file within root, create root-relative url
  if (file.startsWith(root + path.sep)) {
    return normalizePath(file.slice(root.length))
  }
  // out or root, use /@fs/ prefix
  else {
    return path.posix.join('/@fs/', normalizePath(file))
  }
}

/**
 * @param {string[]} files
 */
function mapFiles(files) {
  return glob(files, {
    absolute: true,
    dot: true
  })
}