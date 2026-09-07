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

type PendingCommand = {
  resolve: (value: RedisValue) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

// Reuses ONE persistent, authenticated connection per client instance and
// pipelines every command over it (write immediately, match replies back to
// callers in FIFO order - Redis guarantees replies come back in the same
// order commands were received), instead of opening a brand-new TCP
// connection and redoing the AUTH handshake for every single command.
//
// Under real ad-serving load (a fraud-detection velocity check and a
// campaign-cache lookup on every /serve, another on every /click, from each
// of the four Redis-backed stores) the old one-socket-per-command version
// meant every ad request opened several fresh sockets - each a full TCP (and
// TLS, for a managed Redis provider) handshake plus a round trip just for
// AUTH before the real command could even go out. At any real concurrency
// that burns ephemeral ports and file descriptors faster than the OS
// reclaims them (sockets sit in TIME_WAIT after close) and adds multiple RTTs
// of latency to the hot path - exactly the kind of thing that works fine in
// a demo and then falls over under production traffic. A single reused
// connection removes both problems: one handshake total, and every command
// after that is just a write + a queued read.
export class RedisRespClient {
  private socket: Socket | TLSSocket | null = null;
  private connecting: Promise<Socket | TLSSocket> | null = null;
  private buffer = Buffer.alloc(0);
  private parseOffset = 0;
  private readonly pending: PendingCommand[] = [];

  constructor(private readonly options: RedisClientOptions) {}

  async command<T = RedisValue>(args: Array<string | number>): Promise<T> {
    const socket = await this.getConnection();

    return new Promise<RedisValue>((resolve, reject) => {
      const timeout = setTimeout(() => {
        // A command that never got a reply leaves the response stream at an
        // unknown offset for whatever comes after it - there is no safe way
        // to keep using this connection, so tear it down. Every other
        // pending command on it fails too (via the 'close' handler below)
        // and the next command lazily reconnects from scratch.
        socket.destroy(new Error('Redis command timed out'));
      }, this.options.timeoutMs ?? 3000);

      this.pending.push({ resolve, reject, timeout });
      socket.write(this.encode(args));
    }) as Promise<T>;
  }

  destroy() {
    this.failPending(new Error('Redis client destroyed'));
    this.socket?.destroy();
    this.socket = null;
    this.connecting = null;
  }

  private async getConnection(): Promise<Socket | TLSSocket> {
    if (this.socket && !this.socket.destroyed) {
      return this.socket;
    }

    if (!this.connecting) {
      this.connecting = this.connect();
    }

    return this.connecting;
  }

  private connect(): Promise<Socket | TLSSocket> {
    return new Promise((resolve, reject) => {
      const socket: Socket | TLSSocket = this.options.tls
        ? tlsConnect({
            host: this.options.host,
            port: this.options.port,
            servername: this.options.host,
          })
        : new Socket();

      const connectTimeout = setTimeout(() => {
        socket.destroy(new Error('Redis connection timed out'));
      }, this.options.timeoutMs ?? 3000);

      const onConnectError = (error: Error) => {
        clearTimeout(connectTimeout);
        this.connecting = null;
        reject(error);
      };

      socket.once('error', onConnectError);

      const onReady = () => {
        clearTimeout(connectTimeout);
        socket.removeListener('error', onConnectError);
        this.attach(socket);

        if (!this.options.password) {
          this.connecting = null;
          resolve(socket);
          return;
        }

        // AUTH must be the first command on the freshly-opened connection -
        // send it directly (bypassing the normal pending-queue write in
        // command()) so it lands before anything else, then let the reply
        // for it flow through the same parser/queue as every other reply.
        this.pending.push({
          resolve: () => {
            this.connecting = null;
            resolve(socket);
          },
          reject: (error) => {
            this.connecting = null;
            reject(error);
          },
          timeout: setTimeout(() => {
            socket.destroy(new Error('Redis AUTH timed out'));
          }, this.options.timeoutMs ?? 3000),
        });
        socket.write(this.encode(['AUTH', this.options.password as string]));
      };

      if (this.options.tls) {
        (socket as TLSSocket).once('secureConnect', onReady);
      } else {
        socket.connect(this.options.port, this.options.host, onReady);
      }
    });
  }

  private attach(socket: Socket | TLSSocket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.parseOffset = 0;

    socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.drain();
    });

    const onClose = (error?: Error) => {
      if (this.socket === socket) {
        this.socket = null;
      }
      this.failPending(error ?? new Error('Redis connection closed'));
    };

    socket.on('error', onClose);
    socket.on('close', () => onClose());
  }

  // Parses as many complete replies as the buffer currently holds and
  // resolves the corresponding pending command for each, in order.
  private drain() {
    while (this.pending.length > 0) {
      let parsed: ParsedResp | null;

      try {
        parsed = this.parse(this.buffer, this.parseOffset);
      } catch (error) {
        const next = this.pending.shift();
        if (next) {
          clearTimeout(next.timeout);
          next.reject(error as Error);
        }
        continue;
      }

      if (!parsed) {
        return;
      }

      this.parseOffset = parsed.nextOffset;
      const next = this.pending.shift() as PendingCommand;
      clearTimeout(next.timeout);
      next.resolve(parsed.value);
    }

    // Nothing left waiting on a reply - drop already-consumed bytes so the
    // buffer doesn't grow unboundedly on a long-lived connection.
    if (this.parseOffset > 0) {
      this.buffer = this.buffer.subarray(this.parseOffset);
      this.parseOffset = 0;
    }
  }

  private failPending(error: Error) {
    const failed = this.pending.splice(0, this.pending.length);
    for (const command of failed) {
      clearTimeout(command.timeout);
      command.reject(error);
    }
    this.buffer = Buffer.alloc(0);
    this.parseOffset = 0;
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
