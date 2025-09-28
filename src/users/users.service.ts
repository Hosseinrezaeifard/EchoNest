import { Repository } from 'typeorm';
import { User } from './user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  // find methods
  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      where: { isActive: true },
      select: ['id', 'email', 'username', 'createdAt', 'updatedAt'],
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

  // create method
  async create(user: Partial<User>): Promise<User> {
    // check if email exists
    const existingEmail = await this.findByEmail(user.email);
    if (existingEmail) throw new ConflictException('Email already exists');
    // check if username exists
    const existingUsername = await this.findByUsername(user.email);
    if (existingUsername)
      throw new ConflictException('Username already exists');
    // create user
    const newUser = this.userRepository.create(user);
    return this.userRepository.save(newUser);
  }

  // update method
  async update(id: string, newUserData: Partial<User>): Promise<User> {
    const user = await this.findById(id);
    delete newUserData.email;
    delete newUserData.username;
    delete newUserData.password; // we need to handle this seperately
    Object.assign(user, newUserData);
    return this.userRepository.save(user);
  }

  // delete method
  async deactivate(id: string): Promise<User> {
    const user = await this.findById(id);
    user.isActive = false;
    return this.userRepository.save(user);
  }

  // validate user method
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
