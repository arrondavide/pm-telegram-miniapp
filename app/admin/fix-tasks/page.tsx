"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export default function FixTasksPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const checkTasks = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/debug/assign-project")
      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError("Failed to check tasks")
    } finally {
      setLoading(false)
    }
  }

  const fixTasks = async (projectId: string) => {
    if (!confirm(`Are you sure you want to assign all broken tasks to this project?`)) {
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/debug/assign-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      })
      const data = await response.json()
      setResult(data)
      alert(data.message || "Tasks fixed!")
      // Refresh the list
      await checkTasks()
    } catch (err) {
      setError("Failed to fix tasks")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-3xl font-bold">Fix Tasks Without Project</h1>

      <Card className="mb-6 p-6">
        <p className="mb-4 text-gray-600">
          This tool will find all tasks that don't have a <code>project_id</code> assigned and let you assign them to a
          project.
        </p>
        <Button onClick={checkTasks} disabled={loading}>
          {loading ? "Checking..." : "Check for Broken Tasks"}
        </Button>
      </Card>

      {error && (
        <Card className="mb-6 border-red-500 bg-red-50 p-4">
          <p className="text-red-600">{error}</p>
        </Card>
      )}

      {result && (
        <div className="space-y-6">
          {result.data && (
            <>
              <Card className="p-6">
                <h2 className="mb-4 text-xl font-semibold">
                  Tasks Without Project: {result.data.tasksWithoutProject?.length || 0}
                </h2>
                {result.data.tasksWithoutProject && result.data.tasksWithoutProject.length > 0 ? (
                  <div className="space-y-2">
                    {result.data.tasksWithoutProject.map((task: any) => (
                      <div key={task.id} className="rounded border p-3">
                        <div className="font-medium">{task.title}</div>
                        <div className="text-sm text-gray-500">ID: {task.id}</div>
                        <div className="text-sm text-gray-500">Company ID: {task.companyId}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-green-600">✅ No broken tasks found!</p>
                )}
              </Card>

              <Card className="p-6">
                <h2 className="mb-4 text-xl font-semibold">Available Projects: {result.data.projects?.length || 0}</h2>
                {result.data.projects && result.data.projects.length > 0 ? (
                  <div className="space-y-2">
                    {result.data.projects.map((project: any) => (
                      <div key={project.id} className="flex items-center justify-between rounded border p-3">
                        <div>
                          <div className="font-medium">{project.name}</div>
                          <div className="text-sm text-gray-500">ID: {project.id}</div>
                          <div className="text-sm text-gray-500">Company ID: {project.companyId}</div>
                        </div>
                        {result.data.tasksWithoutProject && result.data.tasksWithoutProject.length > 0 && (
                          <Button onClick={() => fixTasks(project.id)} size="sm" disabled={loading}>
                            Assign Tasks Here
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-yellow-600">⚠️ No projects found. Create a project first.</p>
                )}
              </Card>
            </>
          )}

          {result.message && !result.data && (
            <Card className="border-green-500 bg-green-50 p-4">
              <p className="text-green-600">{result.message}</p>
              {result.modifiedCount !== undefined && (
                <p className="mt-2 text-sm">Modified {result.modifiedCount} tasks</p>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
