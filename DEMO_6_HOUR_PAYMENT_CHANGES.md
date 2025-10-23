# 🚀 Demo: Thay đổi chu kỳ thanh toán từ HÀNG THÁNG thành MỖI 5 TIẾNG

## 📋 Tổng quan

Để demo hệ thống với chu kỳ thanh toán 5 tiếng × 12 lần = 60 tiếng (2.5 ngày), cần thay đổi các logic liên quan đến:

1. **Tính toán period thanh toán**
2. **Cron jobs và scheduling**
3. **Invoice generation**
4. **Payment reminders**
5. **Overdue detection**
6. **Blockchain payment schedule**

---

## 🔧 1. PAYMENT SERVICE - Tính toán Period

### File: `src/modules/payment/payment.service.ts`

#### Thay đổi method `calculatePaymentPeriod` (line ~1010):

```typescript
/**
 * Calculate payment period based on contract start date
 * DEMO MODE: Period every 5 hours instead of monthly
 * Period 1 = First payment (handled separately)
 * Period 2, 3, 4... = 5-hour payments
 */
private calculatePaymentPeriod(
  contract: { startDate: Date },
  paymentDate: Date,
): string {
  const startDate = contract.startDate;

  // DEMO: Calculate 5-hour periods instead of months
  const timeDiffMs = paymentDate.getTime() - startDate.getTime();
  const hoursDiff = Math.floor(timeDiffMs / (1000 * 60 * 60)); // Convert to hours
  const periodsSinceStart = Math.floor(hoursDiff / 5); // 5-hour periods

  // Period starts from 2 since first payment is period 1
  const period = Math.max(2, periodsSinceStart + 2);
  return period.toString();
}
```

---

## 🔧 2. DEMO CONFIG - Thêm configuration

### File: `src/config/demo.config.ts` (tạo mới)

```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('demo', () => ({
  // Demo mode settings
  isDemoMode: process.env.DEMO_MODE === 'true',

  // Payment cycle settings (in hours)
  paymentCycleHours: parseInt(process.env.DEMO_PAYMENT_CYCLE_HOURS || '5', 10),
  totalDemoPeriods: parseInt(process.env.DEMO_TOTAL_PERIODS || '12', 10),

  // Cron timing adjustments
  reminderIntervalMinutes: parseInt(
    process.env.DEMO_REMINDER_INTERVAL_MINUTES || '30',
    10,
  ),
  overdueCheckIntervalMinutes: parseInt(
    process.env.DEMO_OVERDUE_CHECK_INTERVAL_MINUTES || '15',
    10,
  ),

  // Demo helper settings
  demoSpeedMultiplier: parseInt(process.env.DEMO_SPEED_MULTIPLIER || '1', 10),
}));
```

### Environment variables (.env):

```env
# Demo Mode Settings
DEMO_MODE=true
DEMO_PAYMENT_CYCLE_HOURS=5
DEMO_TOTAL_PERIODS=12
DEMO_REMINDER_INTERVAL_MINUTES=30
DEMO_OVERDUE_CHECK_INTERVAL_MINUTES=15
DEMO_SPEED_MULTIPLIER=1
```

---

## 🔧 3. CRON JOBS - Payment Reminder

### File: `src/cron/payment-reminder.cron.ts`

#### Thay đổi scheduling (line ~40):

```typescript
/**
 * DEMO MODE: Chạy mỗi 30 phút thay vì mỗi giờ
 * PRODUCTION: Chạy mỗi giờ để gửi payment reminders
 * Sends payment reminders before due date
 */
@Cron(process.env.DEMO_MODE === 'true' ? '*/30 * * * *' : CronExpression.EVERY_HOUR)
async sendPaymentRemindersFirstMonth(): Promise<void> {
  // Existing logic...
}
```

#### Thay đổi reminder timing (line ~73):

