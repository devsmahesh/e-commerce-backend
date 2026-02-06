import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  getHello() {
    return this.appService.getHello();
  }

  @Get('debug/uploads')
  @Public()
  @ApiOperation({ summary: 'Debug: Check uploads directory' })
  debugUploads() {
    const uploadsPath = join(process.cwd(), 'public', 'uploads');
    const exists = existsSync(uploadsPath);
    
    let folders: string[] = [];
    let fileCount = 0;
    
    if (exists) {
      try {
        folders = readdirSync(uploadsPath, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);
        
        folders.forEach(folder => {
          const folderPath = join(uploadsPath, folder);
          const files = readdirSync(folderPath);
          fileCount += files.length;
        });
      } catch (error) {
        return {
          success: false,
          message: 'Error reading uploads directory',
          error: error instanceof Error ? error.message : 'Unknown error',
          path: uploadsPath,
        };
      }
    }
    
    return {
      success: true,
      path: uploadsPath,
      exists,
      folders,
      totalFiles: fileCount,
      cwd: process.cwd(),
    };
  }
}
