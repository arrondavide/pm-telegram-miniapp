/**
 * Service for sending company-related notifications via Telegram
 */

import { sendMessage, sendMessageWithButtons, bold } from "./bot"

interface NewMemberInfo {
  fullName: string
  username?: string
  telegramId: string
  role: string
  department?: string
}

interface CompanyInfo {
  companyId: string
  companyName: string
}

/**
 * Notify company owner when a new member joins
 */
export async function notifyNewMemberJoined(
  ownerTelegramId: string,
  newMember: NewMemberInfo,
  company: CompanyInfo,
  totalMembers: number
): Promise<{ success: boolean; error?: string }> {
  const usernameDisplay = newMember.username
    ? `@${newMember.username}`
    : newMember.fullName

  let message = `👤 ${bold("New Team Member Joined")}!\n\n`
  message += `${bold("Member:")} ${newMember.fullName}\n`

  if (newMember.username) {
    message += `${bold("Username:")} @${newMember.username}\n`
  }

  message += `${bold("Role:")} ${newMember.role}\n`

  if (newMember.department) {
    message += `${bold("Department:")} ${newMember.department}\n`
  }

  message += `${bold("Company:")} ${company.companyName}\n\n`
  message += `📊 ${bold("Total Members:")} ${totalMembers}`

  const appUrl = process.env.TELEGRAM_WEBAPP_URL || process.env.NEXT_PUBLIC_APP_URL || ""

  if (appUrl) {
    return sendMessageWithButtons(
      ownerTelegramId,
      message,
      [[{ text: "👥 View Team", url: `${appUrl}?screen=team` }]],
      { parse_mode: "Markdown" }
    )
  }

  return sendMessage(ownerTelegramId, message, { parse_mode: "Markdown" })
}

/**
 * Notify when a member leaves the company
 */
export async function notifyMemberLeft(
  ownerTelegramId: string,
  member: { fullName: string; username?: string },
  company: CompanyInfo,
  remainingMembers: number
): Promise<{ success: boolean; error?: string }> {
  let message = `👋 ${bold("Team Member Left")}\n\n`
  message += `${bold("Member:")} ${member.fullName}\n`

  if (member.username) {
    message += `${bold("Username:")} @${member.username}\n`
  }

  message += `${bold("Company:")} ${company.companyName}\n\n`
  message += `📊 ${bold("Remaining Members:")} ${remainingMembers}`

  return sendMessage(ownerTelegramId, message, { parse_mode: "Markdown" })
}
