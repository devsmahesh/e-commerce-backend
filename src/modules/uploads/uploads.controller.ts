import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { existsSync, createReadStream, statSync } from 'fs';
import { join } from 'path';

@ApiTags('uploads')
@Controller('uploads')
@Public()
export class UploadsController {
  @Get(':folder/:filename')
  @ApiOperation({ summary: 'Serve uploaded images' })
  @ApiParam({ name: 'folder', description: 'Upload folder (categories, products, etc.)' })
  @ApiParam({ name: 'filename', description: 'Image filename' })
  async serveFile(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    // Security: Prevent directory traversal
    if (folder.includes('..') || filename.includes('..')) {
      throw new NotFoundException('Invalid file path');
    }

    const filePath = join(process.cwd(), 'public', 'uploads', folder, filename);
    
    // Check if file exists
    if (!existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      throw new NotFoundException(`File not found: ${folder}/${filename}`);
    }

    // Check if it's a file (not a directory)
    const stats = statSync(filePath);
    if (!stats.isFile()) {
      throw new NotFoundException(`Path is not a file: ${folder}/${filename}`);
    }

    // Set proper headers
    const ext = filename.toLowerCase().split('.').pop();
    const contentTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    const contentType = contentTypes[ext || ''] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Length', stats.size);

    // Stream the file
    const fileStream = createReadStream(filePath);
    fileStream.on('error', (error) => {
      console.error(`❌ Error streaming file ${filePath}:`, error);
      if (!res.headersSent) {
        res.status(500).send('Error reading file');
      }
    });
    
    fileStream.pipe(res);
  }
}

