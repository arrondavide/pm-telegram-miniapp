import mongoose from "mongoose"
import { connectToDatabase } from "../lib/mongodb"
import { Company, Project, Task, User } from "../lib/models"

/**
 * Migration Script: Transform flat task system to hierarchical project-based system
 *
 * This script:
 * 1. Creates a default "General Tasks" project for each company
 * 2. Migrates all existing tasks to the default project
 * 3. Converts embedded subtasks to full Task documents with hierarchy
 * 4. Sets depth and path fields correctly
 * 5. Removes old subtasks array
 */

async function migrateToProjects() {
  try {
    console.log("🚀 Starting migration to hierarchical project system...")

    await connectToDatabase()
    console.log("✅ Connected to database")

    // Get all companies
    const companies = await Company.find({}).lean()
    console.log(`📊 Found ${companies.length} companies to migrate`)

    for (const company of companies) {
      console.log(`\n🏢 Processing company: ${company.name} (${company._id})`)

      // Step 1: Create default project for this company
      let defaultProject = await Project.findOne({
        company_id: company._id,
        name: "General Tasks",
      })

      if (!defaultProject) {
        defaultProject = await Project.create({
          name: "General Tasks",
          description: "Default project for migrated tasks",
          company_id: company._id,
          status: "active",
          created_by: company.created_by,
          color: "#3b82f6",
          icon: "📋",
        })
        console.log(`  ✅ Created default project: ${defaultProject._id}`)
      } else {
        console.log(`  ℹ️  Default project already exists: ${defaultProject._id}`)
      }

      // Step 2: Get all tasks for this company that haven't been migrated yet
      const tasks = await Task.find({
        company_id: company._id,
        project_id: { $exists: false }, // Only tasks not yet migrated
      }).lean()

      console.log(`  📋 Found ${tasks.length} tasks to migrate`)

      let migratedCount = 0
      let subtaskCount = 0

      for (const task of tasks as any[]) {
        // Step 3: Update the task to add project_id and hierarchy fields
        const taskUpdate: any = {
          project_id: defaultProject._id,
          depth: 0,
          path: [],
        }

        // Remove parent_task_id if it exists from old data
        if (!task.parent_task_id) {
          taskUpdate.parent_task_id = null
        }

        await Task.updateOne(
          { _id: task._id },
          {
            $set: taskUpdate,
            $unset: { subtasks: "" }, // Remove old subtasks array
          }
        )

        migratedCount++

        // Step 4: Convert embedded subtasks to full Task documents
        if (task.subtasks && Array.isArray(task.subtasks) && task.subtasks.length > 0) {
          console.log(`    🔄 Converting ${task.subtasks.length} subtasks for task: ${task.title}`)

          for (const subtask of task.subtasks) {
            try {
              // Create a new Task document for each subtask
              const newSubtask = await Task.create({
                title: subtask.title,
                description: "",
                due_date: task.due_date, // Inherit from parent
                status: subtask.completed ? "completed" : "pending",
                priority: task.priority, // Inherit from parent
                assigned_to: task.assigned_to, // Inherit from parent
                created_by: task.created_by,
                company_id: company._id,
                project_id: defaultProject._id,
                parent_task_id: task._id, // Link to parent task
                depth: 1, // First level of nesting
                path: [task._id], // Path includes parent
                category: task.category,
                tags: task.tags,
                department: task.department,
                depends_on: [],
                is_recurring: false,
                estimated_hours: 0,
                actual_hours: 0,
                attachments: [],
                completed_at: subtask.completed_at || (subtask.completed ? new Date() : undefined),
              })

              subtaskCount++
              console.log(`      ✅ Created subtask: ${newSubtask.title} (${newSubtask._id})`)
            } catch (error) {
              console.error(`      ❌ Error creating subtask:`, error)
            }
          }
        }

        // Progress indicator
        if (migratedCount % 10 === 0) {
          console.log(`    Progress: ${migratedCount}/${tasks.length} tasks migrated`)
        }
      }

      console.log(`  ✅ Migrated ${migratedCount} tasks and ${subtaskCount} subtasks for company: ${company.name}`)
    }

    console.log("\n✅ Migration completed successfully!")
    console.log("\n📊 Summary:")
    console.log(`  - Companies processed: ${companies.length}`)
    console.log(`  - Default projects created: ${companies.length}`)

    // Get final counts
    const totalProjects = await Project.countDocuments()
    const totalTasks = await Task.countDocuments()
    const tasksWithProjects = await Task.countDocuments({ project_id: { $exists: true } })

    console.log(`  - Total projects: ${totalProjects}`)
    console.log(`  - Total tasks: ${totalTasks}`)
    console.log(`  - Tasks with projects: ${tasksWithProjects}`)

  } catch (error) {
    console.error("❌ Migration failed:", error)
    throw error
  } finally {
    await mongoose.connection.close()
    console.log("\n👋 Database connection closed")
  }
}

// Run the migration
if (require.main === module) {
  migrateToProjects()
    .then(() => {
      console.log("\n🎉 Migration script finished")
      process.exit(0)
    })
    .catch((error) => {
      console.error("\n💥 Migration script failed:", error)
      process.exit(1)
    })
}

export default migrateToProjects
