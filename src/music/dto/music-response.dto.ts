import { Expose, Transform } from 'class-transformer';

export class MusicResponseDto {
  @Expose()
  id: string;

  @Expose()
  fileName: string;

  @Expose()
  originalName: string;

  @Expose()
  title: string;

  @Expose()
  artist: string;

  @Expose()
  album: string;

  @Expose()
  genre: string;

  @Expose()
  year: number;

  @Expose()
  trackNumber: number;

  @Expose()
  totalTracks: number;

  @Expose()
  discNumber: number;

  @Expose()
  totalDiscs: number;

  @Expose()
  albumArtist: string;

  @Expose()
  composers: string[];

  @Expose()
  comment: string;

  @Expose()
  bpm: number;

  @Expose()
  key: string;

  @Expose()
  mood: string;

  @Expose()
  isrc: string;

  @Expose()
  lyrics: string;

  @Expose()
  @Transform(({ value }) => parseFloat(value))
  duration: number;

  @Expose()
  @Transform(({ value }) => {
    // Convert bytes to MB with 2 decimal places
    return parseFloat((value / (1024 * 1024)).toFixed(2));
  })
  size: number;

  @Expose()
  format: string;

  @Expose()
  bitrate: number;

  @Expose()
  sampleRate: number;

  @Expose()
  channels: number;

  @Expose()
  encoding: string;

  @Expose()
  coverArt: string;

  @Expose()
  userId: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<MusicResponseDto>) {
    Object.assign(this, partial);
  }
}
