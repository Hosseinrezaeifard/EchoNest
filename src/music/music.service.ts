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
import {
  SearchMusicDto,
  SearchResultDto,
  SearchFiltersDto,
  SuggestionDto,
  SuggestionResultDto,
  SortBy,
} from './dto/search-music.dto';
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

  /**
   * Advanced search with PostgreSQL full-text search and metadata filtering
   */
  async searchMusic(
    searchDto: SearchMusicDto,
    userId: string,
  ): Promise<SearchResultDto> {
    const {
      page = 1,
      limit = 20,
      sortBy = SortBy.RELEVANCE,
      sortOrder = 'DESC',
    } = searchDto;
    const skip = (page - 1) * limit;

    const qb = this.musicRepository.createQueryBuilder('music');

    // User-specific search
    qb.where('music.userId = :userId', { userId });

    // Full-text search across multiple fields
    if (searchDto.q && searchDto.q.trim()) {
      const searchTerm = searchDto.q.trim();
      qb.andWhere(
        `(
          to_tsvector('english', 
            COALESCE(music.title, '') || ' ' || 
            COALESCE(music.artist, '') || ' ' || 
            COALESCE(music.album, '') || ' ' ||
            COALESCE(music.albumArtist, '') || ' ' ||
            COALESCE(REPLACE(music.composers, ',', ' '), '') || ' ' ||
            COALESCE(music.comment, '') || ' ' ||
            COALESCE(music.lyrics, '')
          ) 
          @@ plainto_tsquery('english', :searchTerm)
        ) OR (
          LOWER(music.title) LIKE LOWER(:likeSearchTerm) OR
          LOWER(music.artist) LIKE LOWER(:likeSearchTerm) OR
          LOWER(music.album) LIKE LOWER(:likeSearchTerm) OR
          LOWER(music.albumArtist) LIKE LOWER(:likeSearchTerm)
        )`,
        {
          searchTerm,
          likeSearchTerm: `%${searchTerm}%`,
        },
      );
    }

    // Basic text filters
    if (searchDto.genre) {
      qb.andWhere('LOWER(music.genre) = LOWER(:genre)', {
        genre: searchDto.genre,
      });
    }
    if (searchDto.artist) {
      qb.andWhere('LOWER(music.artist) LIKE LOWER(:artist)', {
        artist: `%${searchDto.artist}%`,
      });
    }
    if (searchDto.album) {
      qb.andWhere('LOWER(music.album) LIKE LOWER(:album)', {
        album: `%${searchDto.album}%`,
      });
    }
    if (searchDto.albumArtist) {
      qb.andWhere('LOWER(music.albumArtist) LIKE LOWER(:albumArtist)', {
        albumArtist: `%${searchDto.albumArtist}%`,
      });
    }

    // Numeric range filters
    if (searchDto.yearFrom && searchDto.yearTo) {
      qb.andWhere('music.year BETWEEN :yearFrom AND :yearTo', {
        yearFrom: searchDto.yearFrom,
        yearTo: searchDto.yearTo,
      });
    } else if (searchDto.yearFrom) {
      qb.andWhere('music.year >= :yearFrom', { yearFrom: searchDto.yearFrom });
    } else if (searchDto.yearTo) {
      qb.andWhere('music.year <= :yearTo', { yearTo: searchDto.yearTo });
    }

    if (searchDto.durationFrom && searchDto.durationTo) {
      qb.andWhere('music.duration BETWEEN :durationFrom AND :durationTo', {
        durationFrom: searchDto.durationFrom,
        durationTo: searchDto.durationTo,
      });
    } else if (searchDto.durationFrom) {
      qb.andWhere('music.duration >= :durationFrom', {
        durationFrom: searchDto.durationFrom,
      });
    } else if (searchDto.durationTo) {
      qb.andWhere('music.duration <= :durationTo', {
        durationTo: searchDto.durationTo,
      });
    }

    if (searchDto.bpmFrom && searchDto.bpmTo) {
      qb.andWhere('music.bpm BETWEEN :bpmFrom AND :bpmTo', {
        bpmFrom: searchDto.bpmFrom,
        bpmTo: searchDto.bpmTo,
      });
    } else if (searchDto.bpmFrom) {
      qb.andWhere('music.bpm >= :bpmFrom', { bpmFrom: searchDto.bpmFrom });
    } else if (searchDto.bpmTo) {
      qb.andWhere('music.bpm <= :bpmTo', { bpmTo: searchDto.bpmTo });
    }

    // Audio quality filters
    if (searchDto.minBitrate) {
      qb.andWhere('music.bitrate >= :minBitrate', {
        minBitrate: searchDto.minBitrate,
      });
    }
    if (searchDto.channels) {
      qb.andWhere('music.channels = :channels', {
        channels: searchDto.channels,
      });
    }
    if (searchDto.encoding) {
      qb.andWhere('LOWER(music.encoding) LIKE LOWER(:encoding)', {
        encoding: `%${searchDto.encoding}%`,
      });
    }

    // Advanced metadata filters
    if (searchDto.key) {
      qb.andWhere('LOWER(music.key) = LOWER(:key)', { key: searchDto.key });
    }
    if (searchDto.mood) {
      qb.andWhere('LOWER(music.mood) LIKE LOWER(:mood)', {
        mood: `%${searchDto.mood}%`,
      });
    }
    if (searchDto.composers && searchDto.composers.length > 0) {
      // Handle TypeORM simple-array (comma-separated) format
      const composerConditions = searchDto.composers.map(
        (composer, index) =>
          `LOWER(music.composers) LIKE LOWER(:composer${index})`,
      );
      const composerParams: any = {};
      searchDto.composers.forEach((composer, index) => {
        composerParams[`composer${index}`] = `%${composer}%`;
      });

      qb.andWhere(`(${composerConditions.join(' OR ')})`, composerParams);
    }

    // Boolean filters
    if (searchDto.hasLyrics === 'true') {
      qb.andWhere("music.lyrics IS NOT NULL AND music.lyrics != ''");
    } else if (searchDto.hasLyrics === 'false') {
      qb.andWhere("(music.lyrics IS NULL OR music.lyrics = '')");
    }

    if (searchDto.hasCoverArt === 'true') {
      qb.andWhere("music.coverArt IS NOT NULL AND music.coverArt != ''");
    } else if (searchDto.hasCoverArt === 'false') {
      qb.andWhere("(music.coverArt IS NULL OR music.coverArt = '')");
    }

    // Disc/Track filters
    if (searchDto.discNumber) {
      qb.andWhere('music.discNumber = :discNumber', {
        discNumber: searchDto.discNumber,
      });
    }
    if (searchDto.trackNumber) {
      qb.andWhere('music.trackNumber = :trackNumber', {
        trackNumber: searchDto.trackNumber,
      });
    }

    // Sorting
    this.applySorting(qb, sortBy, sortOrder as any, searchDto.q);

    // Get total count before pagination
    const total = await qb.getCount();

    // Apply pagination
    const music = await qb.skip(skip).take(limit).getMany();

    // Convert to DTOs
    const musicDtos = music.map((file) => new MusicResponseDto(file));
    const totalPages = Math.ceil(total / limit);

    return {
      music: musicDtos,
      total,
      totalPages,
      currentPage: page,
    };
  }

  private applySorting(
    qb: any,
    sortBy: SortBy,
    sortOrder: 'ASC' | 'DESC',
    searchQuery?: string,
  ) {
    switch (sortBy) {
      case SortBy.RELEVANCE:
        if (searchQuery && searchQuery.trim()) {
          // Sort by relevance using PostgreSQL ranking
          qb.addSelect(
            `ts_rank(
              to_tsvector('english', 
                COALESCE(music.title, '') || ' ' || 
                COALESCE(music.artist, '') || ' ' || 
                COALESCE(music.album, '')
              ),
              plainto_tsquery('english', :searchTerm)
            )`,
            'rank',
          );
          qb.setParameter('searchTerm', searchQuery.trim());
          qb.orderBy('rank', 'DESC');
          qb.addOrderBy('music.createdAt', 'DESC');
        } else {
          qb.orderBy('music.createdAt', 'DESC');
        }
        break;
      case SortBy.TITLE:
        qb.orderBy('music.title', sortOrder);
        break;
      case SortBy.ARTIST:
        qb.orderBy('music.artist', sortOrder);
        break;
      case SortBy.ALBUM:
        qb.orderBy('music.album', sortOrder);
        break;
      case SortBy.YEAR:
        qb.orderBy('music.year', sortOrder);
        break;
      case SortBy.DURATION:
        qb.orderBy('music.duration', sortOrder);
        break;
      case SortBy.BPM:
        qb.orderBy('music.bpm', sortOrder);
        break;
      case SortBy.CREATED_AT:
      default:
        qb.orderBy('music.createdAt', sortOrder);
        break;
    }
  }

  /**
   * Get available filter options for faceted search
   */
  async getSearchFilters(userId: string): Promise<SearchFiltersDto> {
    const qb = this.musicRepository.createQueryBuilder('music');
    qb.where('music.userId = :userId', { userId });

    // Get distinct values for categorical filters
    const [
      genres,
      artists,
      albums,
      keys,
      moods,
      encodings,
      yearRange,
      durationRange,
      bpmRange,
      bitrateRange,
    ] = await Promise.all([
      qb
        .clone()
        .select('DISTINCT music.genre', 'genre')
        .where('music.genre IS NOT NULL')
        .getRawMany(),
      qb
        .clone()
        .select('DISTINCT music.artist', 'artist')
        .where('music.artist IS NOT NULL')
        .getRawMany(),
      qb
        .clone()
        .select('DISTINCT music.album', 'album')
        .where('music.album IS NOT NULL')
        .getRawMany(),
      qb
        .clone()
        .select('DISTINCT music.key', 'key')
        .where('music.key IS NOT NULL')
        .getRawMany(),
      qb
        .clone()
        .select('DISTINCT music.mood', 'mood')
        .where('music.mood IS NOT NULL')
        .getRawMany(),
      qb
        .clone()
        .select('DISTINCT music.encoding', 'encoding')
        .where('music.encoding IS NOT NULL')
        .getRawMany(),
      qb
        .clone()
        .select('MIN(music.year)', 'min')
        .addSelect('MAX(music.year)', 'max')
        .where('music.year IS NOT NULL')
        .getRawOne(),
      qb
        .clone()
        .select('MIN(music.duration)', 'min')
        .addSelect('MAX(music.duration)', 'max')
        .where('music.duration IS NOT NULL')
        .getRawOne(),
      qb
        .clone()
        .select('MIN(music.bpm)', 'min')
        .addSelect('MAX(music.bpm)', 'max')
        .where('music.bpm IS NOT NULL AND music.bpm > 0')
        .getRawOne(),
      qb
        .clone()
        .select('MIN(music.bitrate)', 'min')
        .addSelect('MAX(music.bitrate)', 'max')
        .where('music.bitrate IS NOT NULL')
        .getRawOne(),
    ]);

    return {
      availableGenres: genres
        .map((g) => g.genre)
        .filter(Boolean)
        .sort(),
      availableArtists: artists
        .map((a) => a.artist)
        .filter(Boolean)
        .sort(),
      availableAlbums: albums
        .map((a) => a.album)
        .filter(Boolean)
        .sort(),
      availableKeys: keys
        .map((k) => k.key)
        .filter(Boolean)
        .sort(),
      availableMoods: moods
        .map((m) => m.mood)
        .filter(Boolean)
        .sort(),
      availableEncodings: encodings
        .map((e) => e.encoding)
        .filter(Boolean)
        .sort(),
      yearRange: {
        min: yearRange?.min || 1900,
        max: yearRange?.max || new Date().getFullYear(),
      },
      durationRange: {
        min: Math.floor(durationRange?.min || 0),
        max: Math.ceil(durationRange?.max || 600),
      },
      bpmRange: {
        min: Math.floor(bpmRange?.min || 0),
        max: Math.ceil(bpmRange?.max || 200),
      },
      bitrateRange: {
        min: bitrateRange?.min || 32000,
        max: bitrateRange?.max || 320000,
      },
    };
  }

  /**
   * Auto-complete suggestions
   */
  async getSuggestions(
    suggestionDto: SuggestionDto,
    userId: string,
  ): Promise<SuggestionResultDto> {
    const { q, limit = 10 } = suggestionDto;

    if (!q || q.trim().length < 2) {
      return { suggestions: [] };
    }

    const searchTerm = q.trim();
    const qb = this.musicRepository.createQueryBuilder('music');
    qb.where('music.userId = :userId', { userId });

    const suggestions = [];

    // Title suggestions
    const titles = await qb
      .clone()
      .select('music.title', 'value')
      .addSelect('COUNT(*)', 'count')
      .where(
        'LOWER(music.title) LIKE LOWER(:searchTerm) AND music.title IS NOT NULL',
        { searchTerm: `%${searchTerm}%` },
      )
      .groupBy('music.title')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    suggestions.push(
      ...titles.map((t) => ({
        type: 'title' as const,
        value: t.value,
        count: parseInt(t.count),
      })),
    );

    // Artist suggestions
    const artists = await qb
      .clone()
      .select('music.artist', 'value')
      .addSelect('COUNT(*)', 'count')
      .where(
        'LOWER(music.artist) LIKE LOWER(:searchTerm) AND music.artist IS NOT NULL',
        { searchTerm: `%${searchTerm}%` },
      )
      .groupBy('music.artist')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    suggestions.push(
      ...artists.map((a) => ({
        type: 'artist' as const,
        value: a.value,
        count: parseInt(a.count),
      })),
    );

    // Album suggestions
    const albums = await qb
      .clone()
      .select('music.album', 'value')
      .addSelect('COUNT(*)', 'count')
      .where(
        'LOWER(music.album) LIKE LOWER(:searchTerm) AND music.album IS NOT NULL',
        { searchTerm: `%${searchTerm}%` },
      )
      .groupBy('music.album')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    suggestions.push(
      ...albums.map((a) => ({
        type: 'album' as const,
        value: a.value,
        count: parseInt(a.count),
      })),
    );

    // Sort by count and limit
    const sortedSuggestions = suggestions
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return { suggestions: sortedSuggestions };
  }
}
