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
