/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as crypto from 'crypto';

if (typeof (globalThis as any).crypto === 'undefined') {
  (globalThis as any).crypto = crypto;
}
