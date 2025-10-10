import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  DefaultValuePipe,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MusicService } from './music.service';
import { MusicSharingService } from './services/music-sharing.service';
import { UploadMusicDto } from './dto/upload-music.dto';
import { MusicResponseDto } from './dto/music-response.dto';
import {
  SearchMusicDto,
  SearchResultDto,
  SearchFiltersDto,
  SuggestionDto,
  SuggestionResultDto,
} from './dto/search-music.dto';
import {
  CreateShareLinkDto,
  ShareLinkResponseDto,
  ShareStatsDto,
} from './dto/sharing.dto';
import { User } from '../users/user.entity';
import {
  musicStorage,
  coverArtStorage,
  mp3FileFilter,
  imageFileFilter,
  fileSizeLimit,
} from './config/multer.config';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';

@Controller('music')
@UseGuards(JwtGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class MusicController {
  constructor(
    private readonly musicService: MusicService,
    private readonly sharingService: MusicSharingService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('music', {
      storage: musicStorage,
      fileFilter: mp3FileFilter,
      limits: { fileSize: fileSizeLimit.music },
    }),
  )
  async uploadMusic(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadMusicDto: UploadMusicDto,
    @CurrentUser() user: User,
  ): Promise<MusicResponseDto> {
    return this.musicService.uploadMusic(file, uploadMusicDto, user);
  }

  @Post(':id/cover')
  @UseInterceptors(
    FileInterceptor('cover', {
      storage: coverArtStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: fileSizeLimit.image },
    }),
  )
  async uploadCoverArt(
    @Param('id') musicId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ): Promise<MusicResponseDto> {
    return this.musicService.uploadCoverArt(musicId, file, user);
  }

  // =============== SEARCH ENDPOINTS (Put specific routes FIRST) ===============

  @Get('search')
  async searchMusic(
    @Query() searchDto: SearchMusicDto,
    @CurrentUser() user: User,
  ): Promise<SearchResultDto> {
    return this.musicService.searchMusic(searchDto, user.id);
  }

  @Get('search/filters')
  async getSearchFilters(@CurrentUser() user: User): Promise<SearchFiltersDto> {
    return this.musicService.getSearchFilters(user.id);
  }

  @Get('search/suggestions')
  async getSuggestions(
    @Query() suggestionDto: SuggestionDto,
    @CurrentUser() user: User,
  ): Promise<SuggestionResultDto> {
    return this.musicService.getSuggestions(suggestionDto, user.id);
  }

  // =============== GENERAL MUSIC ENDPOINTS ===============

  @Get()
  async getUserMusic(
    @CurrentUser() user: User,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<{
    music: MusicResponseDto[];
    total: number;
    totalPages: number;
    currentPage: number;
  }> {
    const result = await this.musicService.getUserMusic(user.id, page, limit);
    return {
      ...result,
      currentPage: page,
    };
  }

  @Get(':id')
  async getMusicById(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<MusicResponseDto> {
    return this.musicService.getMusicById(id, user.id);
  }

  @Delete(':id')
  async deleteMusic(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<{ message: string }> {
    await this.musicService.deleteMusic(id, user.id);
    return { message: 'Music file deleted successfully' };
  }

  // =============== SHARING ENDPOINTS ===============

  @Post(':id/share')
  async createShareLink(
    @Param('id') musicId: string,
    @Body() createShareDto: CreateShareLinkDto,
    @CurrentUser() user: User,
  ): Promise<ShareLinkResponseDto> {
    return this.sharingService.createShareLink(
      musicId,
      createShareDto,
      user.id,
    );
  }

  @Get('shares')
  async getUserShares(
    @CurrentUser() user: User,
  ): Promise<ShareLinkResponseDto[]> {
    return this.sharingService.getUserShares(user.id);
  }

  @Get('shares/:shareId/stats')
  async getShareStats(
    @Param('shareId') shareId: string,
    @CurrentUser() user: User,
  ): Promise<ShareStatsDto> {
    return this.sharingService.getShareStats(shareId, user.id);
  }

  @Delete('shares/:shareId')
  async deleteShare(
    @Param('shareId') shareId: string,
    @CurrentUser() user: User,
  ): Promise<{ message: string }> {
    await this.sharingService.deleteShare(shareId, user.id);
    return { message: 'Share link disabled successfully' };
  }
}
