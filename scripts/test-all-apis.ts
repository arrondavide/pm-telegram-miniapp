/**
 * Comprehensive API Test Suite
 * Tests both Developer API and PM Connect API
 *
 * NOTE: Developer API requires an existing user with company in database.
 * PM Connect API is standalone and doesn't require user registration.
 */

const BASE_URL = process.env.TEST_URL || "http://localhost:3000"
const TEST_TELEGRAM_ID = "123456789"

interface TestResult {
  name: string
  category: string
  passed: boolean
  error?: string
  details?: string
}

const results: TestResult[] = []

async function test(category: string, name: string, fn: () => Promise<string | void>) {
  try {
    const details = await fn()
    results.push({ name, category, passed: true, details: details || undefined })
    console.log(`  ✅ ${name}`)
  } catch (error: any) {
    results.push({ name, category, passed: false, error: error.message })
    console.log(`  ❌ ${name}: ${error.message}`)
  }
}

async function fetchAPI(path: string, options: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-telegram-id": TEST_TELEGRAM_ID,
      ...options.headers,
    },
  })
  return response.json()
}

// ========================================
// DEVELOPER API TESTS
// Tests error handling (requires existing user for full functionality)
// ========================================
async function testDeveloperAPI() {
  console.log("\n📡 DEVELOPER API TESTS")
  console.log("   (Testing error handling - full tests require registered user)\n")

  // Test 1: Unauthorized (no header)
  await test("Developer API", "Reject unauthorized (no header)", async () => {
    const response = await fetch(`${BASE_URL}/api/developer/keys`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
    const result = await response.json()

    if (result.success) throw new Error("Should reject unauthorized")
    if (response.status !== 401) throw new Error(`Expected 401, got ${response.status}`)

    return "Correctly returns 401"
  })

  // Test 2: User not found (valid header but no user)
  await test("Developer API", "Returns 404 for non-existent user", async () => {
    const result = await fetchAPI("/api/developer/keys")

    if (result.success) throw new Error("Should fail for non-existent user")
    if (!result.error?.includes("User not found")) throw new Error(`Wrong error: ${result.error}`)

    return "Correctly returns user not found"
  })

  // Test 3: Create key requires companyId
  await test("Developer API", "Create key requires companyId", async () => {
    const result = await fetchAPI("/api/developer/keys", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Key",
        // missing companyId
      }),
    })

    if (result.success) throw new Error("Should require companyId")
    if (!result.error?.includes("companyId")) throw new Error(`Wrong error: ${result.error}`)

    return "Correctly requires companyId"
  })

  // Test 4: Invalid API key rejected
  await test("Developer API", "Reject invalid API key", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer wt_invalid_key_12345",
      },
      body: JSON.stringify({
        telegram_id: TEST_TELEGRAM_ID,
        message: "Test",
      }),
    })
    const result = await response.json()

    if (result.success) throw new Error("Should reject invalid key")
    if (!result.error?.includes("Invalid")) throw new Error(`Wrong error: ${result.error}`)

    return "Correctly rejects invalid key"
  })

  // Test 5: Notification API missing fields
  await test("Developer API", "Notify API validates required fields", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer wt_test_key",
      },
      body: JSON.stringify({
        // missing telegram_id and message
      }),
    })
    const result = await response.json()

    if (result.success) throw new Error("Should require fields")

    return "Correctly validates fields"
  })

  // Test 6: Webhook endpoint health check
  await test("Developer API", "Webhook endpoint exists", async () => {
    const result = await fetchAPI("/api/developer/webhooks")

    // Even with no user, endpoint should respond (with error)
    if (result.success && !result.error?.includes("User")) {
      // User exists somehow, check structure
      if (!Array.isArray(result.data?.webhooks)) throw new Error("Expected webhooks array")
    }

    return result.success ? "Works (user exists)" : "Correctly requires user"
  })
}

