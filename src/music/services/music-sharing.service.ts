import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MusicShare } from '../entities/music-share.entity';
import { MusicFile } from '../entities/music.entity';
import { User } from '../../users/user.entity';
import {
  CreateShareLinkDto,
  ShareLinkResponseDto,
  SharedMusicResponseDto,
  ShareStatsDto,
} from '../dto/sharing.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class MusicSharingService {
  private readonly logger = new Logger(MusicSharingService.name);

  constructor(
    @InjectRepository(MusicShare)
    private readonly shareRepository: Repository<MusicShare>,
    @InjectRepository(MusicFile)
    private readonly musicRepository: Repository<MusicFile>,
  ) {}

  /**
   * Create a shareable link for a music file
   */
  async createShareLink(
    musicId: string,
    createShareDto: CreateShareLinkDto,
    userId: string,
  ): Promise<ShareLinkResponseDto> {
    // Verify user owns the music file
    const music = await this.musicRepository.findOne({
      where: { id: musicId, userId },
    });

    if (!music) {
      throw new NotFoundException(
        'Music file not found or you do not have permission to share it',
      );
    }

    // Check if a share already exists for this music
    let existingShare = await this.shareRepository.findOne({
      where: { musicId, userId },
    });

    if (existingShare) {
      // Update existing share
      existingShare.allowDownload = createShareDto.allowDownload ?? false;
      existingShare.expiresAt = createShareDto.expiresAt
        ? new Date(createShareDto.expiresAt)
        : null;
      existingShare.isActive = true;
      existingShare = await this.shareRepository.save(existingShare);

      this.logger.log(
        `Updated share link for music ${musicId} by user ${userId}`,
      );
    } else {
      // Create new share
      const shareId = this.generateShareId();

      existingShare = this.shareRepository.create({
        shareId,
        musicId,
        userId,
        allowDownload: createShareDto.allowDownload ?? false,
        expiresAt: createShareDto.expiresAt
          ? new Date(createShareDto.expiresAt)
          : null,
        isActive: true,
      });

      existingShare = await this.shareRepository.save(existingShare);
      this.logger.log(
        `Created new share link for music ${musicId} by user ${userId}`,
      );
    }

    // Generate public share URL
    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/shared/${existingShare.shareId}`;

    return {
      shareId: existingShare.shareId,
      shareUrl,
      allowDownload: existingShare.allowDownload,
      expiresAt: existingShare.expiresAt,
      createdAt: existingShare.createdAt,
      accessCount: existingShare.accessCount,
    };
  }

  /**
   * Get shared music by share ID (public access)
   */
  async getSharedMusic(shareId: string): Promise<SharedMusicResponseDto> {
    const share = await this.shareRepository.findOne({
      where: { shareId, isActive: true },
      relations: ['music', 'user'],
    });

    if (!share) {
      throw new NotFoundException(
        'Shared music not found or link is no longer active',
      );
    }

    // Check if link has expired
    if (share.expiresAt && new Date() > share.expiresAt) {
      throw new BadRequestException('This share link has expired');
    }

    // Increment access count
    await this.incrementAccessCount(share.id);

    this.logger.log(
      `Shared music ${share.musicId} accessed via share ${shareId}`,
    );

    // Return public-safe music data
    return {
      id: share.music.id,
      title: share.music.title,
      artist: share.music.artist,
      album: share.music.album,
      genre: share.music.genre,
      year: share.music.year,
      duration: share.music.duration,
      size: Math.round((share.music.size / (1024 * 1024)) * 100) / 100, // Convert to MB
      format: share.music.format,
      coverArt: share.music.coverArt,
      shareId: share.shareId,
      allowDownload: share.allowDownload,
      sharedBy: {
        id: share.user.id,
        username: share.user.username,
        firstName: share.user.firstName,
        lastName: share.user.lastName,
      },
    };
  }

  /**
   * Get file path for download (if allowed)
   */
  async getSharedMusicFile(
    shareId: string,
  ): Promise<{ filePath: string; fileName: string }> {
    const share = await this.shareRepository.findOne({
      where: { shareId, isActive: true },
      relations: ['music'],
    });

    if (!share) {
      throw new NotFoundException(
        'Shared music not found or link is no longer active',
      );
    }

    if (!share.allowDownload) {
      throw new BadRequestException(
        'Download is not allowed for this shared music',
      );
    }

    // Check if link has expired
    if (share.expiresAt && new Date() > share.expiresAt) {
      throw new BadRequestException('This share link has expired');
    }

    // Increment access count for download
    await this.incrementAccessCount(share.id);

    return {
      filePath: share.music.filePath,
      fileName: share.music.originalName,
    };
  }

  /**
   * Get user's shared music list
   */
  async getUserShares(userId: string): Promise<ShareLinkResponseDto[]> {
    const shares = await this.shareRepository.find({
      where: { userId, isActive: true },
      relations: ['music'],
      order: { createdAt: 'DESC' },
    });

    return shares.map((share) => ({
      shareId: share.shareId,
      shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/shared/${share.shareId}`,
      allowDownload: share.allowDownload,
      expiresAt: share.expiresAt,
      createdAt: share.createdAt,
      accessCount: share.accessCount,
    }));
  }

  /**
   * Delete/disable a share
   */
  async deleteShare(shareId: string, userId: string): Promise<void> {
    const share = await this.shareRepository.findOne({
      where: { shareId, userId },
    });

    if (!share) {
      throw new NotFoundException(
        'Share not found or you do not have permission to delete it',
      );
    }

    // Instead of deleting, mark as inactive to preserve analytics
    share.isActive = false;
    await this.shareRepository.save(share);

    this.logger.log(`Share ${shareId} disabled by user ${userId}`);
  }

  /**
   * Get share statistics
   */
  async getShareStats(shareId: string, userId: string): Promise<ShareStatsDto> {
    const share = await this.shareRepository.findOne({
      where: { shareId, userId },
    });

    if (!share) {
      throw new NotFoundException(
        'Share not found or you do not have permission to view its stats',
      );
    }

    // For now, return basic stats. In a real app, you'd have detailed access logs
    return {
      shareId: share.shareId,
      totalAccesses: share.accessCount,
      uniqueUsers: share.accessCount, // Simplified - in reality you'd track unique IPs/users
      lastAccessedAt: share.lastAccessedAt,
      accessHistory: [
        {
          date: new Date().toISOString().split('T')[0],
          count: share.accessCount,
        },
      ],
    };
  }

  /**
   * Generate a unique share ID
   */
  private generateShareId(): string {
    // Generate a URL-safe random ID
    return randomBytes(16).toString('base64url');
  }

  /**
   * Increment access count and update last accessed time
   */
  private async incrementAccessCount(shareId: string): Promise<void> {
    await this.shareRepository.increment({ id: shareId }, 'accessCount', 1);

    await this.shareRepository.update(
      { id: shareId },
      { lastAccessedAt: new Date() },
    );
  }
}
