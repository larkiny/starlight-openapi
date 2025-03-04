import { z } from 'astro/zod'
import type { OpenAPI } from 'openapi-types'

import { getBasePath, stripLeadingAndTrailingSlashes } from './path'
import { getPathItemSidebarGroups, getWebhooksSidebarGroups } from './pathItem'
import { makeSidebarGroup, makeSidebarLink, type SidebarManualGroup } from './starlight'

export const SchemaConfigSchema = z.object({
  /**
   * The base path containing the generated documentation.
   * @example 'api/petstore'
   */
  base: z.string().min(1).transform(stripLeadingAndTrailingSlashes),
  /**
   * Wheter the generated documentation sidebar group should be collapsed by default.
   * @default true
   */
  collapsed: z.boolean().default(true),
  /**
   * The generated documentation sidebar group label.
   */
  label: z.string().optional(),
  /**
   * The OpenAPI/Swagger schema path or URL.
   */
  schema: z.string().min(1),
  /**
   * Defines if the sidebar should display badges next to operation links with the associated HTTP method.
   * @default false
   */
  sidebarMethodBadges: z.boolean().default(false),
})

export function getSchemaSidebarGroups(schema: Schema): SidebarManualGroup {
  const { config, document } = schema

  return makeSidebarGroup(
    config.label ?? document.info.title,
    [
      makeSidebarLink('Overview', getBasePath(config)),
      ...getPathItemSidebarGroups(schema),
      ...getWebhooksSidebarGroups(schema),
    ],
    config.collapsed,
  )
}

export type StarlightOpenAPISchemaConfig = z.infer<typeof SchemaConfigSchema>

export interface Schema {
  config: StarlightOpenAPISchemaConfig
  document: OpenAPI.Document
}
