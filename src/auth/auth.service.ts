import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto, UserResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { User } from 'src/users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    try {
      const user = await this.usersService.create(registerDto);

      // Generate JWT Token
      const payload = { sub: user.id, email: user.email };
      const accessToken = this.jwtService.sign(payload);

      // return the response
      const userResponse = new UserResponseDto(user);
      return new AuthResponseDto(userResponse, accessToken);
    } catch (error) {
      console.log(error);
      if (error instanceof ConflictException) throw error; //Re-throw validation errors from users service
      throw new ConflictException('Registeration failed');
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    // validate user credentials
    const user = await this.usersService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    if (!user) throw new UnauthorizedException('Invalid email or password');

    // Generate the JWT
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    // return response
    const userResponse = new UserResponseDto(user);
    return new AuthResponseDto(userResponse, accessToken);
  }

  async validateUserById(userId: string): Promise<User | null> {
    try {
      return await this.usersService.findById(userId);
    } catch (error) {
      return null;
    }
  }
}
