import bcrypt from "bcryptjs";

import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import type { ChangePasswordInput, LoginInput, UpdateProfileInput } from "../validators/auth.validator.js";
import { unauthorized } from "../utils/AppError.js";
import { signAccessToken } from "../utils/jwt.js";
import { handleKnownPrismaError } from "../utils/prismaErrors.js";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
}

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true
} as const;

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...publicUserSelect, passwordHash: true }
  });

  // Always run a comparison so a missing account and a wrong password take
  // roughly the same amount of time.
  const passwordHash = user?.passwordHash ?? "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu";
  const passwordMatches = await bcrypt.compare(input.password, passwordHash);

  if (!user || !passwordMatches) {
    throw unauthorized("Invalid email or password.", "INVALID_CREDENTIALS");
  }

  const token = signAccessToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  });

  const { passwordHash: _passwordHash, ...safeUser } = user;

  return {
    token,
    expiresIn: env.JWT_EXPIRES_IN,
    user: safeUser satisfies PublicUser
  };
}

export async function getProfile(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });

  if (!user) {
    throw unauthorized("The account linked to this token no longer exists.", "ACCOUNT_NOT_FOUND");
  }

  return user;
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicUser> {
  try {
    return await prisma.user.update({
      where: { id: userId },
      data: input,
      select: publicUserSelect
    });
  } catch (error) {
    handleKnownPrismaError(error);
  }
}

export async function changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true }
  });

  if (!user) {
    throw unauthorized("The account linked to this token no longer exists.", "ACCOUNT_NOT_FOUND");
  }

  const matches = await bcrypt.compare(input.currentPassword, user.passwordHash);

  if (!matches) {
    throw unauthorized("Current password is incorrect.", "INVALID_CREDENTIALS");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, env.BCRYPT_SALT_ROUNDS);

  try {
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  } catch (error) {
    handleKnownPrismaError(error);
  }
}

export async function countAdmins(): Promise<number> {
  return prisma.user.count();
}