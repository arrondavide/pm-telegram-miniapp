/**
 * Service for sending platform admin notifications via Telegram
 * Notifies the WhatsTask admin about new companies and users
 */

import { sendMessage, bold } from "./bot"

// Get admin Telegram ID from environment
function getAdminTelegramId(): string | null {
  return process.env.ADMIN_TELEGRAM_ID || null
}

/**
 * Notify admin when a new company is created
 */
export async function notifyAdminNewCompany(
  company: {
    name: string
    companyId: string
  },
  creator: {
    fullName: string
    username?: string
    telegramId: string
  },
  stats: {
    totalCompanies: number
  }
): Promise<{ success: boolean; error?: string }> {
  const adminTelegramId = getAdminTelegramId()
  if (!adminTelegramId) {
    console.log("[Admin Notifier] No ADMIN_TELEGRAM_ID configured")
    return { success: false, error: "No admin configured" }
  }

  const usernameDisplay = creator.username ? `@${creator.username}` : "N/A"

  let message = `🏢 ${bold("New Company Created")}!\n\n`
  message += `${bold("Company:")} ${company.name}\n`
  message += `${bold("Created by:")} ${creator.fullName}\n`
  message += `${bold("Username:")} ${usernameDisplay}\n`
  message += `${bold("Telegram ID:")} ${creator.telegramId}\n\n`
  message += `📊 ${bold("Total Companies:")} ${stats.totalCompanies}`

  return sendMessage(adminTelegramId, message, { parse_mode: "Markdown" })
}

/**
 * Notify admin when a new user registers
 */
export async function notifyAdminNewUser(
  user: {
    fullName: string
    username?: string
    telegramId: string
  },
  stats: {
    totalUsers: number
  }
): Promise<{ success: boolean; error?: string }> {
  const adminTelegramId = getAdminTelegramId()
  if (!adminTelegramId) {
    console.log("[Admin Notifier] No ADMIN_TELEGRAM_ID configured")
    return { success: false, error: "No admin configured" }
  }

  const usernameDisplay = user.username ? `@${user.username}` : "N/A"

  let message = `👤 ${bold("New User Registered")}!\n\n`
  message += `${bold("Name:")} ${user.fullName}\n`
  message += `${bold("Username:")} ${usernameDisplay}\n`
  message += `${bold("Telegram ID:")} ${user.telegramId}\n\n`
  message += `📊 ${bold("Total Users:")} ${stats.totalUsers}`

  return sendMessage(adminTelegramId, message, { parse_mode: "Markdown" })
}

/**
 * Notify admin when a user joins a company
 */
export async function notifyAdminUserJoinedCompany(
  user: {
    fullName: string
    username?: string
    telegramId: string
  },
  company: {
    name: string
    companyId: string
  },
  stats: {
    companyMembers: number
    totalUsers: number
  }
): Promise<{ success: boolean; error?: string }> {
  const adminTelegramId = getAdminTelegramId()
  if (!adminTelegramId) {
    console.log("[Admin Notifier] No ADMIN_TELEGRAM_ID configured")
    return { success: false, error: "No admin configured" }
  }

  const usernameDisplay = user.username ? `@${user.username}` : "N/A"

  let message = `👥 ${bold("User Joined Company")}!\n\n`
  message += `${bold("User:")} ${user.fullName}\n`
  message += `${bold("Username:")} ${usernameDisplay}\n`
  message += `${bold("Company:")} ${company.name}\n\n`
  message += `📊 ${bold("Company Members:")} ${stats.companyMembers}\n`
  message += `📊 ${bold("Total Platform Users:")} ${stats.totalUsers}`

  return sendMessage(adminTelegramId, message, { parse_mode: "Markdown" })
}
