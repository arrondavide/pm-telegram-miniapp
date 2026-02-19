# WhatsTask Developer API Guide

> **For Companies & Developers Integrating with WhatsTask**

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Authentication](#2-authentication)
3. [Webhook Integration](#3-webhook-integration)
4. [Step-by-Step Examples](#4-step-by-step-examples)
5. [Supported Services](#5-supported-services)
6. [API Reference](#6-api-reference)
7. [Rate Limits](#7-rate-limits)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Quick Start

### What You Can Do With The API

| Feature | Description |
|---------|-------------|
| **Receive Notifications** | Get alerts from GitHub, Stripe, Vercel, etc. directly in Telegram |
| **Auto-Create Tasks** | Webhooks automatically create tasks in your projects |
| **Custom Integrations** | Connect any service that supports webhooks |

### What You'll Need

1. Your **API Key** (provided by WhatsTask admin)
2. Your **Webhook URL** (we'll create this together)
3. The service you want to connect (GitHub, Stripe, etc.)

---

## 2. Authentication

### Your API Key

Your API key looks like this:
```
wt_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4
```

**Important Rules:**
- Keep your API key **SECRET** - treat it like a password
- Never share it publicly or commit it to code repositories
- If compromised, contact WhatsTask admin to revoke and get a new key

### Using Your API Key

Include the API key in the header of your requests:

```bash
curl -X GET "https://pm.whatstask.com/api/developer/webhooks" \
  -H "x-api-key: wt_your_api_key_here"
```

---

## 3. Webhook Integration

### How Webhooks Work

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Your Service  │     │    WhatsTask    │     │    Telegram     │
│  (GitHub, etc)  │────►│    Webhook      │────►│   Notification  │
│                 │     │    Endpoint     │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │   1. Event occurs     │  2. Process webhook   │  3. You receive
        │   (PR opened, etc)    │     & parse data      │     notification
```

### Your Webhook URL

You will receive a webhook URL that looks like:
```
https://pm.whatstask.com/api/v1/webhook/abc123def456
```

This is the URL you'll add to your external services.

---

## 4. Step-by-Step Examples

### Example 1: Connect GitHub

**Goal:** Get notified in Telegram when someone opens a PR or issue.

#### Step 1: Get Your Webhook URL
Your WhatsTask admin will provide you with a webhook URL like:
```
https://pm.whatstask.com/api/v1/webhook/abc123def456
```

#### Step 2: Add Webhook to GitHub

1. Go to your GitHub repository
2. Click **Settings** → **Webhooks** → **Add webhook**
3. Fill in the form:

| Field | Value |
|-------|-------|
| **Payload URL** | `https://pm.whatstask.com/api/v1/webhook/abc123def456` |
| **Content type** | `application/json` |
| **Secret** | Leave empty (or set if provided) |
| **Events** | Select: `Pull requests`, `Issues`, `Pushes` |

4. Click **Add webhook**

#### Step 3: Test It
- Create a test PR or issue
- You should receive a Telegram notification within seconds!

**Example Notification:**
```
PR opened: Add new feature

john_doe opened a pull request in company/repo

View Details

—
via GitHub → WhatsTask
```

---

### Example 2: Connect Stripe

**Goal:** Get notified when payments are received.

#### Step 1: Go to Stripe Dashboard
1. Open [Stripe Dashboard](https://dashboard.stripe.com)
2. Go to **Developers** → **Webhooks**
3. Click **Add endpoint**

#### Step 2: Configure Webhook

| Field | Value |
|-------|-------|
| **Endpoint URL** | `https://pm.whatstask.com/api/v1/webhook/abc123def456` |
| **Events** | Select: `payment_intent.succeeded`, `invoice.paid`, etc. |

#### Step 3: Save & Test
- Stripe has a "Send test webhook" button
- Click it to verify the connection works

**Example Notification:**
```
Stripe: payment intent succeeded

Amount: 99.00 USD

—
via Stripe → WhatsTask
```

---

### Example 3: Connect Vercel

**Goal:** Get notified when deployments complete.

#### Step 1: Go to Vercel Project Settings
1. Open your project in Vercel
2. Go to **Settings** → **Git** → **Deploy Hooks** OR
3. Go to **Settings** → **Webhooks**

#### Step 2: Add Webhook URL

| Field | Value |
|-------|-------|
| **URL** | `https://pm.whatstask.com/api/v1/webhook/abc123def456` |
| **Events** | `deployment.created`, `deployment.succeeded`, `deployment.failed` |

#### Step 3: Deploy Something
- Push a commit to trigger a deployment
- You'll get notified when it completes!

**Example Notification:**
```
Deployment deployment.succeeded

my-app - deployment.succeeded

View Details: https://my-app-xyz.vercel.app

—
via Vercel → WhatsTask
```

---

### Example 4: Connect Any Custom Service

**Goal:** Send notifications from your own app/script.

#### Using cURL
```bash
curl -X POST "https://pm.whatstask.com/api/v1/webhook/abc123def456" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Server Alert",
    "message": "CPU usage exceeded 90%",
    "priority": "high",
    "source": "Monitoring System"
  }'
```

#### Using JavaScript/Node.js
```javascript
const sendNotification = async () => {
  const response = await fetch(
    "https://pm.whatstask.com/api/v1/webhook/abc123def456",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: "New Order Received",
        message: "Order #12345 - $150.00",
        priority: "medium",
        source: "E-commerce System"
      })
    }
  );

  const result = await response.json();
  console.log(result);
};

sendNotification();
```

#### Using Python
```python
import requests

webhook_url = "https://pm.whatstask.com/api/v1/webhook/abc123def456"

data = {
    "title": "Backup Completed",
    "message": "Daily backup finished successfully. Size: 2.3 GB",
    "priority": "low",
    "source": "Backup System"
}

response = requests.post(webhook_url, json=data)
print(response.json())
```

#### Using PHP
```php
<?php
$webhook_url = "https://pm.whatstask.com/api/v1/webhook/abc123def456";

$data = [
    "title" => "Form Submission",
    "message" => "New contact form submission from john@example.com",
    "source" => "Website"
];

$ch = curl_init($webhook_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));

$response = curl_exec($ch);
curl_close($ch);

echo $response;
?>
```

---

## 5. Supported Services

### Auto-Detected Services

These services are automatically detected and formatted nicely:

| Service | Events Supported |
|---------|-----------------|
| **GitHub** | Pull Requests, Issues, Pushes, Reviews |
| **Stripe** | Payments, Invoices, Subscriptions |
| **Vercel** | Deployments (created, succeeded, failed) |
| **Linear** | Issues, Comments, Status changes |

### Generic Webhooks

For any other service, we look for these common fields:

| Field | Description |
|-------|-------------|
| `title` | Main heading of the notification |
| `message` / `description` / `text` | Body content |
| `priority` | low, medium, high, urgent |
| `status` | Any status information |
| `url` / `link` | Link to view details |
| `source` | Name of the sending service |

---

## 6. API Reference

### Verify Webhook (GET)

Check if your webhook is active:

```bash
curl -X GET "https://pm.whatstask.com/api/v1/webhook/abc123def456"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "GitHub Notifications",
    "isActive": true,
    "targetType": "notification",
    "usageCount": 42
  }
}
```

### Send Webhook (POST)

Send data to your webhook with **custom recipients**:

```bash
curl -X POST "https://pm.whatstask.com/api/v1/webhook/abc123def456" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Your Title",
    "message": "Your message here",
    "priority": "medium",
    "url": "https://example.com/details",
    "source": "Your App",
    "recipients": ["123456789", "987654321"]
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "data": {
    "type": "notification",
    "recipientCount": 2,
    "parsed": {
      "title": "Your Title",
      "hasMessage": true,
      "source": "Your App"
    }
  }
}
```

### Specifying Recipients

You have **3 ways** to specify who receives notifications:

| Method | Priority | Description |
|--------|----------|-------------|
| **In payload** | 1st (highest) | Send `recipients` array in webhook payload |
| **Default recipients** | 2nd | Set when creating webhook |
| **Webhook creator** | 3rd (fallback) | If nothing else specified |

**Payload fields for recipients** (any of these work):
- `recipients`: `["123456789", "987654321"]`
- `telegram_ids`: `["123456789"]`
- `telegram_id`: `"123456789"` (single recipient)
- `chat_ids`: `["123456789"]`
- `chat_id`: `"123456789"`

### Create Webhook with Default Recipients

When creating a webhook, you can set default recipients:

```bash
curl -X POST "https://pm.whatstask.com/api/developer/webhooks" \
  -H "Content-Type: application/json" \
  -H "x-telegram-id: YOUR_TELEGRAM_ID" \
  -d '{
    "name": "Team Alerts",
    "companyId": "YOUR_COMPANY_ID",
    "targetType": "notification",
    "recipients": ["111111111", "222222222", "333333333"]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hookId": "abc123def456",
    "url": "https://app.com/api/v1/webhook/abc123def456",
    "defaultRecipients": ["111111111", "222222222", "333333333"]
  },
  "message": "Webhook created. Notifications will be sent to 3 recipient(s)."
}
```

Now ALL webhooks to this URL will notify those 3 people (unless overridden in payload).

### Webhook Target Types

When your webhook was created, it was configured with a target type:

| Type | Behavior |
|------|----------|
| `notification` | Sends Telegram notification only |
| `task` | Creates a task in your project |
| `both` | Sends notification AND creates task |

---

## 7. Rate Limits

| Limit | Value |
|-------|-------|
| Requests per minute | 60 |
| API keys per user | 10 |
| Webhooks per user | 20 |

If you exceed limits, you'll receive a `429 Too Many Requests` response.

---

## 8. Troubleshooting

### "Webhook not found or inactive"

**Cause:** The webhook URL is incorrect or has been deactivated.

**Solution:**
1. Double-check the webhook URL
2. Contact WhatsTask admin to verify the webhook is active

### "Not receiving notifications"

**Cause:** The webhook is working but notifications aren't arriving.

**Solutions:**
1. Check you've started a conversation with the WhatsTask bot on Telegram
2. Make sure your Telegram notifications are enabled
3. Verify the webhook is set to `notification` or `both` target type

### "Webhook returns 500 error"

**Cause:** Server-side processing error.

**Solutions:**
1. Ensure your payload is valid JSON
2. Try a simpler payload to test:
```json
{"title": "Test", "message": "Hello"}
```
3. Contact WhatsTask admin with the error details

### "GitHub/Stripe not connecting"

**Cause:** Usually a URL copy/paste issue.

**Solutions:**
1. Make sure you copied the FULL webhook URL including `https://`
2. Ensure there are no extra spaces
3. For Stripe, ensure the endpoint is NOT set to "Test mode only" if you're in production

---

## Need Help?

Contact your WhatsTask administrator for:
- New API keys
- Additional webhooks
- Custom integrations
- Bug reports

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WHATSTASK API QUICK REFERENCE                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  YOUR WEBHOOK URL:                                                  │
│  https://pm.whatstask.com/api/v1/webhook/[YOUR_HOOK_ID]       │
│                                                                     │
│  SIMPLE TEST:                                                       │
│  curl -X POST [YOUR_WEBHOOK_URL] \                                  │
│    -H "Content-Type: application/json" \                            │
│    -d '{"title":"Test","message":"Hello!"}'                         │
│                                                                     │
│  SEND TO MULTIPLE PEOPLE:                                           │
│  curl -X POST [YOUR_WEBHOOK_URL] \                                  │
│    -H "Content-Type: application/json" \                            │
│    -d '{"title":"Alert","message":"Check this!",                    │
│         "recipients":["123456789","987654321"]}'                    │
│                                                                     │
│  PAYLOAD FORMAT:                                                    │
│  {                                                                  │
│    "title": "...",       // Required - notification title           │
│    "message": "...",     // Optional - notification body            │
│    "recipients": [...],  // Optional - Telegram IDs to notify       │
│    "priority": "...",    // Optional - low/medium/high/urgent       │
│    "url": "...",         // Optional - link to details              │
│    "source": "..."       // Optional - your app name                │
│  }                                                                  │
│                                                                     │
│  RECIPIENT PRIORITY:                                                │
│  1. recipients in payload (if provided)                             │
│  2. default_recipients on webhook (if configured)                   │
│  3. webhook creator (fallback)                                      │
│                                                                     │
│  SUPPORTED SERVICES:                                                │
│  GitHub, Stripe, Vercel, Linear, + any webhook-capable service      │
│                                                                     │
│  RATE LIMIT: 60 requests/minute                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

*Last Updated: February 2026*
