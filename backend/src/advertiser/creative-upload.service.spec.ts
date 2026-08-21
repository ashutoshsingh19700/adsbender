import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

import { CreativeUploadService } from './creative-upload.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('CreativeUploadService', () => {
  let service: CreativeUploadService;
  const storage = {
    getBucket: jest.fn(),
    createBucket: jest.fn(),
    from: jest.fn(),
  };
  const supabaseService = {
    admin: { storage },
  };

  const fromMock = {
    upload: jest.fn(),
    getPublicUrl: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    storage.from.mockReturnValue(fromMock);
    storage.getBucket.mockResolvedValue({ data: { name: 'campaign-creatives' } });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreativeUploadService,
        { provide: SupabaseService, useValue: supabaseService },
      ],
    }).compile();

    service = module.get<CreativeUploadService>(CreativeUploadService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects when no file is provided', async () => {
    await expect(service.uploadCreative('advertiser-1', undefined)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a disallowed mimetype', async () => {
    const file = {
      mimetype: 'application/pdf',
      buffer: Buffer.from(''),
    } as Express.Multer.File;

    await expect(service.uploadCreative('advertiser-1', file)).rejects.toThrow(
      BadRequestException,
    );
    expect(storage.from).not.toHaveBeenCalled();
  });

  it('uploads to a namespaced path and returns the public URL', async () => {
    const file = {
      mimetype: 'image/png',
      buffer: Buffer.from('fake-image-bytes'),
    } as Express.Multer.File;

    fromMock.upload.mockResolvedValue({ error: null });
    fromMock.getPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://supabase.example/creatives/advertiser-1/x.png' },
    });

    const result = await service.uploadCreative('advertiser-1', file);

    expect(storage.from).toHaveBeenCalledWith('campaign-creatives');
    const [uploadedPath, uploadedBuffer, options] = fromMock.upload.mock.calls[0];
    expect(uploadedPath).toMatch(/^advertiser-1\/.+\.png$/);
    expect(uploadedBuffer).toBe(file.buffer);
    expect(options).toMatchObject({ contentType: 'image/png', upsert: false });
    expect(result).toEqual({
      url: 'https://supabase.example/creatives/advertiser-1/x.png',
    });
  });

  it('creates the bucket first if it does not exist yet', async () => {
    storage.getBucket.mockResolvedValue({ data: null });
    storage.createBucket.mockResolvedValue({ error: null });
    fromMock.upload.mockResolvedValue({ error: null });
    fromMock.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://x/y.png' } });

    const file = { mimetype: 'image/png', buffer: Buffer.from('x') } as Express.Multer.File;
    await service.uploadCreative('advertiser-1', file);

    expect(storage.createBucket).toHaveBeenCalledWith(
      'campaign-creatives',
      expect.objectContaining({ public: true }),
    );
  });

  it('wraps a storage upload failure in a 500', async () => {
    fromMock.upload.mockResolvedValue({ error: { message: 'boom' } });

    const file = { mimetype: 'image/png', buffer: Buffer.from('x') } as Express.Multer.File;

    await expect(service.uploadCreative('advertiser-1', file)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
