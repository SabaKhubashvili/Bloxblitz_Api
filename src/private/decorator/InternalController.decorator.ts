import { applyDecorators, Controller, UseGuards } from '@nestjs/common';
import { InternalServiceGuard } from 'src/middleware/InternalServiceGuard.middleware';

// Adds /internal automatically
export function InternalController(prefix?: string): ClassDecorator {
  const path = `internal${prefix ? `/${prefix}` : ''}`;
  return applyDecorators(Controller(path), UseGuards(InternalServiceGuard));
}
