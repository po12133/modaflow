import { Transform } from 'class-transformer';
import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Trims strings; leaves other values untouched for the validators to reject. */
export const Trim = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

/** Trims and turns empty strings into null (for optional text fields that can be cleared). */
export const TrimToNull = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  });

export const NormalizeEmail = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** Password policy: 8–128 characters with at least one letter and one digit. */
export const IsStrongPassword = () =>
  applyDecorators(
    IsString(),
    MinLength(PASSWORD_MIN, { message: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.` }),
    MaxLength(PASSWORD_MAX, { message: `La contraseña no puede superar ${PASSWORD_MAX} caracteres.` }),
    Matches(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/, { message: 'La contraseña debe incluir al menos una letra.' }),
    Matches(/\d/, { message: 'La contraseña debe incluir al menos un número.' }),
  );
