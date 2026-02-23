/**
 * Migration script: Add subscription_tier to all existing companies
 *
 * Run with: npx tsx scripts/migrate-subscriptions.ts
 *
 * This sets all existing companies to the free tier for all pillars.
 */

import mongoose from "mongoose"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  console.error("MONGODB_URI not found in .env.local")
  process.exit(1)
}

async function migrate() {
  console.log("Connecting to MongoDB...")
  await mongoose.connect(MONGODB_URI!)

  const db = mongoose.connection.db
  if (!db) {
    console.error("Failed to get database connection")
    process.exit(1)
  }

  const companiesCollection = db.collection("companies")

  // Find companies that don't have subscription_tier set
  const companiesWithoutTier = await companiesCollection.countDocuments({
    subscription_tier: { $exists: false },
  })

  console.log(`Found ${companiesWithoutTier} companies without subscription_tier`)

  if (companiesWithoutTier === 0) {
    console.log("Nothing to migrate!")
    await mongoose.disconnect()
    return
  }

  // Update all companies without subscription_tier
  const result = await companiesCollection.updateMany(
    { subscription_tier: { $exists: false } },
    {
      $set: {
        subscription_tier: {
          core: "free",
          "pm-connect": "free",
          "developer-api": "free",
        },
      },
    }
  )

  console.log(`Updated ${result.modifiedCount} companies with default free tier`)

  // Verify
  const total = await companiesCollection.countDocuments({})
  const withTier = await companiesCollection.countDocuments({
    subscription_tier: { $exists: true },
  })

  console.log(`Verification: ${withTier}/${total} companies have subscription_tier`)

  await mongoose.disconnect()
  console.log("Migration complete!")
}

migrate().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
