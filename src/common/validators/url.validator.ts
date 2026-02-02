import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'isValidUrl', async: false })
export class IsValidUrlConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    // Allow empty/undefined values (handled by @IsOptional())
    if (!value || value === '') {
      return true;
    }

    // Must be a string
    if (typeof value !== 'string') {
      return false;
    }

    try {
      const url = new URL(value);
      // Only accept http and https protocols
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    return 'Image must be a valid URL starting with http:// or https://';
  }
}