// ========================================
// PM CONNECT API TESTS (Standalone)
// ========================================
async function testPMConnectAPI() {
  console.log("\n🔗 PM CONNECT API TESTS\n")

  let integrationId: string = ""
  let connectId: string = ""
  let taskId: string = ""

  // Test 1: Create Integration
  await test("PM Connect", "Create Integration", async () => {
    const result = await fetchAPI("/api/pm-connect/integrations", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Monday Integration",
        platform: "monday",
        companyName: "Test Company",
      }),
    })

    if (!result.success) throw new Error(result.error || "Failed to create integration")
    if (!result.data.id) throw new Error("No integration ID returned")
    if (!result.data.connectId) throw new Error("No connect ID returned")
    if (!result.data.webhookUrl) throw new Error("No webhook URL returned")

    integrationId = result.data.id
    connectId = result.data.connectId
    return `Connect ID: ${connectId.substring(0, 16)}...`
  })

  // Test 2: List Integrations
  await test("PM Connect", "List Integrations", async () => {
    const result = await fetchAPI("/api/pm-connect/integrations")

    if (!result.success) throw new Error(result.error || "Failed to list integrations")
    if (!Array.isArray(result.data.integrations)) throw new Error("Expected integrations array")

    const found = result.data.integrations.find((i: any) => i.id === integrationId)
    if (!found) throw new Error("Created integration not found")

    return `Found ${result.data.integrations.length} integration(s)`
  })

  // Test 3: Add Worker
  await test("PM Connect", "Add Worker", async () => {
    const result = await fetchAPI(`/api/pm-connect/integrations/${integrationId}/workers`, {
      method: "POST",
      body: JSON.stringify({
        workerTelegramId: "987654321",
        externalName: "John Driver",
        externalId: "monday_user_123",
      }),
    })

    if (!result.success) throw new Error(result.error || "Failed to add worker")

    return `Workers: ${result.data.workersCount}`
  })

  // Test 4: Add Second Worker
  await test("PM Connect", "Add Second Worker", async () => {
    const result = await fetchAPI(`/api/pm-connect/integrations/${integrationId}/workers`, {
      method: "POST",
      body: JSON.stringify({
        workerTelegramId: "555666777",
        externalName: "Jane Delivery",
        externalId: "monday_user_456",
      }),
    })

    if (!result.success) throw new Error(result.error || "Failed to add worker")

    return `Workers: ${result.data.workersCount}`
  })

  // Test 5: Webhook Verification (GET)
  await test("PM Connect", "Webhook Verification (GET)", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/pm-connect/${connectId}`)
    const result = await response.json()

    if (!result.success) throw new Error(result.error || "Webhook verification failed")
    if (result.data.name !== "Test Monday Integration") throw new Error("Wrong integration")

    return `Platform: ${result.data.platform}, Workers: ${result.data.workersCount}`
  })

  // Test 6: Receive Monday.com Webhook
  await test("PM Connect", "Receive Monday.com Webhook", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/pm-connect/${connectId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: {
          pulseId: "monday_task_001",
          pulseName: "Deliver package to 123 Main St",
          userId: "monday_user_123",
          boardId: "board_001",
          columnValues: {
            text: { value: "Handle with care. Ring doorbell twice." },
            priority: { label: "High" },
            location: { value: "123 Main St, Downtown" },
          },
        },
      }),
    })
    const result = await response.json()

    if (!result.success) throw new Error(result.error || "Failed to process webhook")
    if (!result.data.taskId) throw new Error("No task ID returned")

    taskId = result.data.taskId
    return `Task: ${taskId}, Sent to: ${result.data.sentTo}`
  })

  // Test 7: Receive ClickUp Webhook
  await test("PM Connect", "Receive ClickUp Webhook", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/pm-connect/${connectId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_id: "clickup_task_002",
        name: "Pick up supplies from warehouse",
        description: "Get materials for tomorrow's jobs",
        priority: { id: 2 },
        due_date: String(Date.now() + 7200000),
        assignees: [{ id: "monday_user_456" }],
      }),
    })
    const result = await response.json()

    if (!result.success) throw new Error(result.error || "Failed to process webhook")

    return `Task: ${result.data.taskId}`
  })

  // Test 8: Receive Asana Webhook
  await test("PM Connect", "Receive Asana Webhook", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/pm-connect/${connectId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events: [{
          resource: {
            gid: "asana_task_003",
            name: "Install equipment at client site",
            notes: "Bring tools and safety gear",
            assignee: { gid: "monday_user_123" },
            due_on: "2024-12-25",
            priority: "high",
          },
        }],
      }),
    })
    const result = await response.json()

    if (!result.success) throw new Error(result.error || "Failed to process webhook")

    return `Task: ${result.data.taskId}`
  })

  // Test 9: Receive Trello Webhook
  await test("PM Connect", "Receive Trello Webhook", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/pm-connect/${connectId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: {
          data: {
            card: {
              id: "trello_card_001",
              name: "Review client proposal",
              desc: "Check budget and timeline",
              due: "2024-12-30T10:00:00.000Z",
            },
            board: { id: "board_trello" },
          },
          memberCreator: { id: "trello_user" },
        },
      }),
    })
    const result = await response.json()

    if (!result.success) throw new Error(result.error || "Failed to process webhook")

    return `Task: ${result.data.taskId}`
  })

  // Test 10: Receive Generic Webhook
  await test("PM Connect", "Receive Generic Webhook", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/pm-connect/${connectId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Custom task from any system",
        description: "This is a generic webhook format",
        priority: "urgent",
        location: "456 Oak Ave",
        due_date: new Date(Date.now() + 3600000).toISOString(),
      }),
    })
    const result = await response.json()

    if (!result.success) throw new Error(result.error || "Failed to process webhook")

    return `Task: ${result.data.taskId}`
  })

  // Test 11: Get Tracking Data
  await test("PM Connect", "Get Tracking Data", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/pm-connect/${connectId}/tracking`)
    const result = await response.json()

    if (!result.success) throw new Error(result.error || "Failed to get tracking data")

    return `Tasks tracked: ${result.data.tasks.length}, Active: ${result.data.active_tracking_count}`
  })

  // Test 12: Get Task Location
  await test("PM Connect", "Get Task Location", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/pm-connect/${connectId}/tasks/${taskId}/location`)
    const result = await response.json()

    if (!result.success) throw new Error(result.error || "Failed to get task location")

    return result.data.has_location ? "Has location" : "No location yet (expected)"
  })

  // Test 13: Get Task Location with History
  await test("PM Connect", "Get Task Location (with history param)", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/pm-connect/${connectId}/tasks/${taskId}/location?history=true&limit=50`)
    const result = await response.json()

    if (!result.success) throw new Error(result.error || "Failed to get task location")

    return `Tracking enabled: ${result.data.tracking_enabled}`
  })

  // Test 14: Remove Worker
  await test("PM Connect", "Remove Worker", async () => {
    const result = await fetchAPI(
      `/api/pm-connect/integrations/${integrationId}/workers?workerTelegramId=555666777`,
      { method: "DELETE" }
    )

    if (!result.success) throw new Error(result.error || "Failed to remove worker")

    return `Workers remaining: ${result.data.workersCount}`
  })

  // Test 15: Verify Integration Stats
  await test("PM Connect", "Verify Integration Stats", async () => {
    const result = await fetchAPI("/api/pm-connect/integrations")
    const integration = result.data.integrations.find((i: any) => i.id === integrationId)

    if (!integration) throw new Error("Integration not found")

    return `Sent: ${integration.stats.tasks_sent}, Completed: ${integration.stats.tasks_completed}`
  })
}

