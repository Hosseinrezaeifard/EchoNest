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