```typescript
// DEMO MODE: Send reminders at 3 hours, 1 hour, 30 minutes before due
// PRODUCTION: Send reminders at 7, 3, 1 days before due
const reminderIntervals =
  process.env.DEMO_MODE === 'true'
    ? [3 * 60, 1 * 60, 30] // minutes before due (3 hours, 1 hour, 30 minutes)
    : [7 * 24 * 60, 3 * 24 * 60, 1 * 24 * 60]; // minutes before due (7, 3, 1 days)

const minutesToDue = Math.ceil(
  (booking.firstRentDueAt.getTime() - now.getTime()) / (1000 * 60),
);

if (reminderIntervals.includes(minutesToDue)) {
  await this.sendPaymentReminderFirstMonth(booking, minutesToDue);
}
```

#### Thêm helper method:

```typescript
/**
 * Convert demo minutes to human readable format
 */
private formatDemoReminderTime(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours} giờ`;
  }
  return `${minutes} phút`;
}

/**
 * Gửi payment reminder với timing phù hợp cho demo
 */
private async sendPaymentReminderFirstMonth(
  booking: Booking,
  timeToRemind: number, // minutes in demo mode, days in production
): Promise<void> {
  try {
    const isDemoMode = process.env.DEMO_MODE === 'true';
    const timeUnit = isDemoMode ? 'phút' : 'ngày';
    const timeValue = isDemoMode ? this.formatDemoReminderTime(timeToRemind) : `${timeToRemind} ngày`;

    const messages = {
      [reminderIntervals[0]]: {
        title: `Nhắc nhở thanh toán (${timeValue})`,
        content: `Bạn cần thanh toán tiền thuê cho căn hộ ${booking.property.title} trong vòng ${timeValue} tới.`,
      },
      [reminderIntervals[1]]: {
        title: `Nhắc nhở thanh toán khẩn cấp (${timeValue})`,
        content: `Chỉ còn ${timeValue} để thanh toán tiền thuê cho căn hộ ${booking.property.title}. Hãy thanh toán ngay!`,
      },
      [reminderIntervals[2]]: {
        title: `Cảnh báo cuối cùng (${timeValue})`,
        content: `Còn ${timeValue} nữa là hết hạn thanh toán cho căn hộ ${booking.property.title}. Thanh toán ngay để tránh phạt!`,
      },
    };

    const message = messages[timeToRemind];
    if (!message) return;

    await this.notificationService.create({
      userId: booking.tenant.id,
      type: NotificationTypeEnum.PAYMENT,
      title: message.title,
      content: message.content,
    });

    this.logger.log(
      `📨 Sent ${timeValue} payment reminder for booking ${booking.id}`,
    );
  } catch (error) {
    this.logger.error(
      `❌ Failed to send payment reminder for booking ${booking.id}:`,
      error,
    );
  }
}
```

---

## 🔧 4. INVOICE CRON SERVICE

### File: `src/modules/invoice/invoice-cron.service.ts`

#### Thay đổi cron timing (line ~25):

```typescript
/**
 * DEMO MODE: Generate invoices every 30 seconds
 * PRODUCTION: Generate invoices every 30 seconds
 */
@Cron(process.env.DEMO_MODE === 'true' ? '*/10 * * * * *' : '*/30 * * * * *', {
  name: 'generate-monthly-invoices-morning',
})
async handleGenerateMonthlyInvoicesMorning(): Promise<void> {
  // Existing logic...
}
```

#### Thay đổi billing period calculation (line ~110):

```typescript
// DEMO MODE: Use hour-based billing periods
// PRODUCTION: Use month-based billing periods
const isDemoMode = process.env.DEMO_MODE === 'true';
let billingPeriod: string;

if (isDemoMode) {
  // Demo: Use hour-based periods like "2025-01-20-14" (year-month-day-hour)
  billingPeriod = formatVN(dueDate, 'yyyy-MM-dd-HH');
} else {
  // Production: Use month-based periods like "2025-01"
  billingPeriod = formatVN(dueDate, 'yyyy-MM');
}
```

#### Thay đổi early notification logic (line ~105):

```typescript
// DEMO MODE: Create invoice for payments due in 2 hours or less
// PRODUCTION: Create invoice for payments due in 7 days or less
const isDemoMode = process.env.DEMO_MODE === 'true';
const notificationThreshold = isDemoMode ? 2 : 7 * 24; // hours

