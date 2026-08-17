import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('AuthService', () => {
  let service: AuthService;
  const usersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };
  const supabaseService = {
    admin: {
      auth: {
        admin: {
          createUser: jest.fn(),
          deleteUser: jest.fn(),
        },
      },
    },
    anon: {
      auth: {
        signInWithPassword: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: SupabaseService,
          useValue: supabaseService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('creates a Supabase auth user then a matching profile row, keyed by the Supabase user id', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      supabaseService.admin.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'supabase-user-1' } },
        error: null,
      });
      usersService.create.mockImplementation(async (data) => ({
        ...data,
        balance_usd: 0,
      }));

      const result = await service.register({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'secret12',
        role: 'ADVERTISER' as any,
      });

      expect(supabaseService.admin.auth.admin.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'ada@example.com',
          password: 'secret12',
        }),
      );
      expect(usersService.create).toHaveBeenCalledWith({
        id: 'supabase-user-1',
        name: 'Ada',
        email: 'ada@example.com',
        role: 'ADVERTISER',
      });
      expect(result.user).not.toHaveProperty('password');
    });

    it('rejects registration when the email already exists locally', async () => {
      usersService.findByEmail.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({
          name: 'Ada',
          email: 'ada@example.com',
          password: 'secret12',
          role: 'ADVERTISER' as any,
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(supabaseService.admin.auth.admin.createUser).not.toHaveBeenCalled();
    });

    it('rolls back the Supabase auth user if the local profile row fails to create', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      supabaseService.admin.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'supabase-user-1' } },
        error: null,
      });
      usersService.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.register({
          name: 'Ada',
          email: 'ada@example.com',
          password: 'secret12',
          role: 'ADVERTISER' as any,
        }),
      ).rejects.toThrow('db down');

      expect(supabaseService.admin.auth.admin.deleteUser).toHaveBeenCalledWith(
        'supabase-user-1',
      );
    });
  });

  describe('login', () => {
    it('sets the Supabase session token in an httpOnly sameSite=lax cookie', async () => {
      supabaseService.anon.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user-1' },
          session: { access_token: 'supabase-jwt', expires_in: 3600 },
        },
        error: null,
      });
      usersService.findById.mockResolvedValue({
        id: 'user-1',
        name: 'Ada',
        email: 'ada@example.com',
        role: 'ADVERTISER',
      });

      const response = {
        cookie: jest.fn(),
      } as any;

      await service.login(
        {
          email: 'ada@example.com',
          password: 'secret12',
        },
        response,
      );

      expect(response.cookie).toHaveBeenCalledWith(
        'token',
        'supabase-jwt',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
        }),
      );
    });

    it('rejects invalid credentials', async () => {
      supabaseService.anon.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      const response = { cookie: jest.fn() } as any;

      await expect(
        service.login(
          { email: 'ada@example.com', password: 'wrong' },
          response,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(response.cookie).not.toHaveBeenCalled();
    });
  });
});
