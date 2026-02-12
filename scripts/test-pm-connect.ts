/**
 * PM Connect Integration Tests
 * Run with: npx ts-node scripts/test-pm-connect.ts
 *
 * Tests all PM Connect API endpoints to ensure they work correctly before launch.
 */

const BASE_URL = process.env.TEST_URL || "http://localhost:3000"
const TEST_TELEGRAM_ID = "123456789" // Mock Telegram ID for testing

interface TestResult {
  name: string
  passed: boolean
  error?: string
  response?: any
}

const results: TestResult[] = []

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    results.push({ name, passed: true })
    console.log(`✅ ${name}`)
  } catch (error: any) {
    results.push({ name, passed: false, error: error.message })
    console.log(`❌ ${name}: ${error.message}`)
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

let testIntegrationId: string
let testConnectId: string

async function runTests() {
  console.log("\n🧪 PM Connect Integration Tests\n")
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Test Telegram ID: ${TEST_TELEGRAM_ID}\n`)

  // Test 1: Create Integration
  await test("Create PM Integration", async () => {
    const result = await fetchAPI("/api/pm-connect/integrations", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Integration",
        platform: "monday",
        companyName: "Test Company",
      }),
    })

    if (!result.success) throw new Error(result.error || "Failed to create integration")
    if (!result.data.id) throw new Error("No integration ID returned")
    if (!result.data.connectId) throw new Error("No connect ID returned")
    if (!result.data.webhookUrl) throw new Error("No webhook URL returned")

    testIntegrationId = result.data.id
    testConnectId = result.data.connectId
    console.log(`   Integration ID: ${testIntegrationId}`)
    console.log(`   Connect ID: ${testConnectId}`)
  })

  // Test 2: List Integrations
  await test("List Integrations", async () => {
    const result = await fetchAPI("/api/pm-connect/integrations")

    if (!result.success) throw new Error(result.error || "Failed to list integrations")
    if (!Array.isArray(result.data.integrations)) throw new Error("Expected integrations array")

    const found = result.data.integrations.find((i: any) => i.id === testIntegrationId)
    if (!found) throw new Error("Created integration not found in list")

    console.log(`   Found ${result.data.integrations.length} integration(s)`)
  })

  // Test 3: Add Worker with valid Telegram ID
  await test("Add Worker (valid)", async () => {
    const result = await fetchAPI(`/api/pm-connect/integrations/${testIntegrationId}/workers`, {
      method: "POST",
      body: JSON.stringify({
        workerTelegramId: "987654321",
        externalName: "Test Worker",
        externalId: "monday_user_123",
      }),
    })

    if (!result.success) throw new Error(result.error || "Failed to add worker")
    if (result.data.workersCount !== 1) throw new Error(`Expected 1 worker, got ${result.data.workersCount}`)

    console.log(`   Workers count: ${result.data.workersCount}`)
  })

  // Test 4: Add Worker with invalid Telegram ID (should fail)
  await test("Add Worker (invalid ID - should fail)", async () => {
    const result = await fetchAPI(`/api/pm-connect/integrations/${testIntegrationId}/workers`, {
      method: "POST",
      body: JSON.stringify({
        workerTelegramId: "invalid_id",
        externalName: "Bad Worker",
      }),
    })

    if (result.success) throw new Error("Should have rejected invalid Telegram ID")
    console.log(`   Correctly rejected: ${result.error}`)
  })

  // Test 5: Add Worker without Telegram ID (should fail)
  await test("Add Worker (missing ID - should fail)", async () => {
    const result = await fetchAPI(`/api/pm-connect/integrations/${testIntegrationId}/workers`, {
      method: "POST",
      body: JSON.stringify({
        externalName: "No ID Worker",
      }),
    })

    if (result.success) throw new Error("Should have rejected missing Telegram ID")
    console.log(`   Correctly rejected: ${result.error}`)
  })

  // Test 6: Invalid Integration ID (should fail gracefully)
  await test("Add Worker (invalid integration - should fail)", async () => {
    const result = await fetchAPI("/api/pm-connect/integrations/invalid_id/workers", {
      method: "POST",
      body: JSON.stringify({
        workerTelegramId: "111222333",
      }),
    })

    if (result.success) throw new Error("Should have rejected invalid integration ID")
    console.log(`   Correctly rejected: ${result.error}`)
  })

  // Test 7: Verify webhook endpoint exists
  await test("Webhook endpoint verification (GET)", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/pm-connect/${testConnectId}`)
    const result = await response.json()

    if (!result.success) throw new Error(result.error || "Webhook endpoint not found")
    if (result.data.name !== "Test Integration") throw new Error("Wrong integration returned")

    console.log(`   Integration name: ${result.data.name}`)
    console.log(`   Workers: ${result.data.workersCount}`)
  })

  // Test 8: Send task via webhook (Monday format)
  await test("Receive Monday.com webhook", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/pm-connect/${testConnectId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: {
          pulseId: "12345",
          pulseName: "Test Task from Monday",
          userId: "monday_user_123",
          boardId: "board_456",
          columnValues: {
            text: { value: "This is a test task description" },
            priority: { label: "High" },
          },
        },
      }),
    })
    const result = await response.json()

    if (!result.success) throw new Error(result.error || "Failed to process Monday webhook")
    if (!result.data.taskId) throw new Error("No task ID returned")

    console.log(`   Task ID: ${result.data.taskId}`)
    console.log(`   Sent to: ${result.data.sentTo}`)
  })

  // Test 9: Send task via webhook (ClickUp format)
  await test("Receive ClickUp webhook", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/pm-connect/${testConnectId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_id: "clickup_task_789",
        name: "Test Task from ClickUp",
        description: "ClickUp task description",
        priority: { id: 2 }, // High
        assignees: [{ id: "clickup_user" }],
      }),
    })
    const result = await response.json()

    if (!result.success) throw new Error(result.error || "Failed to process ClickUp webhook")
    console.log(`   Task ID: ${result.data.taskId}`)
  })

  // Test 10: Send task via webhook (Generic format)
  await test("Receive Generic webhook", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/pm-connect/${testConnectId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Generic Task",
        description: "This is from a custom integration",
        priority: "urgent",
        due_date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      }),
    })
    const result = await response.json()

    if (!result.success) throw new Error(result.error || "Failed to process generic webhook")
    console.log(`   Task ID: ${result.data.taskId}`)
  })

  // Test 11: Telegram webhook health check
  await test("Telegram webhook health check", async () => {
    const response = await fetch(`${BASE_URL}/api/telegram/webhook`)
    const result = await response.json()

    if (result.status !== "ok") throw new Error("Telegram webhook not healthy")
    console.log(`   Status: ${result.status}`)
  })

  // Test 12: Remove Worker
  await test("Remove Worker", async () => {
    const result = await fetchAPI(
      `/api/pm-connect/integrations/${testIntegrationId}/workers?workerTelegramId=987654321`,
      { method: "DELETE" }
    )

    if (!result.success) throw new Error(result.error || "Failed to remove worker")
    if (result.data.workersCount !== 0) throw new Error(`Expected 0 workers, got ${result.data.workersCount}`)

    console.log(`   Workers count: ${result.data.workersCount}`)
  })

  // Summary
  console.log("\n" + "=".repeat(50))
  console.log("TEST SUMMARY")
  console.log("=".repeat(50))

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  console.log(`Total: ${results.length}`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)

  if (failed > 0) {
    console.log("\nFailed tests:")
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.name}: ${r.error}`)
    })
    process.exit(1)
  } else {
    console.log("\n🎉 All tests passed!")
    process.exit(0)
  }
}

// Run tests
runTests().catch(console.error)
