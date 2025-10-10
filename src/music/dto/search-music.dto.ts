import {
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum SortBy {
  RELEVANCE = 'relevance',
  TITLE = 'title',
  ARTIST = 'artist',
  ALBUM = 'album',
  YEAR = 'year',
  DURATION = 'duration',
  CREATED_AT = 'createdAt',
  BPM = 'bpm',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class SearchMusicDto {
  @IsOptional()
  @IsString()
  q?: string; // Main search query

  // Basic filters
  @IsOptional()
  @IsString()
  genre?: string;

  @IsOptional()
  @IsString()
  artist?: string;

  @IsOptional()
  @IsString()
  album?: string;

  @IsOptional()
  @IsString()
  albumArtist?: string;

  // Numeric range filters
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1900)
  @Max(2030)
  yearFrom?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1900)
  @Max(2030)
  yearTo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  durationFrom?: number; // in seconds

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  durationTo?: number; // in seconds

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bpmFrom?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bpmTo?: number;

  // Audio quality filters
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(32000)
  minBitrate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  channels?: number;

  @IsOptional()
  @IsString()
  encoding?: string;

  // Advanced metadata filters
  @IsOptional()
  @IsString()
  key?: string; // Musical key

  @IsOptional()
  @IsString()
  mood?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  composers?: string[];

  @IsOptional()
  @IsString()
  hasLyrics?: string; // 'true' | 'false'

  @IsOptional()
  @IsString()
  hasCoverArt?: string; // 'true' | 'false'

  // Disc/Track filters
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  discNumber?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  trackNumber?: number;

  // Sorting
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy = SortBy.RELEVANCE;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  // Pagination
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class SearchResultDto {
  music: any[]; // Will be MusicResponseDto[]
  total: number;
  totalPages: number;
  currentPage: number;
  filters?: SearchFiltersDto;
}

export class SearchFiltersDto {
  availableGenres: string[];
  availableArtists: string[];
  availableAlbums: string[];
  availableKeys: string[];
  availableMoods: string[];
  availableEncodings: string[];
  yearRange: { min: number; max: number };
  durationRange: { min: number; max: number };
  bpmRange: { min: number; max: number };
  bitrateRange: { min: number; max: number };
}

export class SuggestionDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(20)
  limit?: number = 10;
}

export class SuggestionResultDto {
  suggestions: {
    type: 'title' | 'artist' | 'album' | 'genre';
    value: string;
    count: number;
  }[];
}
