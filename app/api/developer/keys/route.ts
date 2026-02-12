import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { ApiKey, User } from "@/lib/models"
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

    await connectToDatabase()

    const user = await User.findOne({ telegram_id: telegramId })
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const keys = await ApiKey.find({ user_id: user._id, is_active: true })
      .select("-key") // Don't return the actual key hash
      .sort({ createdAt: -1 })

    return NextResponse.json({
      success: true,
      data: {
        keys: keys.map((k) => ({
          id: k._id.toString(),
          name: k.name,
          keyPrefix: k.key_prefix,
          permissions: k.permissions,
          usageCount: k.usage_count,
          lastUsedAt: k.last_used_at,
          rateLimit: k.rate_limit,
          createdAt: k.createdAt,
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

    await connectToDatabase()

    const user = await User.findOne({ telegram_id: telegramId })
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Check user belongs to company
    const userCompany = user.companies.find(
      (c: any) => c.company_id.toString() === companyId
    )
    if (!userCompany || userCompany.role === "employee") {
      return NextResponse.json(
        { success: false, error: "Only admins and managers can create API keys" },
        { status: 403 }
      )
    }

    // Limit keys per user
    const existingKeysCount = await ApiKey.countDocuments({
      user_id: user._id,
      is_active: true,
    })
    if (existingKeysCount >= 10) {
      return NextResponse.json(
        { success: false, error: "Maximum of 10 API keys allowed" },
        { status: 400 }
      )
    }

    // Generate new key
    const { key, hash, prefix } = generateApiKey()

    const apiKey = await ApiKey.create({
      key: hash,
      key_prefix: prefix,
      name,
      user_id: user._id,
      company_id: companyId,
      permissions,
      rate_limit: 60,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: apiKey._id.toString(),
        name: apiKey.name,
        key, // Return the actual key only on creation!
        keyPrefix: prefix,
        permissions: apiKey.permissions,
        rateLimit: apiKey.rate_limit,
        createdAt: apiKey.createdAt,
      },
      message: "API key created. Save it now - you won't be able to see it again!",
    })
  } catch (error) {
    console.error("Error creating API key:", error)
    return NextResponse.json({ success: false, error: "Failed to create API key" }, { status: 500 })
  }
}
