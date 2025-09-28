import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { RegisterDto } from 'src/auth/dto/register.dto';
import { UserResponseDto } from 'src/auth/dto/auth-response.dto';
import { UpdateUserDto } from 'src/auth/dto/update-user.dto';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async createUser(@Body() registerDto: RegisterDto): Promise<UserResponseDto> {
    const user = await this.usersService.create(registerDto);
    return new UserResponseDto(user);
  }

  @Get()
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.usersService.findAll();
    return users.map((user) => new UserResponseDto(user));
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    const user = await this.usersService.findById(id);
    return new UserResponseDto(user);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.update(id, updateUserDto);
    return new UserResponseDto(user);
  }

  @Delete(':id')
  async deactivate(@Param('id') id: string): Promise<UserResponseDto> {
    const user = await this.usersService.deactivate(id);
    return new UserResponseDto(user);
  }
}
