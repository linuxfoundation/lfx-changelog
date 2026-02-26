import { ChangelogStatus } from '../enums/changelog-status.enum.js';
import type { CreateChangelogEntryRequest } from '../interfaces/dto.interface.js';

export interface ValidationError {
  field: string;
  message: string;
}

export function validateCreateChangelogEntry(data: Partial<CreateChangelogEntryRequest>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!data.productId?.trim()) {
    errors.push({ field: 'productId', message: 'Product ID is required.' });
  }

  if (!data.title?.trim()) {
    errors.push({ field: 'title', message: 'Title is required.' });
  } else if (data.title.length > 200) {
    errors.push({ field: 'title', message: 'Title must be 200 characters or fewer.' });
  }

  if (!data.description?.trim()) {
    errors.push({ field: 'description', message: 'Description is required.' });
  }

  if (!data.version?.trim()) {
    errors.push({ field: 'version', message: 'Version is required.' });
  }

  if (!data.status || !Object.values(ChangelogStatus).includes(data.status)) {
    errors.push({ field: 'status', message: 'A valid status is required.' });
  }

  return errors;
}
