import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { SupabaseService } from '../supabase/supabase.service';

// Advertisers only ever paste a URL into `creativeUrl` (see
// CreateCampaignDto) - this is what lets them upload the file itself
// instead. We reuse the Supabase project that's already configured for auth
// (see SupabaseService) rather than standing up a separate storage
// provider: Storage sits on the same project, same service-role key.
export const CREATIVES_BUCKET = 'campaign-creatives';

export const MAX_CREATIVE_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

// Extension is derived from the (allowlisted) mimetype rather than trusted
// from the client-supplied filename, which could carry anything.
const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export const ALLOWED_CREATIVE_MIME_TYPES = Object.keys(EXTENSION_BY_MIME_TYPE);

@Injectable()
export class CreativeUploadService {
  private readonly logger = new Logger(CreativeUploadService.name);
  private bucketReady = false;

  constructor(private readonly supabaseService: SupabaseService) {}

  async uploadCreative(
    advertiserId: string,
    file: Express.Multer.File | undefined,
  ): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const extension = EXTENSION_BY_MIME_TYPE[file.mimetype];
    if (!extension) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Allowed: ${ALLOWED_CREATIVE_MIME_TYPES.join(', ')}`,
      );
    }

    await this.ensureBucketExists();

    // Namespaced by advertiser so nobody can guess/overwrite another
    // advertiser's creative path; randomUUID avoids collisions and strips
    // any information the original filename might have carried.
    const path = `${advertiserId}/${randomUUID()}.${extension}`;

    const { error: uploadError } = await this.supabaseService.admin.storage
      .from(CREATIVES_BUCKET)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      this.logger.error(`Creative upload failed for ${path}: ${uploadError.message}`);
      throw new InternalServerErrorException('Could not store the uploaded image');
    }

    const { data } = this.supabaseService.admin.storage
      .from(CREATIVES_BUCKET)
      .getPublicUrl(path);

    return { url: data.publicUrl };
  }

  // The publisher tag renders creatives cross-origin on arbitrary
  // third-party sites with no auth (see backend/public/publisher_tag.js),
  // so the bucket must serve files publicly - creating it here means a
  // fresh environment doesn't need a manual Supabase dashboard step.
  private async ensureBucketExists() {
    if (this.bucketReady) {
      return;
    }

    const { data: existing } = await this.supabaseService.admin.storage.getBucket(
      CREATIVES_BUCKET,
    );

    if (!existing) {
      const { error } = await this.supabaseService.admin.storage.createBucket(
        CREATIVES_BUCKET,
        {
          public: true,
          fileSizeLimit: MAX_CREATIVE_UPLOAD_BYTES,
        },
      );

      // A concurrent request may have created it between getBucket and
      // here - only surface an error if it's for some other reason.
      if (error && !/already exists/i.test(error.message)) {
        this.logger.error(`Could not create "${CREATIVES_BUCKET}" bucket: ${error.message}`);
        throw new InternalServerErrorException('Creative storage is not available');
      }
    }

    this.bucketReady = true;
  }
}
