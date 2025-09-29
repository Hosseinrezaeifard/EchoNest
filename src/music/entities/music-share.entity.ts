import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { MusicFile } from './music.entity';
import { User } from '../../users/user.entity';

@Entity()
@Index(['shareId'], { unique: true })
export class MusicShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  shareId: string; // Public shareable ID (different from internal ID)

  @ManyToOne(() => MusicFile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'musicId' })
  music: MusicFile;

  @Column()
  musicId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string; // Owner of the music

  @Column({ default: false })
  allowDownload: boolean;

  @Column({ nullable: true })
  expiresAt: Date;

  @Column({ default: 0 })
  accessCount: number;

  @Column({ nullable: true })
  lastAccessedAt: Date;

  @Column({ default: true })
  isActive: boolean; // Can be disabled by owner

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
