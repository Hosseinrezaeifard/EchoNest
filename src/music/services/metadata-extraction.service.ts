import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { parseFile } from 'music-metadata';
import * as fs from 'fs';
import * as path from 'path';

export interface ExtractedMetadata {
  // Basic metadata
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  year?: number;

  // Track information
  trackNumber?: number;
  totalTracks?: number;
  discNumber?: number;
  totalDiscs?: number;

  // Additional metadata
  albumArtist?: string;
  composers?: string[];
  comment?: string;
  bpm?: number;
  key?: string;
  mood?: string;
  isrc?: string;
  lyrics?: string;

  // Audio properties
  duration?: number;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  encoding?: string;

  // Artwork
  artwork?: {
    data: Buffer;
    format: string;
    type?: string;
    description?: string;
  };
}

@Injectable()
export class MetadataExtractionService {
  private readonly logger = new Logger(MetadataExtractionService.name);

  async extractMetadata(filePath: string): Promise<ExtractedMetadata> {
    try {
      // Validate file exists
      if (!fs.existsSync(filePath)) {
        this.logger.error(
          `File not found for metadata extraction: ${filePath}`,
        );
        throw new BadRequestException('File not found for metadata extraction');
      }

      // Validate file has content
      const fileStats = fs.statSync(filePath);
      if (fileStats.size === 0) {
        this.logger.error(
          `Empty file found for metadata extraction: ${filePath}`,
        );
        throw new BadRequestException(
          'Cannot extract metadata from empty file',
        );
      }

      this.logger.log(
        `Extracting metadata from: ${path.basename(filePath)} (${fileStats.size} bytes)`,
      );

      // Parse the audio file
      const metadata = await parseFile(filePath);
      const { common, format } = metadata;

      // Extract basic metadata
      const extractedData: ExtractedMetadata = {
        // Basic info
        title: common.title,
        artist: common.artist,
        album: common.album,
        genre: common.genre?.[0], // Take first genre if multiple
        year: common.year,

        // Track info
        trackNumber: common.track?.no,
        totalTracks: common.track?.of,
        discNumber: common.disk?.no,
        totalDiscs: common.disk?.of,

        // Additional metadata
        albumArtist: common.albumartist,
        composers: common.composer
          ? Array.isArray(common.composer)
            ? common.composer
            : [common.composer]
          : undefined,
        comment:
          typeof common.comment?.[0] === 'string'
            ? common.comment[0]
            : (common.comment?.[0] as any)?.text,
        bpm: common.bpm,
        key: common.key,
        mood: common.mood,
        isrc: common.isrc?.[0],
        lyrics:
          typeof common.lyrics?.[0] === 'string'
            ? common.lyrics[0]
            : (common.lyrics?.[0] as any)?.text,

        // Audio properties
        duration: format.duration,
        bitrate: format.bitrate,
        sampleRate: format.sampleRate,
        channels: format.numberOfChannels,
        encoding: format.codec,
      };

      // Extract artwork if available
      if (common.picture && common.picture.length > 0) {
        const artwork = common.picture[0];
        extractedData.artwork = {
          data: Buffer.from(artwork.data),
          format: artwork.format,
          type: artwork.type,
          description: artwork.description,
        };
      }

      this.logger.log(
        `Successfully extracted metadata: ${extractedData.title} by ${extractedData.artist}`,
      );

      return extractedData;
    } catch (error) {
      this.logger.error(`Failed to extract metadata from ${filePath}`, error);

      // Re-throw the error if it's a BadRequestException (file validation failed)
      if (error instanceof BadRequestException) {
        throw error;
      }

      // For other errors (parsing issues), return basic file info
      this.logger.warn(
        `Metadata extraction failed, using fallback values for ${path.basename(filePath)}`,
      );
      return {
        title: this.extractTitleFromFilename(filePath),
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        genre: 'Unknown',
        year: new Date().getFullYear(),
      };
    }
  }

  async saveExtractedArtwork(
    artworkData: Buffer,
    format: string,
    userId: string,
    musicId: string,
  ): Promise<string> {
    try {
      // Determine file extension from format
      const extension =
        format.includes('jpeg') || format.includes('jpg')
          ? '.jpg'
          : format.includes('png')
            ? '.png'
            : format.includes('webp')
              ? '.webp'
              : '.jpg';

      // Create filename for extracted artwork
      const timestamp = Date.now();
      const filename = `extracted_${userId}_${musicId}_${timestamp}${extension}`;
      const artworkPath = path.join(
        process.cwd(),
        'uploads',
        'music',
        'covers',
        filename,
      );

      // Ensure directory exists
      const artworkDir = path.dirname(artworkPath);
      if (!fs.existsSync(artworkDir)) {
        fs.mkdirSync(artworkDir, { recursive: true });
      }

      // Save artwork to disk
      fs.writeFileSync(artworkPath, artworkData);

      this.logger.log(`Saved extracted artwork: ${filename}`);

      return artworkPath;
    } catch (error) {
      this.logger.error('Failed to save extracted artwork', error);
      return null;
    }
  }

  private extractTitleFromFilename(filePath: string): string {
    const filename = path.basename(filePath, path.extname(filePath));

    // Remove user ID and timestamp prefix if present
    const cleanName = filename.replace(/^[a-f0-9-]+_\d+_/, '');

    // Replace underscores and hyphens with spaces
    const spaced = cleanName.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();

    // Capitalize first letter of each word
    return spaced
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Validates if metadata extraction is available for the file type
   */
  isMetadataExtractionSupported(filename: string): boolean {
    const supportedExtensions = ['.mp3', '.m4a', '.flac', '.ogg', '.wav'];
    const extension = path.extname(filename).toLowerCase();
    return supportedExtensions.includes(extension);
  }

  /**
   * Gets a summary of extracted metadata for logging
   */
  getMetadataSummary(metadata: ExtractedMetadata): string {
    const parts = [];
    if (metadata.title) parts.push(`Title: ${metadata.title}`);
    if (metadata.artist) parts.push(`Artist: ${metadata.artist}`);
    if (metadata.album) parts.push(`Album: ${metadata.album}`);
    if (metadata.duration)
      parts.push(`Duration: ${metadata.duration.toFixed(1)}s`);
    if (metadata.artwork) parts.push('Artwork: Yes');

    return parts.join(', ') || 'No metadata found';
  }
}
