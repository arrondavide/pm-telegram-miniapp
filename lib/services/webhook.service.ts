/**
 * Webhook Service
 * Send events to external systems for integrations
 */

export type WebhookEvent =
  | "task.created"
  | "task.updated"
  | "task.deleted"
  | "task.completed"
  | "task.assigned"
  | "task.comment_added"
  | "project.created"
  | "project.updated"
  | "project.deleted"
  | "member.joined"
  | "member.removed"
  | "time.clock_in"
  | "time.clock_out"

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  companyId: string
  data: Record<string, any>
}

export interface WebhookConfig {
  id: string
  companyId: string
  url: string
  secret?: string
  events: WebhookEvent[] | "*"
  enabled: boolean
  createdAt: string
  lastTriggered?: string
  lastStatus?: number
  failureCount: number
}

export interface WebhookDelivery {
  id: string
  webhookId: string
  event: WebhookEvent
  payload: WebhookPayload
  status: "pending" | "success" | "failed"
  statusCode?: number
  responseBody?: string
  attempts: number
  lastAttempt?: string
  createdAt: string
}

// In-memory store for webhooks (would be MongoDB in production)
const webhooks: WebhookConfig[] = []
const deliveries: WebhookDelivery[] = []

/**
 * Register a webhook
 */
export function registerWebhook(
  companyId: string,
  url: string,
  events: WebhookEvent[] | "*",
  secret?: string
): WebhookConfig {
  const webhook: WebhookConfig = {
    id: generateId(),
    companyId,
    url,
    secret,
    events,
    enabled: true,
    createdAt: new Date().toISOString(),
    failureCount: 0,
  }

  webhooks.push(webhook)
  return webhook
}

/**
 * Remove a webhook
 */
export function removeWebhook(webhookId: string): boolean {
  const index = webhooks.findIndex((w) => w.id === webhookId)
  if (index === -1) return false
  webhooks.splice(index, 1)
  return true
}

/**
 * Get webhooks for a company
 */
export function getWebhooks(companyId: string): WebhookConfig[] {
  return webhooks.filter((w) => w.companyId === companyId)
}

/**
 * Trigger webhooks for an event
 */
export async function triggerWebhooks(
  companyId: string,
  event: WebhookEvent,
  data: Record<string, any>
): Promise<void> {
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    companyId,
    data,
  }

  const matchingWebhooks = webhooks.filter(
    (w) =>
      w.companyId === companyId &&
      w.enabled &&
      (w.events === "*" || w.events.includes(event))
  )

  // Fire and forget - don't block the main flow
  for (const webhook of matchingWebhooks) {
    deliverWebhook(webhook, payload).catch((error) => {
      console.error(`Webhook delivery failed for ${webhook.id}:`, error)
    })
  }
}

/**
 * Deliver webhook payload
 */
async function deliverWebhook(
  webhook: WebhookConfig,
  payload: WebhookPayload
): Promise<void> {
  const delivery: WebhookDelivery = {
    id: generateId(),
    webhookId: webhook.id,
    event: payload.event,
    payload,
    status: "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
  }

  deliveries.push(delivery)

  // Keep only last 1000 deliveries
  if (deliveries.length > 1000) {
    deliveries.shift()
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Event": payload.event,
      "X-Webhook-Timestamp": payload.timestamp,
    }

    // Add signature if secret is configured
    if (webhook.secret) {
      const signature = await generateSignature(JSON.stringify(payload), webhook.secret)
      headers["X-Webhook-Signature"] = signature
    }

    delivery.attempts++
    delivery.lastAttempt = new Date().toISOString()

    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    })

    delivery.statusCode = response.status
    delivery.status = response.ok ? "success" : "failed"

    if (!response.ok) {
      delivery.responseBody = await response.text().catch(() => "")
      webhook.failureCount++
    } else {
      webhook.failureCount = 0
    }

    webhook.lastTriggered = new Date().toISOString()
    webhook.lastStatus = response.status

    // Disable webhook after 10 consecutive failures
    if (webhook.failureCount >= 10) {
      webhook.enabled = false
    }
  } catch (error) {
    delivery.status = "failed"
    delivery.attempts++
    webhook.failureCount++
  }
}

/**
 * Generate HMAC signature for payload
 */
async function generateSignature(payload: string, secret: string): Promise<string> {
  // In browser, use SubtleCrypto
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const encoder = new TextEncoder()
    const key = await window.crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )
    const signature = await window.crypto.subtle.sign("HMAC", key, encoder.encode(payload))
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  }

  // Fallback for server-side
  return `sha256=${secret.slice(0, 8)}` // Simplified for demo
}

/**
 * Get delivery history for a webhook
 */
export function getWebhookDeliveries(
  webhookId: string,
  limit: number = 50
): WebhookDelivery[] {
  return deliveries
    .filter((d) => d.webhookId === webhookId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}

/**
 * Retry a failed delivery
 */
export async function retryDelivery(deliveryId: string): Promise<boolean> {
  const delivery = deliveries.find((d) => d.id === deliveryId)
  if (!delivery || delivery.status !== "failed") return false

  const webhook = webhooks.find((w) => w.id === delivery.webhookId)
  if (!webhook) return false

  await deliverWebhook(webhook, delivery.payload)
  return true
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
}

/**
 * Available webhook events with descriptions
 */
export const WEBHOOK_EVENTS: { event: WebhookEvent; label: string; description: string }[] = [
  { event: "task.created", label: "Task Created", description: "When a new task is created" },
  { event: "task.updated", label: "Task Updated", description: "When a task is modified" },
  { event: "task.deleted", label: "Task Deleted", description: "When a task is deleted" },
  { event: "task.completed", label: "Task Completed", description: "When a task is marked complete" },
  { event: "task.assigned", label: "Task Assigned", description: "When a task is assigned to someone" },
  { event: "task.comment_added", label: "Comment Added", description: "When a comment is added to a task" },
  { event: "project.created", label: "Project Created", description: "When a new project is created" },
  { event: "project.updated", label: "Project Updated", description: "When a project is modified" },
  { event: "project.deleted", label: "Project Deleted", description: "When a project is deleted" },
  { event: "member.joined", label: "Member Joined", description: "When someone joins the company" },
  { event: "member.removed", label: "Member Removed", description: "When someone leaves the company" },
  { event: "time.clock_in", label: "Clock In", description: "When someone starts tracking time" },
  { event: "time.clock_out", label: "Clock Out", description: "When someone stops tracking time" },
]
