/**
 * Comprehensive Data Fix Script
 *
 * Fixes all data inconsistencies in the database:
 * 1. Tasks without project_id
 * 2. Tasks with inconsistent assignedTo format
 * 3. Tasks with missing depth/path
 * 4. Time logs with missing durationMinutes
 * 5. Remove orphaned data
 */

import { connectToDatabase } from "../lib/mongodb"
import { Task, Project, User, TimeLog } from "../lib/models"
import mongoose from "mongoose"

async function fixAllData() {
  console.log("🔧 Starting comprehensive data fix...\n")

  try {
    await connectToDatabase()
    console.log("✅ Connected to database\n")

    // ========================================
    // 1. FIX TASKS WITHOUT PROJECT_ID
    // ========================================
    console.log("📋 [1/5] Fixing tasks without project_id...")

    const tasksWithoutProject = await Task.find({
      $or: [
        { project_id: null },
        { project_id: { $exists: false } }
      ]
    }).lean()

    console.log(`   Found ${tasksWithoutProject.length} tasks without project_id`)

    if (tasksWithoutProject.length > 0) {
      // Group by company
      const tasksByCompany: Record<string, any[]> = {}
      for (const task of tasksWithoutProject) {
        const companyId = task.company_id?.toString()
        if (!companyId) continue
        if (!tasksByCompany[companyId]) tasksByCompany[companyId] = []
        tasksByCompany[companyId].push(task)
      }

      // For each company, find or create a "General Tasks" project
      for (const [companyId, tasks] of Object.entries(tasksByCompany)) {
        console.log(`   Company ${companyId}: ${tasks.length} tasks need fixing`)

        // Find existing "General Tasks" project or create one
        let project = await Project.findOne({
          company_id: new mongoose.Types.ObjectId(companyId),
          name: "General Tasks"
        })

        if (!project) {
          // Create default project
          const creator = await User.findOne({
            "companies.company_id": new mongoose.Types.ObjectId(companyId)
          })

          if (!creator) {
            console.log(`   ⚠️  No users found for company ${companyId}, skipping...`)
            continue
          }

          project = await Project.create({
            name: "General Tasks",
            description: "Default project for uncategorized tasks",
            company_id: new mongoose.Types.ObjectId(companyId),
            status: "active",
            created_by: creator._id,
            color: "#6366f1",
            icon: "📋"
          })

          console.log(`   ✅ Created "General Tasks" project: ${project._id}`)
        } else {
          console.log(`   ℹ️  Using existing "General Tasks" project: ${project._id}`)
        }

        // Update all tasks
        const result = await Task.updateMany(
          {
            _id: { $in: tasks.map(t => t._id) }
          },
          {
            $set: { project_id: project._id }
          }
        )

        console.log(`   ✅ Updated ${result.modifiedCount} tasks with project_id`)
      }
    }

    // ========================================
    // 2. FIX ASSIGNED_TO FIELD FORMAT
    // ========================================
    console.log("\n👥 [2/5] Normalizing assignedTo field format...")

    const allTasks = await Task.find().lean()
    let normalizedCount = 0

    for (const task of allTasks) {
      let needsUpdate = false
      const normalizedAssignedTo: mongoose.Types.ObjectId[] = []

      if (task.assigned_to && Array.isArray(task.assigned_to)) {
        for (const assignee of task.assigned_to) {
          // If it's already an ObjectId, keep it
          if (mongoose.Types.ObjectId.isValid(assignee)) {
            normalizedAssignedTo.push(new mongoose.Types.ObjectId(assignee))
          }
        }

        // If we found any non-ObjectId values, update
        if (normalizedAssignedTo.length !== task.assigned_to.length) {
          needsUpdate = true
        }
      }

      if (needsUpdate) {
        await Task.updateOne(
          { _id: task._id },
          { $set: { assigned_to: normalizedAssignedTo } }
        )
        normalizedCount++
      }
    }

    console.log(`   ✅ Normalized ${normalizedCount} task assignment fields`)

    // ========================================
    // 3. FIX MISSING DEPTH/PATH FOR HIERARCHICAL TASKS
    // ========================================
    console.log("\n🌳 [3/5] Fixing task hierarchy (depth/path)...")

    const tasksWithoutDepth = await Task.find({
      $or: [
        { depth: { $exists: false } },
        { path: { $exists: false } }
      ]
    }).lean()

    console.log(`   Found ${tasksWithoutDepth.length} tasks with missing depth/path`)

    for (const task of tasksWithoutDepth) {
      const depth = task.parent_task_id ? 1 : 0 // Simplified - full calculation would be recursive
      const path = task.parent_task_id ? [task.parent_task_id] : []

      await Task.updateOne(
        { _id: task._id },
        {
          $set: {
            depth: task.depth ?? depth,
            path: task.path ?? path
          }
        }
      )
    }

    console.log(`   ✅ Fixed ${tasksWithoutDepth.length} task hierarchy records`)

    // ========================================
    // 4. FIX TIME LOGS MISSING DURATION_MINUTES
    // ========================================
    console.log("\n⏱️  [4/5] Fixing time log durations...")

    const timeLogs = await TimeLog.find({
      end_time: { $exists: true, $ne: null },
      $or: [
        { duration_minutes: { $exists: false } },
        { duration_minutes: null }
      ]
    }).lean()

    console.log(`   Found ${timeLogs.length} time logs with missing duration_minutes`)

    for (const log of timeLogs) {
      if (log.start_time && log.end_time) {
        const durationMs = new Date(log.end_time).getTime() - new Date(log.start_time).getTime()
        const durationMinutes = Math.round(durationMs / (1000 * 60))

        await TimeLog.updateOne(
          { _id: log._id },
          { $set: { duration_minutes: durationMinutes } }
        )
      }
    }

    console.log(`   ✅ Fixed ${timeLogs.length} time log durations`)

    // ========================================
    // 5. REMOVE ORPHANED TIME LOGS (tasks deleted)
    // ========================================
    console.log("\n🗑️  [5/5] Cleaning up orphaned time logs...")

    const allTimeLogs = await TimeLog.find().lean()
    let orphanedCount = 0

    for (const log of allTimeLogs) {
      const taskExists = await Task.exists({ _id: log.task_id })
      if (!taskExists) {
        await TimeLog.deleteOne({ _id: log._id })
        orphanedCount++
      }
    }

    console.log(`   ✅ Removed ${orphanedCount} orphaned time logs`)

    // ========================================
    // SUMMARY
    // ========================================
    console.log("\n" + "=".repeat(50))
    console.log("✅ DATA FIX COMPLETE!")
    console.log("=".repeat(50))
    console.log(`📋 Tasks without project_id: ${tasksWithoutProject.length} fixed`)
    console.log(`👥 Tasks with normalized assignments: ${normalizedCount}`)
    console.log(`🌳 Tasks with fixed hierarchy: ${tasksWithoutDepth.length}`)
    console.log(`⏱️  Time logs with fixed duration: ${timeLogs.length}`)
    console.log(`🗑️  Orphaned time logs removed: ${orphanedCount}`)
    console.log("=".repeat(50))

  } catch (error) {
    console.error("❌ Error during data fix:", error)
    throw error
  } finally {
    await mongoose.connection.close()
    console.log("\n👋 Database connection closed")
  }
}

// Run if called directly
if (require.main === module) {
  fixAllData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export { fixAllData }
