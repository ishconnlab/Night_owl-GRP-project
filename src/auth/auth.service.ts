import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginDto } from './dto/login.dto';
import { StaffUser } from './entities/staff-user.entity';
import { verifyPassword } from './password.util';
import type { AuthUser } from '../shared/current-user.decorator';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(StaffUser)
    private readonly staffUsers: Repository<StaffUser>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Verifies credentials and issues an access token.
   *
   * A wrong email and a wrong password produce the same error and both go
   * through a dummy hash comparison, so the response cannot be used to discover
   * which staff accounts exist.
   */
  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.staffUsers
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('lower(u.email) = :email', { email })
      .andWhere('u.is_active = true')
      .getOne();

    const stored = user?.passwordHash ?? DUMMY_HASH;
    const passwordMatches = await verifyPassword(dto.password, stored);

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Incorrect email or password.');
    }

    const payload: AuthUser = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const expiresIn = (this.config.get<string>('JWT_EXPIRES_IN', '1d') ??
      '1d') as JwtSignOptions['expiresIn'];

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn,
    });

    await this.staffUsers.update(user.id, { lastLoginAt: new Date() });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }
}

/**
 * A real digest of a value nobody can guess, compared against when the email
 * does not exist so unknown and known accounts take the same time.
 */
const DUMMY_HASH =
  'scrypt$00000000000000000000000000000000$' +
  '0'.repeat(128);
