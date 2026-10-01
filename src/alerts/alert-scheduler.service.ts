import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { AlertsService } from './alerts.service';

/**
 * Runs the expiration / low-stock scan on a timer so alerts appear without staff
 * having to open a screen.
 *
 * A plain interval is used rather than a cron dependency: the job is a single
 * idempotent reconciliation pass, and a timer is easy to reason about. The
 * first pass is delayed slightly so it does not compete with application
 * startup, and the timer is unref'd so it never keeps the process alive on its
 * own.
 */
@Injectable()
export class AlertScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AlertScheduler.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly alertsService: AlertsService) {}

  onApplicationBootstrap() {
    const minutes = this.alertsService.intervalMinutes;

    this.timer = setInterval(() => {
      void this.runOnce();
    }, minutes * 60_000);

    this.timer.unref();

    // Give the HTTP server a moment to come up before the first database pass.
    setTimeout(() => void this.runOnce(), 5_000).unref();

    this.logger.log(
      `Expiration and low-stock alerts will be re-checked every ${minutes} minute(s).`,
    );
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async runOnce() {
    try {
      const summary = await this.alertsService.scan();
      this.logger.log(
        `Alert scan complete: ${summary.open} open (${summary.critical} critical, ${summary.expiring} expiring, ${summary.lowStock} low stock).`,
      );
    } catch (error) {
      // A failed scan must never take the API down with it.
      this.logger.error(
        `Alert scan failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
