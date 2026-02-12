/**
 * Telegram Webhook Handler Tests
 * Tests worker responses: text commands, callback queries, etc.
 */

const BASE_URL = process.env.TEST_URL || "http://localhost:3000"

interface TestResult {
  name: string
  passed: boolean
  error?: string
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

async function sendTelegramUpdate(update: any): Promise<any> {
  const response = await fetch(`${BASE_URL}/api/telegram/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  })
  return response.json()
}

async function runTests() {
  console.log("\n🤖 Telegram Webhook Handler Tests\n")
  console.log(`Base URL: ${BASE_URL}\n`)

  // Test 1: /start command
  await test("Handle /start command", async () => {
    const result = await sendTelegramUpdate({
      message: {
        message_id: 1,
        chat: { id: 111222333 },
        text: "/start",
        from: { id: 111222333, first_name: "Test" },
      },
    })

    if (!result.ok) throw new Error("Webhook did not return ok")
  })

  // Test 2: start command without active task
  await test("Handle 'start' without active task", async () => {
    const result = await sendTelegramUpdate({
      message: {
        message_id: 2,
        chat: { id: 999888777 },
        text: "start",
        from: { id: 999888777, first_name: "NoTask" },
      },
    })

    if (!result.ok) throw new Error("Webhook did not return ok")
  })

  // Test 3: done command without active task
  await test("Handle 'done' without active task", async () => {
    const result = await sendTelegramUpdate({
      message: {
        message_id: 3,
        chat: { id: 999888777 },
        text: "done",
        from: { id: 999888777, first_name: "NoTask" },
      },
    })

    if (!result.ok) throw new Error("Webhook did not return ok")
  })

  // Test 4: problem command without active task
  await test("Handle 'problem' without active task", async () => {
    const result = await sendTelegramUpdate({
      message: {
        message_id: 4,
        chat: { id: 999888777 },
        text: "problem",
        from: { id: 999888777, first_name: "NoTask" },
      },
    })

    if (!result.ok) throw new Error("Webhook did not return ok")
  })

  // Test 5: Random text (comment) without active task - should be ignored
  await test("Handle random text without active task (ignored)", async () => {
    const result = await sendTelegramUpdate({
      message: {
        message_id: 5,
        chat: { id: 999888777 },
        text: "Hello, how are you?",
        from: { id: 999888777, first_name: "NoTask" },
      },
    })

    if (!result.ok) throw new Error("Webhook did not return ok")
  })

  // Test 6: Callback query with invalid task ID
  await test("Handle callback with invalid task ID", async () => {
    const result = await sendTelegramUpdate({
      callback_query: {
        id: "callback_123",
        from: { id: 999888777, first_name: "Test" },
        message: {
          message_id: 100,
          chat: { id: 999888777 },
        },
        data: "task_start_invalid_task_id",
      },
    })

    if (!result.ok) throw new Error("Webhook did not return ok")
  })

  // Test 7: Callback query with unknown action
  await test("Handle callback with unknown action", async () => {
    const result = await sendTelegramUpdate({
      callback_query: {
        id: "callback_456",
        from: { id: 999888777, first_name: "Test" },
        message: {
          message_id: 101,
          chat: { id: 999888777 },
        },
        data: "unknown_action_xyz",
      },
    })

    if (!result.ok) throw new Error("Webhook did not return ok")
  })

  // Test 8: Empty update (should handle gracefully)
  await test("Handle empty update", async () => {
    const result = await sendTelegramUpdate({})

    if (!result.ok) throw new Error("Webhook did not return ok")
  })

  // Test 9: Photo without active task
  await test("Handle photo without active task", async () => {
    const result = await sendTelegramUpdate({
      message: {
        message_id: 10,
        chat: { id: 999888777 },
        photo: [
          { file_id: "small_photo", width: 90, height: 90 },
          { file_id: "large_photo", width: 800, height: 600 },
        ],
        caption: "My photo",
        from: { id: 999888777, first_name: "NoTask" },
      },
    })

    if (!result.ok) throw new Error("Webhook did not return ok")
  })

  // Test 10: Various emoji commands
  await test("Handle emoji commands (👍)", async () => {
    const result = await sendTelegramUpdate({
      message: {
        message_id: 11,
        chat: { id: 999888777 },
        text: "👍",
        from: { id: 999888777, first_name: "NoTask" },
      },
    })

    if (!result.ok) throw new Error("Webhook did not return ok")
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
    console.log("\n🎉 All Telegram webhook tests passed!")
    process.exit(0)
  }
}

runTests().catch(console.error)
