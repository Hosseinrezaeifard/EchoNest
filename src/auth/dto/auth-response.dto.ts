import { Exclude, Expose } from 'class-transformer';

export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  username: string;

  @Expose()
  firstName?: string;

  @Expose()
  lastName?: string;

  @Expose()
  isActive: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Exclude()
  password: string;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}

export class AuthResponseDto {
  @Expose()
  user: UserResponseDto;

  @Expose()
  accessToken: string;

  constructor(user: UserResponseDto, accessToken: string) {
    this.user = user;
    this.accessToken = accessToken;
  }
}
