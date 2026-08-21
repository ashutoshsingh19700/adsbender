import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import type { AuthenticatedRequest } from '../common/authenticated-request';
import { AdvertiserService } from './advertiser.service';
import {
  ALLOWED_CREATIVE_MIME_TYPES,
  CreativeUploadService,
  MAX_CREATIVE_UPLOAD_BYTES,
} from './creative-upload.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';

@Controller('api/v1/advertiser')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADVERTISER')
export class AdvertiserController {
  constructor(
    private readonly advertiserService: AdvertiserService,
    private readonly creativeUploadService: CreativeUploadService,
  ) {}

  // Lets an advertiser upload the creative file directly instead of having
  // to host it elsewhere first and paste a URL into CreateCampaignDto -
  // returns a public URL suitable for that `creativeUrl` field.
  @Post('creatives/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_CREATIVE_UPLOAD_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_CREATIVE_MIME_TYPES.includes(file.mimetype)) {
          callback(
            new BadRequestException(
              `Unsupported file type "${file.mimetype}". Allowed: ${ALLOWED_CREATIVE_MIME_TYPES.join(', ')}`,
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadCreative(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.creativeUploadService.uploadCreative(req.user.id, file);
  }

  @Get('me')
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.advertiserService.getProfile(req.user.id);
  }

  @Post('campaigns')
  createCampaign(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.advertiserService.createCampaign(req.user.id, dto);
  }

  @Get('campaigns')
  listCampaigns(
    @Req() req: AuthenticatedRequest,
    @Query() query: { page?: string; pageSize?: string; status?: string },
  ) {
    return this.advertiserService.listCampaigns(req.user.id, query);
  }

  @Get('campaigns/:id')
  getCampaign(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.advertiserService.getCampaign(req.user.id, id);
  }

  @Patch('campaigns/:id')
  updateCampaign(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.advertiserService.updateCampaign(req.user.id, id, dto);
  }

  @Post('campaigns/:id/pause')
  pauseCampaign(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.advertiserService.pauseCampaign(req.user.id, id);
  }

  @Post('campaigns/:id/resume')
  resumeCampaign(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.advertiserService.resumeCampaign(req.user.id, id);
  }

  @Post('campaigns/:id/archive')
  archiveCampaign(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.advertiserService.archiveCampaign(req.user.id, id);
  }

  @Delete('campaigns/:id')
  deleteCampaign(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.advertiserService.deleteCampaign(req.user.id, id);
  }

  @Get('campaigns/:id/creatives')
  listCreatives(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.advertiserService.listCreatives(req.user.id, id);
  }

  @Get('campaigns/:id/performance')
  getCampaignPerformance(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.advertiserService.getCampaignPerformance(
      req.user.id,
      id,
      startDate,
      endDate,
    );
  }

  @Get('campaigns/:id/spend')
  getCampaignSpend(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.advertiserService.getCampaignSpend(req.user.id, id);
  }

  @Get('campaigns/:id/budget-status')
  getCampaignBudgetStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.advertiserService.getCampaignBudgetStatus(req.user.id, id);
  }
}
