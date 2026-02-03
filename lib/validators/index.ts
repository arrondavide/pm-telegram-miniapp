/**
 * Validation schemas - centralized exports
 */

export * from "./project.schema"
export * from "./task.schema"

/**
 * Validation helper for API routes
 */
import { ZodError, ZodSchema } from "zod"
import { NextResponse } from "next/server"

export interface ValidationResult<T> {
  success: boolean
  data?: T
  error?: NextResponse
}

/**
 * Validate request body against a Zod schema
 */
export async function validateBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  try {
    const body = await request.json()
    const data = schema.parse(body)
    return { success: true, data }
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }))
      return {
        success: false,
        error: NextResponse.json(
          { error: "Validation failed", details: errors },
          { status: 400 }
        ),
      }
    }
    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        ),
      }
    }
    throw error
  }
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQuery<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>
): ValidationResult<T> {
  try {
    const params = Object.fromEntries(searchParams.entries())
    const data = schema.parse(params)
    return { success: true, data }
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }))
      return {
        success: false,
        error: NextResponse.json(
          { error: "Invalid query parameters", details: errors },
          { status: 400 }
        ),
      }
    }
    throw error
  }
}
