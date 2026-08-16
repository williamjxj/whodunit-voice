// Vercel serverless entry: reuse the app's existing Node HTTP handler.
// vercel.json rewrites every path to this function, so static files, the
// API, TTS, and the R2 image proxy all keep working exactly like `node server.js`.
import { handler } from '../server.js';

export default handler;
