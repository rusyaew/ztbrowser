import { concatBytes } from './bytes.mjs';
import { AttestationError } from './errors.mjs';

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

export function decodeCbor(bytes) {
  try {
    return readCborValue(bytes, 0);
  } catch (error) {
    if (error instanceof AttestationError) {
      throw error;
    }

    throw new AttestationError('invalid_doc', error instanceof Error ? error.message : 'Invalid CBOR');
  }
}

export function encodeCborValue(value) {
  if (Array.isArray(value)) {
    return concatBytes(encodeCborHead(4, value.length), ...value.map((item) => encodeCborValue(item)));
  }

  if (value instanceof Uint8Array) {
    return concatBytes(encodeCborHead(2, value.length), value);
  }

  if (typeof value === 'string') {
    const encoded = textEncoder.encode(value);
    return concatBytes(encodeCborHead(3, encoded.length), encoded);
  }

  throw new AttestationError('invalid_doc', `Unsupported CBOR encoding type: ${typeof value}`);
}

function readCborValue(bytes, offset) {
  if (offset >= bytes.length) {
    throw new AttestationError('invalid_doc', 'Unexpected end of CBOR input');
  }

  const initial = bytes[offset];
  const majorType = initial >> 5;
  const additionalInfo = initial & 0x1f;
  const lengthInfo = readCborLength(bytes, offset + 1, additionalInfo);
  const nextOffset = lengthInfo.nextOffset;

  switch (majorType) {
    case 0:
      return { value: lengthInfo.value, offset: nextOffset };
    case 1:
      return { value: negateCborInteger(lengthInfo.value), offset: nextOffset };
    case 2: {
      const length = toSafeCborLength(lengthInfo.value);
      const endOffset = nextOffset + length;
      if (endOffset > bytes.length) {
        throw new AttestationError('invalid_doc', 'CBOR byte string exceeds input length');
      }
      return { value: bytes.subarray(nextOffset, endOffset), offset: endOffset };
    }
    case 3: {
      const length = toSafeCborLength(lengthInfo.value);
      const endOffset = nextOffset + length;
      if (endOffset > bytes.length) {
        throw new AttestationError('invalid_doc', 'CBOR text string exceeds input length');
      }
      return { value: textDecoder.decode(bytes.subarray(nextOffset, endOffset)), offset: endOffset };
    }
    case 4: {
      const length = toSafeCborLength(lengthInfo.value);
      const items = [];
      let cursor = nextOffset;
      for (let index = 0; index < length; index += 1) {
        const decoded = readCborValue(bytes, cursor);
        items.push(decoded.value);
        cursor = decoded.offset;
      }
      return { value: items, offset: cursor };
    }
    case 5: {
      const length = toSafeCborLength(lengthInfo.value);
      const map = new Map();
      let cursor = nextOffset;
      for (let index = 0; index < length; index += 1) {
        const key = readCborValue(bytes, cursor);
        const value = readCborValue(bytes, key.offset);
        map.set(key.value, value.value);
        cursor = value.offset;
      }
      return { value: map, offset: cursor };
    }
    case 6: {
      const tagged = readCborValue(bytes, nextOffset);
      return { value: tagged.value, offset: tagged.offset };
    }
    case 7:
      return readCborSimpleValue(bytes, additionalInfo, nextOffset);
    default:
      throw new AttestationError('invalid_doc', `Unsupported CBOR major type: ${majorType}`);
  }
}

function readCborLength(bytes, offset, additionalInfo) {
  if (additionalInfo < 24) {
    return { value: additionalInfo, nextOffset: offset };
  }

  if (additionalInfo === 24) {
    return { value: bytes[offset], nextOffset: offset + 1 };
  }

  if (additionalInfo === 25) {
    return {
      value: readUint(bytes, offset, 2),
      nextOffset: offset + 2
    };
  }

  if (additionalInfo === 26) {
    return {
      value: readUint(bytes, offset, 4),
      nextOffset: offset + 4
    };
  }

  if (additionalInfo === 27) {
    return {
      value: readUint64(bytes, offset),
      nextOffset: offset + 8
    };
  }

  throw new AttestationError('invalid_doc', 'Indefinite-length CBOR values are not supported');
}

function readCborSimpleValue(bytes, additionalInfo, offset) {
  if (additionalInfo === 20) {
    return { value: false, offset };
  }
  if (additionalInfo === 21) {
    return { value: true, offset };
  }
  if (additionalInfo === 22) {
    return { value: null, offset };
  }
  if (additionalInfo === 23) {
    return { value: undefined, offset };
  }
  if (additionalInfo === 26) {
    const buffer = bytes.buffer.slice(bytes.byteOffset + offset, bytes.byteOffset + offset + 4);
    return { value: new DataView(buffer).getFloat32(0, false), offset: offset + 4 };
  }
  if (additionalInfo === 27) {
    const buffer = bytes.buffer.slice(bytes.byteOffset + offset, bytes.byteOffset + offset + 8);
    return { value: new DataView(buffer).getFloat64(0, false), offset: offset + 8 };
  }

  throw new AttestationError('invalid_doc', `Unsupported CBOR simple value: ${additionalInfo}`);
}

function negateCborInteger(value) {
  if (typeof value === 'bigint') {
    return -1n - value;
  }
  return -1 - value;
}

function toSafeCborLength(value) {
  if (typeof value === 'bigint') {
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new AttestationError('invalid_doc', 'CBOR length exceeds safe integer range');
    }
    return Number(value);
  }

  return value;
}

function readUint(bytes, offset, length) {
  if (offset + length > bytes.length) {
    throw new AttestationError('invalid_doc', 'Unexpected end of CBOR input');
  }

  let value = 0;
  for (let index = 0; index < length; index += 1) {
    value = (value * 256) + bytes[offset + index];
  }
  return value;
}

function readUint64(bytes, offset) {
  if (offset + 8 > bytes.length) {
    throw new AttestationError('invalid_doc', 'Unexpected end of CBOR input');
  }

  let value = 0n;
  for (let index = 0; index < 8; index += 1) {
    value = (value << 8n) | BigInt(bytes[offset + index]);
  }
  if (value <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(value);
  }
  return value;
}

function encodeCborHead(majorType, value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new AttestationError('invalid_doc', 'CBOR length must be a non-negative integer');
  }

  if (value < 24) {
    return Uint8Array.of((majorType << 5) | value);
  }

  if (value < 0x100) {
    return Uint8Array.of((majorType << 5) | 24, value);
  }

  if (value < 0x10000) {
    return Uint8Array.of((majorType << 5) | 25, (value >> 8) & 0xff, value & 0xff);
  }

  if (value < 0x100000000) {
    return Uint8Array.of(
      (majorType << 5) | 26,
      (value >>> 24) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 8) & 0xff,
      value & 0xff
    );
  }

  throw new AttestationError('invalid_doc', 'CBOR lengths above 32 bits are not supported');
}
