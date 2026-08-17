import { Socket } from 'net';
import { connect as tlsConnect, TLSSocket } from 'tls';

type RedisValue = string | number | null | RedisValue[];

type RedisClientOptions = {
  host: string;
  port: number;
  password?: string;
  timeoutMs?: number;
  tls?: boolean;
};

type ParsedResp = {
  value: RedisValue;
  nextOffset: number;
};

export class RedisRespClient {
  private readonly sockets = new Set<Socket | TLSSocket>();

  constructor(private readonly options: RedisClientOptions) {}

  async command<T = RedisValue>(args: Array<string | number>): Promise<T> {
    const authArgs = this.options.password
      ? [['AUTH', this.options.password], args]
      : [args];
    let result: RedisValue = null;

    for (const commandArgs of authArgs) {
      result = await this.send(commandArgs);
    }

    return result as T;
  }

  destroy() {
    for (const socket of this.sockets) {
      socket.destroy();
    }
    this.sockets.clear();
  }

  private send(args: Array<string | number>) {
    return new Promise<RedisValue>((resolve, reject) => {
      const socket: Socket | TLSSocket = this.options.tls
        ? tlsConnect({
            host: this.options.host,
            port: this.options.port,
            servername: this.options.host,
          })
        : new Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error('Redis command timed out'));
      }, this.options.timeoutMs ?? 3000);
      let buffer = Buffer.alloc(0);

      this.sockets.add(socket);

      const cleanup = () => {
        clearTimeout(timeout);
        this.sockets.delete(socket);
      };

      socket.once('error', (error) => {
        cleanup();
        reject(error);
      });

      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);

        try {
          const parsed = this.parse(buffer, 0);

          if (!parsed) {
            return;
          }

          cleanup();
          socket.destroy();
          resolve(parsed.value);
        } catch (error) {
          cleanup();
          socket.destroy();
          reject(error);
        }
      });

      const onReady = () => {
        socket.write(this.encode(args));
      };

      if (this.options.tls) {
        (socket as TLSSocket).once('secureConnect', onReady);
      } else {
        socket.connect(this.options.port, this.options.host, onReady);
      }
    });
  }

  private encode(args: Array<string | number>) {
    const parts = [`*${args.length}\r\n`];

    for (const arg of args) {
      const value = String(arg);
      const bytes = Buffer.byteLength(value);
      parts.push(`$${bytes}\r\n${value}\r\n`);
    }

    return parts.join('');
  }

  private parse(buffer: Buffer, offset: number): ParsedResp | null {
    if (offset >= buffer.length) {
      return null;
    }

    const prefix = String.fromCharCode(buffer[offset]);

    if (prefix === '+') {
      return this.parseLine(buffer, offset + 1);
    }

    if (prefix === '-') {
      const error = this.parseLine(buffer, offset + 1);
      if (!error) {
        return null;
      }

      throw new Error(String(error.value));
    }

    if (prefix === ':') {
      const integer = this.parseLine(buffer, offset + 1);
      if (!integer) {
        return null;
      }

      return {
        value: Number(integer.value),
        nextOffset: integer.nextOffset,
      };
    }

    if (prefix === '$') {
      return this.parseBulkString(buffer, offset + 1);
    }

    if (prefix === '*') {
      return this.parseArray(buffer, offset + 1);
    }

    throw new Error('Unsupported Redis response');
  }

  private parseLine(buffer: Buffer, offset: number): ParsedResp | null {
    const end = buffer.indexOf('\r\n', offset);

    if (end === -1) {
      return null;
    }

    return {
      value: buffer.toString('utf8', offset, end),
      nextOffset: end + 2,
    };
  }

  private parseBulkString(buffer: Buffer, offset: number): ParsedResp | null {
    const lengthLine = this.parseLine(buffer, offset);

    if (!lengthLine) {
      return null;
    }

    const length = Number(lengthLine.value);

    if (length === -1) {
      return {
        value: null,
        nextOffset: lengthLine.nextOffset,
      };
    }

    const valueStart = lengthLine.nextOffset;
    const valueEnd = valueStart + length;
    const nextOffset = valueEnd + 2;

    if (buffer.length < nextOffset) {
      return null;
    }

    return {
      value: buffer.toString('utf8', valueStart, valueEnd),
      nextOffset,
    };
  }

  private parseArray(buffer: Buffer, offset: number): ParsedResp | null {
    const lengthLine = this.parseLine(buffer, offset);

    if (!lengthLine) {
      return null;
    }

    const length = Number(lengthLine.value);
    const values: RedisValue[] = [];
    let nextOffset = lengthLine.nextOffset;

    for (let index = 0; index < length; index += 1) {
      const parsed = this.parse(buffer, nextOffset);

      if (!parsed) {
        return null;
      }

      values.push(parsed.value);
      nextOffset = parsed.nextOffset;
    }

    return {
      value: values,
      nextOffset,
    };
  }
}
