import { Controller, Get } from '@nestjs/common';

import { webAppUrl } from './config/env';

@Controller()
export class AppController {
  @Get()
  getPlatform() {
    const baseUrl = webAppUrl();
    return {
      name: 'Ad Network',
      status: 'online',
      dashboard: `${baseUrl}/analytics`,
      publisherPortal: `${baseUrl}/publisher`,
      advertiserStudio: `${baseUrl}/advertiser`,
    };
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
