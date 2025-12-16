/**
 * Comprehensive Time Tracking Test Suite
 *
 * Tests all time tracking functionality including:
 * - Clock in/out API endpoints
 * - Time logs storage and retrieval
 * - Stats calculation for employees and admins
 * - Time format display
 */

import { formatDuration, formatElapsedTime } from "../lib/format-time"

interface TestResult {
  name: string
  passed: boolean
  message: string
  details?: any
}

const results: TestResult[] = []

// Test configuration
const TEST_CONFIG = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
  testTelegramId: "123456789",
  testCompanyId: "",
  testTaskId: "",
  testUserId: "",
}

// Helper function to log test results
function logTest(name: string, passed: boolean, message: string, details?: any) {
  results.push({ name, passed, message, details })
  console.log(`[v0 Test] ${passed ? "✓" : "✗"} ${name}: ${message}`)
  if (details) {
    console.log("[v0 Test Details]", JSON.stringify(details, null, 2))
  }
}

// Test 1: Time Format Functions
function testTimeFormatting() {
  console.log("\n=== Testing Time Formatting Functions ===\n")

  // Test formatDuration with seconds
  const duration1 = formatDuration(3665) // 1 hour, 1 minute, 5 seconds
  const expected1 = "00:01:01:05"
  logTest("formatDuration (3665 seconds)", duration1 === expected1, `Expected ${expected1}, got ${duration1}`, {
    input: 3665,
    output: duration1,
  })

  // Test formatDuration with days
  const duration2 = formatDuration(90061) // 1 day, 1 hour, 1 minute, 1 second
  const expected2 = "01:01:01:01"
  logTest("formatDuration (90061 seconds)", duration2 === expected2, `Expected ${expected2}, got ${duration2}`, {
    input: 90061,
    output: duration2,
  })

  // Test formatDuration with 0
  const duration3 = formatDuration(0)
  const expected3 = "00:00:00:00"
  logTest("formatDuration (0 seconds)", duration3 === expected3, `Expected ${expected3}, got ${duration3}`, {
    input: 0,
    output: duration3,
  })

  // Test formatElapsedTime
  const elapsed1 = formatElapsedTime(125) // 2 minutes, 5 seconds
  const expected4 = "00:00:02:05"
  logTest("formatElapsedTime (125 seconds)", elapsed1 === expected4, `Expected ${expected4}, got ${elapsed1}`, {
    input: 125,
    output: elapsed1,
  })

  // Test with NaN/undefined
  const duration4 = formatDuration(Number.NaN)
  logTest("formatDuration handles NaN", duration4 === "00:00:00:00", `Expected 00:00:00:00, got ${duration4}`, {
    input: Number.NaN,
    output: duration4,
  })
}

// Test 2: Clock In API
async function testClockInAPI() {
  console.log("\n=== Testing Clock In API ===\n")

  try {
    const response = await fetch(`${TEST_CONFIG.apiBaseUrl}/api/time/clock-in`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Id": TEST_CONFIG.testTelegramId,
      },
      body: JSON.stringify({
        taskId: TEST_CONFIG.testTaskId,
      }),
    })

    const data = await response.json()

    if (response.ok && data.timeLog) {
      logTest("Clock In API - Success", true, "Successfully clocked in", {
        timeLogId: data.timeLog.id,
        startTime: data.timeLog.startTime,
      })
      return data.timeLog.id
    } else {
      logTest("Clock In API - Failed", false, data.error || "Unknown error", { status: response.status, data })
      return null
    }
  } catch (error: any) {
    logTest("Clock In API - Error", false, error.message, { error: error.toString() })
    return null
  }
}

// Test 3: Clock Out API
async function testClockOutAPI(taskId: string) {
  console.log("\n=== Testing Clock Out API ===\n")

  // Wait 2 seconds to simulate work
  await new Promise((resolve) => setTimeout(resolve, 2000))

  try {
    const response = await fetch(`${TEST_CONFIG.apiBaseUrl}/api/time/clock-out`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Id": TEST_CONFIG.testTelegramId,
      },
      body: JSON.stringify({
        taskId,
      }),
    })

    const data = await response.json()

    if (response.ok && data.timeLog) {
      const hasEndTime = !!data.timeLog.endTime
      const hasDuration = data.timeLog.durationMinutes > 0

      logTest("Clock Out API - Success", hasEndTime && hasDuration, "Successfully clocked out with duration", {
        timeLogId: data.timeLog.id,
        durationMinutes: data.timeLog.durationMinutes,
        endTime: data.timeLog.endTime,
      })
      return data.timeLog
    } else {
      logTest("Clock Out API - Failed", false, data.error || "Unknown error", { status: response.status, data })
      return null
    }
  } catch (error: any) {
    logTest("Clock Out API - Error", false, error.message, { error: error.toString() })
    return null
  }
}

