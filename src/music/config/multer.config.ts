import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { BadRequestException } from '@nestjs/common';

// File filter to only allow MP3 files
export const mp3FileFilter = (req: any, file: any, callback: any) => {
  // Check file extension
  if (!file.originalname.match(/\.(mp3)$/i)) {
    return callback(
      new BadRequestException('Only MP3 files are allowed!'),
      false,
    );
  }

  // Check MIME type
  if (file.mimetype !== 'audio/mpeg' && file.mimetype !== 'audio/mp3') {
    return callback(
      new BadRequestException('Invalid file type! Only MP3 files are allowed.'),
      false,
    );
  }

  callback(null, true);
};

// Image filter for cover art
export const imageFileFilter = (req: any, file: any, callback: any) => {
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
    return callback(
      new BadRequestException(
        'Only image files (JPG, JPEG, PNG, GIF) are allowed!',
      ),
      false,
    );
  }

  if (!file.mimetype.startsWith('image/')) {
    return callback(
      new BadRequestException(
        'Invalid file type! Only image files are allowed.',
      ),
      false,
    );
  }

  callback(null, true);
};

// Storage configuration for music files
export const musicStorage = diskStorage({
  destination: join(process.cwd(), 'uploads', 'music'),
  filename: (req: any, file, callback) => {
    // Get user ID from request (set by auth guard)
    const userId = req.user?.id || 'anonymous';

    // Create unique filename: userId_timestamp_originalName.mp3
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/\s+/g, '_'); // Replace spaces with underscores
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9._-]/g, ''); // Remove special chars

    const filename = `${userId}_${timestamp}_${sanitizedName}`;
    callback(null, filename);
  },
});

// Storage configuration for cover art
export const coverArtStorage = diskStorage({
  destination: join(process.cwd(), 'uploads', 'music', 'covers'),
  filename: (req: any, file, callback) => {
    const userId = req.user?.id || 'anonymous';
    const timestamp = Date.now();
    const extension = extname(file.originalname);

    const filename = `cover_${userId}_${timestamp}${extension}`;
    callback(null, filename);
  },
});

// File size limits
export const fileSizeLimit = {
  music: 10 * 1024 * 1024, // 10MB for music files
  image: 5 * 1024 * 1024, // 5MB for cover images
};
