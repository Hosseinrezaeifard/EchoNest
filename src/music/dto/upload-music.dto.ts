import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadMusicDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  artist?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  album?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  genre?: string;

  @IsOptional()
  year?: number;
}
