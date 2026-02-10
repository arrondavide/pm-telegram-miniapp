// AI Client
export { getAIClient, generateCompletion, generateJSON } from "./client"

// Services
export {
  parseTaskFromText,
  parseMultipleTasks,
  type TaskParserContext,
} from "./task-parser.service"

export {
  generateProjectStructure,
  flattenStructureToTasks,
  type ProjectGeneratorContext,
} from "./project-generator.service"

export {
  generateDailyDigest,
  formatDigestAsText,
  formatDigestAsHTML,
} from "./digest-generator.service"

// Types from prompts
export type { ParsedTask } from "./prompts/task-parser"
export type { GeneratedProject, TaskStructure } from "./prompts/project-generator"
export type { DailyDigest, DigestInput } from "./prompts/daily-digest"
