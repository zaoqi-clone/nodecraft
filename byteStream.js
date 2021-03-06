const uuidParse = require("uuid-parse");
const Item = require("./player/item.js");

class ByteStream {
  constructor(buffer) {
    this.buffer = buffer
    this.i = 0
  }

  readByte() {
    if(this.empty()){
      throw new Error("Buffer is empty")
    }
    var result = this.buffer[this.i]
    this.i++
    return result
  }

  writeByte(data) {
    if(this.empty()){
      throw new Error("Buffer too small")
    }
    this.buffer[this.i] = data
    this.i++
  }

  readVarIntAndSize() {
    var numRead = 0;
    var result = 0;
    do {
        var read = this.readByte();
        var value = (read & 0b01111111);
        result |= (value << (7 * numRead));

        numRead++;
        if (numRead > 5) {
            throw new Error("VarInt is too big");
        }
    } while ((read & 0b10000000) != 0);
    return {
      result: result,
      size: numRead
    }
  }

  readVarInt() {
    return this.readVarIntAndSize().result;
  }

  writeVarInt(value) {
    do {
        var temp = value & 0b01111111;
        value >>>= 7;
        if (value != 0) {
            temp |= 0b10000000;
        }
        this.writeByte(temp);
    } while (value != 0);
  }

  amendVarInt(f) {
    var value = this.readVarIntAndSize()
    this.i -= value.size
    this.writeVarInt(f(value.result))
  }

  writeBlocks(values, blockBits) {
    if(values.length % 64 != 0){
      throw new Error(`Size of value array must be divisible by 64`)
    }
    var nextByte = 0
    var bitsRemaining = 8
    for(var i = 0; i < values.length; i++) {
      var v = values[i]
      for(var j = blockBits-1; j >= 0; j--) {
        nextByte <<= 1
        bitsRemaining--
        if(v >= (1 << j)){
          nextByte++
          v -= (1 << j)
        }
        if(bitsRemaining == 0){
          this.writeByte(nextByte)
          nextByte = 0
          bitsRemaining = 8
        }
      }
    }
  }

  readInt() {
    var value = this.buffer.readInt32BE(this.i)
    this.i += 4
    return value
  }

  writeInt(val) {
    this.buffer.writeInt32BE(val, this.i)
    this.i += 4
  }

  readUuid(uuid) {
    var uuidBuffer = Buffer.alloc(16)
    this.buffer.copy(uuidBuffer, 0, this.i, this.i + 16)
    return uuidParse.unparse(uuidBuffer)
  }

  writeUuid(uuid) {
    Buffer.from(uuidParse.parse(uuid)).copy(this.buffer, this.i)
    this.i += 16
  }

  readFloat() {
    var value = this.buffer.readFloatBE(this.i)
    this.i += 4
    return value
  }

  writeFloat(val) {
    this.buffer.writeFloatBE(val, this.i)
    this.i += 4
  }

  readShort() {
    var value = this.buffer.readInt16BE(this.i)
    this.i += 2
    return value
  }

  readDouble() {
    var value = this.buffer.readDoubleBE(this.i)
    this.i += 8
    return value
  }

  writeDouble(val) {
    this.buffer.writeDoubleBE(val, this.i)
    this.i += 8
  }

  amendDouble(f) {
    var d = this.readDouble()
    this.i -= 8
    this.writeDouble(f(d))
  }

  readByteArray() {
    var result = []
    while(!this.empty()){
      result.push(this.readByte());
    }
    return result
  }

  readString() {
    var result = []
    var len = this.readByte()
    for(var i = 0; i < len; i++){
      result.push(this.readByte())
    }
    return Buffer.from(result).toString()
  }

  readPosition() {
    var x, y, z
    var first = this.buffer.slice(this.i).readInt32BE()
    var second = this.buffer.slice(this.i+4).readInt32BE()
    x = first >> 6
    y = ((first & 0x3F) << 3) | (second >>> 26)
    z = second & 0x03FFFFFF
    this.i += 8
    return {
      x: x,
      y: y,
      z: z
    }
  }

  writePosition(position) {
    var value = position.x << 6
    value += (position.y & 0xFC) >> 6
    this.buffer.writeInt32BE(value, this.i)
    this.i += 4
    var value = (position.y & 0x3F) << 26
    value += position.z
    this.buffer.writeInt32BE(value, this.i)
    this.i += 4
  }

  readItem() {
    var present = this.readByte()
    if(present){
      var itemID = this.readVarInt()
      var itemCount = this.readVarInt()
      return new Item(present, itemID, itemCount)
    } else {
      return new Item(present)
    }
  }

  tail(upTo) {
    if(this.empty()){
      return Buffer.alloc(0)
    }
    var result = this.buffer.slice(this.i, upTo)
    this.i = upTo
    return result
  }

  empty() {
    return this.i >= this.buffer.length
  }
}

module.exports = ByteStream
