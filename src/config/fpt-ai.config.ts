import { registerAs } from '@nestjs/config';

export default registerAs('fptAi', () => ({
  apiKey: process.env.FPT_AI_API_KEY,
  endpoint: process.env.FPT_AI_ENDPOINT || 'https://api.fpt.ai/vision/idr/vnm',
}));