const hoursDiff = Math.ceil(
  (dueDate.getTime() - todayUtc.getTime()) / (1000 * 60 * 60),
);

if (hoursDiff <= notificationThreshold) {
  // Create invoice logic...
}
```

---

## 🔧 5. AUTOMATED PENALTY CRON

### File: `src/cron/automated-penalty.cron.ts`

#### Thay đổi cron timing:

```typescript
/**
 * DEMO MODE: Chạy mỗi 10 phút để kiểm tra overdue payments
 * PRODUCTION: Chạy hàng ngày lúc 9h sáng
 */
@Cron(process.env.DEMO_MODE === 'true' ? '*/10 * * * *' : '0 9 * * *', {
  name: 'process-overdue-payments',
  timeZone: 'Asia/Ho_Chi_Minh',
})
async processOverduePayments(): Promise<void> {
  // Existing logic...
}
```

#### Thay đổi overdue detection:

```typescript
/**
 * Check if payment is overdue based on demo mode
 */
private isPaymentOverdue(dueDate: Date): { isOverdue: boolean; timeUnit: number } {
  const now = vnNow();
  const isDemoMode = process.env.DEMO_MODE === 'true';

  if (isDemoMode) {
    // Demo: Consider overdue after 30 minutes
    const minutesPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60));
    return {
      isOverdue: minutesPastDue > 30,
      timeUnit: minutesPastDue
    };
  } else {
    // Production: Consider overdue after 1 day
    const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    return {
      isOverdue: daysPastDue > 0,
      timeUnit: daysPastDue
    };
  }
}
```

---

## 🔧 6. BLOCKCHAIN SERVICE

### File: `src/modules/blockchain/blockchain.service.ts`

#### Thêm method tạo demo payment schedule:

```typescript
/**
 * Generate demo payment schedule with 5-hour intervals
 */
async createDemoPaymentSchedule(
  contractId: string,
  startDate: Date,
  rentAmount: number,
  user: FabricUser
): Promise<BlockchainResponse<any[]>> {
  return this.executeBlockchainOperation(
    async () => {
      const results: any[] = [];
      const isDemoMode = process.env.DEMO_MODE === 'true';
      const cycleHours = parseInt(process.env.DEMO_PAYMENT_CYCLE_HOURS || '5', 10);
      const totalPeriods = parseInt(process.env.DEMO_TOTAL_PERIODS || '12', 10);

      if (!isDemoMode) {
        // Use normal monthly schedule
        return this.createMonthlyPaymentSchedule(contractId, user);
      }

      // Create demo schedule with 5-hour intervals
      for (let period = 2; period <= totalPeriods + 1; period++) {
        const hoursOffset = (period - 2) * cycleHours;
        const dueDate = new Date(startDate.getTime() + hoursOffset * 60 * 60 * 1000);

        const result = await this.contract.submitTransaction(
          'CreatePaymentSchedule',
          contractId,
          period.toString(),
          rentAmount.toString(),
          `DEMO_ORDER_${contractId}_${period}` // Generate orderRef
        );
        results.push(JSON.parse(result.toString()));
      }

      return results;
    },
    'createDemoPaymentSchedule',
    user.orgName,
    user.userId
  );
}
```

---

## 🔧 7. CONTRACT SERVICE

### File: `src/modules/contract/contract.service.ts`

#### Thay đổi payment schedule creation:

```typescript
/**
 * Create payment schedule on blockchain (supports demo mode)
 */
