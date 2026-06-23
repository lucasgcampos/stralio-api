import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';

@Injectable()
export class HashService {
  SALT_ROUNDS: number = 12;

  async createHash(text: string): Promise<string> {
    const salt = await bcrypt.genSalt(this.SALT_ROUNDS);
    return await bcrypt.hash(text, salt);
  }

  async verify(input: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(input, hash);
  }
}
