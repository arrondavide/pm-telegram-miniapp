# WhatsTask Developer API Documentation

Send Telegram notifications from any application. No bot management required.

## Quick Start

### 1. Get Your API Key

1. Open WhatsTask in Telegram
2. Go to **Profile → Developer API**
3. Click **Create Key**
4. Copy and save your key (you won't see it again!)

### 2. Send Your First Notification

```bash
curl -X POST https://whatstask.com/api/v1/notify \
  -H "Authorization: Bearer wt_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "telegram_id": "123456789",
    "message": "Hello from my app!"
  }'
```

That's it! The user will receive your message on Telegram.

---

## Authentication

All API requests require an API key. Pass it in the `Authorization` header:

```
Authorization: Bearer wt_your_api_key_here
```

Or include it in the request body:

```json
{
  "api_key": "wt_your_api_key_here",
  "message": "Hello!"
}
```

### API Key Permissions

When creating an API key, you can select permissions:

| Permission | Description |
|------------|-------------|
| `notify` | Send notifications to users |
| `tasks:read` | Read tasks and projects |
| `tasks:write` | Create and update tasks |
| `projects:read` | Read project data |
| `webhooks` | Manage webhook endpoints |

---

## Endpoints

### POST /api/v1/notify

Send a notification to a Telegram user.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `telegram_id` | string | Yes* | Telegram user ID to notify |
| `user_id` | string | Yes* | WhatsTask user ID (alternative to telegram_id) |
| `message` | string | Yes | The notification message |
| `title` | string | No | Bold title above the message |
| `project` | string | No | Project name to display |
| `priority` | string | No | One of: `low`, `medium`, `high`, `urgent` |
| `link` | string | No | URL to include in notification |

*Either `telegram_id` or `user_id` is required.

**Example Request:**

```bash
curl -X POST https://whatstask.com/api/v1/notify \
  -H "Authorization: Bearer wt_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "telegram_id": "123456789",
    "title": "Deployment Complete",
    "message": "Production deployment finished successfully.",
    "project": "Backend API",
    "priority": "high",
    "link": "https://github.com/org/repo/actions/runs/123"
  }'
```

**Response:**

```json
{
  "success": true,
  "message": "Notification sent successfully",
  "data": {
    "sent_to": "123456789",
    "timestamp": "2026-02-12T10:30:00.000Z"
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | Invalid API key | Key doesn't exist or is revoked |
| 403 | Permission denied | Key lacks `notify` permission |
| 403 | User not in company | Target user isn't in your company |
| 429 | Rate limit exceeded | Too many requests |
| 500 | Failed to send | Telegram API error |

---

## Webhooks

Receive notifications from external services like GitHub, Stripe, and Vercel.

### Create a Webhook

1. Go to **Profile → Developer API → Webhooks**
2. Click **Create Webhook**
3. Copy the webhook URL

### Webhook URL Format

```
https://whatstask.com/api/v1/webhook/{hook_id}
```

### Supported Services

We automatically parse webhooks from:

- **GitHub**: Pull requests, issues, pushes
- **Stripe**: Payments, subscriptions, invoices
- **Vercel**: Deployments
- **Linear**: Issues

Any other JSON payload is also accepted—we'll extract title and message fields.

### Webhook Actions

When creating a webhook, choose what happens:

| Action | Description |
|--------|-------------|
| `notification` | Send a Telegram notification (default) |
| `task` | Create a task in a project |
| `both` | Send notification AND create task |

### Example: GitHub Webhook Setup

1. Go to your GitHub repo → Settings → Webhooks
2. Click "Add webhook"
3. Paste your WhatsTask webhook URL
4. Select "application/json" content type
5. Choose events (e.g., Pull requests, Issues)
6. Save

Now you'll get Telegram notifications for GitHub events!

---

## Rate Limits

| Tier | Requests/Minute | Requests/Month |
|------|-----------------|----------------|
| Free | 60 | 1,000 |
| Starter | 120 | 10,000 |
| Pro | 300 | 100,000 |
| Enterprise | Custom | Unlimited |

When rate limited, you'll receive:

```json
{
  "success": false,
  "error": "Rate limit exceeded. Try again later."
}
```

The rate limit resets every minute.

---

## Code Examples

### Node.js

```javascript
const axios = require('axios');

async function sendNotification(telegramId, message) {
  const response = await axios.post(
    'https://whatstask.com/api/v1/notify',
    {
      telegram_id: telegramId,
      message: message,
      title: 'My App Alert'
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.WHATSTASK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data;
}

// Usage
sendNotification('123456789', 'Something happened!');
```

### Python

```python
import requests
import os

def send_notification(telegram_id: str, message: str):
    response = requests.post(
        'https://whatstask.com/api/v1/notify',
        json={
            'telegram_id': telegram_id,
            'message': message,
            'title': 'My App Alert'
        },
        headers={
            'Authorization': f'Bearer {os.environ["WHATSTASK_API_KEY"]}',
            'Content-Type': 'application/json'
        }
    )

    return response.json()

# Usage
send_notification('123456789', 'Something happened!')
```

### Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "net/http"
    "os"
)

func sendNotification(telegramID, message string) error {
    payload := map[string]string{
        "telegram_id": telegramID,
        "message":     message,
        "title":       "My App Alert",
    }

    body, _ := json.Marshal(payload)

    req, _ := http.NewRequest("POST",
        "https://whatstask.com/api/v1/notify",
        bytes.NewBuffer(body))

    req.Header.Set("Authorization", "Bearer "+os.Getenv("WHATSTASK_API_KEY"))
    req.Header.Set("Content-Type", "application/json")

    client := &http.Client{}
    _, err := client.Do(req)

    return err
}
```

### cURL (GitHub Actions)

```yaml
- name: Notify on Telegram
  run: |
    curl -X POST https://whatstask.com/api/v1/notify \
      -H "Authorization: Bearer ${{ secrets.WHATSTASK_API_KEY }}" \
      -H "Content-Type: application/json" \
      -d '{
        "telegram_id": "${{ secrets.TELEGRAM_ID }}",
        "title": "Build Complete",
        "message": "Build #${{ github.run_number }} finished successfully",
        "priority": "high",
        "link": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
      }'
```

---

## Error Handling

All responses follow this format:

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Description of what went wrong"
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "API key required" | No key provided | Add Authorization header |
| "Invalid or expired API key" | Key is wrong or revoked | Check key or create new one |
| "API key does not have 'notify' permission" | Missing permission | Update key permissions |
| "User does not belong to your company" | Target not in your company | Check user is in same company |
| "Rate limit exceeded" | Too many requests | Wait and retry |

---

## Best Practices

1. **Store keys securely**: Use environment variables, never commit keys to code
2. **Handle rate limits**: Implement exponential backoff on 429 errors
3. **Validate responses**: Always check `success` field before using data
4. **Use specific permissions**: Only request permissions you need
5. **Rotate keys periodically**: Create new keys and revoke old ones regularly

---

## Support

- **Email**: support@whatstask.com
- **GitHub Issues**: github.com/whatstask/api-issues
- **Telegram**: @whatstask_support

---

*API Version: 1.0*
*Last Updated: February 2026*