private async createPaymentScheduleOnBlockchain(contract: Contract): Promise<void> {
  try {
    const fabricUser = {
      userId: 'system',
      orgName: 'OrgProp',
      mspId: 'OrgPropMSP',
    };

    const isDemoMode = process.env.DEMO_MODE === 'true';

    let scheduleResponse;
    if (isDemoMode) {
      // Use demo schedule with 5-hour intervals
      scheduleResponse = await this.blockchainService.createDemoPaymentSchedule(
        contract.contractCode!,
        contract.startDate,
        contract.monthlyRent,
        fabricUser,
      );
    } else {
      // Use normal monthly schedule
      scheduleResponse = await this.blockchainService.createMonthlyPaymentSchedule(
        contract.contractCode!,
        fabricUser,
      );
    }

    if (scheduleResponse.success) {
      this.logger.log(
        `✅ ${isDemoMode ? 'Demo' : 'Monthly'} payment schedule created for contract ${contract.contractCode}`,
      );
    } else {
      this.logger.error(
        `❌ Failed to create payment schedule for contract ${contract.contractCode}:`,
        scheduleResponse.error,
      );
    }
  } catch (error) {
    this.logger.error('❌ Error creating payment schedule on blockchain:', error);
  }
}
```

---

## 🔧 8. DEMO HELPER SERVICE

### File: `src/common/demo-payment.helper.ts` (tạo mới)

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DemoPaymentHelper {
  constructor(private configService: ConfigService) {}

  /**
   * Check if demo mode is enabled
   */
  isDemoMode(): boolean {
    return this.configService.get<string>('demo.isDemoMode') === 'true';
  }

  /**
   * Get payment cycle in hours
   */
  getPaymentCycleHours(): number {
    return this.configService.get<number>('demo.paymentCycleHours', 6);
  }

  /**
   * Get total demo periods
   */
  getTotalDemoPeriods(): number {
    return this.configService.get<number>('demo.totalDemoPeriods', 12);
  }

  /**
   * Convert time periods for demo vs production
   */
  convertTimeForMode(productionDays: number): number {
    if (!this.isDemoMode()) {
      return productionDays * 24 * 60; // Convert days to minutes
    }

    // Demo mode: scale down significantly
    const hoursEquivalent = (productionDays * this.getPaymentCycleHours()) / 30; // 30 days = 1 cycle
    return Math.max(30, hoursEquivalent * 60); // At least 30 minutes, convert hours to minutes
  }

  /**
   * Get appropriate cron expression for demo vs production
   */
  getCronExpression(
    productionCron: string,
    demoIntervalMinutes: number = 10,
  ): string {
    if (!this.isDemoMode()) {
      return productionCron;
    }

    return `*/${demoIntervalMinutes} * * * *`; // Every N minutes in demo mode
  }

  /**
   * Calculate due date for payment period
   */
  calculateDueDate(startDate: Date, period: number): Date {
    if (!this.isDemoMode()) {
      // Production: monthly periods
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + period - 1);
      return dueDate;
    }

    // Demo: 5-hour periods
    const cycleHours = this.getPaymentCycleHours();
    const hoursOffset = (period - 1) * cycleHours;
    return new Date(startDate.getTime() + hoursOffset * 60 * 60 * 1000);
  }

  /**
   * Format time remaining for notifications
   */
  formatTimeRemaining(targetDate: Date): string {
    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();

    if (!this.isDemoMode()) {
      const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return `${days} ngày`;
    }

    // Demo mode: show hours and minutes
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours} giờ ${minutes} phút`;
    }
    return `${minutes} phút`;
  }
}
```

---

## 🔧 9. DYNAMIC CRON MANAGER

### File: `src/common/dynamic-cron.manager.ts` (tạo mới)

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { DemoPaymentHelper } from './demo-payment.helper';

@Injectable()
export class DynamicCronManager implements OnModuleInit {
  private readonly logger = new Logger(DynamicCronManager.name);

  constructor(
    private schedulerRegistry: SchedulerRegistry,
    private demoHelper: DemoPaymentHelper,
  ) {}

  async onModuleInit() {
    if (this.demoHelper.isDemoMode()) {
      this.logger.log(
        '🎭 Demo mode enabled - adjusting cron jobs for faster execution',
      );
      this.setupDemoCronJobs();
    } else {
      this.logger.log('🏭 Production mode - using standard cron schedules');
    }
  }

  private setupDemoCronJobs() {
    // Override payment reminder job
    this.replaceJob(
      'payment-reminder',
      '*/30 * * * *', // Every 30 minutes
      () => this.handlePaymentReminders(),
    );

    // Override overdue check job
    this.replaceJob(
      'overdue-check',
      '*/15 * * * *', // Every 15 minutes
      () => this.handleOverdueCheck(),
    );

    // Override invoice generation job
    this.replaceJob(
      'invoice-generation',
      '*/10 * * * * *', // Every 10 seconds
      () => this.handleInvoiceGeneration(),
    );
  }

  private replaceJob(name: string, pattern: string, callback: () => void) {
    try {
      // Remove existing job if it exists
      if (this.schedulerRegistry.getCronJob(name)) {
        this.schedulerRegistry.deleteCronJob(name);
      }
    } catch (error) {
      // Job doesn't exist, continue
    }

    // Add new job
    const job = new CronJob(pattern, callback);
    this.schedulerRegistry.addCronJob(name, job);
    job.start();

    this.logger.log(`✅ Replaced cron job '${name}' with pattern '${pattern}'`);
  }

  private async handlePaymentReminders() {
    // Implementation will be injected from PaymentReminderCron
    this.logger.debug('🔔 Demo payment reminder check...');
  }

  private async handleOverdueCheck() {
    // Implementation will be injected from AutomatedPenaltyCron
    this.logger.debug('⏰ Demo overdue payment check...');
  }

  private async handleInvoiceGeneration() {
    // Implementation will be injected from InvoiceCronService
    this.logger.debug('📄 Demo invoice generation check...');
  }
}
```

