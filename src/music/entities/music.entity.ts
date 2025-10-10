import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';

@Entity('music_files')
export class MusicFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fileName: string;

  @Column()
  originalName: string;

  @Column({ nullable: true })
  title: string;

  @Column({ nullable: true })
  artist: string;

  @Column({ nullable: true })
  album: string;

  @Column({ nullable: true })
  genre: string;

  @Column({ nullable: true })
  year: number;

  @Column({ nullable: true })
  trackNumber: number;

  @Column({ nullable: true })
  totalTracks: number;

  @Column({ nullable: true })
  discNumber: number;

  @Column({ nullable: true })
  totalDiscs: number;

  @Column({ nullable: true })
  albumArtist: string;

  @Column('simple-array', { nullable: true })
  composers: string[];

  @Column({ nullable: true })
  comment: string;

  @Column({ nullable: true })
  bpm: number;

  @Column({ nullable: true })
  key: string; // Musical key (C, G, Am, etc.)

  @Column({ nullable: true })
  mood: string;

  @Column({ nullable: true })
  isrc: string; // International Standard Recording Code

  @Column({ type: 'text', nullable: true })
  lyrics: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  duration: number; // in seconds

  @Column()
  size: number; // in bytes

  @Column({ default: 'mp3' })
  format: string;

  @Column({ nullable: true })
  bitrate: number;

  @Column({ nullable: true })
  sampleRate: number;

  @Column({ nullable: true })
  channels: number;

  @Column({ nullable: true })
  encoding: string;

  @Column()
  filePath: string;

  @Column({ nullable: true })
  coverArt: string; // path to cover image

  @ManyToOne(() => User, (user) => user.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
