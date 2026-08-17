import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles/roles.guard';

describe('AuthController', () => {
  let controller: AuthController;
  const authService = {
    register: jest.fn(),
    login: jest.fn(),
  };

  beforeEach(async () => {
    // Tests call controller methods directly rather than through HTTP, so
    // the guards never actually run - these stubs exist only so Nest can
    // resolve @UseGuards(JwtAuthGuard, RolesGuard) at module-compile time
    // without needing a real SupabaseService/UsersService/DB connection.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns the authenticated profile from the request', () => {
    const user = {
      id: 'user-1',
      email: 'advertiser@example.com',
      role: 'ADVERTISER',
    };

    expect(controller.getProfile({ user })).toEqual({
      message: 'Profile fetched successfully',
      user,
    });
  });

  it('returns advertiser-only payload for guarded advertiser endpoint', () => {
    const user = {
      id: 'user-1',
      email: 'advertiser@example.com',
      role: 'ADVERTISER',
    };

    expect(controller.getAdvertiserOnly({ user })).toEqual({
      message: 'Advertiser access granted',
      user,
    });
  });
});
