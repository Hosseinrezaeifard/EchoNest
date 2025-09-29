import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { MusicSharingService } from './services/music-sharing.service';
import { SharedMusicResponseDto } from './dto/sharing.dto';
import * as fs from 'fs';
import * as path from 'path';

@Controller('shared')
@UseInterceptors(ClassSerializerInterceptor)
export class PublicShareController {
  constructor(private readonly sharingService: MusicSharingService) {}

  /**
   * Get shared music metadata (public access)
   */
  @Get(':shareId')
  async getSharedMusic(
    @Param('shareId') shareId: string,
  ): Promise<SharedMusicResponseDto> {
    return this.sharingService.getSharedMusic(shareId);
  }

  /**
   * Download shared music file (if download is allowed)
   */
  @Get(':shareId/download')
  async downloadSharedMusic(
    @Param('shareId') shareId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { filePath, fileName } =
        await this.sharingService.getSharedMusicFile(shareId);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new NotFoundException('Music file not found on server');
      }

      // Set headers for file download
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-cache',
      });

      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Stream shared music for playback (public access)
   */
  @Get(':shareId/stream')
  async streamSharedMusic(
    @Param('shareId') shareId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { filePath } =
        await this.sharingService.getSharedMusicFile(shareId);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new NotFoundException('Music file not found on server');
      }

      // Get file stats for content length
      const stat = fs.statSync(filePath);

      // Set headers for audio streaming
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': stat.size.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      });

      // Stream the file for playback
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get shared music cover art (public access)
   */
  @Get(':shareId/cover')
  async getSharedMusicCover(
    @Param('shareId') shareId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const sharedMusic = await this.sharingService.getSharedMusic(shareId);

      if (!sharedMusic.coverArt) {
        throw new NotFoundException('No cover art available for this music');
      }

      // Check if cover art file exists
      if (!fs.existsSync(sharedMusic.coverArt)) {
        throw new NotFoundException('Cover art file not found on server');
      }

      // Determine content type based on file extension
      const ext = path.extname(sharedMusic.coverArt).toLowerCase();
      const contentType =
        ext === '.png'
          ? 'image/png'
          : ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : ext === '.webp'
              ? 'image/webp'
              : 'image/jpeg';

      // Set headers for image
      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      });

      // Stream the cover art
      const imageStream = fs.createReadStream(sharedMusic.coverArt);
      imageStream.pipe(res);
    } catch (error) {
      throw error;
    }
  }
}
