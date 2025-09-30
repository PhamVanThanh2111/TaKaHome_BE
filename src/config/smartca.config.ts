export const smartcaConfig = {
  baseUrl: process.env.SMARTCA_BASE_URL || "https://gwsca.vnpt.vn/sca/sp769/v1",
  uatBaseUrl: process.env.SMARTCA_UAT_BASE_URL || "https://rmgateway.vnptit.vn/sca/sp769/v1",
  defaultSpId: process.env.SMARTCA_SP_ID,
  defaultSpPassword: process.env.SMARTCA_SP_PASSWORD,
  timeout: parseInt(process.env.SMARTCA_TIMEOUT || '30000'),
  maxPollAttempts: parseInt(process.env.SMARTCA_MAX_POLL_ATTEMPTS || '24'),
  pollIntervalMs: parseInt(process.env.SMARTCA_POLL_INTERVAL_MS || '10000'),
  environment: process.env.SMARTCA_ENVIRONMENT || 'production', // 'production' or 'uat'
};

export default () => ({
  smartca: smartcaConfig,
});