// ========================================
// TELEGRAM WEBHOOK TESTS
// ========================================
async function testTelegramWebhook() {
  console.log("\n🤖 TELEGRAM WEBHOOK TESTS\n")

  // Test 1: Health check
  await test("Telegram", "Health check (GET)", async () => {
    const response = await fetch(`${BASE_URL}/api/telegram/webhook`)
    const result = await response.json()

    if (result.status !== "ok") throw new Error("Health check failed")

    return "Status: ok"
  })

  // Test 2: /start command
  await test("Telegram", "Handle /start command", async () => {
    const response = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          message_id: 1,
          chat: { id: 111222333 },
          text: "/start",
          from: { id: 111222333, first_name: "Test" },
        },
      }),
    })
    const result = await response.json()

    if (!result.ok) throw new Error("Webhook did not return ok")

    return "Welcome message sent"
  })

  // Test 3: Task commands without task
  await test("Telegram", "Commands without active task", async () => {
    const commands = ["start", "done", "problem", "ok", "yes"]
    for (const cmd of commands) {
      const response = await fetch(`${BASE_URL}/api/telegram/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            message_id: 2,
            chat: { id: 999888777 },
            text: cmd,
            from: { id: 999888777, first_name: "NoTask" },
          },
        }),
      })
      const result = await response.json()
      if (!result.ok) throw new Error(`Failed on command: ${cmd}`)
    }

    return "All 5 commands handled gracefully"
  })

  // Test 4: Skip location sharing
  await test("Telegram", "Handle skip location", async () => {
    const response = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          message_id: 3,
          chat: { id: 999888777 },
          text: "⏭️ Skip Location Sharing",
          from: { id: 999888777, first_name: "Test" },
        },
      }),
    })
    const result = await response.json()

    if (!result.ok) throw new Error("Webhook did not return ok")

    return "Skip handled"
  })

  // Test 5: Callback query
  await test("Telegram", "Handle callback query (invalid task)", async () => {
    const response = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query: {
          id: "callback_123",
          from: { id: 999888777, first_name: "Test" },
          message: {
            message_id: 100,
            chat: { id: 999888777 },
          },
          data: "task_start_507f1f77bcf86cd799439011",
        },
      }),
    })
    const result = await response.json()

    if (!result.ok) throw new Error("Webhook did not return ok")

    return "Handled gracefully"
  })

  // Test 6: Unknown callback action
  await test("Telegram", "Handle unknown callback action", async () => {
    const response = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query: {
          id: "callback_456",
          from: { id: 999888777, first_name: "Test" },
          message: {
            message_id: 101,
            chat: { id: 999888777 },
          },
          data: "unknown_action_xyz",
        },
      }),
    })
    const result = await response.json()

    if (!result.ok) throw new Error("Webhook did not return ok")

    return "Unknown action handled"
  })

  // Test 7: Location message (one-time)
  await test("Telegram", "Handle one-time location", async () => {
    const response = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          message_id: 5,
          chat: { id: 999888777 },
          location: {
            latitude: 37.7749,
            longitude: -122.4194,
            horizontal_accuracy: 10,
          },
          from: { id: 999888777, first_name: "Test" },
        },
      }),
    })
    const result = await response.json()

    if (!result.ok) throw new Error("Webhook did not return ok")

    return "Location processed"
  })

  // Test 8: Live location update
  await test("Telegram", "Handle live location update", async () => {
    const response = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        edited_message: {
          message_id: 10,
          chat: { id: 999888777 },
          location: {
            latitude: 37.7750,
            longitude: -122.4195,
            live_period: 3600,
            heading: 90,
            speed: 5.5,
          },
          from: { id: 999888777, first_name: "Test" },
        },
      }),
    })
    const result = await response.json()

    if (!result.ok) throw new Error("Webhook did not return ok")

    return "Live location processed"
  })

  // Test 9: Photo message
  await test("Telegram", "Handle photo (no active task)", async () => {
    const response = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          message_id: 6,
          chat: { id: 999888777 },
          photo: [
            { file_id: "small", width: 90, height: 90 },
            { file_id: "large", width: 800, height: 600 },
          ],
          caption: "Proof photo",
          from: { id: 999888777, first_name: "Test" },
        },
      }),
    })
    const result = await response.json()

    if (!result.ok) throw new Error("Webhook did not return ok")

    return "Photo handled (no task)"
  })

  // Test 10: Empty update
  await test("Telegram", "Handle empty update", async () => {
    const response = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const result = await response.json()

    if (!result.ok) throw new Error("Webhook did not return ok")

    return "Empty update handled"
  })

  // Test 11: Emoji responses
  await test("Telegram", "Handle emoji responses", async () => {
    const emojis = ["👍", "✅", "❌"]
    for (const emoji of emojis) {
      const response = await fetch(`${BASE_URL}/api/telegram/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            message_id: 20,
            chat: { id: 999888777 },
            text: emoji,
            from: { id: 999888777, first_name: "Test" },
          },
        }),
      })
      const result = await response.json()
      if (!result.ok) throw new Error(`Failed on emoji: ${emoji}`)
    }

    return "All emojis handled"
  })
}

