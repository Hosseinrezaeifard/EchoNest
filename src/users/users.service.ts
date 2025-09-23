import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      where: { isActive: true },
      select: ['id', 'email', 'username', 'firstName', 'lastName', 'createdAt'],
    });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id, isActive: true },
      select: ['id', 'email', 'username', 'firstName', 'lastName', 'createdAt'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email, isActive: true },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { username, isActive: true },
    });
  }

  async create(userData: Partial<User>): Promise<User> {
    // Check if email already exists
    const existingEmail = await this.findByEmail(userData.email);
    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    // Check if username already exists
    const existingUsername = await this.findByUsername(userData.username);
    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    const user = this.userRepository.create(userData);
    return this.userRepository.save(user);
  }

  async update(id: string, updateData: Partial<User>): Promise<User> {
    const user = await this.findById(id);

    // Don't allow updating email or username for now
    delete updateData.email;
    delete updateData.username;
    delete updateData.password; // Password updates should be handled separately

    Object.assign(user, updateData);
    return this.userRepository.save(user);
  }

  async deactivate(id: string): Promise<User> {
    const user = await this.findById(id);
    user.isActive = false;
    return this.userRepository.save(user);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { email, isActive: true },
    });

    if (user && (await user.validatePassword(password))) {
      return user;
    }

    return null;
  }
}
