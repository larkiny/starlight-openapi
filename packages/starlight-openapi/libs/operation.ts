import type { OpenAPI } from 'openapi-types'

import { type Document, isOpenAPIV2Document } from './document'
import { slug } from './path'
import { isPathItem, type PathItem } from './pathItem'
import type { Schema } from './schema'

const defaultOperationTag = 'Operations'
const operationHttpMethods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const

export function getOperationsByTag(document: Schema['document']) {
  const operationsByTag = new Map<string, { entries: PathItemOperation[]; tag: OperationTag }>()

  for (const [pathItemPath, pathItem] of Object.entries(document.paths ?? {})) {
    if (!isPathItem(pathItem)) {
      continue
    }

    const allOperationIds = operationHttpMethods.map((method) => {
      return isPathItemOperation(pathItem, method) ? (pathItem[method].operationId ?? pathItemPath) : undefined
    })

    for (const [index, method] of operationHttpMethods.entries()) {
      const operationId = allOperationIds[index]

      if (!operationId || !isPathItemOperation(pathItem, method)) {
        continue
      }

      const operation = pathItem[method]
      const isDuplicateOperationId = allOperationIds.filter((id) => id === operationId).length > 1
      const operationIdSlug = slug(operationId)

      for (const tag of operation.tags ?? [defaultOperationTag]) {
        const operations = operationsByTag.get(tag) ?? { entries: [], tag: { name: tag } }

        operations.entries.push({
          method,
          operation,
          path: pathItemPath,
          pathItem,
          slug: isDuplicateOperationId
            ? `operations/${operationIdSlug}/${slug(method)}`
            : `operations/${operationIdSlug}`,
          title:
            isDuplicateOperationId ? `${operationId} (${method.toUpperCase()})` : operationId,
        })

        operationsByTag.set(tag, operations)
      }
    }
  }

  // Sort the entries alphabetically by operationId
  for (const [tag, operations] of operationsByTag.entries()) {
    operations.entries.sort((a, b) => a.title.localeCompare(b.title))
    operationsByTag.set(tag, operations)
  }

  if (document.tags) {
    // Sort the tags alphabetically by name
    const sortedTags = document.tags.slice().sort((a, b) => a.name.localeCompare(b.name))
    const orderedTags = new Map(sortedTags.map((tag, index) => [tag.name, { index, tag }]))
    const operationsByTagArray = [...operationsByTag.entries()].sort(([tagA], [tagB]) => {
      return tagA.localeCompare(tagB)
    })

    operationsByTag.clear()

    for (const [tag, operations] of operationsByTagArray) {
      operationsByTag.set(tag, { ...operations, tag: orderedTags.get(tag)?.tag ?? operations.tag })
    }
  }

  return operationsByTag
}

export function getWebhooksOperations(document: Schema['document']): PathItemOperation[] {
  if (!('webhooks' in document)) {
    return []
  }

  const operations: PathItemOperation[] = []

  for (const [webhookKey, pathItem] of Object.entries(document.webhooks)) {
    if (!isPathItem(pathItem)) {
      continue
    }

    for (const method of operationHttpMethods) {
      if (!isPathItemOperation(pathItem, method)) {
        continue
      }

      const operation = pathItem[method]
      const operationId = operation.operationId ?? webhookKey

      operations.push({
        method,
        operation,
        pathItem,
        slug: `webhooks/${slug(operationId)}`,
        title: operationId,
      })
    }
  }

  return operations
}

export function isPathItemOperation<TMethod extends OperationHttpMethod>(
  pathItem: PathItem,
  method: TMethod,
): pathItem is Record<TMethod, Operation> {
  return method in pathItem
}

export function isMinimalOperationTag(tag: OperationTag): boolean {
  return (tag.description === undefined || tag.description.length === 0) && tag.externalDocs === undefined
}

export function getOperationURLs(document: Document, { operation, path, pathItem }: PathItemOperation): OperationURL[] {
  const urls: OperationURL[] = []

  if (isOpenAPIV2Document(document) && 'host' in document) {
    let url = document.host
    url += document.basePath ?? ''
    url += path ?? ''

    if (url.length > 0) {
      urls.push(makeOperationURL(url))
    }
  } else {
    const servers =
      'servers' in operation
        ? operation.servers
        : 'servers' in pathItem
          ? pathItem.servers
          : 'servers' in document
            ? document.servers
            : []

    for (const server of servers) {
      let url = server.url
      url += path ?? ''

      if (url.length > 0) {
        urls.push(makeOperationURL(url, server.description))
      }
    }
  }

  return urls
}

function makeOperationURL(url: string, description?: string): OperationURL {
  return { description, url: url.replace(/^\/\//, '') }
}

export interface PathItemOperation {
  method: OperationHttpMethod
  operation: Operation
  path?: string
  pathItem: PathItem
  slug: string
  title: string
}

export type Operation = OpenAPI.Operation
export type OperationHttpMethod = (typeof operationHttpMethods)[number]
export type OperationTag = NonNullable<Document['tags']>[number]

interface OperationURL {
  description?: string | undefined
  url: string
}
