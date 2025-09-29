import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { MusicController } from './music.controller';
import { PublicShareController } from './public-share.controller';
import { MusicService } from './music.service';
import { MusicSharingService } from './services/music-sharing.service';
import { MetadataExtractionService } from './services/metadata-extraction.service';
import { MusicFile } from './entities/music.entity';
import { MusicShare } from './entities/music-share.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MusicFile, MusicShare]),
    MulterModule.register({
      dest: './uploads',
    }),
  ],
  controllers: [MusicController, PublicShareController],
  providers: [MusicService, MusicSharingService, MetadataExtractionService],
  exports: [MusicService, MusicSharingService, MetadataExtractionService],
})
export class MusicModule {}
