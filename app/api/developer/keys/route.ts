import { NextRequest, NextResponse } from "next/server"
import { db, users, userCompanies, apiKeys } from "@/lib/db"
import { eq, and, desc } from "drizzle-orm"
import { checkQuota } from "@/lib/quota"
import crypto from "crypto"

// Generate a secure API key
function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `wt_${crypto.randomBytes(24).toString("hex")}`
  const hash = crypto.createHash("sha256").update(key).digest("hex")
  const prefix = key.substring(0, 11) // "wt_" + first 8 chars
  return { key, hash, prefix }
}

// GET /api/developer/keys - List all API keys for user
export async function GET(request: NextRequest) {
  try {
    const telegramId = request.headers.get("x-telegram-id")
    if (!telegramId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const user = await db.query.users.findFirst({
      where: eq(users.telegram_id, telegramId),
    })
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        key_prefix: apiKeys.key_prefix,
        permissions: apiKeys.permissions,
        usage_count: apiKeys.usage_count,
        last_used_at: apiKeys.last_used_at,
        rate_limit: apiKeys.rate_limit,
        created_at: apiKeys.created_at,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.user_id, user.id), eq(apiKeys.is_active, true)))
      .orderBy(desc(apiKeys.created_at))

    return NextResponse.json({
      success: true,
      data: {
        keys: keys.map((k) => ({
          id: k.id,
          name: k.name,
          keyPrefix: k.key_prefix,
          permissions: k.permissions,
          usageCount: k.usage_count,
          lastUsedAt: k.last_used_at,
          rateLimit: k.rate_limit,
          createdAt: k.created_at,
        })),
      },
    })
  } catch (error) {
    console.error("Error listing API keys:", error)
    return NextResponse.json({ success: false, error: "Failed to list API keys" }, { status: 500 })
  }
}

// POST /api/developer/keys - Create new API key
export async function POST(request: NextRequest) {
  try {
    const telegramId = request.headers.get("x-telegram-id")
    if (!telegramId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, permissions = ["notify"], companyId } = body

    if (!name || !companyId) {
      return NextResponse.json(
        { success: false, error: "Name and companyId are required" },
        { status: 400 }
      )
    }

    const user = await db.query.users.findFirst({
      where: eq(users.telegram_id, telegramId),
    })
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Check user belongs to company and is admin/manager
    const userCompany = await db.query.userCompanies.findFirst({
      where: and(
        eq(userCompanies.user_id, user.id),
        eq(userCompanies.company_id, companyId)
      ),
    })
    if (!userCompany || userCompany.role === "employee") {
      return NextResponse.json(
        { success: false, error: "Only admins and managers can create API keys" },
        { status: 403 }
      )
    }

    // Check API key quota
    const quotaResult = await checkQuota(companyId, "api_keys")
    if (!quotaResult.allowed) {
      return NextResponse.json(
        { success: false, error: quotaResult.message, quotaExceeded: true, planRequired: quotaResult.planRequired },
        { status: 400 }
      )
    }

    // Generate new key
    const { key, hash, prefix } = generateApiKey()

    const [apiKey] = await db
      .insert(apiKeys)
      .values({
        key: hash,
        key_prefix: prefix,
        name,
        user_id: user.id,
        company_id: companyId,
        permissions,
        rate_limit: 60,
      })
      .returning()

    return NextResponse.json({
      success: true,
      data: {
        id: apiKey.id,
        name: apiKey.name,
        key, // Return the actual key only on creation!
        keyPrefix: prefix,
        permissions: apiKey.permissions,
        rateLimit: apiKey.rate_limit,
        createdAt: apiKey.created_at,
      },
      message: "API key created. Save it now - you won't be able to see it again!",
    })
  } catch (error) {
    console.error("Error creating API key:", error)
    return NextResponse.json({ success: false, error: "Failed to create API key" }, { status: 500 })
  }
}
