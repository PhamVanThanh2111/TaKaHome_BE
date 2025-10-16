import { registerAs } from '@nestjs/config';

export default registerAs('frontend', () => ({
  url: process.env.FRONTEND_URL || 'http://localhost:3001',
}));