---

## 🚀 10. IMPLEMENTATION CHECKLIST

### ✅ Files to Create:

- [ ] `src/config/demo.config.ts`
- [ ] `src/common/demo-payment.helper.ts`
- [ ] `src/common/dynamic-cron.manager.ts`

### ✅ Files to Modify:

- [ ] `src/modules/payment/payment.service.ts` - `calculatePaymentPeriod()`
- [ ] `src/cron/payment-reminder.cron.ts` - Cron timing + reminder intervals
- [ ] `src/modules/invoice/invoice-cron.service.ts` - Cron timing + billing period
- [ ] `src/cron/automated-penalty.cron.ts` - Overdue detection timing
- [ ] `src/modules/blockchain/blockchain.service.ts` - Add demo schedule method
- [ ] `src/modules/contract/contract.service.ts` - Payment schedule creation

### ✅ Environment Variables:

```env
DEMO_MODE=true
DEMO_PAYMENT_CYCLE_HOURS=5
DEMO_TOTAL_PERIODS=12
DEMO_REMINDER_INTERVAL_MINUTES=30
DEMO_OVERDUE_CHECK_INTERVAL_MINUTES=15
DEMO_SPEED_MULTIPLIER=1
```

### ✅ Module Dependencies:

- [ ] Add `DemoPaymentHelper` to providers in relevant modules
- [ ] Add `DynamicCronManager` to CronModule
- [ ] Import `demo.config.ts` in app.module.ts

---

## ⚠️ IMPORTANT NOTES

1. **Blockchain Consistency**: Blockchain vẫn sẽ lưu periods as numbers (2, 3, 4...) nhưng timing sẽ được tính theo hours thay vì months.

2. **Database Schema**: Không cần thay đổi database schema, chỉ thay đổi business logic.

3. **Frontend Impact**: Frontend có thể cần cập nhật để hiển thị đúng timing (hours vs days/months).

4. **Testing**: Nên có separate environment variables để dễ dàng switch giữa demo và production mode.

5. **Performance**: Demo mode sẽ tạo nhiều cron jobs chạy thường xuyên hơn, cần monitor resource usage.

6. **Data Cleanup**: Sau demo, có thể cần cleanup demo contracts và payments để tránh confusion.

---

## 🎯 DEMO TIMELINE

Với cài đặt này:

- **5 giờ x 12 kỳ = 60 giờ = 2.5 ngày**
- **Reminders**: 3 giờ, 1 giờ, 30 phút trước hạn
- **Overdue check**: Mỗi 15 phút
- **Invoice generation**: Mỗi 10 giây
- **Payment reminders**: Mỗi 30 phút

Demo sẽ cho thấy full cycle của một contract trong vòng 2.5 ngày thay vì 12 tháng!
