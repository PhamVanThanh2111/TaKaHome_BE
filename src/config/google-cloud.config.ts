import { registerAs } from '@nestjs/config';

export default registerAs('googleCloud', () => ({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFile: process.env.GOOGLE_CLOUD_KEY_FILE,
  documentAI: {
    processorId: process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID,
    location: process.env.GOOGLE_DOCUMENT_AI_LOCATION || 'us',
  },
}));