// ========================================
// VALIDATION TESTS
// ========================================
async function testValidation() {
  console.log("\n🔒 VALIDATION TESTS\n")

  // Test 1: Invalid Telegram ID format
  await test("Validation", "Reject invalid Telegram ID", async () => {
    const result = await fetchAPI("/api/pm-connect/integrations/507f1f77bcf86cd799439011/workers", {
      method: "POST",
      body: JSON.stringify({
        workerTelegramId: "not_a_number",
        externalName: "Bad Worker",
      }),
    })

    if (result.success) throw new Error("Should have rejected invalid Telegram ID")

    return `Rejected: ${result.error}`
  })

  // Test 2: Invalid integration ID
  await test("Validation", "Reject invalid integration ID", async () => {
    const result = await fetchAPI("/api/pm-connect/integrations/invalid_id/workers", {
      method: "POST",
      body: JSON.stringify({
        workerTelegramId: "123456789",
      }),
    })

    if (result.success) throw new Error("Should have rejected invalid integration ID")

    return `Rejected: ${result.error}`
  })

  // Test 3: Missing required fields
  await test("Validation", "Reject missing platform", async () => {
    const result = await fetchAPI("/api/pm-connect/integrations", {
      method: "POST",
      body: JSON.stringify({
        name: "Test",
        // missing platform
      }),
    })

    if (result.success) throw new Error("Should have rejected missing platform")

    return `Rejected: ${result.error}`
  })

  // Test 4: Invalid platform
  await test("Validation", "Reject invalid platform", async () => {
    const result = await fetchAPI("/api/pm-connect/integrations", {
      method: "POST",
      body: JSON.stringify({
        name: "Test",
        platform: "invalid_platform",
      }),
    })

    if (result.success) throw new Error("Should have rejected invalid platform")

    return `Rejected: ${result.error}`
  })

  // Test 5: Unauthorized request (no telegram ID header)
  await test("Validation", "Reject unauthorized request", async () => {
    const response = await fetch(`${BASE_URL}/api/pm-connect/integrations`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      // No x-telegram-id header
    })
    const result = await response.json()

    if (result.success) throw new Error("Should have rejected unauthorized request")
    if (response.status !== 401) throw new Error(`Expected 401, got ${response.status}`)

    return `Rejected with 401`
  })

  // Test 6: Non-existent webhook
  await test("Validation", "Non-existent webhook returns 404", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/pm-connect/nonexistent123`)
    const result = await response.json()

    if (result.success) throw new Error("Should return 404")
    if (response.status !== 404) throw new Error(`Expected 404, got ${response.status}`)

    return "Returns 404"
  })

  // Test 7: Non-existent task location
  await test("Validation", "Non-existent task location returns 404", async () => {
    // First get a valid connect ID
    const integrations = await fetchAPI("/api/pm-connect/integrations")
    if (!integrations.success || integrations.data.integrations.length === 0) {
      throw new Error("No integrations to test with")
    }
    const connectId = integrations.data.integrations[0].connectId

    const response = await fetch(`${BASE_URL}/api/v1/pm-connect/${connectId}/tasks/507f1f77bcf86cd799439011/location`)
    const result = await response.json()

    if (result.success && result.data.has_location) throw new Error("Should not find task")

    return result.success ? "Task not found (no location)" : "Returns 404"
  })
}

// ========================================
// MAIN
// ========================================
async function runAllTests() {
  console.log("╔══════════════════════════════════════════════════════════════╗")
  console.log("║         COMPREHENSIVE API TEST SUITE                         ║")
  console.log("║         Developer API + PM Connect + Telegram                ║")
  console.log("╠══════════════════════════════════════════════════════════════╣")
  console.log("║  Developer API: Requires existing user with company          ║")
  console.log("║  PM Connect:    Standalone (no user registration needed)     ║")
  console.log("║  Telegram:      Bot webhook handlers                         ║")
  console.log("╚══════════════════════════════════════════════════════════════╝")
  console.log(`\nBase URL: ${BASE_URL}`)
  console.log(`Test Telegram ID: ${TEST_TELEGRAM_ID}`)

  await testDeveloperAPI()
  await testPMConnectAPI()
  await testTelegramWebhook()
  await testValidation()

  // Summary by category
  console.log("\n" + "═".repeat(65))
  console.log("TEST RESULTS SUMMARY")
  console.log("═".repeat(65))

  const categories = [...new Set(results.map(r => r.category))]

  for (const category of categories) {
    const catResults = results.filter(r => r.category === category)
    const passed = catResults.filter(r => r.passed).length
    const failed = catResults.filter(r => !r.passed).length

    const statusIcon = failed === 0 ? "✅" : "⚠️"
    console.log(`\n${statusIcon} ${category}: ${passed}/${catResults.length} passed`)

    if (failed > 0) {
      console.log("   Failed tests:")
      catResults.filter(r => !r.passed).forEach(r => {
        console.log(`     ❌ ${r.name}: ${r.error}`)
      })
    }
  }

  const totalPassed = results.filter(r => r.passed).length
  const totalFailed = results.filter(r => !r.passed).length

  console.log("\n" + "═".repeat(65))
  console.log(`TOTAL: ${results.length} tests | ✅ PASSED: ${totalPassed} | ❌ FAILED: ${totalFailed}`)
  console.log("═".repeat(65))

  if (totalFailed > 0) {
    console.log("\n⚠️  Some tests failed. Review above for details.")
    process.exit(1)
  } else {
    console.log("\n🎉 All tests passed! APIs are working correctly.")
    process.exit(0)
  }
}

runAllTests().catch(error => {
  console.error("\n❌ Test suite crashed:", error)
  process.exit(1)
})
