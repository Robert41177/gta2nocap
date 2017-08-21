function convertUint8ArrayToBinaryString(u8Array) {
	var i, len = u8Array.length, b_str = "";
	for (i=0; i<len; i++) {
		b_str += String.fromCharCode(u8Array[i]);
	}
	return b_str;
}

export
class StructReader {
  constructor(struct) {
    this.functions = Object.keys(struct).reduce((arr, key) => {
      const value = struct[key];
      let fn;
      let args = [];

      switch (true) {
        case value instanceof Array:
          fn = `read${value[0]}`
          args.push(value[1]);
          break;
        case typeof value === 'string':
          fn = `read${value}`
          break;
        default:
          throw 'Unknown value';
          break;
      }

      arr.push({ key, fn, args });

      return arr;
    }, []);
  }

  read(buffer) {
    return this.functions.reduce((obj, { key, fn, args }) => {
      const fun = buffer[fn];
      if (!fun) {
        console.log(this.functions);
        throw `Invalid function: ${fn}`;
      }
      obj[key] = buffer[fn].apply(buffer, args)
      return obj;
    }, {});
  };
}

export
function packIntLE(array) {
  return packIntBE(array.reverse());
}

export
function packIntBE(array) {
  return array.reduce((acc, x) => (acc << 8) + x, 0) >>> 0;
}

function formatHex(array, length = 1) {
  return Array.prototype.map.call(array, (i) => i.toString(16).padStart(length * 2, '0')).join(' ');
}

function newTypedArray(numBytes, length) {
  const len = Math.floor(length / numBytes);

  switch (numBytes) {
    case 1:
      return new Uint8Array(len);
    case 2:
      return new Uint16Array(len);
    case 4:
      return new Uint32Array(len);
    default:
      throw `Can't build array with ${numBytes} bytes per element`;
  }
}

const _data = Symbol();
const _pos = Symbol();

export default class BinaryByffer {
  constructor(data) {
    this[_data] = data;
    this[_pos] = 0;
  }

  get length() {
    return this[_data].length;
  }

  get pos() {
    return this[_pos];
  }

  set pos(pos) {
    this[_pos] = pos;
  }

  read8() { return this._readIntLE(1); }
  read16() { return this._readIntLE(2); }
  read32() { return this._readIntLE(4); }

  read8LE() { return this._readIntLE(1); }
  read16LE() { return this._readIntLE(2); }
  read32LE() { return this._readIntLE(4); }

  read8BE() { return this._readIntBE(1); }
  read16BE() { return this._readIntBE(2); }
  read32BE() { return this._readIntBE(4); }

  read8arrayLE(len) { return this.readArrayLE(1, len); }
  read16arrayLE(len) { return this.readArrayLE(2, len); }
  read32arrayLE(len) { return this.readArrayLE(4, len); }

  readStructs(count, struct) {
    const structReader = new StructReader(struct);
    return Array.from(({ length: count }), () => this.readStruct(structReader));
  }

  readStruct(struct) {
    if (struct instanceof StructReader) {
      return struct.read(this);
    }

    return this.readStruct(new StructReader(struct));
  }

  read8arrayBE(len) { return this.readArrayBE(1, len); }
  read16arrayBE(len) { return this.readArrayBE(2, len); }
  read32arrayBE(len) { return this.readArrayBE(4, len); }

  readString(len) { return this._readString(len); }

  readArrayLE(bytesPerElement, len) {
    return this.readArray(bytesPerElement, len, packIntLE);
  }

  readArrayBE(bytesPerElement, len) {
    return this.readArray(bytesPerElement, len, packIntBE);
  }

  readArray(bytesPerElement, len, packFn = packIntLE) {
    const bytes = this._readBytes(len);

    if (bytesPerElement === 1) {
      return bytes;
    }

    const result = newTypedArray(bytesPerElement, len);

    for (let i = 0; i < result.length; i++) {
      const x = i * bytesPerElement;
      result[i] = packFn(bytes.slice(x, x + bytesPerElement));
    }

    return result;
  }

  _readIntLE(length) {
    return packIntLE(this._readBytes(length));
  }

  _readIntBE(length) {
    return packIntBE(this._readBytes(length));
  }

  _readString(length) {
    return convertUint8ArrayToBinaryString(this._readBytes(length));
  }

  _peekBytes(length) {
    return this[_data].slice(this[_pos], this[_pos] + length);
  }

  skip(length) {
    this[_pos] += length;
  }

  eof() {
    return this[_pos] >= this.length;
  }

  _readBytes(length) {
    const pos = this.pos;
    const bytes = this._peekBytes(length);
    this.skip(length);
    return bytes;
  }

  inspect(length = 16) {
    return `[${this.constructor.name} pos=${this.pos} length=${this.length} next=${formatHex(this._peekBytes(length), 1)}]`;
  }
}