// Test 4: Get Time Logs API
async function testGetTimeLogsAPI(taskId: string) {
  console.log("\n=== Testing Get Time Logs API ===\n")

  try {
    const response = await fetch(`${TEST_CONFIG.apiBaseUrl}/api/tasks/${taskId}/timelogs`, {
      headers: {
        "X-Telegram-Id": TEST_CONFIG.testTelegramId,
      },
    })

    const data = await response.json()

    if (response.ok && data.timeLogs) {
      const hasTimeLogs = data.timeLogs.length > 0
      const hasCompletedLogs = data.timeLogs.some((log: any) => !log.isActive)

      logTest(
        "Get Time Logs API - Success",
        hasTimeLogs && hasCompletedLogs,
        `Found ${data.timeLogs.length} time logs, ${data.timeLogs.filter((l: any) => !l.isActive).length} completed`,
        {
          totalLogs: data.timeLogs.length,
          completedLogs: data.timeLogs.filter((l: any) => !l.isActive).length,
          firstLog: data.timeLogs[0],
        },
      )
      return data.timeLogs
    } else {
      logTest("Get Time Logs API - Failed", false, data.error || "No time logs found", {
        status: response.status,
        data,
      })
      return []
    }
  } catch (error: any) {
    logTest("Get Time Logs API - Error", false, error.message, { error: error.toString() })
    return []
  }
}

// Test 5: Stats API
async function testStatsAPI() {
  console.log("\n=== Testing Stats API ===\n")

  try {
    const response = await fetch(`${TEST_CONFIG.apiBaseUrl}/api/stats?companyId=${TEST_CONFIG.testCompanyId}`, {
      headers: {
        "X-Telegram-Id": TEST_CONFIG.testTelegramId,
      },
    })

    const data = await response.json()

    if (response.ok) {
      const hasPersonalStats = data.personalStats && typeof data.personalStats.totalSecondsWorked === "number"
      const hasTeamStats = data.companyStats && typeof data.companyStats.totalSecondsWorked === "number"

      logTest(
        "Stats API - Personal Stats",
        hasPersonalStats,
        `Total seconds worked: ${data.personalStats?.totalSecondsWorked || 0}`,
        {
          personalStats: data.personalStats,
          formatted: formatDuration(data.personalStats?.totalSecondsWorked || 0),
        },
      )

      logTest(
        "Stats API - Team Stats",
        hasTeamStats,
        `Team total seconds: ${data.companyStats?.totalSecondsWorked || 0}`,
        {
          companyStats: data.companyStats,
          formatted: formatDuration(data.companyStats?.totalSecondsWorked || 0),
        },
      )

      return data
    } else {
      logTest("Stats API - Failed", false, data.error || "Unknown error", { status: response.status, data })
      return null
    }
  } catch (error: any) {
    logTest("Stats API - Error", false, error.message, { error: error.toString() })
    return null
  }
}

// Test 6: Debug Time Logs API
async function testDebugTimeLogsAPI() {
  console.log("\n=== Testing Debug Time Logs API ===\n")

  try {
    const response = await fetch(
      `${TEST_CONFIG.apiBaseUrl}/api/debug/timelogs?companyId=${TEST_CONFIG.testCompanyId}`,
      {
        headers: {
          "X-Telegram-Id": TEST_CONFIG.testTelegramId,
        },
      },
    )

    const data = await response.json()

    if (response.ok) {
      logTest("Debug Time Logs API", true, `Found ${data.timeLogs?.length || 0} time logs in database`, {
        totalTimeLogs: data.timeLogs?.length || 0,
        user: data.user,
        tasks: data.tasks?.length || 0,
      })
      return data
    } else {
      logTest("Debug Time Logs API - Failed", false, "Could not fetch debug data", { status: response.status })
      return null
    }
  } catch (error: any) {
    logTest("Debug Time Logs API - Error", false, error.message, { error: error.toString() })
    return null
  }
}

// Main test runner
async function runAllTests() {
  console.log("\n╔════════════════════════════════════════════════════════╗")
  console.log("║      Time Tracking Comprehensive Test Suite          ║")
  console.log("╚════════════════════════════════════════════════════════╝\n")

  // Test 1: Time Formatting (no API required)
  testTimeFormatting()

  // Check if we have the required test data
  if (!TEST_CONFIG.testTaskId || !TEST_CONFIG.testCompanyId) {
    console.log("\n⚠️  Skipping API tests - Missing test configuration")
    console.log("   Set testTaskId and testCompanyId in TEST_CONFIG to run API tests\n")
  } else {
    // Test 2-6: API Tests (require actual data)
    const timeLogId = await testClockInAPI()

    if (timeLogId && TEST_CONFIG.testTaskId) {
      const clockOutResult = await testClockOutAPI(TEST_CONFIG.testTaskId)

      if (clockOutResult) {
        await testGetTimeLogsAPI(TEST_CONFIG.testTaskId)
        await testStatsAPI()
        await testDebugTimeLogsAPI()
      }
    }
  }

  // Print summary
  console.log("\n╔════════════════════════════════════════════════════════╗")
  console.log("║                    Test Summary                        ║")
  console.log("╚════════════════════════════════════════════════════════╝\n")

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  const total = results.length

  console.log(`Total Tests: ${total}`)
  console.log(`✓ Passed: ${passed}`)
  console.log(`✗ Failed: ${failed}`)
  console.log(`Success Rate: ${Math.round((passed / total) * 100)}%\n`)

  if (failed > 0) {
    console.log("Failed Tests:")
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  ✗ ${r.name}: ${r.message}`)
      })
    console.log()
  }

  return results
}

// Run the tests
runAllTests()
  .then((results) => {
    const allPassed = results.every((r) => r.passed)
    process.exit(allPassed ? 0 : 1)
  })
  .catch((error) => {
    console.error("[v0 Test] Fatal error:", error)
    process.exit(1)
  })
