import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env.test if present; fall back to .env
const envTestPath = path.resolve(process.cwd(), '.env.test');
if (fs.existsSync(envTestPath)) {
  config({ path: envTestPath });
} else {
  // Fall back to loading default .env
  config();
}
