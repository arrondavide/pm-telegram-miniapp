# PM Connect Testing Guide

## Automated Tests

Run all tests with:
```bash
# Start dev server first
npm run dev

# In another terminal:
npx tsx scripts/test-pm-connect.ts      # API tests
npx tsx scripts/test-telegram-webhook.ts # Bot handler tests
npx tsx scripts/test-e2e-worker-flow.ts  # End-to-end flow
```

## Test Results Summary

### API Tests (12 tests) ✅
- Create integration
- List integrations
- Add worker (valid)
- Add worker (invalid Telegram ID - rejected)
- Add worker (missing ID - rejected)
- Add worker (invalid integration - rejected)
- Webhook verification (GET)
- Monday.com webhook
- ClickUp webhook
- Generic webhook
- Telegram health check
- Remove worker

### Telegram Handler Tests (10 tests) ✅
- /start command
- 'start' without task
- 'done' without task
- 'problem' without task
- Random text ignored
- Invalid callback
- Unknown action
- Empty update
- Photo without task
- Emoji commands

### End-to-End Flow ✅
- Integration creation
- Worker addition
- Task from PM tool
- Worker starts task
- Worker adds notes
- Worker completes task
- Problem reporting
- Button interactions

## Manual Testing Checklist

### Before Launch - Must Test Manually:

#### 1. Telegram Bot Setup
- [ ] Create bot via @BotFather
- [ ] Set TELEGRAM_BOT_TOKEN in environment
- [ ] Set webhook: `https://yourdomain.com/api/telegram/webhook`

#### 2. UI Testing
- [ ] Navigate to Profile → PM Connect (admin/manager only)
- [ ] Create new integration (select platform)
- [ ] Copy webhook URL
- [ ] Add worker with valid Telegram ID
- [ ] Verify integration appears in list

#### 3. Worker Onboarding
- [ ] Worker opens Telegram bot
- [ ] Worker sends /start
- [ ] Verify welcome message shows Telegram ID

#### 4. Task Flow (with real Telegram)
- [ ] Send test webhook to integration URL
- [ ] Verify worker receives task in Telegram
- [ ] Verify inline buttons work (Start/Done/Problem)
- [ ] Test text commands: start, done, problem
- [ ] Test photo sending
- [ ] Verify stats update in PM Connect screen

#### 5. Problem Flow
- [ ] Worker sends "problem"
- [ ] Worker describes issue
- [ ] Manager receives notification

#### 6. Platform-Specific Testing
Test with each PM tool if using:
- [ ] Monday.com webhook format
- [ ] Asana webhook format
- [ ] ClickUp webhook format
- [ ] Trello webhook format
- [ ] Generic webhook format

## Test Webhook Payloads

### Monday.com
```json
{
  "event": {
    "pulseId": "12345",
    "pulseName": "Task Name",
    "userId": "user_123",
    "boardId": "board_456",
    "columnValues": {
      "text": { "value": "Description" },
      "priority": { "label": "High" }
    }
  }
}
```

### ClickUp
```json
{
  "task_id": "abc123",
  "name": "Task Name",
  "description": "Description",
  "priority": { "id": 2 },
  "assignees": [{ "id": "user_123" }],
  "due_date": "1699900000000"
}
```

### Asana
```json
{
  "events": [{
    "resource": {
      "gid": "12345",
      "name": "Task Name",
      "notes": "Description",
      "assignee": { "gid": "user_123" },
      "priority": "high"
    }
  }]
}
```

### Generic
```json
{
  "title": "Task Name",
  "description": "Description",
  "priority": "high",
  "due_date": "2024-12-25",
  "assignee_id": "user_123"
}
```

## Common Issues

### Webhook not receiving tasks
- Check integration is active
- Verify webhook URL is correct
- Check PM tool webhook settings
- Look for errors in server logs

### Worker not receiving messages
- Verify TELEGRAM_BOT_TOKEN is set
- Check worker Telegram ID is numeric
- Ensure worker has started the bot (/start)
- Verify worker is active in integration

### Buttons not working
- Check task ID format in callback_data
- Verify bot has permission to edit messages
- Check server logs for callback errors

## Environment Variables Required

```env
MONGODB_URI=your_mongodb_uri
TELEGRAM_BOT_TOKEN=your_bot_token
NEXT_PUBLIC_APP_URL=https://your-domain.com
```
