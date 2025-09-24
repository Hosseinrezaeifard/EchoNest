import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/user.entity';
import { UserResponseDto, AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    try {
      // Create user through users service (includes validation)
      const user = await this.usersService.create(registerDto);

      // Generate JWT token
      const payload = { sub: user.id, email: user.email };
      const accessToken = this.jwtService.sign(payload);

      // Return clean response
      const userResponse = new UserResponseDto(user);
      return new AuthResponseDto(userResponse, accessToken);
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error; // Re-throw validation errors from users service
      }
      throw new ConflictException('Registration failed');
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    // Validate user credentials
    const user = await this.usersService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate JWT token
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    // Return clean response
    const userResponse = new UserResponseDto(user);
    return new AuthResponseDto(userResponse, accessToken);
  }

  async validateUserById(userId: string): Promise<User | null> {
    try {
      return await this.usersService.findById(userId);
    } catch {
      return null;
    }
  }
}
