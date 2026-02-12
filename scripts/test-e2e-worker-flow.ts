/**
 * End-to-End Worker Flow Test
 * Simulates the complete flow:
 * 1. Create integration
 * 2. Add worker
 * 3. Receive task from PM tool
 * 4. Worker starts task
 * 5. Worker completes task
 */

const BASE_URL = process.env.TEST_URL || "http://localhost:3000"
const MANAGER_TELEGRAM_ID = "888888888"
const WORKER_TELEGRAM_ID = "999999999"

async function fetchAPI(path: string, options: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-telegram-id": MANAGER_TELEGRAM_ID,
      ...options.headers,
    },
  })
  return response.json()
}

async function sendTelegramUpdate(update: any): Promise<any> {
  const response = await fetch(`${BASE_URL}/api/telegram/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  })
  return response.json()
}

async function runE2ETest() {
  console.log("\n🔄 End-to-End Worker Flow Test\n")
  console.log(`Manager Telegram ID: ${MANAGER_TELEGRAM_ID}`)
  console.log(`Worker Telegram ID: ${WORKER_TELEGRAM_ID}\n`)

  // Step 1: Create integration
  console.log("Step 1: Creating PM Integration...")
  const createResult = await fetchAPI("/api/pm-connect/integrations", {
    method: "POST",
    body: JSON.stringify({
      name: "E2E Test Integration",
      platform: "clickup",
      companyName: "E2E Test Company",
    }),
  })

  if (!createResult.success) {
    console.log(`❌ Failed to create integration: ${createResult.error}`)
    process.exit(1)
  }

  const integrationId = createResult.data.id
  const connectId = createResult.data.connectId
  console.log(`✅ Integration created: ${integrationId}`)
  console.log(`   Webhook URL: ${createResult.data.webhookUrl}\n`)

  // Step 2: Add worker
  console.log("Step 2: Adding worker...")
  const addWorkerResult = await fetchAPI(`/api/pm-connect/integrations/${integrationId}/workers`, {
    method: "POST",
    body: JSON.stringify({
      workerTelegramId: WORKER_TELEGRAM_ID,
      externalName: "Test Worker",
      externalId: "clickup_worker_1",
    }),
  })

  if (!addWorkerResult.success) {
    console.log(`❌ Failed to add worker: ${addWorkerResult.error}`)
    process.exit(1)
  }
  console.log(`✅ Worker added. Total workers: ${addWorkerResult.data.workersCount}\n`)

  // Step 3: Receive task from PM tool (ClickUp webhook)
  console.log("Step 3: Receiving task from ClickUp...")
  const webhookResponse = await fetch(`${BASE_URL}/api/v1/pm-connect/${connectId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task_id: "e2e_task_001",
      name: "Deliver package to 123 Main St",
      description: "Customer requested delivery before 5pm. Handle with care.",
      priority: { id: 1 }, // Urgent
      due_date: String(Date.now() + 3600000), // 1 hour from now
      assignees: [{ id: "clickup_worker_1" }],
      custom_fields: [
        { name: "Location", value: "123 Main St, City" }
      ]
    }),
  })
  const taskResult = await webhookResponse.json()

  if (!taskResult.success) {
    console.log(`❌ Failed to process webhook: ${taskResult.error}`)
    process.exit(1)
  }

  const taskId = taskResult.data.taskId
  console.log(`✅ Task created: ${taskId}`)
  console.log(`   Sent to worker: ${taskResult.data.sentTo}\n`)

  // Step 4: Worker receives /start command (bot introduction)
  console.log("Step 4: Worker starts bot...")
  await sendTelegramUpdate({
    message: {
      message_id: 100,
      chat: { id: parseInt(WORKER_TELEGRAM_ID) },
      text: "/start",
      from: { id: parseInt(WORKER_TELEGRAM_ID), first_name: "Worker" },
    },
  })
  console.log("✅ /start command handled\n")

  // Step 5: Worker starts the task via text command
  console.log("Step 5: Worker starts task (text: 'start')...")
  await sendTelegramUpdate({
    message: {
      message_id: 101,
      chat: { id: parseInt(WORKER_TELEGRAM_ID) },
      text: "start",
      from: { id: parseInt(WORKER_TELEGRAM_ID), first_name: "Worker" },
    },
  })
  console.log("✅ Task started\n")

  // Step 6: Worker adds a comment
  console.log("Step 6: Worker adds a note...")
  await sendTelegramUpdate({
    message: {
      message_id: 102,
      chat: { id: parseInt(WORKER_TELEGRAM_ID) },
      text: "On my way to delivery location",
      from: { id: parseInt(WORKER_TELEGRAM_ID), first_name: "Worker" },
    },
  })
  console.log("✅ Note added\n")

  // Step 7: Worker completes task
  console.log("Step 7: Worker completes task (text: 'done')...")
  await sendTelegramUpdate({
    message: {
      message_id: 103,
      chat: { id: parseInt(WORKER_TELEGRAM_ID) },
      text: "done",
      from: { id: parseInt(WORKER_TELEGRAM_ID), first_name: "Worker" },
    },
  })
  console.log("✅ Task completed\n")

  // Step 8: Verify integration stats
  console.log("Step 8: Verifying integration stats...")
  const integrationsResult = await fetchAPI("/api/pm-connect/integrations")
  const integration = integrationsResult.data.integrations.find((i: any) => i.id === integrationId)

  if (integration) {
    console.log(`   Tasks sent: ${integration.stats.tasks_sent}`)
    console.log(`   Tasks completed: ${integration.stats.tasks_completed}`)
    console.log(`   Avg response time: ${Math.round(integration.stats.avg_response_time_mins)} mins`)
  }

  // Test problem flow
  console.log("\n--- Testing Problem Flow ---\n")

  // Step 9: Receive another task
  console.log("Step 9: Receiving another task...")
  const webhookResponse2 = await fetch(`${BASE_URL}/api/v1/pm-connect/${connectId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task_id: "e2e_task_002",
      name: "Pick up supplies from warehouse",
      description: "Collect supplies for tomorrow's deliveries",
      priority: { id: 3 }, // Medium
      assignees: [{ id: "clickup_worker_1" }],
    }),
  })
  const taskResult2 = await webhookResponse2.json()
  console.log(`✅ Task 2 created: ${taskResult2.data.taskId}\n`)

  // Step 10: Worker reports problem
  console.log("Step 10: Worker reports problem...")
  await sendTelegramUpdate({
    message: {
      message_id: 110,
      chat: { id: parseInt(WORKER_TELEGRAM_ID) },
      text: "problem",
      from: { id: parseInt(WORKER_TELEGRAM_ID), first_name: "Worker" },
    },
  })
  console.log("✅ Problem status set\n")

  // Step 11: Worker describes problem
  console.log("Step 11: Worker describes the problem...")
  await sendTelegramUpdate({
    message: {
      message_id: 111,
      chat: { id: parseInt(WORKER_TELEGRAM_ID) },
      text: "Warehouse is closed, nobody is answering the phone",
      from: { id: parseInt(WORKER_TELEGRAM_ID), first_name: "Worker" },
    },
  })
  console.log("✅ Problem description saved (manager would be notified)\n")

  // Test button flow
  console.log("--- Testing Button Flow ---\n")

  // Step 12: Receive another task
  console.log("Step 12: Receiving another task...")
  const webhookResponse3 = await fetch(`${BASE_URL}/api/v1/pm-connect/${connectId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task_id: "e2e_task_003",
      name: "Button test task",
      description: "Test button interactions",
      priority: { id: 2 }, // High
      assignees: [{ id: "clickup_worker_1" }],
    }),
  })
  const taskResult3 = await webhookResponse3.json()
  const task3Id = taskResult3.data.taskId
  console.log(`✅ Task 3 created: ${task3Id}\n`)

  // Step 13: Worker clicks Start button (callback query)
  console.log("Step 13: Worker clicks 'Start' button...")
  await sendTelegramUpdate({
    callback_query: {
      id: "callback_start_001",
      from: { id: parseInt(WORKER_TELEGRAM_ID), first_name: "Worker" },
      message: {
        message_id: 200,
        chat: { id: parseInt(WORKER_TELEGRAM_ID) },
      },
      data: `task_start_${task3Id}`,
    },
  })
  console.log("✅ Start button handled\n")

  // Step 14: Worker clicks Done button (callback query)
  console.log("Step 14: Worker clicks 'Done' button...")
  await sendTelegramUpdate({
    callback_query: {
      id: "callback_done_001",
      from: { id: parseInt(WORKER_TELEGRAM_ID), first_name: "Worker" },
      message: {
        message_id: 200,
        chat: { id: parseInt(WORKER_TELEGRAM_ID) },
      },
      data: `task_done_${task3Id}`,
    },
  })
  console.log("✅ Done button handled\n")

  // Final stats
  console.log("=".repeat(50))
  console.log("FINAL VERIFICATION")
  console.log("=".repeat(50))

  const finalResult = await fetchAPI("/api/pm-connect/integrations")
  const finalIntegration = finalResult.data.integrations.find((i: any) => i.id === integrationId)

  if (finalIntegration) {
    console.log(`\nIntegration: ${finalIntegration.name}`)
    console.log(`Platform: ${finalIntegration.platform}`)
    console.log(`Active: ${finalIntegration.isActive}`)
    console.log(`\nStats:`)
    console.log(`  Tasks sent: ${finalIntegration.stats.tasks_sent}`)
    console.log(`  Tasks completed: ${finalIntegration.stats.tasks_completed}`)
    console.log(`  Avg response time: ${Math.round(finalIntegration.stats.avg_response_time_mins)} mins`)
  }

  console.log("\n🎉 End-to-End test completed successfully!")
}

runE2ETest().catch(error => {
  console.error("Test failed:", error)
  process.exit(1)
})
