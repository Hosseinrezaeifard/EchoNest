import { IsOptional, IsBoolean, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateShareLinkDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  allowDownload?: boolean = false;

  @IsOptional()
  @IsDateString()
  expiresAt?: string; // ISO date string
}

export class ShareLinkResponseDto {
  shareId: string;
  shareUrl: string;
  allowDownload: boolean;
  expiresAt?: Date;
  createdAt: Date;
  accessCount: number;
}

export class SharedMusicResponseDto {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  year: number;
  duration: number;
  size: number;
  format: string;
  coverArt?: string;

  // Sharing info
  shareId: string;
  allowDownload: boolean;
  sharedBy: {
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
  };

  // Hide sensitive info for security
  // fileName, filePath, userId are excluded
}

export class ShareStatsDto {
  shareId: string;
  totalAccesses: number;
  uniqueUsers: number;
  lastAccessedAt?: Date;
  accessHistory: {
    date: string;
    count: number;
  }[];
}
