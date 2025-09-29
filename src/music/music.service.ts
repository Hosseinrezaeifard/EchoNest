import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MusicFile } from './entities/music.entity';
import { UploadMusicDto } from './dto/upload-music.dto';
import { MusicResponseDto } from './dto/music-response.dto';
import { User } from '../users/user.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MusicService {
  constructor(
    @InjectRepository(MusicFile)
    private readonly musicRepository: Repository<MusicFile>,
  ) {}

  async uploadMusic(
    file: Express.Multer.File,
    uploadMusicDto: UploadMusicDto,
    user: User,
  ): Promise<MusicResponseDto> {
    // Validate file exists (Multer should ensure this, but double-check)
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate file was actually saved to disk
    if (!fs.existsSync(file.path)) {
      throw new BadRequestException('File upload failed - file not saved');
    }

    try {
      // Create music file record only after confirming file upload success
      const musicFile = this.musicRepository.create({
        fileName: file.filename,
        originalName: file.originalname,
        title:
          uploadMusicDto.title ||
          this.extractTitleFromFilename(file.originalname),
        artist: uploadMusicDto.artist || 'Unknown Artist',
        album: uploadMusicDto.album || 'Unknown Album',
        genre: uploadMusicDto.genre || 'Unknown',
        year: uploadMusicDto.year || new Date().getFullYear(),
        size: file.size,
        format: 'mp3',
        filePath: file.path,
        user: user,
        userId: user.id,
      });

      // Save to database
      const savedMusic = await this.musicRepository.save(musicFile);

      // Return formatted response
      return new MusicResponseDto(savedMusic);
    } catch (error) {
      // If database save fails, clean up uploaded file
      if (file && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  }

  async uploadCoverArt(
    musicId: string,
    file: Express.Multer.File,
    user: User,
  ): Promise<MusicResponseDto> {
    // Validate file exists and was saved successfully
    if (!file || !fs.existsSync(file.path)) {
      if (file && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new BadRequestException('Cover art upload failed');
    }

    // Find the music file
    const musicFile = await this.musicRepository.findOne({
      where: { id: musicId, userId: user.id },
    });

    if (!musicFile) {
      // Clean up uploaded file if music not found
      if (file && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new NotFoundException('Music file not found');
    }

    try {
      // Remove old cover art if exists
      if (musicFile.coverArt && fs.existsSync(musicFile.coverArt)) {
        fs.unlinkSync(musicFile.coverArt);
      }

      // Update music file with new cover art path
      musicFile.coverArt = file.path;
      const updatedMusic = await this.musicRepository.save(musicFile);

      return new MusicResponseDto(updatedMusic);
    } catch (error) {
      // If database update fails, clean up uploaded file
      if (file && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  }

  async getUserMusic(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ music: MusicResponseDto[]; total: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    const [music, total] = await this.musicRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const musicDtos = music.map((file) => new MusicResponseDto(file));
    const totalPages = Math.ceil(total / limit);

    return {
      music: musicDtos,
      total,
      totalPages,
    };
  }

  async getMusicById(id: string, userId: string): Promise<MusicResponseDto> {
    const musicFile = await this.musicRepository.findOne({
      where: { id, userId },
    });

    if (!musicFile) {
      throw new NotFoundException('Music file not found');
    }

    return new MusicResponseDto(musicFile);
  }

  async deleteMusic(id: string, userId: string): Promise<void> {
    const musicFile = await this.musicRepository.findOne({
      where: { id, userId },
    });

    if (!musicFile) {
      throw new NotFoundException('Music file not found');
    }

    // Delete physical files
    if (fs.existsSync(musicFile.filePath)) {
      fs.unlinkSync(musicFile.filePath);
    }

    if (musicFile.coverArt && fs.existsSync(musicFile.coverArt)) {
      fs.unlinkSync(musicFile.coverArt);
    }

    // Delete from database
    await this.musicRepository.remove(musicFile);
  }

  private extractTitleFromFilename(filename: string): string {
    // Remove extension and clean up filename for title
    const nameWithoutExt = path.parse(filename).name;

    // Replace underscores and hyphens with spaces
    const cleanName = nameWithoutExt
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Capitalize first letter of each word
    return cleanName
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}
