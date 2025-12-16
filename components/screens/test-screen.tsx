"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, XCircle, Loader2, Play, ArrowLeft } from "lucide-react"
import { formatDuration, formatElapsedTime } from "@/lib/format-time"
import { useAppStore } from "@/lib/store"
import { taskApi, statsApi } from "@/lib/api"

type TestResult = {
  name: string
  status: "pending" | "running" | "passed" | "failed"
  message?: string
  duration?: number
}

export function TestScreen({ onBack }: { onBack: () => void }) {
  const [tests, setTests] = useState<TestResult[]>([
    { name: "Format Duration (0 seconds)", status: "pending" },
    { name: "Format Duration (90 seconds)", status: "pending" },
    { name: "Format Duration (1 day + 2 hours)", status: "pending" },
    { name: "Format Elapsed Time", status: "pending" },
    { name: "Fetch Tasks from API", status: "pending" },
    { name: "Fetch Stats from API", status: "pending" },
    { name: "Time Logs API (Mock Task)", status: "pending" },
  ])
  const [isRunning, setIsRunning] = useState(false)
  const { currentUser, currentCompany } = useAppStore()

  const updateTest = (index: number, updates: Partial<TestResult>) => {
    setTests((prev) => prev.map((test, i) => (i === index ? { ...test, ...updates } : test)))
  }

  const runTests = async () => {
    setIsRunning(true)
    const startTime = Date.now()

    // Test 1: Format Duration (0 seconds)
    try {
      updateTest(0, { status: "running" })
      const result = formatDuration(0)
      if (result === "00:00:00:00") {
        updateTest(0, { status: "passed", message: `Result: ${result}` })
      } else {
        updateTest(0, { status: "failed", message: `Expected 00:00:00:00, got ${result}` })
      }
    } catch (error) {
      updateTest(0, { status: "failed", message: String(error) })
    }

    // Test 2: Format Duration (90 seconds)
    try {
      updateTest(1, { status: "running" })
      const result = formatDuration(90)
      if (result === "00:00:01:30") {
        updateTest(1, { status: "passed", message: `Result: ${result}` })
      } else {
        updateTest(1, { status: "failed", message: `Expected 00:00:01:30, got ${result}` })
      }
    } catch (error) {
      updateTest(1, { status: "failed", message: String(error) })
    }

    // Test 3: Format Duration (1 day + 2 hours = 93600 seconds)
    try {
      updateTest(2, { status: "running" })
      const result = formatDuration(93600)
      if (result === "01:02:00:00") {
        updateTest(2, { status: "passed", message: `Result: ${result}` })
      } else {
        updateTest(2, { status: "failed", message: `Expected 01:02:00:00, got ${result}` })
      }
    } catch (error) {
      updateTest(2, { status: "failed", message: String(error) })
    }

    // Test 4: Format Elapsed Time
    try {
      updateTest(3, { status: "running" })
      const result = formatElapsedTime(3665) // 1 hour, 1 minute, 5 seconds
      if (result === "00:01:01:05") {
        updateTest(3, { status: "passed", message: `Result: ${result}` })
      } else {
        updateTest(3, { status: "failed", message: `Expected 00:01:01:05, got ${result}` })
      }
    } catch (error) {
      updateTest(3, { status: "failed", message: String(error) })
    }

    // Test 5: Fetch Tasks from API
    if (currentCompany?.id && currentUser?.telegramId) {
      try {
        updateTest(4, { status: "running" })
        const tasks = await taskApi.getAll(currentCompany.id, currentUser.telegramId.toString())
        updateTest(4, {
          status: "passed",
          message: `Found ${tasks.length} tasks in company`,
        })
      } catch (error) {
        updateTest(4, { status: "failed", message: String(error) })
      }
    } else {
      updateTest(4, { status: "failed", message: "No company or user found" })
    }

    // Test 6: Fetch Stats from API
    if (currentCompany?.id && currentUser?.telegramId) {
      try {
        updateTest(5, { status: "running" })
        const stats = await statsApi.get(currentCompany.id, currentUser.telegramId.toString())
        updateTest(5, {
          status: "passed",
          message: `Total: ${stats.totalTasks}, Completed: ${stats.completedTasks}, Time: ${formatDuration(stats.totalSecondsWorked || 0)}`,
        })
      } catch (error) {
        updateTest(5, { status: "failed", message: String(error) })
      }
    } else {
      updateTest(5, { status: "failed", message: "No company or user found" })
    }

    // Test 7: Time Logs API
    if (currentUser?.telegramId) {
      try {
        updateTest(6, { status: "running" })
        // Try to get time logs for any task (this will test the API endpoint)
        const response = await fetch("/api/debug/timelogs")
        const data = await response.json()
        updateTest(6, {
          status: "passed",
          message: `Found ${data.timeLogs?.length || 0} time logs in database`,
        })
      } catch (error) {
        updateTest(6, { status: "failed", message: String(error) })
      }
    } else {
      updateTest(6, { status: "failed", message: "No user found" })
    }

    const totalTime = Date.now() - startTime
    setIsRunning(false)

    // Summary
    const passed = tests.filter((t) => t.status === "passed").length
    const failed = tests.filter((t) => t.status === "failed").length
    console.log(`[v0] Tests completed: ${passed} passed, ${failed} failed in ${totalTime}ms`)
  }

  const getStatusIcon = (status: TestResult["status"]) => {
    switch (status) {
      case "passed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />
      case "running":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
    }
  }

  const passedCount = tests.filter((t) => t.status === "passed").length
  const failedCount = tests.filter((t) => t.status === "failed").length
  const totalCount = tests.length

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Time Tracking Tests</h1>
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-2xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Run tests to verify time tracking functionality</p>
            </div>
            <Button onClick={runTests} disabled={isRunning} size="lg">
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Tests
                </>
              )}
            </Button>
          </div>

          {(passedCount > 0 || failedCount > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>{passedCount} passed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span>{failedCount} failed</span>
                  </div>
                  <div className="text-muted-foreground">{totalCount} total</div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {tests.map((test, index) => (
              <Card key={index}>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(test.status)}
                      <div>
                        <CardTitle className="text-sm font-medium">{test.name}</CardTitle>
                        {test.message && <CardDescription className="text-xs mt-1">{test.message}</CardDescription>}
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>

          <Card className="bg-muted">
            <CardHeader>
              <CardTitle className="text-sm">Current Context</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              <div>User Telegram ID: {currentUser?.telegramId || "Not found"}</div>
              <div>Company ID: {currentCompany?.id || "Not found"}</div>
              <div>Company Name: {currentCompany?.name || "Not found"}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
