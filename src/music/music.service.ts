import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MusicFile } from './entities/music.entity';
import { UploadMusicDto } from './dto/upload-music.dto';
import { MusicResponseDto } from './dto/music-response.dto';
import { User } from '../users/user.entity';
import { MetadataExtractionService } from './services/metadata-extraction.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MusicService {
  private readonly logger = new Logger(MusicService.name);

  constructor(
    @InjectRepository(MusicFile)
    private readonly musicRepository: Repository<MusicFile>,
    private readonly metadataExtractionService: MetadataExtractionService,
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

    // Validate file has content
    if (!file.size || file.size === 0) {
      throw new BadRequestException('Uploaded file is empty');
    }

    // Validate file was actually saved to disk
    if (!fs.existsSync(file.path)) {
      throw new BadRequestException(
        'File upload failed - file not saved to disk',
      );
    }

    // Additional validation: Check if file on disk has content
    const fileStats = fs.statSync(file.path);
    if (fileStats.size === 0) {
      // Clean up empty file
      fs.unlinkSync(file.path);
      throw new BadRequestException(
        'File upload failed - empty file saved to disk',
      );
    }

    this.logger.log(
      `Processing music upload for user ${user.id}: ${file.originalname}`,
    );

    try {
      // Extract metadata from the uploaded file
      const extractedMetadata =
        await this.metadataExtractionService.extractMetadata(file.path);

      this.logger.log(
        `Metadata extracted: ${this.metadataExtractionService.getMetadataSummary(extractedMetadata)}`,
      );

      // Create music file record with extracted metadata
      // User-provided data takes precedence over extracted metadata
      const musicFile = this.musicRepository.create({
        fileName: file.filename,
        originalName: file.originalname,

        // Basic metadata (user input overrides extracted data)
        title:
          uploadMusicDto.title ||
          extractedMetadata.title ||
          this.extractTitleFromFilename(file.originalname),
        artist:
          uploadMusicDto.artist || extractedMetadata.artist || 'Unknown Artist',
        album:
          uploadMusicDto.album || extractedMetadata.album || 'Unknown Album',
        genre: uploadMusicDto.genre || extractedMetadata.genre || 'Unknown',
        year:
          uploadMusicDto.year ||
          extractedMetadata.year ||
          new Date().getFullYear(),

        // Extended metadata from extraction
        trackNumber: extractedMetadata.trackNumber,
        totalTracks: extractedMetadata.totalTracks,
        discNumber: extractedMetadata.discNumber,
        totalDiscs: extractedMetadata.totalDiscs,
        albumArtist: extractedMetadata.albumArtist,
        composers: extractedMetadata.composers,
        comment: extractedMetadata.comment,
        bpm: extractedMetadata.bpm,
        key: extractedMetadata.key,
        mood: extractedMetadata.mood,
        isrc: extractedMetadata.isrc,
        lyrics: extractedMetadata.lyrics,

        // Audio properties
        duration: extractedMetadata.duration,
        bitrate: extractedMetadata.bitrate,
        sampleRate: extractedMetadata.sampleRate,
        channels: extractedMetadata.channels,
        encoding: extractedMetadata.encoding,

        // File properties
        size: file.size,
        format: 'mp3',
        filePath: file.path,
        user: user,
        userId: user.id,
      });

      // Save to database first to get the ID
      const savedMusic = await this.musicRepository.save(musicFile);

      // Process artwork if extracted
      if (extractedMetadata.artwork) {
        try {
          const artworkPath =
            await this.metadataExtractionService.saveExtractedArtwork(
              extractedMetadata.artwork.data,
              extractedMetadata.artwork.format,
              user.id,
              savedMusic.id,
            );

          if (artworkPath) {
            savedMusic.coverArt = artworkPath;
            await this.musicRepository.save(savedMusic);
            this.logger.log(
              `Artwork extracted and saved for music ${savedMusic.id}`,
            );
          }
        } catch (artworkError) {
          this.logger.warn(
            `Failed to save extracted artwork for music ${savedMusic.id}`,
            artworkError,
          );
          // Continue without artwork - not a critical failure
        }
      }

      this.logger.log(
        `Successfully processed music upload: ${savedMusic.title} by ${savedMusic.artist}`,
      );

      // Return formatted response
      return new MusicResponseDto(savedMusic);
    } catch (error) {
      this.logger.error(
        `Failed to process music upload for user ${user.id}`,
        error,
      );

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
