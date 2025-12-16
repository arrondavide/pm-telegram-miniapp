# Time Tracking Test Guide

This guide explains how to test all time tracking features in the WhatsTask app.

## Automated Tests

Run the comprehensive test suite:

```bash
npm run test:time-tracking
```

Or execute directly:

```bash
npx tsx scripts/test-time-tracking.ts
```

### Test Configuration

Before running API tests, update the `TEST_CONFIG` in `scripts/test-time-tracking.ts`:

```typescript
const TEST_CONFIG = {
  testTelegramId: 'YOUR_TELEGRAM_ID',
  testCompanyId: 'YOUR_COMPANY_ID',
  testTaskId: 'YOUR_TASK_ID'
}
```

## Manual Testing Checklist

### 1. Employee Side - Clock In/Out

- [ ] Open a task as an employee
- [ ] Click "Start Timer" button
- [ ] Verify timer starts counting (00:00:00:00 format)
- [ ] Wait at least 5 seconds
- [ ] Click "Stop Timer" button
- [ ] Verify "Time Tracked" section updates with new log
- [ ] Check time shows in DD:HH:MM:SS format

**Expected Result:** Time log appears immediately with correct duration

### 2. Admin Side - View Time Logs

- [ ] Admin opens the same task
- [ ] Scroll to "Time Tracked" section
- [ ] Verify employee's time log is visible
- [ ] Check duration displays correctly in DD:HH:MM:SS format
- [ ] Verify employee name/ID shows correctly

**Expected Result:** Admin sees all employee time logs for the task

### 3. Employee Stats Page

- [ ] Navigate to Stats screen as employee
- [ ] Check "Personal Stats" tab
- [ ] Verify "Total Time Tracked" shows correct time
- [ ] Verify "Tasks Completed", "Tasks Pending", "Overdue Tasks" counts
- [ ] Click refresh button and verify data updates

**Expected Result:** Personal stats show accurate time in DD:HH:MM:SS format

### 4. Admin Stats Page

- [ ] Navigate to Stats screen as admin
- [ ] Check "Team Stats" tab
- [ ] Verify "Team Total Time Tracked" shows sum of all employee time
- [ ] Check "Team Members" count
- [ ] View "Top Performers" list

**Expected Result:** Team stats aggregate all employee data correctly

### 5. Multiple Time Logs

- [ ] Clock in and out 3 times on the same task
- [ ] Verify all 3 time logs appear in task detail
- [ ] Check total time tracked = sum of all logs
- [ ] Verify format is consistent across all logs

**Expected Result:** All time logs display and sum correctly

### 6. Cross-Session Persistence

- [ ] Employee clocks in on a task
- [ ] Close and reopen the miniapp
- [ ] Verify timer is still running (if active)
- [ ] Clock out
- [ ] Close and reopen as admin
- [ ] Verify time log is visible

**Expected Result:** Time logs persist across sessions

## Debugging Failed Tests

### Issue: Time not showing for admin

**Check:**
1. Open `/api/debug/timelogs?companyId=YOUR_COMPANY_ID`
2. Verify time logs exist in database
3. Check `task_id` matches the task being viewed
4. Verify `end_time` and `duration_minutes` are set

**Fix:** If time logs exist but don't show, check task ID matching in API query

### Issue: Stats showing 00:00:00:00

**Check:**
1. Verify employee has clocked out (not just clocked in)
2. Check time logs have `end_time` set
3. Verify `duration_minutes` > 0 in database
4. Check stats API response for `totalSecondsWorked`

**Fix:** Ensure clock-out completes successfully and saves duration

### Issue: Timer not stopping

**Check:**
1. Browser console for errors
2. Network tab for failed API calls to `/api/time/clock-out`
3. Check `X-Telegram-Id` header is being sent

**Fix:** Verify `currentUser.telegramId` is set correctly

## API Endpoints to Test

### Clock In
```
POST /api/time/clock-in
Headers: { "X-Telegram-Id": "123456789" }
Body: { "taskId": "task_id" }
```

### Clock Out
```
POST /api/time/clock-out
Headers: { "X-Telegram-Id": "123456789" }
Body: { "taskId": "task_id" }
```

### Get Time Logs
```
GET /api/tasks/{taskId}/timelogs
Headers: { "X-Telegram-Id": "123456789" }
```

### Get Stats
```
GET /api/stats?companyId={companyId}
Headers: { "X-Telegram-Id": "123456789" }
```

### Debug Time Logs
```
GET /api/debug/timelogs?companyId={companyId}
Headers: { "X-Telegram-Id": "123456789" }
```

## Expected Time Format

All time displays should use the format: `DD:HH:MM:SS`

Examples:
- 0 seconds: `00:00:00:00`
- 65 seconds: `00:00:01:05`
- 1 hour 30 minutes: `00:01:30:00`
- 2 days 5 hours: `02:05:00:00`

## Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Time not syncing | Task ID mismatch | Ensure task IDs are consistent (MongoDB ObjectId strings) |
| Stats showing 0 | Incomplete clock-out | Always clock out to finalize time logs |
| NaN:NaN:NaN:NaN | Missing duration data | Check `duration_minutes` field in database |
| Admin can't see logs | User ID mismatch | Use `telegramId` consistently for queries |

## Success Criteria

All tests pass when:
- ✅ Time formatting displays correctly in DD:HH:MM:SS format
- ✅ Clock in/out APIs return success with proper data
- ✅ Time logs appear for both employee and admin
- ✅ Stats calculate correctly from database
- ✅ Total time tracked matches sum of all time logs
- ✅ Data persists across sessions and user roles
