import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { MusicController } from './music.controller';
import { MusicService } from './music.service';
import { MusicFile } from './entities/music.entity';
import { MetadataExtractionService } from './services/metadata-extraction.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MusicFile]),
    MulterModule.register({
      dest: './uploads',
    }),
  ],
  controllers: [MusicController],
  providers: [MusicService, MetadataExtractionService],
  exports: [MusicService, MetadataExtractionService],
})
export class MusicModule {}
